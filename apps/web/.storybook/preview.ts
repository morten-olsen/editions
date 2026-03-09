import type { Preview } from "@storybook/react-vite";
import "../src/app.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "oklch(0.975 0.005 70)" },
        { name: "raised", value: "oklch(0.99 0.002 70)" },
        { name: "sunken", value: "oklch(0.945 0.008 70)" },
        { name: "white", value: "#ffffff" },
      ],
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
