import { z } from 'zod/v4';

import { FocusNotFoundError, FocusesService } from '../focuses/focuses.ts';
import type { Focus, FocusSource, TuningArticle } from '../focuses/focuses.ts';
import { VotesService } from '../votes/votes.ts';

import { LIMITS, clamp, truncate } from './mcp.budget.ts';
import {
  defineTool,
  optionalIdSchema,
  readinessAdvice,
  readinessFor,
  resolveOptionalId,
  waitForReadiness,
  waitSecondsSchema,
} from './mcp.tools.ts';
import type { McpTool } from './mcp.tools.ts';

// --- Shared schema fragments ---

const focusSourceSchema = z.object({
  sourceId: z.string(),
  weight: z.number().min(0).max(5).default(1).describe('Multiplier on this source’s articles when ranking.'),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .default(null)
    .describe('Per-source threshold override. null inherits the focus threshold.'),
});

const minConfidenceSchema = z
  .number()
  .min(0)
  .max(1)
  .describe(
    'Confidence an article must reach to belong to this focus. Higher is stricter. ' +
      'Tune it against preview_focus rather than guessing — 0.3–0.5 suits most focuses.',
  );

// --- Output shaping ---

const toFocusSummary = (focus: Focus): Record<string, unknown> => ({
  id: focus.id,
  name: focus.name,
  description: focus.description,
  icon: focus.icon,
  minConfidence: focus.minConfidence,
  minConsumptionTimeSeconds: focus.minConsumptionTimeSeconds,
  maxConsumptionTimeSeconds: focus.maxConsumptionTimeSeconds,
  sources: focus.sources,
});

// --- save_focus ---

const saveFocus = defineTool({
  name: 'save_focus',
  title: 'Create or update a focus',
  description: [
    'Create a focus (omit focusId) or update one (pass focusId). A focus is a topic area described in',
    'natural language; articles are matched against that description by embedding similarity.',
    '',
    'The description is the single biggest lever on match quality. Write it as a few sentences',
    'describing the subject matter as an article about it would read — not as instructions, and not',
    'as a bare keyword list.',
    '',
    'COST: changing name or description invalidates every score for this focus and triggers a full',
    'reclassification, which is slow. Changing minConfidence, sources or the reading-time bounds only',
    're-filters existing scores and is effectively free — tune those with preview_focus first, and only',
    'rewrite the description if the near-misses show it is genuinely matching the wrong things.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    focusId: optionalIdSchema(
      'The focus to update. Omit it (or pass null) to CREATE a new focus — do not pass an empty string.',
    ),
    name: z.string().min(1).optional(),
    description: z.string().optional().describe('Natural-language description of the topic. See COST note.'),
    icon: z.string().nullable().optional(),
    minConfidence: minConfidenceSchema.optional(),
    minConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
    maxConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
    sources: z
      .array(focusSourceSchema)
      .optional()
      .describe('Replaces the full source list. Omit to leave source links untouched.'),
    waitSeconds: waitSecondsSchema,
  },
  handler: async (args, ctx) => {
    const focuses = ctx.services.get(FocusesService);
    const { focusId: rawFocusId, sources, waitSeconds, ...fields } = args;
    const focusId = resolveOptionalId(rawFocusId);

    let focus: Focus;
    let created: boolean;

    if (focusId === undefined) {
      if (fields.name === undefined) {
        throw new Error('name is required when creating a focus (omit focusId to create)');
      }
      focus = await focuses.create({
        userId: ctx.userId,
        name: fields.name,
        description: fields.description,
        icon: fields.icon,
        minConfidence: fields.minConfidence,
        minConsumptionTimeSeconds: fields.minConsumptionTimeSeconds,
        maxConsumptionTimeSeconds: fields.maxConsumptionTimeSeconds,
        sources: sources as FocusSource[] | undefined,
      });
      created = true;
    } else {
      try {
        focus = await focuses.update(ctx.userId, focusId, fields);
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          // Make a wrong id self-correcting rather than a dead end.
          throw new Error(`${err.message}. To create a new focus instead, call save_focus with no focusId.`);
        }
        throw err;
      }
      if (sources !== undefined) {
        focus = await focuses.setSources(ctx.userId, focusId, sources as FocusSource[]);
      }
      created = false;
    }

    const readiness = await waitForReadiness(ctx, { focusIds: [focus.id] }, waitSeconds);

    return {
      focus: toFocusSummary(focus),
      created,
      readiness,
      nextStep: readinessAdvice(readiness, 'Call preview_focus to check the match quality and tune minConfidence.'),
    };
  },
});

