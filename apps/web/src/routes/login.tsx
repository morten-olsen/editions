import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";

const LoginPage = (): React.ReactNode => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status === "authenticated") {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await auth.login(username, password);
      } else {
        await auth.register(username, password);
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="font-serif text-3xl tracking-tight text-ink mb-2">
            Editions
          </div>
          <div className="text-sm text-ink-tertiary">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
          <Input
            label="Username"
            placeholder="Enter username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? "..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
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

const Route = createFileRoute("/login")({
  component: LoginPage,
});

export { Route };
