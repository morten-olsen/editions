import { z } from 'zod/v4';

import { EditionConfigNotFoundError, EditionsService } from '../editions/editions.ts';
import type { EditionConfig, EditionConfigFocus, EditionPreview } from '../editions/editions.ts';
import { FocusesService } from '../focuses/focuses.ts';

import { LIMITS, capList, clamp, truncate } from './mcp.budget.ts';
import { defineTool, optionalIdSchema, readinessFor, resolveOptionalId } from './mcp.tools.ts';
import type { McpTool, ToolContext } from './mcp.tools.ts';

// --- Shared schema fragments ---

const editionFocusSchema = z.object({
  focusId: z.string(),
  position: z.number().int().min(0).describe('Section order within the edition, ascending.'),
  budgetType: z
    .enum(['count', 'time'])
    .describe('"count" budgets a number of articles; "time" budgets reading minutes.'),
  budgetValue: z.number().min(1).describe('Articles when budgetType is "count", minutes when "time".'),
  lookbackHours: z.number().int().min(1).nullable().default(null).describe('Overrides the edition lookback.'),
  weight: z.number().min(0).max(5).default(1),
});

// --- Output shaping ---

const toConfigSummary = (config: EditionConfig): Record<string, unknown> => ({
  id: config.id,
  name: config.name,
  schedule: config.schedule,
  lookbackHours: config.lookbackHours,
  excludePriorEditions: config.excludePriorEditions,
  enabled: config.enabled,
  focuses: config.focuses.map((f) => ({
    focusId: f.focusId,
    focusName: f.focusName,
    position: f.position,
    budgetType: f.budgetType,
    budgetValue: f.budgetValue,
    lookbackHours: f.lookbackHours,
    weight: f.weight,
  })),
});

// --- Shortfall diagnostics ---

type SectionDiagnostic = {
  focusId: string;
  focusName: string;
  budgetType: string;
  budgetValue: number;
  budgetUsed: number;
  articles: number;
  readingMinutes: number;
  /** Set only when the section could not fill its budget. */
  shortfall: { missing: number; candidatePoolInWindow: number; likelyCause: string } | null;
};

/**
 * Explains why a section came up short.
 *
 * A thin edition is the common failure and the counts alone do not say why —
 * the focus might match nothing at all, or match plenty but nothing recent
 * enough for the lookback window. Comparing the section against the focus's
 * total match count inside the same window separates those two cases, which are
 * fixed in opposite ways (loosen the focus vs widen the lookback).
 */
const diagnoseSections = async ({
  ctx,
  config,
  preview,
}: {
  ctx: ToolContext;
  config: EditionConfig;
  preview: EditionPreview;
}): Promise<SectionDiagnostic[]> => {
  const focuses = ctx.services.get(FocusesService);
  const sectionsByFocus = new Map(preview.sections.map((s) => [s.focusId, s]));

  return Promise.all(
    [...config.focuses]
      .sort((a, b) => a.position - b.position)
      .map(async (focusConfig): Promise<SectionDiagnostic> => {
        const section = sectionsByFocus.get(focusConfig.focusId);
        const articles = section?.articles ?? [];
        const readingSeconds = articles.reduce((sum, a) => sum + (a.consumptionTimeSeconds ?? 0), 0);
        const readingMinutes = Math.ceil(readingSeconds / 60);
        const budgetUsed = focusConfig.budgetType === 'count' ? articles.length : readingMinutes;
        const missing = focusConfig.budgetValue - budgetUsed;

        const base: Omit<SectionDiagnostic, 'shortfall'> = {
          focusId: focusConfig.focusId,
          focusName: focusConfig.focusName,
          budgetType: focusConfig.budgetType,
          budgetValue: focusConfig.budgetValue,
          budgetUsed,
          articles: articles.length,
          readingMinutes,
        };

        if (missing <= 0) {
          return { ...base, shortfall: null };
        }

        const lookbackHours = focusConfig.lookbackHours ?? config.lookbackHours;
        const windowStart = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
        const tuning = await focuses.tuning(ctx.userId, focusConfig.focusId, {}, { sampleSize: 1, from: windowStart });

        return {
          ...base,
          shortfall: {
            missing,
            candidatePoolInWindow: tuning.matchCount,
            likelyCause:
              tuning.matchCount === 0
                ? `The focus matched nothing published in the last ${lookbackHours}h. Lower its minConfidence, add sources, or widen lookbackHours.`
                : tuning.matchCount <= articles.length
                  ? `Only ${tuning.matchCount} article(s) matched in the last ${lookbackHours}h and all were used. Widen lookbackHours or add sources.`
                  : `${tuning.matchCount} matched in the window but only ${articles.length} were selected — source budgeting or excludePriorEditions is holding the rest back.`,
          },
        };
      }),
  );
};

