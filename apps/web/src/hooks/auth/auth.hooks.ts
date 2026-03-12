import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { client } from '../../api/api.ts';
import { useAuth } from '../../auth/auth.tsx';

type LoginFormMode = 'login' | 'register';

type UseLoginFormResult = {
  mode: LoginFormMode;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string | null;
  submitting: boolean;
  allowSignups: boolean;
  isAuthenticated: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  toggleMode: () => void;
};

const useLoginForm = (): UseLoginFormResult => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginFormMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowSignups, setAllowSignups] = useState(true);

  useEffect(() => {
    client.GET('/api/config').then(({ data }) => {
      if (data) {
        setAllowSignups(data.allowSignups);
      }
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);

      try {
        if (mode === 'login') {
          await auth.login(username, password);
        } else {
          await auth.register(username, password);
        }
        await navigate({ to: '/' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setSubmitting(false);
      }
    },
    [mode, username, password, auth, navigate],
  );

  const toggleMode = useCallback((): void => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError(null);
  }, []);

  return {
    mode,
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    allowSignups,
    isAuthenticated: auth.status === 'authenticated',
    handleSubmit,
    toggleMode,
  };
};

export type { UseLoginFormResult };
export { useLoginForm };
