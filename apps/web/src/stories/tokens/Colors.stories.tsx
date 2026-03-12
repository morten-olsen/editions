import type { Meta, StoryObj } from '@storybook/react-vite';

type ColorEntry = {
  name: string;
  token: string;
  desc: string;
};

type ColorPaletteProps = {
  colors: ColorEntry[];
};

const ColorPalette = ({ colors = [] }: ColorPaletteProps): React.ReactElement => (
  <div className="grid grid-cols-2 gap-4">
    {colors.map((color) => (
      <div key={color.name} className="flex items-center gap-5 rounded-lg border border-border p-4">
        <div
          className="size-16 rounded-md shadow-sm shrink-0 border border-border"
          style={{ backgroundColor: `var(${color.token})` }}
        />
        <div className="min-w-0">
          <div className="font-medium text-sm text-ink">{color.name}</div>
          <div className="text-xs text-ink-tertiary font-mono mt-0.5">{color.token}</div>
          <div className="text-xs text-ink-secondary mt-1">{color.desc}</div>
        </div>
      </div>
    ))}
  </div>
);

const meta: Meta<typeof ColorPalette> = {
  title: 'Design System/Tokens/Colors',
  component: ColorPalette,
  parameters: {
    layout: 'fullscreen',
  },
};

type Story = StoryObj<typeof ColorPalette>;

const AllColors: Story = {
  args: {
    colors: [
      { name: 'surface', token: '--color-surface', desc: 'Primary background' },
      {
        name: 'surface-raised',
        token: '--color-surface-raised',
        desc: 'Cards',
      },
      {
        name: 'surface-sunken',
        token: '--color-surface-sunken',
        desc: 'Recessed areas',
      },
      { name: 'ink', token: '--color-ink', desc: 'Primary text' },
      {
        name: 'ink-secondary',
        token: '--color-ink-secondary',
        desc: 'Body text',
      },
      { name: 'accent', token: '--color-accent', desc: 'Interactive elements' },
    ],
  },
};

export default meta;
export { ColorPalette, AllColors };
