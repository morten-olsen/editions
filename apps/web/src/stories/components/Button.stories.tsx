import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../components/button.tsx";

const meta: Meta<typeof Button> = {
  title: "Design System/Components/Button",
  component: Button,
  parameters: { layout: "centered" },
};

type Story = StoryObj<typeof Button>;

const Primary: Story = {
  args: { variant: "primary", children: "Save changes" },
};

const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

const Ghost: Story = {
  args: { variant: "ghost", children: "Skip for now" },
};

const Destructive: Story = {
  args: { variant: "destructive", children: "Delete source" },
};

const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
        <Button variant="ghost" disabled>
          Disabled
        </Button>
      </div>
    </div>
  ),
};

export default meta;
export { Primary, Secondary, Ghost, Destructive, Sizes, AllVariants };
