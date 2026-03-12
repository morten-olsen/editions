import type { Meta, StoryObj } from '@storybook/react-vite';

const spacingSteps = [
  { name: '0.5', rem: '0.125rem', px: '2px' },
  { name: '1', rem: '0.25rem', px: '4px' },
  { name: '1.5', rem: '0.375rem', px: '6px' },
  { name: '2', rem: '0.5rem', px: '8px' },
  { name: '3', rem: '0.75rem', px: '12px' },
  { name: '4', rem: '1rem', px: '16px' },
  { name: '5', rem: '1.25rem', px: '20px' },
  { name: '6', rem: '1.5rem', px: '24px' },
  { name: '8', rem: '2rem', px: '32px' },
  { name: '10', rem: '2.5rem', px: '40px' },
  { name: '12', rem: '3rem', px: '48px' },
  { name: '16', rem: '4rem', px: '64px' },
  { name: '20', rem: '5rem', px: '80px' },
  { name: '24', rem: '6rem', px: '96px' },
  { name: '32', rem: '8rem', px: '128px' },
] as const;

const SpacingScale = (): React.ReactElement => (
  <div className="flex flex-col gap-3">
    {spacingSteps.map((step) => (
      <div key={step.name} className="flex items-center gap-4">
        <span className="text-xs font-mono text-ink-tertiary w-8 text-right shrink-0">{step.name}</span>
        <div className="h-3 rounded-sm bg-accent/20 border border-accent/30" style={{ width: step.rem }} />
        <span className="text-xs text-ink-tertiary font-mono">
          {step.rem}
          <span className="text-ink-faint ml-2">{step.px}</span>
        </span>
      </div>
    ))}
  </div>
);

const SpacingCompositions = (): React.ReactElement => (
  <div className="grid grid-cols-2 gap-8">
    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">Article card</div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-tertiary font-sans">The Guardian</span>
          <span className="text-ink-faint">·</span>
          <span className="text-xs text-ink-tertiary">3 min read</span>
        </div>
        <div className="text-lg font-medium tracking-tight text-ink leading-snug">
          A sense of calm in a world of noise
        </div>
        <div className="text-sm text-ink-secondary leading-relaxed">
          How deliberate design choices can transform the experience of consuming information online.
        </div>
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">Section header</div>
      <div>
        <div className="text-xs text-accent tracking-wide uppercase font-medium mb-2">Technology</div>
        <div className="text-2xl tracking-tight text-ink leading-tight mb-3">Your morning briefing</div>
        <div className="text-sm text-ink-secondary">5 articles · approximately 12 minutes</div>
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">Metadata row</div>
      <div className="flex items-center gap-3 text-sm text-ink-tertiary">
        <span>Ars Technica</span>
        <span className="w-px h-3 bg-border-strong" />
        <span>March 9, 2026</span>
        <span className="w-px h-3 bg-border-strong" />
        <span>8 min read</span>
      </div>
    </div>

    <div className="border border-border rounded-lg p-8">
      <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-6">Navigation item</div>
      <div className="space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-accent-subtle text-accent text-sm font-medium">
          <div className="size-1.5 rounded-full bg-accent" />
          Editions
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-md text-ink-secondary text-sm">
          <div className="size-1.5 rounded-full bg-transparent" />
          Feed
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-md text-ink-secondary text-sm">
          <div className="size-1.5 rounded-full bg-transparent" />
          Sources
        </div>
      </div>
    </div>
  </div>
);

const meta: Meta = {
  title: 'Design System/Tokens/Spacing',
  parameters: {
    layout: 'fullscreen',
  },
};

type Story = StoryObj;

const Scale: Story = {
  render: () => <SpacingScale />,
};

const Compositions: Story = {
  render: () => <SpacingCompositions />,
};

export default meta;
export { SpacingScale, SpacingCompositions, Scale, Compositions };
