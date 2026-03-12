import { createFileRoute, Navigate } from '@tanstack/react-router';

import { useLoginForm } from '../hooks/auth/auth.hooks.ts';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';

const LoginPage = (): React.ReactNode => {
  const {
    mode,
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    allowSignups,
    isAuthenticated,
    handleSubmit,
    toggleMode,
  } = useLoginForm();

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="font-serif text-3xl tracking-tight text-ink mb-2">Editions</div>
          <div className="text-sm text-ink-tertiary">{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>
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
            {submitting ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        {allowSignups && (
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-ink-tertiary hover:text-accent transition-colors duration-fast cursor-pointer"
            >
              {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Route = createFileRoute('/login')({
  component: LoginPage,
});

export { Route };
