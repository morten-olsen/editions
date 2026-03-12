import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { client } from '../api/api.ts';

type User = {
  id: string;
  username: string;
  role: string;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; token: string };

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const TOKEN_KEY = 'editions_token';

const AuthContext = createContext<AuthContextValue | null>(null);

const AuthProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({ status: 'unauthenticated' });
      return;
    }

    client
      .GET('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(TOKEN_KEY);
          setState({ status: 'unauthenticated' });
          return;
        }
        setState({ status: 'authenticated', user: data, token });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ status: 'unauthenticated' });
      });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const { data, error } = await client.POST('/api/auth/login', {
      body: { username, password },
    });

    if (error) {
      throw new Error(error.error);
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    const { data: user } = await client.GET('/api/auth/me', {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    if (!user) {
      throw new Error('Failed to fetch user');
    }

    setState({ status: 'authenticated', user, token: data.token });
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<void> => {
    const { data, error } = await client.POST('/api/auth/register', {
      body: { username, password },
    });

    if (error) {
      throw new Error(error.error);
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    const { data: user } = await client.GET('/api/auth/me', {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    if (!user) {
      throw new Error('Failed to fetch user');
    }

    setState({ status: 'authenticated', user, token: data.token });
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ status: 'unauthenticated' });
  }, []);

  const value = useMemo(
    (): AuthContextValue => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };
