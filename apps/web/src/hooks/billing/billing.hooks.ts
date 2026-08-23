import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

import { queryKeys, useAuthHeaders } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import type { Page } from '../../api/api.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

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

/**
 * Every call goes through the generated client, so a route or field rename shows
 * up as a type error here rather than a runtime 404.
 */
const unwrap = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error !== undefined || result.data === undefined) {
    const message = (result.error as { error?: string } | undefined)?.error;
    throw new Error(message ?? 'Request failed');
  }
  return result.data;
};

// --- Hooks ---

const BILLING_STALE_TIME = 60_000; // 60s — subscription/access status changes rarely

const useUserSubscription = (): UseQueryResult<UserSubscription> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: async (): Promise<UserSubscription> =>
      unwrap(await client.GET('/api/billing/subscription', { headers })) as UserSubscription,
    enabled: Boolean(headers),
    staleTime: BILLING_STALE_TIME,
  });
};

const useAccessStatus = (pollInterval?: number): UseQueryResult<AccessStatus> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.access,
    queryFn: async (): Promise<AccessStatus> =>
      unwrap(await client.GET('/api/billing/access', { headers })) as AccessStatus,
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
    mutationFn: async (body): Promise<{ url: string }> =>
      unwrap(await client.POST('/api/billing/checkout', { body, headers })),
  });
};

const useCreatePortal = (): UseMutationResult<{ url: string }, Error, { returnUrl: string }> => {
  const headers = useAuthHeaders();
  return useMutation({
    mutationFn: async (body): Promise<{ url: string }> =>
      unwrap(await client.POST('/api/billing/portal', { body, headers })),
  });
};

// --- Admin hooks ---

const useAdminBillingSettings = (): UseQueryResult<PaymentSettings> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.billing.settings,
    queryFn: async (): Promise<PaymentSettings> =>
      unwrap(await client.GET('/api/admin/billing/settings', { headers })) as PaymentSettings,
    enabled: Boolean(headers),
  });
};

const useUpdateBillingSettings = (): UseMutationResult<PaymentSettings, Error, Partial<PaymentSettings>> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body): Promise<PaymentSettings> =>
      unwrap(await client.PUT('/api/admin/billing/settings', { body, headers })) as PaymentSettings,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.billing.settings, data);
    },
  });
};

const ADMIN_USERS_PAGE_SIZE = 25;

type UseAdminUsersResult = {
  users: AdminUser[];
  total: number;
  isLoading: boolean;
  pagination: PagerControls;
};

/** Paged — this list grows with signups. */
const useAdminUsers = (): UseAdminUsersResult => {
  const headers = useAuthHeaders();

  const paged = usePagedQuery<AdminUser>({
    queryKey: (offset) => [...queryKeys.billing.adminUsers, offset],
    fetchPage: async ({ offset, limit }): Promise<Page<AdminUser>> =>
      unwrap(
        await client.GET('/api/admin/billing/users', { params: { query: { offset, limit } }, headers }),
      ) as Page<AdminUser>,
    pageSize: ADMIN_USERS_PAGE_SIZE,
    enabled: Boolean(headers),
  });

  return { users: paged.items, total: paged.total, isLoading: paged.isLoading, pagination: paged.pagination };
};

const useAdminSetAccess = (): UseMutationResult<AdminUser, Error, { userId: string; expiresAt: string | null }> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, expiresAt }): Promise<AdminUser> =>
      unwrap(
        await client.PUT('/api/admin/billing/users/{userId}/access', {
          params: { path: { userId } },
          body: { expiresAt },
          headers,
        }),
      ) as AdminUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.adminUsers });
    },
  });
};

const useAdminCancelSubscription = (): UseMutationResult<{ success: boolean }, Error, string> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId): Promise<{ success: boolean }> =>
      unwrap(
        await client.DELETE('/api/admin/billing/users/{userId}/subscription', {
          params: { path: { userId } },
          headers,
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.adminUsers });
    },
  });
};

export type {
  AccessState,
  AccessStatus,
  SubscriptionInfo,
  UserSubscription,
  PaymentSettings,
  AdminUser,
  UseAdminUsersResult,
};
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
