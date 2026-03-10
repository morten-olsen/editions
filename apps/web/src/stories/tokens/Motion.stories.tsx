import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, useCallback } from "react";
import {
  FadeIn,
  SlideIn,
  ScaleIn,
  Collapse,
  Presence,
  StaggerList,
  StaggerItem,
} from "../../components/animate.tsx";

/* ── Helpers ──────────────────────────────────────────────────────── */

const ReplayButton = ({ onReplay }: { onReplay: () => void }): React.ReactElement => (
  <button
    type="button"
    className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer font-mono"
    onClick={onReplay}
  >
    Replay
  </button>
);

const useReplay = (): [number, () => void] => {
  const [key, setKey] = useState(0);
  const replay = useCallback(() => setKey((k) => k + 1), []);
  return [key, replay];
};

const SampleCard = ({ label }: { label: string }): React.ReactElement => (
  <div className="border border-border rounded-lg p-4 bg-surface-raised">
    <div className="text-sm font-medium text-ink">{label}</div>
    <div className="text-xs text-ink-tertiary mt-1">Sample content for animation demo</div>
  </div>
);

const Label = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <div className="text-xs font-mono text-ink-tertiary mb-3">{children}</div>
);

/* ── Easing Curves ────────────────────────────────────────────────── */

const EasingCurves = (): React.ReactElement => {
  const [animate, setAnimate] = useState(false);

  return (
    <div className="space-y-8 p-8">
      <button
        type="button"
        className="text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer"
        onClick={() => setAnimate((prev) => !prev)}
      >
        {animate ? "Reset" : "Play animation"}
      </button>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs font-mono text-ink-tertiary w-24">
              ease-gentle
            </span>
            <span className="text-xs text-ink-secondary">
              Default — cubic-bezier(0.25, 0.1, 0.25, 1)
            </span>
          </div>
          <div className="h-10 bg-surface-sunken rounded-lg relative overflow-hidden">
            <div
              className="absolute top-1 bottom-1 left-1 w-12 bg-accent rounded-md"
              style={{
                transform: animate ? "translateX(calc(100cqw - 4rem))" : "translateX(0)",
                transition: "transform 800ms cubic-bezier(0.25, 0.1, 0.25, 1)",
                containerType: "inline-size",
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs font-mono text-ink-tertiary w-24">
              ease-out-soft
            </span>
            <span className="text-xs text-ink-secondary">
              Entering — cubic-bezier(0, 0, 0.15, 1)
            </span>
          </div>
          <div className="h-10 bg-surface-sunken rounded-lg relative overflow-hidden">
            <div
              className="absolute top-1 bottom-1 left-1 w-12 bg-accent rounded-md"
              style={{
                transform: animate ? "translateX(calc(100cqw - 4rem))" : "translateX(0)",
                transition: "transform 800ms cubic-bezier(0, 0, 0.15, 1)",
                containerType: "inline-size",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Duration Scale ───────────────────────────────────────────────── */

const durations = [
  { name: "fast", ms: "120ms", use: "Hover states, color changes" },
  { name: "normal", ms: "200ms", use: "Default transitions, focus rings" },
  { name: "slow", ms: "350ms", use: "Panel slides, layout shifts" },
  { name: "slower", ms: "500ms", use: "Page transitions, modal entries" },
] as const;

const DurationScale = (): React.ReactElement => (
  <div className="space-y-4 p-8">
    {durations.map((d) => (
      <div key={d.name} className="flex items-center gap-6">
        <span className="text-xs font-mono text-ink-tertiary w-16 text-right shrink-0">
          {d.name}
        </span>
        <div className="w-20 shrink-0">
          <div
            className="h-2 rounded-full bg-accent/30"
            style={{
              width: `${(parseInt(d.ms) / 500) * 100}%`,
            }}
          >
            <div className="h-full rounded-full bg-accent" />
          </div>
        </div>
        <span className="text-xs font-mono text-ink-secondary w-12">{d.ms}</span>
        <span className="text-xs text-ink-tertiary">{d.use}</span>
      </div>
    ))}
  </div>
);

/* ── CSS Transition Examples ──────────────────────────────────────── */

const TransitionExamples = (): React.ReactElement => (
  <div className="grid grid-cols-3 gap-6 p-8">
    <div className="group border border-border rounded-lg p-6 transition-shadow duration-normal ease-gentle hover:shadow-md cursor-pointer">
      <div className="text-sm font-medium text-ink mb-1 transition-colors duration-fast group-hover:text-accent">
        Card hover
      </div>
      <div className="text-xs text-ink-tertiary">
        shadow + color · normal + fast
      </div>
    </div>

    <button
      type="button"
      className="border border-border rounded-lg p-6 text-left bg-surface-raised transition-all duration-normal ease-gentle hover:bg-accent hover:text-accent-ink hover:border-accent cursor-pointer"
    >
      <div className="text-sm font-medium mb-1">Button transition</div>
      <div className="text-xs opacity-70">background + border · normal</div>
    </button>

    <div className="group border border-border rounded-lg p-6 cursor-pointer">
      <div className="text-sm font-medium text-ink mb-1">Subtle fade</div>
      <div className="text-xs text-ink-faint transition-colors duration-slow ease-gentle group-hover:text-ink-secondary">
        This text fades in on hover · slow
      </div>
    </div>
  </div>
);

/* ── FadeIn Demo ──────────────────────────────────────────────────── */

const FadeInDemo = (): React.ReactElement => {
  const [key, replay] = useReplay();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>FadeIn — elements gently materialize</Label>
        <ReplayButton onReplay={replay} />
      </div>
      <div key={key} className="grid grid-cols-3 gap-4">
        <FadeIn>
          <SampleCard label="Default (slow)" />
        </FadeIn>
        <FadeIn delay={0.15}>
          <SampleCard label="With delay" />
        </FadeIn>
        <FadeIn duration="slower" delay={0.3}>
          <SampleCard label="Slower + delay" />
        </FadeIn>
      </div>
    </div>
  );
};

/* ── SlideIn Demo ─────────────────────────────────────────────────── */

const SlideInDemo = (): React.ReactElement => {
  const [key, replay] = useReplay();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>SlideIn — elements enter from a direction</Label>
        <ReplayButton onReplay={replay} />
      </div>
      <div key={key} className="grid grid-cols-2 gap-4">
        <SlideIn from="up">
          <SampleCard label='from="up" (default)' />
        </SlideIn>
        <SlideIn from="down">
          <SampleCard label='from="down"' />
        </SlideIn>
        <SlideIn from="left">
          <SampleCard label='from="left"' />
        </SlideIn>
        <SlideIn from="right">
          <SampleCard label='from="right"' />
        </SlideIn>
      </div>
    </div>
  );
};

/* ── ScaleIn Demo ─────────────────────────────────────────────────── */

const ScaleInDemo = (): React.ReactElement => {
  const [key, replay] = useReplay();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>ScaleIn — subtle scale for popovers, cards, dialogs</Label>
        <ReplayButton onReplay={replay} />
      </div>
      <div key={key} className="flex gap-4">
        <ScaleIn>
          <SampleCard label="ScaleIn (normal)" />
        </ScaleIn>
        <ScaleIn duration="slow" delay={0.1}>
          <SampleCard label="Slow + delay" />
        </ScaleIn>
      </div>
    </div>
  );
};

/* ── Collapse Demo ────────────────────────────────────────────────── */

const CollapseDemo = (): React.ReactElement => {
  const [show, setShow] = useState(true);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>Collapse — animate height for expand/collapse</Label>
        <button
          type="button"
          className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer font-mono"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Collapse" : "Expand"}
        </button>
      </div>
      <div className="max-w-md">
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="p-4 bg-surface-raised">
            <div className="text-sm font-medium text-ink">Expandable section</div>
          </div>
          <Collapse show={show}>
            <div className="p-4 border-t border-border">
              <div className="text-sm text-ink-secondary leading-relaxed">
                This content smoothly animates its height when toggled.
                Useful for accordions, detail panels, and progressive disclosure
                — revealing information without jarring layout shifts.
              </div>
            </div>
          </Collapse>
        </div>
      </div>
    </div>
  );
};

/* ── Presence Demo ────────────────────────────────────────────────── */

const PresenceDemo = (): React.ReactElement => {
  const [show, setShow] = useState(true);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>Presence — animate mount and unmount</Label>
        <button
          type="button"
          className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer font-mono"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <div className="h-24 flex items-start">
        <Presence show={show}>
          <SampleCard label="Now you see me" />
        </Presence>
      </div>
    </div>
  );
};