// --- save_edition_config ---

const saveEditionConfig = defineTool({
  name: 'save_edition_config',
  title: 'Create or update an edition config',
  description: [
    'Create an edition config (omit editionConfigId) or update one (pass it). An edition config is the',
    'recipe for a recurring issue: which focuses appear, in what order, and how much room each gets.',
    '',
    'Budgets are what keep an edition finite. Give each focus either a count of articles or a number of',
    'reading minutes. lookbackHours decides how far back articles may be drawn from — match it to the',
    'schedule, so a daily edition looks back roughly 24 hours.',
    '',
    'Passing focuses replaces the entire list. Call preview_edition afterwards to check the budgets are',
    'actually fillable before relying on the schedule.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    editionConfigId: optionalIdSchema(
      'The edition config to update. Omit it (or pass null) to CREATE a new one — do not pass an empty string.',
    ),
    name: z.string().min(1).optional(),
    icon: z.string().nullable().optional(),
    schedule: z.string().optional().describe('Cron expression, e.g. "0 7 * * *" for 07:00 daily.'),
    lookbackHours: z.number().int().min(1).optional(),
    excludePriorEditions: z
      .boolean()
      .optional()
      .describe('Skip articles already used in an earlier issue of this edition.'),
    enabled: z.boolean().optional(),
    focuses: z.array(editionFocusSchema).optional().describe('Replaces the full focus list.'),
  },
  handler: async (args, ctx) => {
    const editions = ctx.services.get(EditionsService);
    const { editionConfigId: rawConfigId, focuses, ...fields } = args;
    const editionConfigId = resolveOptionalId(rawConfigId);

    if (editionConfigId === undefined) {
      if (fields.name === undefined || fields.schedule === undefined) {
        throw new Error(
          'name and schedule are required when creating an edition config (omit editionConfigId to create)',
        );
      }
      const config = await editions.createConfig({
        userId: ctx.userId,
        name: fields.name,
        icon: fields.icon,
        schedule: fields.schedule,
        lookbackHours: fields.lookbackHours ?? 24,
        excludePriorEditions: fields.excludePriorEditions,
        enabled: fields.enabled,
        focuses: (focuses ?? []) as EditionConfigFocus[],
      });
      return { editionConfig: toConfigSummary(config), created: true };
    }

    try {
      const config = await editions.updateConfig(ctx.userId, editionConfigId, {
        ...fields,
        focuses: focuses as EditionConfigFocus[] | undefined,
      });
      return { editionConfig: toConfigSummary(config), created: false };
    } catch (err) {
      if (err instanceof EditionConfigNotFoundError) {
        // Make a wrong id self-correcting rather than a dead end.
        throw new Error(
          `${err.message}. To create a new edition config instead, call save_edition_config with no editionConfigId.`,
        );
      }
      throw err;
    }
  },
});

// --- preview_edition ---

