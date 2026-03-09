import type { Meta, StoryObj } from "@storybook/react-vite";

const sizeSteps = [
  { name: "5xl", fontSize: "2.986rem", lineHeight: "3.25rem", letterSpacing: "-0.02em", sample: "The morning edition" },
  { name: "4xl", fontSize: "2.488rem", lineHeight: "2.75rem", letterSpacing: "-0.02em", sample: "A deliberate calm" },
  { name: "3xl", fontSize: "2.074rem", lineHeight: "2.5rem", letterSpacing: "-0.02em", sample: "Stories worth your time" },
  { name: "2xl", fontSize: "1.728rem", lineHeight: "2.25rem", letterSpacing: "-0.02em", sample: "Curated with intention" },
  { name: "xl", fontSize: "1.44rem", lineHeight: "2rem", letterSpacing: "0", sample: "Every edition has a natural end" },
  { name: "lg", fontSize: "1.2rem", lineHeight: "1.75rem", letterSpacing: "0", sample: "Reading should feel like settling into a favourite chair" },
  { name: "base", fontSize: "1rem", lineHeight: "1.625rem", letterSpacing: "0", sample: "The technology available today should let us do something meaningfully better than firehose timelines and algorithmic feeds." },
  { name: "sm", fontSize: "0.833rem", lineHeight: "1.25rem", letterSpacing: "0.015em", sample: "Source budgeting prevents any single feed from dominating. Small blogs get proportional representation alongside major publications." },
  { name: "xs", fontSize: "0.694rem", lineHeight: "1rem", letterSpacing: "0.04em", sample: "PUBLISHED 3 HOURS AGO  ·  6 MIN READ" },
] as const;