// --- preview_focus ---

const previewFocus = defineTool({
  name: 'preview_focus',
  title: 'Preview and tune a focus',
  description: [
    'Evaluate what a focus currently matches, optionally under unsaved overrides. This is the main',
    'tuning tool — use it in a loop before committing changes with save_focus.',
    '',
    'Returns the match count, a confidence histogram over every scored article, the top matches, and',
    'the NEAR-MISSES: the highest-confidence articles that fell just below the threshold. Read the',
    'near-misses to decide which way to move minConfidence. If they look on-topic, lower it. If the top',
    'matches look off-topic, raise it — or rewrite the description, which is the expensive fix.',
    '',
    'Overrides here are not saved, so trying a threshold costs nothing. Check the readiness block:',
    'while state is "analysing" these numbers are provisional and will change.',
    '',
    'Every listed article carries its current vote (focus-scoped and global), so this is also the',
    'surface to curate from: read the matches, then pass the article ids to vote_articles.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    focusId: z.string(),
    minConfidence: minConfidenceSchema.optional().describe('Unsaved override to try.'),
    minConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
    maxConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
    sources: z.array(focusSourceSchema).optional().describe('Unsaved source-selection override to try.'),
    from: z.iso.datetime().optional().describe('Only consider articles published at or after this ISO timestamp.'),
    to: z.iso.datetime().optional(),
    sampleSize: z.number().int().min(1).max(LIMITS.focusSample.max).optional(),
  },
  handler: async (args, ctx) => {
    const { focusId, from, to, sampleSize, ...overrides } = args;
    const focuses = ctx.services.get(FocusesService);
    const saved = await focuses.get(ctx.userId, focusId);

    const tuning = await focuses.tuning(ctx.userId, focusId, overrides, {
      sampleSize: clamp(sampleSize, LIMITS.focusSample),
      from,
      to,
    });

    // One batch lookup covering both sample lists, so the agent can see what it
    // has already voted on without a second tool call — this is the surface it
    // curates from.
    const listed = [...tuning.topMatches, ...tuning.nearMisses];
    const votes = await ctx.services.get(VotesService).getVotesByArticleIds(
      ctx.userId,
      listed.map((a) => a.id),
      focusId,
    );

    const withVotes = (article: TuningArticle): Record<string, unknown> => {
      const pair = votes.get(article.id);
      return {
        ...article,
        title: truncate(article.title, LIMITS.titleChars),
        confidence: Number(article.confidence.toFixed(3)),
        vote: pair?.focus ?? null,
        globalVote: pair?.global ?? null,
      };
    };

    const votedCount = listed.filter((a) => votes.get(a.id)?.focus != null).length;

    return {
      focus: { id: saved.id, name: saved.name, description: truncate(saved.description, LIMITS.summaryChars) },
      applied: {
        minConfidence: tuning.effectiveMinConfidence,
        minConsumptionTimeSeconds: overrides.minConsumptionTimeSeconds ?? saved.minConsumptionTimeSeconds,
        maxConsumptionTimeSeconds: overrides.maxConsumptionTimeSeconds ?? saved.maxConsumptionTimeSeconds,
        sourceCount: (overrides.sources ?? saved.sources).length,
        overridesApplied: Object.keys(overrides).length > 0,
      },
      matchCount: tuning.matchCount,
      scoredCount: tuning.scoredCount,
      excludedByReadingTime: tuning.excludedByReadingTime,
      confidenceHistogram: tuning.confidenceHistogram,
      sourceBreakdown: tuning.sourceBreakdown,
      topMatches: tuning.topMatches.map(withVotes),
      nearMisses: tuning.nearMisses.map(withVotes),
      // How much of what is shown has been curated already, so the agent knows
      // whether voting here would add anything.
      votedInSample: votedCount,
      readiness: await readinessFor(ctx, { focusIds: [focusId] }),
    };
  },
});

// --- Exports ---

const focusTools: McpTool[] = [saveFocus, previewFocus];

export { focusTools };
