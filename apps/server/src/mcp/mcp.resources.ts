/**
 * Guides exposed as MCP resources.
 *
 * These hold the "why" that would otherwise bloat tool descriptions — how
 * classification actually works, how budgets interact — which an agent needs
 * occasionally but not on every request. Kept deliberately short: a resource an
 * agent will not read is worse than no resource, because it still costs a
 * listing entry.
 */

type Guide = {
  uri: string;
  name: string;
  title: string;
  description: string;
  text: string;
};

const guides: Guide[] = [
  {
    uri: 'editions://guide/focuses',
    name: 'focuses',
    title: 'How focuses classify articles',
    description: 'How article-to-focus matching works and how to write a description that matches well.',
    text: `
# Focuses

A focus is a topic area described in natural language. Every article is scored against every focus,
producing a **confidence** between 0 and 1.

## How the score is produced

The focus's name and description are embedded into a vector. Each article is embedded the same way,
and the confidence is the cosine similarity between them. Some instances additionally run an NLI
classifier; where an NLI score exists it supersedes the similarity score.

The practical consequence: **matching is semantic, not keyword-based**. A description reading like
prose about the subject matches better than a list of keywords, because articles are prose. Write
two or three sentences describing the subject the way an article about it would read.

Good: "Space exploration and astronomy. Rocket launches, orbital missions, telescope discoveries,
planetary science, and the companies and agencies behind them."

Poor: "space, NASA, rockets, astronomy" — a bare keyword list embeds nothing like an article does.

Poor: "Find me articles about space" — instructions to a model, not a description of a subject.

## Narrow focuses beat threshold tuning

The single biggest determinant of match quality is how **concrete** a focus is — bigger than the
threshold, and bigger than the model. Measured against human labels, focuses naming specific things
reach 0.89–1.00 precision; broad category-style focuses cap out around 0.53–0.70 at *any* threshold.

| Works well | Struggles |
|---|---|
| Electric Vehicles, Russia & Ukraine, Cybersecurity & Privacy | Big Tech & Business, Policy & Regulation, Gaming & Entertainment |

The reason is that matching is similarity, not membership: every article in a technology feed is
somewhat "big tech business", so a broad focus has no clean boundary to find. If \`preview_focus\`
shows \`topMatches\` that are only loosely related and no threshold fixes it, **split the focus into
narrower ones** rather than continuing to tune. Two focuses at 0.9 precision beat one at 0.6.

## Thresholds

\`minConfidence\` is the bar an article must clear. Similarity scores cluster tightly, so small
changes matter and the usable band is narrow: with the default model the best per-focus thresholds
measured across three corpora ran from 0.37 to 0.57, averaging about 0.48. Treat ~0.45 as a starting
point rather than a meaning — it is a position in a narrow band, not "45% confident". Above roughly
0.6 almost nothing matches.

Because the optimum varies by ±0.1 between focuses, tune each one separately against
\`preview_focus\` instead of reusing a number that worked elsewhere.

Do not guess. Call \`preview_focus\` and read the \`confidenceHistogram\` to see where articles
actually fall, then read the \`nearMisses\` — the highest-confidence articles sitting just below your
threshold. If those look on-topic, lower it. If \`topMatches\` look off-topic, the description is the
problem, not the threshold.

Per-source overrides exist for the case where one source is consistently on-topic and another is
noisy: set a lower threshold on the reliable source rather than lowering it everywhere.

## Sources

A focus only draws from sources linked to it. Linking a source does not rescore anything — every
article is already scored against every focus — so adding and removing links is instant. Weights
multiply a source's articles during ranking, letting a preferred source surface first without
excluding the others.

## Curating with votes

\`vote_articles\` records up/down votes, scoped to a focus. Be precise about what this changes:

- It **does** change ranking. Score is a blend of confidence, vote signal and recency, and the vote
  term's weight ramps up as votes accumulate. Since an edition fills each section from the top of
  that ordering until the budget runs out, votes decide which of the matching articles actually
  reach the reader.
- It does **not** change membership. Voting up an article below the threshold will not bring it into
  the focus. Only \`minConfidence\`, the source links and the reading-time bounds do that.

So votes are the tool for "the right articles match, but the wrong ones surface first". If the wrong
articles are matching at all, fix the description or the threshold instead — voting cannot rescue a
focus whose boundary is wrong.

Vote signal also propagates: an unvoted article inherits a weighted signal from the most similar
voted articles. That is why a modest number of well-chosen votes goes a long way, and why voting
scattered borderline articles is worse than voting clear examples. Aim for 10–20 decisive votes per
focus, spread across the kinds of story you care about, rather than many marginal ones.

\`preview_focus\` returns the current \`vote\` and \`globalVote\` on every article it lists, plus
\`votedInSample\`, so you can see what is already curated before adding more. Existing votes are not
overwritten unless you ask — the user's own votes outrank yours.

One thing to expect: \`preview_focus\` lists articles by **confidence**, so its ordering does not
change when you vote. To see a vote take effect, call \`preview_edition\` — sections are filled from
the ranked order, which is where the vote signal applies.
`.trim(),
  },
  {
    uri: 'editions://guide/editions',
    name: 'editions',
    title: 'How editions are assembled',
    description: 'Budgets, lookback windows, source distribution and scheduling.',
    text: `
# Editions

An edition config is the recipe for a recurring issue. Generating it produces one issue.

## Budgets

Each focus in an edition gets a budget, which is what keeps an issue finite:

- \`budgetType: "count"\` — at most N articles.
- \`budgetType: "time"\` — at most N minutes of reading.

Reading-time budgets are usually the better choice, because they map to what the user actually has:
a commute, a coffee. A 20-minute morning edition split across three focuses might give 10 minutes to
the main focus and 5 each to the others.

## Lookback

\`lookbackHours\` bounds how far back articles may be drawn from. Match it to the schedule: roughly
24 hours for a daily edition, 168 for a weekly one. Too short and sections come up empty; too long
and the issue fills with stale news.

A focus can override the edition's lookback — useful when one topic is slow-moving and would
otherwise never have enough recent material.

## Source distribution

Within a focus, selection round-robins across that focus's sources rather than taking the top N
outright. Without this, one prolific feed would crowd out everything else. This is why a section can
come up short even when plenty of articles matched: the remaining candidates all came from sources
already represented.

## Repeats

\`excludePriorEditions\` skips articles already used in an earlier issue of the same edition. Leave
it on for a recurring edition. It does mean each issue draws from a shrinking pool, so a section
that fills today may not fill tomorrow — \`preview_edition\` reports this as a shortfall with the
cause.
`.trim(),
  },
  {
    uri: 'editions://guide/readiness',
    name: 'readiness',
    title: 'The analysis pipeline and readiness',
    description: 'What happens after a source is added, and why previews can be provisional.',
    text: `
# Readiness

## The pipeline

When a source is added or refreshed, its articles go through:

1. **Fetch** — pull and parse the feed, insert new articles.
2. **Extract** — fetch each article's full text and estimate reading time.
3. **Embed** — compute an embedding vector per article.
4. **Classify** — score every article against every focus.
5. **Mark analysed** — the article becomes usable.

Steps 2–4 run locally on models loaded in a worker. On a cold instance the first run downloads a
model of roughly 33MB before anything else happens, so a first \`add_sources\` can take minutes while
later ones take seconds.

## Why this is in your interface

Every tool returning analysed data includes a \`readiness\` block:

- \`state\` — \`"ready"\`, \`"analysing"\` or \`"stalled"\`.
- \`analysed\` / \`pending\` — articles through the pipeline versus still in it.
- \`pendingClassification\` — articles already analysed but not yet scored against a focus in scope.
  This is what a freshly created focus looks like while it reconciles.
- \`activeJobs\` — background work in flight. A source still being fetched has no articles yet, so
  this is the only signal that anything is happening.
- \`pendingSources\` — where the outstanding work is.

While \`state\` is \`"analysing"\`, every count is a lower bound. The failure mode this exists to
prevent is tuning a focus's threshold down to compensate for a corpus that was merely still loading,
then finding the focus far too permissive once analysis completes.

## Stalled is not analysing

Extraction fetches each article's page, and some never succeed — dead links, paywalls, scraper
blocks. Those articles stay unanalysed after their job finishes. Nothing retries them on its own.

That is \`state: "stalled"\`: \`pending > 0\` with \`activeJobs === 0\`. It is reported separately from
\`"analysing"\` because the right response is opposite. Waiting resolves \`"analysing"\`; waiting on
\`"stalled"\` can only burn your budget, so \`wait_until_ready\` returns from it immediately.

A stalled scope is usually fine to work with — a handful of unreachable links out of fifty articles
changes nothing about whether a focus is well tuned. Check \`pending\` against \`analysed\`: if it is a
small fraction, carry on. \`refresh_sources\` retries them.

## Waiting

\`add_sources\`, \`adopt_from_catalog\`, \`refresh_sources\` and \`save_focus\` wait for up to
\`waitSeconds\` before returning. That budget is capped because the transport returns a single
response with no way to report progress. When it runs out they return honestly with
\`state: "analysing"\`; call \`wait_until_ready\`, scoped to what you care about, to continue waiting.
`.trim(),
  },
];

const guideByUri = new Map(guides.map((guide) => [guide.uri, guide]));

export type { Guide };
export { guides, guideByUri };
