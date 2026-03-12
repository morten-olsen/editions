import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tooltip, TooltipProvider } from '../../components/tooltip.tsx';
import { Button } from '../../components/button.tsx';

const meta: Meta = {
  title: 'Design System/Components/Tooltip',
  parameters: { layout: 'centered' },
  decorators: [(story) => <TooltipProvider>{story()}</TooltipProvider>],
};

type Story = StoryObj;

const Default: Story = {
  render: () => (
    <Tooltip content="Fetch new articles from this source">
      <Button variant="secondary">Fetch now</Button>
    </Tooltip>
  ),
};

const Sides: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', padding: '4rem' }}>
      <Tooltip content="Top" side="top">
        <Button variant="ghost">Top</Button>
      </Tooltip>
      <Tooltip content="Bottom" side="bottom">
        <Button variant="ghost">Bottom</Button>
      </Tooltip>
      <Tooltip content="Left" side="left">
        <Button variant="ghost">Left</Button>
      </Tooltip>
      <Tooltip content="Right" side="right">
        <Button variant="ghost">Right</Button>
      </Tooltip>
    </div>
  ),
};

export default meta;
export { Default, Sides };
