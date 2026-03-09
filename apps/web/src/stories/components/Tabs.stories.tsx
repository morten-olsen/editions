import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "../../components/tabs.tsx";

const meta: Meta = {
  title: "Design System/Components/Tabs",
  parameters: { layout: "centered" },
};

type Story = StoryObj;

const Default: Story = {
  render: () => (
    <div style={{ width: "32rem" }}>
      <Tabs.Root defaultValue="articles">
        <Tabs.List>
          <Tabs.Tab value="articles">Articles</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="articles" style={{ padding: "1.5rem 0" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
            12 articles from 4 sources, approximately 18 minutes of reading.
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="settings" style={{ padding: "1.5rem 0" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
            Configure sources, budgets, and schedule for this edition.
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="history" style={{ padding: "1.5rem 0" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
            Past 7 editions generated from this configuration.
          </div>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  ),
};

export default meta;
export { Default };
