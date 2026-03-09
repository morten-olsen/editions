import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Input } from "../../components/input.tsx";
import { Button } from "../../components/button.tsx";

const meta: Meta = {
  title: "Design System/Compositions/Login",
  parameters: { layout: "fullscreen" },
};

type Story = StoryObj;

const LoginScreen = (): React.ReactElement => {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="font-serif text-3xl tracking-tight text-ink mb-2">
            Editions
          </div>
          <div className="text-sm text-ink-tertiary">
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <Input label="Username" placeholder="Enter username" />
          <Input label="Password" type="password" placeholder="Enter password" />
        </div>

        <Button variant="primary" className="w-full mb-4">
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-sm text-ink-tertiary hover:text-accent transition-colors duration-fast cursor-pointer"
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Default: Story = {
  render: () => <LoginScreen />,
};

export default meta;
export { Default };