const TypeScale = (): React.ReactElement => (
  <div className="flex flex-col gap-8">
    {sizeSteps.map((step) => (
      <div key={step.name}>
        <div className="flex items-baseline gap-4 mb-2">
          <span style={{ fontSize: "0.694rem", fontFamily: "var(--font-mono)", color: "var(--color-ink-tertiary)", width: "2rem", textAlign: "right", flexShrink: 0 }}>
            {step.name}
          </span>
          <div className="h-px bg-border flex-1 self-center" />
        </div>
        <div style={{ paddingLeft: "3rem" }}>
          <div
            style={{
              fontSize: step.fontSize,
              lineHeight: step.lineHeight,
              letterSpacing: step.letterSpacing,
              color: "var(--color-ink)",
              maxWidth: "65ch",
            }}
          >
            {step.sample}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const TypeFamilies = (): React.ReactElement => (
  <div className="flex flex-col gap-12">
    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">
        Serif — for reading
      </div>
      <div className="font-serif text-3xl tracking-tight text-ink mb-4">
        Newsreader
      </div>
      <div className="font-serif text-base leading-relaxed text-ink-secondary max-w-prose">
        The long-form reading experience deserves a typeface designed for it.
        Serifs guide the eye along the line, reducing fatigue across paragraphs.
        Every article, every edition, every quiet moment of reading is set in
        this face. It carries warmth without nostalgia, authority without
        stiffness.
      </div>
      <div className="font-serif text-sm text-ink-tertiary mt-4 italic">
        "I am now done" is a first-class feature.
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">
        Sans-serif — for interface
      </div>
      <div className="font-sans text-3xl tracking-tight text-ink mb-4">Inter</div>
      <div className="font-sans text-base leading-relaxed text-ink-secondary max-w-prose">
        The interface layer is functional, not decorative. Inter is optimized
        for screen readability at small sizes — navigation, labels, metadata,
        controls. It stays out of the way so the content can speak. Clean,
        neutral, and quietly confident.
      </div>
      <div className="font-sans text-sm text-ink-tertiary mt-4">
        Sources · Focuses · Editions · 6 min read
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">
        Monospace — for precision
      </div>
      <div className="font-mono text-3xl tracking-tight text-ink mb-4">
        JetBrains Mono
      </div>
      <div className="font-mono text-base leading-relaxed text-ink-secondary max-w-prose">
        Reserved for token references, code, technical metadata. Appears rarely
        — only where fixed-width alignment or a "system" voice is appropriate.
      </div>
      <div className="font-mono text-sm text-ink-tertiary mt-4">
        --color-accent: oklch(0.52 0.08 170)
      </div>
    </div>
  </div>
);

const DualSystem = (): React.ReactElement => (
  <div className="flex flex-col gap-8">
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="p-8 border-r border-border">
          <div className="text-xs font-mono text-accent tracking-wide uppercase mb-6">
            Serif — Content
          </div>
          <div className="flex flex-col gap-4">
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.728rem", letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--color-ink)" }}>
              Article titles
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.44rem", letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--color-ink)" }}>
              Edition headings
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--color-ink)" }}>
              Focus section names
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", lineHeight: 1.625, color: "var(--color-ink-secondary)", maxWidth: "45ch" }}>
              Article body text — the long-form reading experience where the serif guides the eye across lines, reducing fatigue.
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "0.833rem", lineHeight: 1.625, color: "var(--color-ink-tertiary)", fontStyle: "italic" }}>
              Summaries and pull quotes
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="text-xs font-mono text-accent tracking-wide uppercase mb-6">
            Sans — Interface
          </div>
          <div className="flex flex-col gap-4">
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.833rem", color: "var(--color-ink-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Section labels
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.833rem", color: "var(--color-ink-secondary)" }}>
              Navigation items
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.833rem", color: "var(--color-ink-secondary)" }}>
              Button labels, form fields
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.694rem", color: "var(--color-ink-tertiary)", letterSpacing: "0.015em" }}>
              Metadata: Ars Technica · 3h ago · 6 min read
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.694rem", color: "var(--color-ink-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Timestamps, counts, status indicators
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">
        In context — article card
      </div>
      <div className="max-w-lg">
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.694rem", color: "var(--color-ink-tertiary)", letterSpacing: "0.015em", marginBottom: "0.375rem" }}>
          Ars Technica · 3h ago · 8 min read
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", letterSpacing: "-0.02em", lineHeight: 1.4, color: "var(--color-ink)", fontWeight: 500, marginBottom: "0.5rem" }}>
          The quiet revolution in reader design
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.833rem", lineHeight: 1.625, color: "var(--color-ink-secondary)" }}>
          How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.694rem", color: "var(--color-ink-tertiary)", marginTop: "0.375rem" }}>
          By Samuel Axon
        </div>
      </div>
    </div>
  </div>
);

const ReadingMeasure = (): React.ReactElement => (
  <div className="flex flex-col gap-8">
    <div className="border border-border rounded-lg p-8">
      <div className="max-w-prose mx-auto">
        <div className="text-xs font-mono text-ink-tertiary tracking-wide mb-6 text-center">
          65ch — the ideal measure
        </div>
        <div className="font-serif text-lg leading-relaxed text-ink">
          News aggregation today falls into two failure modes. Firehose
          timelines dump everything into a single chronological stream — a
          prolific publication buries a small specialized blog. Users feel
          overwhelmed and behind.
        </div>
        <div className="font-serif text-lg leading-relaxed text-ink mt-4">
          Neither respects the reader's time or attention. Reading an Edition
          should feel like settling into a favourite chair with a good magazine —
          quiet, deliberate, finite.
        </div>
      </div>
    </div>

    <div className="flex gap-4 text-xs text-ink-tertiary font-mono">
      <div className="flex items-center gap-2">
        <div className="w-8 h-px bg-critical" />
        <span>&lt;45ch — too narrow, choppy</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-px bg-positive" />
        <span>45–75ch — comfortable</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-px bg-critical" />
        <span>&gt;75ch — too wide, eye loses its place</span>
      </div>
    </div>
  </div>
);

const meta: Meta = {
  title: "Design System/Tokens/Typography",
  parameters: {
    layout: "fullscreen",
  },
};

type Story = StoryObj;

const Scale: Story = {
  render: () => <TypeScale />,
};

const Families: Story = {
  render: () => <TypeFamilies />,
};

const Measure: Story = {
  render: () => <ReadingMeasure />,
};

export default meta;
const DualSystemStory: Story = {
  render: () => <DualSystem />,
};

export { TypeScale, TypeFamilies, DualSystem, ReadingMeasure, Scale, Families, DualSystemStory, Measure };
