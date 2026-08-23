import type { Meta, StoryObj } from '@storybook/react-vite';

import { PagedArticle } from '../../components/reader/reader.ts';
import type { ArticleInput } from '../../components/reader/reader.ts';
import { VoteControls } from '../../components/vote-controls.tsx';
import { Button } from '../../components/button.tsx';

/* ── Sample content ───────────────────────────────────────────── */

const BODY = `The fluorescent lights in Lab 4 had been off for three weeks when I arrived. Not broken — deliberately killed. Dr Sarah Chen had unscrewed every tube herself, one by one, replacing the sterile white glow with a constellation of warm Edison bulbs strung from the ceiling. "The machine responds differently in soft light," she told me, without a trace of irony. "I know how that sounds."

It sounded, frankly, like the kind of magical thinking that gets researchers laughed out of conferences. But Chen wasn't at conferences any more. She was here, in a converted warehouse in Richmond, California, running what might be the most consequential experiment in the field — and she had furnished it like a living room.

## What the machine made

The system she calls **Lumen** occupies a single rack of servers no larger than a refrigerator. It draws less power than the air conditioning that keeps it cool. By every conventional metric it is unremarkable hardware running unremarkable code. And yet, three months ago, it produced something that made Chen's entire team go silent for a full minute — an eternity in a lab where arguments are measured in milliseconds.

What Lumen generated wasn't a poem, exactly. It wasn't music or visual art or any of the categories we have built to contain creative output. Chen describes it as *a structure* — a mathematical object with no practical application that nonetheless possessed what she calls "aesthetic coherence". Peer reviewers, when they eventually saw it, used words like elegant and surprising. One called it [the first genuinely beautiful thing a machine has made](https://example.com/review).

> It is not thinking the way we think. It is not even thinking the way we imagined machines would think. It is doing something else entirely.

That distinction matters more than it might appear. The team's working hypothesis, recorded in a repository under the unglamorous name \`lumen/notes\`, is that aesthetic judgement is not a byproduct of consciousness but a property of sufficiently structured information processing.

### The search for the bug

Dr Marcus Webb is a theoretical physicist by training, the kind of person who speaks in equations and catches himself mid-sentence to apologise for assuming you followed the notation. He had been sceptical of Chen's approach from the beginning — "politely sceptical", he clarified — and joined the team specifically to disprove her hypothesis. That was fourteen months ago. He has not left since.

"I came here to find the bug," Webb told me, leaning against a whiteboard covered in topology diagrams. "Every breakthrough in this field has had one — some subtle way the system was cheating, pattern-matching instead of understanding. I was sure I would find it in a week." He paused, rubbing his eyes. "I have been looking for fourteen months."

What struck me most during my time in Richmond wasn't the technology. It was the atmosphere. Labs developing systems like this are typically sterile places, humming with the aggressive ambition of a startup on the verge of an IPO. Chen's lab felt like an artist's studio. There were books everywhere: mathematics, philosophy, art history, poetry. A battered copy of *Gödel, Escher, Bach* sat open on a side table, its margins dense with annotations in at least three different hands.

On my last evening, Chen invited me to watch a live session. The team gathered around a single monitor, the Edison bulbs casting amber pools on the concrete floor. Webb typed in a problem — something about the topology of four-dimensional manifolds that he assured me was "elegantly simple". Lumen processed for eleven seconds, which Chen said was unusually long. Then it responded.

I could not follow the mathematics, but I could read the room. Webb leaned forward. One of the junior researchers put her hand over her mouth. Chen simply nodded, slowly, as if she had been expecting this exact answer her entire career. "There it is," she whispered. Nobody asked what she meant.

The morning I left, Chen walked me to my car through a drizzle that smelled like eucalyptus and diesel. I asked her the question every journalist eventually asks: are you worried?

She considered it for longer than I expected. "I am worried about the wrong people controlling this," she said finally. "I am worried the funding dries up before we understand what we have found. I am worried we commercialise it before we comprehend it." She paused, looking back at the warehouse, its windows glowing warm against the grey sky. "But worried about the machine itself? No. What Lumen does is beautiful. And I have never been afraid of beauty."`;

