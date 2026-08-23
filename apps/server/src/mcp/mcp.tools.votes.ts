import { z } from 'zod/v4';

import { FocusesService } from '../focuses/focuses.ts';
import { ArticleNotFoundForVoteError, VotesService } from '../votes/votes.ts';

import { LIMITS } from './mcp.budget.ts';
import { defineTool, optionalIdSchema, resolveOptionalId } from './mcp.tools.ts';
import type { McpTool } from './mcp.tools.ts';

// --- Types ---

type VoteAction =
  | 'voted'
  | 'replaced'
  | 'already_set'
  | 'skipped_existing'
  | 'cleared'
  | 'nothing_to_clear'
  | 'not_found';

type VoteResult = {
  articleId: string;
  action: VoteAction;
  value: 1 | -1 | null;
};

// --- vote_articles ---

const VOTE_VALUES = { up: 1, down: -1 } as const;

const voteArticles = defineTool({
  name: 'vote_articles',
  title: 'Vote articles up or down',
  description: [
    'Record up/down votes on articles, in bulk. Scoped to a focus when focusId is given, otherwise',
    'global. Use this to curate a focus: vote up the articles that genuinely belong and down the ones',
    'that do not.',
    '',
    'WHAT VOTES DO TODAY: they change article *ranking*, not focus membership. A voted-up article that',
    'sits below the focus threshold will not start appearing in the focus — only save_focus and',
    'preview_focus control membership. What votes do change is the order articles are picked in, which',
    'decides what actually fits inside an edition budget. So voting is how you improve which of the',
    'matching articles reach the reader, not which articles match.',
    '',
    'Vote signal ramps in as votes accumulate, so a handful of votes has a small effect and a couple of',
    'dozen a large one. Curating around 10-20 votes per focus is a reasonable target.',
    '',
    'Existing votes are left alone by default — the user may have voted deliberately, and their',
    'judgement outranks yours. Pass overwriteExisting only if the user asked you to redo their votes.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    focusId: optionalIdSchema(
      'Scope the votes to this focus. Omit it (or pass null) for a global vote affecting every feed.',
    ),
    votes: z
      .array(
        z.object({
          articleId: z.string(),
          value: z
            .enum(['up', 'down', 'clear'])
            .describe('"clear" removes an existing vote in this scope rather than recording one.'),
        }),
      )
      .min(1)
      .max(LIMITS.voteBatch)
      .describe(`Up to ${LIMITS.voteBatch} votes per call. Get article ids from preview_focus.`),
    overwriteExisting: z
      .boolean()
      .default(false)
      .describe('Replace votes that already exist in this scope. Off by default so user votes survive.'),
  },
  handler: async ({ focusId, votes, overwriteExisting }, ctx) => {
    const votesService = ctx.services.get(VotesService);
    // A blank id means "no focus scope", i.e. global — it can never name a focus.
    const scopeFocusId = resolveOptionalId(focusId) ?? null;

    // Ownership check on the focus before writing anything against it.
    if (scopeFocusId !== null) {
      await ctx.services.get(FocusesService).get(ctx.userId, scopeFocusId);
    }

    const existing = await votesService.getVotesByArticleIds(
      ctx.userId,
      votes.map((v) => v.articleId),
      scopeFocusId,
    );
    const currentOf = (articleId: string): 1 | -1 | null => {
      const pair = existing.get(articleId);
      return (scopeFocusId === null ? pair?.global : pair?.focus) ?? null;
    };

    const results: VoteResult[] = [];

    for (const { articleId, value } of votes) {
      const current = currentOf(articleId);

      if (value === 'clear') {
        if (current === null) {
          results.push({ articleId, action: 'nothing_to_clear', value: null });
          continue;
        }
        await votesService.remove(ctx.userId, articleId, scopeFocusId, null);
        results.push({ articleId, action: 'cleared', value: null });
        continue;
      }

      const desired = VOTE_VALUES[value];

      if (current === desired) {
        results.push({ articleId, action: 'already_set', value: desired });
        continue;
      }
      if (current !== null && !overwriteExisting) {
        results.push({ articleId, action: 'skipped_existing', value: current });
        continue;
      }

      try {
        await votesService.upsert({
          userId: ctx.userId,
          articleId,
          focusId: scopeFocusId,
          editionId: null,
          value: desired,
        });
        results.push({ articleId, action: current === null ? 'voted' : 'replaced', value: desired });
      } catch (err) {
        if (err instanceof ArticleNotFoundForVoteError) {
          // Unknown id, or an article belonging to someone else.
          results.push({ articleId, action: 'not_found', value: null });
          continue;
        }
        throw err;
      }
    }

    const tally = (action: VoteAction): number => results.filter((r) => r.action === action).length;

    return {
      scope: scopeFocusId === null ? 'global' : { focusId: scopeFocusId },
      results,
      summary: {
        recorded: tally('voted') + tally('replaced'),
        skippedExisting: tally('skipped_existing'),
        alreadySet: tally('already_set'),
        cleared: tally('cleared'),
        notFound: tally('not_found'),
      },
      // preview_focus lists by confidence, so it will look unchanged — the vote
      // effect shows up in the ranked selection an edition actually makes.
      nextStep:
        'Call preview_edition to see the effect: votes change the ranked order sections are filled ' +
        'from, so the selection shifts. preview_focus lists by confidence and will look unchanged. ' +
        'If the wrong articles are matching at all, fix the focus description or threshold instead.',
    };
  },
});

// --- Exports ---

const voteTools: McpTool[] = [voteArticles];

export type { VoteAction, VoteResult };
export { voteTools };