/* ── StaggerList Demo ─────────────────────────────────────────────── */

const StaggerListDemo = (): React.ReactElement => {
  const [key, replay] = useReplay();
  const items = ["Latest from Stratechery", "The Browser Company Blog", "Daring Fireball", "Platformer", "Not Boring"];

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>StaggerList — children animate in sequence</Label>
        <ReplayButton onReplay={replay} />
      </div>
      <div key={key} className="max-w-md">
        <StaggerList className="space-y-2">
          {items.map((item) => (
            <StaggerItem key={item}>
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-surface-raised">
                <div className="w-2 h-2 rounded-full bg-accent/40 shrink-0" />
                <span className="text-sm text-ink">{item}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </div>
  );
};

/* ── Composition: Page Enter ──────────────────────────────────────── */

const PageEnterDemo = (): React.ReactElement => {
  const [key, replay] = useReplay();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <Label>Page enter — composing primitives for a natural page load</Label>
        <ReplayButton onReplay={replay} />
      </div>
      <div key={key} className="max-w-lg border border-border rounded-xl overflow-hidden bg-surface">
        <div className="p-6 border-b border-border">
          <FadeIn duration="normal">
            <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase">Morning Edition</div>
          </FadeIn>
          <SlideIn from="up" distance={8} delay={0.1}>
            <div className="text-2xl font-serif font-medium text-ink mt-2 tracking-tight">
              Tuesday, March 10
            </div>
          </SlideIn>
        </div>
        <div className="p-6">
          <StaggerList className="space-y-4">
            {["The State of RSS in 2026", "Why Calm Software Wins", "On Finite Feeds"].map((title) => (
              <StaggerItem key={title}>
                <div className="flex gap-3 items-start">
                  <div className="w-1 h-8 rounded-full bg-accent/20 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-serif font-medium text-ink">{title}</div>
                    <div className="text-xs text-ink-tertiary mt-0.5">3 min read</div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </div>
    </div>
  );
};

/* ── Stories ───────────────────────────────────────────────────────── */

const meta: Meta = {
  title: "Design System/Tokens/Motion",
  parameters: {
    layout: "fullscreen",
  },
};

type Story = StoryObj;

const Easing: Story = {
  render: () => <EasingCurves />,
};

const Duration: Story = {
  render: () => <DurationScale />,
};

const Examples: Story = {
  name: "CSS Transitions",
  render: () => <TransitionExamples />,
};

const FadeInStory: Story = {
  name: "FadeIn",
  render: () => <FadeInDemo />,
};

const SlideInStory: Story = {
  name: "SlideIn",
  render: () => <SlideInDemo />,
};

const ScaleInStory: Story = {
  name: "ScaleIn",
  render: () => <ScaleInDemo />,
};

const CollapseStory: Story = {
  name: "Collapse",
  render: () => <CollapseDemo />,
};

const PresenceStory: Story = {
  name: "Presence",
  render: () => <PresenceDemo />,
};

const StaggerListStory: Story = {
  name: "StaggerList",
  render: () => <StaggerListDemo />,
};

const PageEnter: Story = {
  name: "Composition: Page Enter",
  render: () => <PageEnterDemo />,
};

export default meta;
export {
  Easing,
  Duration,
  Examples,
  FadeInStory,
  SlideInStory,
  ScaleInStory,
  CollapseStory,
  PresenceStory,
  StaggerListStory,
  PageEnter,
};
