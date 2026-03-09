import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const EasingCurves = (): React.ReactElement => {
  const [animate, setAnimate] = useState(false);

  return (
    <div className="space-y-8">
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

const durations = [
  { name: "fast", ms: "120ms", use: "Hover states, color changes" },
  { name: "normal", ms: "200ms", use: "Default transitions, focus rings" },
  { name: "slow", ms: "350ms", use: "Panel slides, layout shifts" },
  { name: "slower", ms: "500ms", use: "Page transitions, modal entries" },
] as const;

const DurationScale = (): React.ReactElement => (
  <div className="space-y-4">
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

const TransitionExamples = (): React.ReactElement => (
  <div className="grid grid-cols-3 gap-6">
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
  render: () => <TransitionExamples />,
};

export default meta;
export { EasingCurves, DurationScale, TransitionExamples, Easing, Duration, Examples };
