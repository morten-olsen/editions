import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../../components/checkbox.tsx";
import { Switch } from "../../components/switch.tsx";
import { Separator } from "../../components/separator.tsx";

const meta: Meta = {
  title: "Design System/Components/Controls",
  parameters: { layout: "centered" },
};

type Story = StoryObj;

const Checkboxes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Checkbox label="Global news" defaultChecked />
      <Checkbox label="Technology" defaultChecked />
      <Checkbox label="Science" />
      <Checkbox label="Local news" />
    </div>
  ),
};

const Switches: Story = {
  render: () => (
    <div style={{ width: "20rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Switch label="Enable edition" defaultChecked />
      <Switch label="Exclude prior articles" />
      <Switch label="Extract full content" defaultChecked />
    </div>
  ),
};

const SeparatorStory: Story = {
  render: () => (
    <div style={{ width: "24rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
        Content above
      </div>
      <Separator />
      <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
        Default separator
      </div>
      <Separator soft />
      <div style={{ fontSize: "0.875rem", color: "var(--color-ink-secondary)" }}>
        Soft separator (lighter)
      </div>
    </div>
  ),
  name: "Separator",
};

const FormSection: Story = {
  render: () => (
    <div style={{ width: "24rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.75rem" }}>Sources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Checkbox label="Ars Technica" defaultChecked />
          <Checkbox label="The Guardian" defaultChecked />
          <Checkbox label="Hacker News" />
        </div>
      </div>
      <Separator soft />
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.75rem" }}>Options</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Switch label="Always include" />
          <Switch label="Match by topic" defaultChecked />
        </div>
      </div>
    </div>
  ),
};

export default meta;
export { Checkboxes, Switches, SeparatorStory, FormSection };
