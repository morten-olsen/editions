import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../../components/input.tsx";
import { Textarea } from "../../components/textarea.tsx";

const meta: Meta<typeof Input> = {
  title: "Design System/Components/Input",
  component: Input,
  parameters: { layout: "centered" },
};

type Story = StoryObj<typeof Input>;

const Default: Story = {
  args: { placeholder: "Enter feed URL..." },
};

const WithLabel: Story = {
  args: {
    label: "Feed URL",
    placeholder: "https://example.com/feed.xml",
    description: "The RSS or Atom feed URL for this source",
  },
};

const WithError: Story = {
  args: {
    label: "Feed URL",
    placeholder: "https://example.com/feed.xml",
    defaultValue: "not-a-url",
    error: "Please enter a valid URL",
  },
};

const Disabled: Story = {
  args: {
    label: "Feed URL",
    defaultValue: "https://example.com/feed.xml",
    disabled: true,
  },
};

const TextareaStory: Story = {
  render: () => (
    <div style={{ width: "24rem" }}>
      <Textarea
        label="Description"
        placeholder="Describe what this focus covers..."
        description="Optional. Helps classify articles into this focus."
      />
    </div>
  ),
  name: "Textarea",
};

const FormExample: Story = {
  render: () => (
    <div style={{ width: "24rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Input label="Source name" placeholder="e.g. Ars Technica" />
      <Input
        label="Feed URL"
        placeholder="https://feeds.arstechnica.com/arstechnica/index"
        description="RSS or Atom feed URL"
      />
      <Textarea
        label="Notes"
        placeholder="Any notes about this source..."
      />
    </div>
  ),
};

export default meta;
export { Default, WithLabel, WithError, Disabled, TextareaStory, FormExample };
