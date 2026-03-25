import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

import { queryKeys, useAuthHeaders } from '../../api/api.hooks.ts';

// --- Types ---

type AccessState = 'active' | 'trial' | 'expired' | 'unlimited';

type AccessStatus = {
  state: AccessState;
  expiresAt: string | null;
  daysRemaining: number | null;
};

type SubscriptionInfo = {
  status: string;
  interval: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string;
};

type PricingInfo = {
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  trialDays: number;
};

type UserSubscription = {
  access: AccessStatus;
  subscription: SubscriptionInfo | null;
  paymentEnabled: boolean;
  pricing: PricingInfo | null;
};

type PaymentSettings = {
  enabled: boolean;
  trialDays: number;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  monthlyStripePriceId: string;
  yearlyStripePriceId: string;
  stripeProductId: string;
};

type AdminUser = {
  id: string;
  username: string;
  role: string;
  accessExpiresAt: string | null;
  state: AccessState;
  subscription: {
    status: string;
    interval: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
};

// --- Helpers ---

const fetchJson = async <T>(url: string, headers: Record<string, string>, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...options, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

// --- Hooks ---

const BILLING_STALE_TIME = 60_000; // 60s — subscription/access status changes rarely

const useUserSubscription = (): UseQueryResult<UserSubscription> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: () => fetchJson<UserSubscription>('/api/billing/subscription', headers ?? {}),
    enabled: Boolean(headers),
    staleTime: BILLING_STALE_TIME,
  });
};

const useAccessStatus = (pollInterval?: number): UseQueryResult<AccessStatus> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.access,
    queryFn: () => fetchJson<AccessStatus>('/api/billing/access', headers ?? {}),
    enabled: Boolean(headers),
    refetchInterval: pollInterval,
    staleTime: BILLING_STALE_TIME,
  });
};

const useCreateCheckout = (): UseMutationResult<
  { url: string },
  Error,
  { interval: 'monthly' | 'yearly'; successUrl: string; cancelUrl: string }
> => {
  const headers = useAuthHeaders();
  return useMutation({
    mutationFn: (body) =>
      fetchJson<{ url: string }>('/api/billing/checkout', headers ?? {}, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
};

const useCreatePortal = (): UseMutationResult<{ url: string }, Error, { returnUrl: string }> => {
  const headers = useAuthHeaders();
  return useMutation({
    mutationFn: (body) =>
      fetchJson<{ url: string }>('/api/billing/portal', headers ?? {}, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
};

// --- Admin hooks ---

const useAdminBillingSettings = (): UseQueryResult<PaymentSettings> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.settings,
    queryFn: () => fetchJson<PaymentSettings>('/api/admin/billing/settings', headers ?? {}),
    enabled: Boolean(headers),
  });
};

const useUpdateBillingSettings = (): UseMutationResult<PaymentSettings, Error, Partial<PaymentSettings>> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchJson<PaymentSettings>('/api/admin/billing/settings', headers ?? {}, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.billing.settings, data);
    },
  });
};

const useAdminUsers = (): UseQueryResult<AdminUser[]> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.adminUsers,
    queryFn: () => fetchJson<AdminUser[]>('/api/admin/billing/users', headers ?? {}),
    enabled: Boolean(headers),
  });
};

const useAdminSetAccess = (): UseMutationResult<AdminUser, Error, { userId: string; expiresAt: string | null }> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, expiresAt }) =>
      fetchJson<AdminUser>(`/api/admin/billing/users/${userId}/access`, headers ?? {}, {
        method: 'PUT',
        body: JSON.stringify({ expiresAt }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.adminUsers });
    },
  });
};

const useAdminCancelSubscription = (): UseMutationResult<{ success: boolean }, Error, string> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) =>
      fetchJson<{ success: boolean }>(`/api/admin/billing/users/${userId}/subscription`, headers ?? {}, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.adminUsers });
    },
  });
};

export type { AccessState, AccessStatus, SubscriptionInfo, UserSubscription, PaymentSettings, AdminUser };
export {
  useUserSubscription,
  useAccessStatus,
  useCreateCheckout,
  useCreatePortal,
  useAdminBillingSettings,
  useUpdateBillingSettings,
  useAdminUsers,
  useAdminSetAccess,
  useAdminCancelSubscription,
};
