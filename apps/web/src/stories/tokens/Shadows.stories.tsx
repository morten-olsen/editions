import type { Meta, StoryObj } from "@storybook/react-vite";

const shadows = [
  { name: "xs", className: "shadow-xs", desc: "Subtle lift — inputs, small cards" },
  { name: "sm", className: "shadow-sm", desc: "Default card elevation" },
  { name: "md", className: "shadow-md", desc: "Raised panels, dropdowns" },
  { name: "lg", className: "shadow-lg", desc: "Modals, floating elements" },
  { name: "xl", className: "shadow-xl", desc: "Popovers, command palette" },
] as const;

const ShadowScale = (): React.ReactElement => (
  <div className="grid grid-cols-5 gap-6">
    {shadows.map((shadow) => (
      <div key={shadow.name} className="text-center">
        <div
          className={`${shadow.className} bg-surface-overlay rounded-lg h-24 mb-4 border border-border/50`}
        />
        <div className="text-sm font-medium text-ink">{shadow.name}</div>
        <div className="text-xs font-mono text-ink-tertiary mt-0.5">
          shadow-{shadow.name}
        </div>
        <div className="text-xs text-ink-secondary mt-2">{shadow.desc}</div>
      </div>
    ))}
  </div>
);

const ShadowElevation = (): React.ReactElement => (
  <div className="relative bg-surface-sunken rounded-xl p-12 flex flex-col gap-8">
    <div className="text-xs font-mono text-ink-tertiary tracking-wide uppercase mb-8">
      Layered elevation
    </div>

    {/* Base surface */}
    <div className="bg-surface rounded-lg p-8 border border-border">
      <div className="text-sm text-ink-secondary mb-6">
        Base surface — flat, no shadow. Most content lives here.
      </div>

      {/* Raised card */}
      <div className="bg-surface-raised rounded-lg shadow-sm p-6 border border-border/50 max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-ink-tertiary">Ars Technica</span>
          <span className="text-ink-faint">·</span>
          <span className="text-xs text-ink-tertiary">5 min</span>
        </div>
        <div className="font-medium text-ink mb-1">
          The quiet revolution in reader design
        </div>
        <div className="text-sm text-ink-secondary">
          A raised card with subtle shadow — interactive, tappable.
        </div>
      </div>
    </div>

    {/* Floating element */}
    <div className="flex justify-center">
      <div className="bg-surface-overlay rounded-lg shadow-lg p-6 border border-border/50 max-w-sm">
        <div className="text-sm font-medium text-ink mb-2">Edition complete</div>
        <div className="text-sm text-ink-secondary">
          Floating notification — shadow-lg lifts it above the content plane.
        </div>
      </div>
    </div>
  </div>
);

const meta: Meta = {
  title: "Design System/Tokens/Shadows & Elevation",
  parameters: {
    layout: "fullscreen",
  },
};

type Story = StoryObj;

const Scale: Story = {
  render: () => <ShadowScale />,
};

const Elevation: Story = {
  render: () => <ShadowElevation />,
};

export default meta;
export { ShadowScale, ShadowElevation, Scale, Elevation };
