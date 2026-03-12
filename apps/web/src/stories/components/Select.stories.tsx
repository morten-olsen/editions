import type { Meta, StoryObj } from '@storybook/react-vite';

import { Select } from '../../components/select.tsx';

const meta: Meta = {
  title: 'Design System/Components/Select',
  parameters: { layout: 'centered' },
};

type Story = StoryObj;

const Default: Story = {
  render: () => (
    <div style={{ width: '16rem' }}>
      <Select.Root>
        <Select.Trigger />
        <Select.Content>
          <Select.Item value="12h">Last 12 hours</Select.Item>
          <Select.Item value="24h">Last 24 hours</Select.Item>
          <Select.Item value="2d">Last 2 days</Select.Item>
          <Select.Item value="1w">Last week</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  ),
};

const WithGroups: Story = {
  render: () => (
    <div style={{ width: '16rem' }}>
      <Select.Root defaultValue="daily">
        <Select.Trigger />
        <Select.Content>
          <Select.Group>
            <Select.GroupLabel>Frequency</Select.GroupLabel>
            <Select.Item value="daily">Daily</Select.Item>
            <Select.Item value="weekly">Weekly</Select.Item>
            <Select.Item value="monthly">Monthly</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </div>
  ),
};

export default meta;
export { Default, WithGroups };