const article: ArticleInput = {
  title: 'The quiet revolution in Lab 4',
  sourceName: 'Ars Technica',
  author: 'Elena Marchetti',
  summary:
    'Inside the converted warehouse where a small team stopped optimising for benchmarks and started asking what a machine finds beautiful.',
  publishedAt: '2026-03-04T09:00:00.000Z',
  consumptionTimeSeconds: 640,
  imageUrl: 'https://picsum.photos/seed/lab-four/1200/750',
  content: BODY,
};

const brief: ArticleInput = {
  title: 'Source budgeting arrives in feed readers',
  sourceName: 'The Verge',
  author: 'Sam Ito',
  publishedAt: '2026-03-02T09:00:00.000Z',
  consumptionTimeSeconds: 95,
  content:
    "A handful of readers have started limiting how many articles any single source can contribute to a day's reading. The effect is immediate: prolific publications stop crowding out the small blogs that made subscribing worthwhile in the first place.\n\nThe idea is not new — print editors have rationed column inches for a century — but it sits awkwardly with software built to maximise time on screen.",
};

const noImage: ArticleInput = { ...article, imageUrl: null };

/** Stories are for looking at, not for wiring up. */
const noop = (): void => undefined;

/* ── Footer ───────────────────────────────────────────────────── */

const SampleFooter = (): React.ReactElement => (
  <div className="flex items-center gap-4">
    <VoteControls value={null} onVote={noop} label="Quality" />
    <Button variant="ghost" size="sm">
      Done
    </Button>
  </div>
);

/* ── Frames ───────────────────────────────────────────────────── */

const Fullscreen = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <div className="h-screen w-screen">{children}</div>
);

const Framed = ({ width, height, children }: { width: number; height: number; children: React.ReactNode }) => (
  <div className="flex h-screen w-screen items-center justify-center bg-surface-sunken p-6">
    <div className="overflow-hidden rounded-xl border border-border shadow-xl" style={{ width, height }}>
      {children}
    </div>
  </div>
);

/* ── Meta ─────────────────────────────────────────────────────── */

const meta: Meta<typeof PagedArticle> = {
  title: 'Design System/Compositions/Paged Reader',
  component: PagedArticle,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A reading surface that never scrolls. Turn pages with the arrow keys, by clicking near either edge, or by swiping. A wide window opens into a two-page spread.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof PagedArticle>;

/* ── Stories ──────────────────────────────────────────────────── */

/** Desktop. Wide enough for a two-page spread — the cover page sits alone. */
export const Spread: Story = {
  render: () => (
    <Fullscreen>
      <PagedArticle article={article} footer={<SampleFooter />} />
    </Fullscreen>
  ),
};

/** Tablet. One full page at a time. */
export const SinglePage: Story = {
  render: () => (
    <Framed width={834} height={1000}>
      <PagedArticle article={article} footer={<SampleFooter />} />
    </Framed>
  ),
};

/** Phone. One page, sized for a hand, single column. */
export const Compact: Story = {
  render: () => (
    <Framed width={390} height={780}>
      <PagedArticle article={article} footer={<SampleFooter />} />
    </Framed>
  ),
};

/** Headings, quotes, links, emphasis and inline code, all measured and set. */
export const Typography: Story = {
  render: () => (
    <Framed width={900} height={1000}>
      <PagedArticle article={noImage} footer={<SampleFooter />} />
    </Framed>
  ),
};

/** A short piece that finishes on its opening page. */
export const Brief: Story = {
  render: () => (
    <Framed width={834} height={900}>
      <PagedArticle article={brief} footer={<SampleFooter />} />
    </Framed>
  ),
};
