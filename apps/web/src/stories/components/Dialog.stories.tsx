import type { Meta, StoryObj } from '@storybook/react-vite';

import { Dialog } from '../../components/dialog.tsx';
import { Button } from '../../components/button.tsx';

const meta: Meta = {
  title: 'Design System/Components/Dialog',
  parameters: { layout: 'centered' },
};

type Story = StoryObj;

const Default: Story = {
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger render={<Button>Delete source</Button>} />
      <Dialog.Content>
        <Dialog.Title>Delete "Ars Technica"?</Dialog.Title>
        <Dialog.Description>
          This will permanently remove the source and all its articles. This action cannot be undone.
        </Dialog.Description>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
          <Dialog.Close render={<Button variant="destructive">Delete</Button>} />
        </div>
      </Dialog.Content>
    </Dialog.Root>
  ),
};

const Informational: Story = {
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="secondary">Edition complete</Button>} />
      <Dialog.Content>
        <Dialog.Title>You're all caught up</Dialog.Title>
        <Dialog.Description>
          Your morning edition had 5 articles across 3 focuses, totalling about 12 minutes of reading. Enjoy the rest of
          your day.
        </Dialog.Description>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Dialog.Close render={<Button variant="primary">Done</Button>} />
        </div>
      </Dialog.Content>
    </Dialog.Root>
  ),
};

export default meta;
export { Default, Informational };
