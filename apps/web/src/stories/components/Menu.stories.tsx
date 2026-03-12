import type { Meta, StoryObj } from '@storybook/react-vite';

import { Menu } from '../../components/menu.tsx';
import { Button } from '../../components/button.tsx';

const meta: Meta = {
  title: 'Design System/Components/Menu',
  parameters: { layout: 'centered' },
};

type Story = StoryObj;

const Default: Story = {
  render: () => (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="secondary">Actions</Button>} />
      <Menu.Content>
        <Menu.Item>Edit source</Menu.Item>
        <Menu.Item>Fetch now</Menu.Item>
        <Menu.Item>Reanalyse articles</Menu.Item>
        <Menu.Separator />
        <Menu.Item>Delete source</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  ),
};

const WithLabels: Story = {
  render: () => (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="secondary">Sort by</Button>} />
      <Menu.Content>
        <Menu.Label>Sort order</Menu.Label>
        <Menu.Item>Newest first</Menu.Item>
        <Menu.Item>Oldest first</Menu.Item>
        <Menu.Separator />
        <Menu.Label>Group by</Menu.Label>
        <Menu.Item>Source</Menu.Item>
        <Menu.Item>Focus</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  ),
};

export default meta;
export { Default, WithLabels };
