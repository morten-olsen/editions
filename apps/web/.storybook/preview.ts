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
      default: "surface-light",
      values: [
        { name: "surface-light", value: "oklch(0.975 0.005 70)" },
        { name: "raised-light", value: "oklch(0.99 0.002 70)" },
        { name: "surface-dark", value: "oklch(0.16 0.005 70)" },
        { name: "raised-dark", value: "oklch(0.2 0.005 70)" },
      ],
    },
    a11y: {
      test: "todo",
    },
    viewport: {
      viewports: {
        mobile: { name: "Mobile", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" } },
      },
    },
  },
  decorators: [
    (Story, context) => {
      const bg = context.globals?.backgrounds?.value ?? context.parameters?.backgrounds?.default;
      const isDark = typeof bg === "string" && bg.includes("dark");
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return Story();
    },
  ],
};

export default preview;