const previewEdition = defineTool({
  name: 'preview_edition',
  title: 'Preview an edition without publishing it',
  description: [
    'Run edition generation without saving an issue. Returns each section with its article titles,',
    'reading time, and — critically — a shortfall diagnostic when a section could not fill its budget,',
    'explaining whether the cause is a too-strict focus, too narrow a lookback window, or source',
    'budgeting.',
    '',
    'Overrides are not saved, so trying a different lookback or focus mix costs nothing. Iterate here',
    'until every section fills, then call generate_edition. Check readiness: previews taken while',
    'state is "analysing" understate what the edition will contain.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    editionConfigId: z.string(),
    lookbackHours: z.number().int().min(1).optional().describe('Unsaved override to try.'),
    excludePriorEditions: z.boolean().optional(),
    focuses: z.array(editionFocusSchema).optional().describe('Unsaved focus/budget override to try.'),
    titlesPerSection: z.number().int().min(0).max(LIMITS.editionSectionSample.max).optional(),
  },
  handler: async (args, ctx) => {
    const { editionConfigId, titlesPerSection, ...overrides } = args;
    const editions = ctx.services.get(EditionsService);
    const saved = await editions.getConfig(ctx.userId, editionConfigId);

    const preview = await editions.previewGenerate(ctx.userId, editionConfigId, {
      lookbackHours: overrides.lookbackHours,
      excludePriorEditions: overrides.excludePriorEditions,
      focuses: overrides.focuses as EditionConfigFocus[] | undefined,
    });

    const effectiveConfig: EditionConfig = {
      ...saved,
      lookbackHours: overrides.lookbackHours ?? saved.lookbackHours,
      excludePriorEditions: overrides.excludePriorEditions ?? saved.excludePriorEditions,
      focuses: (overrides.focuses as EditionConfigFocus[] | undefined) ?? saved.focuses,
    };

    const diagnostics = await diagnoseSections({ ctx, config: effectiveConfig, preview });
    const take = titlesPerSection ?? clamp(undefined, LIMITS.editionSectionSample);
    const sectionsByFocus = new Map(preview.sections.map((s) => [s.focusId, s]));

    return {
      editionConfig: { id: saved.id, name: saved.name, schedule: saved.schedule },
      applied: {
        lookbackHours: effectiveConfig.lookbackHours,
        excludePriorEditions: effectiveConfig.excludePriorEditions,
        overridesApplied: Object.keys(overrides).length > 0,
      },
      totalArticles: preview.totalArticles,
      totalReadingMinutes: preview.totalReadingMinutes,
      sections: diagnostics.map((d) => ({
        ...d,
        titles: capList(
          (sectionsByFocus.get(d.focusId)?.articles ?? []).map((a) => ({
            title: truncate(a.title, LIMITS.titleChars),
            sourceName: a.sourceName,
            consumptionTimeSeconds: a.consumptionTimeSeconds,
          })),
          take,
        ),
      })),
      readiness: await readinessFor(ctx, { focusIds: effectiveConfig.focuses.map((f) => f.focusId) }),
    };
  },
});

// --- generate_edition ---

const generateEdition = defineTool({
  name: 'generate_edition',
  title: 'Generate an issue',
  description: [
    'Publish a real issue from an edition config, using the saved settings. This writes an issue the',
    'user will see, and articles it consumes may be excluded from later issues when',
    'excludePriorEditions is on — so preview_edition first and only generate once the sections fill.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    editionConfigId: z.string(),
    titlesPerSection: z.number().int().min(0).max(LIMITS.editionSectionSample.max).optional(),
  },
  handler: async ({ editionConfigId, titlesPerSection }, ctx) => {
    const editions = ctx.services.get(EditionsService);
    const edition = await editions.generate(ctx.userId, editionConfigId);
    const take = titlesPerSection ?? clamp(undefined, LIMITS.editionSectionSample);

    const byFocus = new Map<string, { focusName: string; titles: { title: string | null; sourceName: string }[] }>();
    for (const article of edition.articles) {
      const section = byFocus.get(article.focusId) ?? { focusName: article.focusName, titles: [] };
      section.titles.push({ title: truncate(article.title, LIMITS.titleChars), sourceName: article.sourceName });
      byFocus.set(article.focusId, section);
    }

    return {
      issue: {
        id: edition.id,
        title: edition.title,
        articleCount: edition.articleCount,
        totalReadingMinutes: edition.totalReadingMinutes,
        publishedAt: edition.publishedAt,
      },
      sections: [...byFocus.entries()].map(([focusId, section]) => ({
        focusId,
        focusName: section.focusName,
        titles: capList(section.titles, take),
      })),
    };
  },
});

// --- Exports ---

const editionTools: McpTool[] = [saveEditionConfig, previewEdition, generateEdition];

export { editionTools };
