import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { queryKeys } from '../../api/api.hooks.ts';
import type { FocusConfig, Focus } from '../../views/editions/focus-config-card.tsx';

/* ── Types ────────────────────────────────────────────────────────── */

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
};

/* ── Schedule presets ─────────────────────────────────────────────── */

const SCHEDULE_PRESETS = [
  { label: 'Daily at 7am', value: '0 7 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekdays at 7am', value: '0 7 * * 1-5' },
  { label: 'Weekdays at 8am', value: '0 8 * * 1-5' },
  { label: 'Every Monday at 8am', value: '0 8 * * 1' },
  { label: 'Every Friday at 5pm', value: '0 17 * * 5' },
  { label: 'Custom…', value: '__custom__' },
] as const;

/* ── Data hook ────────────────────────────────────────────────────── */

const useEditEditionData = (
  configId: string,
  headers: Record<string, string> | undefined,
): {
  configQuery: ReturnType<typeof useQuery<EditionConfig>>;
  focusesQuery: ReturnType<typeof useQuery<Focus[]>>;
} => {
  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error('Edition config not found');
      }
      return data as unknown as EditionConfig;
    },
    enabled: !!headers,
  });

  const focusesQuery = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<Focus[]> => {
      const { data } = await client.GET('/api/focuses', { headers });
      return (data ?? []) as Focus[];
    },
    enabled: !!headers,
  });

  return { configQuery, focusesQuery };
};

/* ── Form hook ────────────────────────────────────────────────────── */

type EditEditionFormResult = {
  name: string;
  setName: (v: string) => void;
  icon: string | null;
  setIcon: (v: string | null) => void;
  schedule: string;
  setSchedule: (v: string) => void;
  lookbackHours: number;
  setLookbackHours: (v: number) => void;
  excludePriorEditions: boolean;
  setExcludePriorEditions: (v: boolean) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  selectedFocuses: FocusConfig[];
  toggleFocus: (focusId: string) => void;
  updateFocusField: (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ) => void;
  moveFocus: (focusId: string, direction: -1 | 1) => void;
};

const useFocusSelection = (
  initial: FocusConfig[],
): {
  selectedFocuses: FocusConfig[];
  setSelectedFocuses: (v: FocusConfig[]) => void;
  toggleFocus: (focusId: string) => void;
  updateFocusField: (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ) => void;
  moveFocus: (focusId: string, direction: -1 | 1) => void;
} => {
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>(initial);

  const toggleFocus = (focusId: string): void => {
    setSelectedFocuses((prev) => {
      const existing = prev.find((f) => f.focusId === focusId);
      if (existing) {
        return prev.filter((f) => f.focusId !== focusId);
      }
      return [
        ...prev,
        {
          focusId,
          position: prev.length,
          budgetType: 'count' as const,
          budgetValue: 5,
          lookbackHours: null,
          excludePriorEditions: null,
          weight: 1,
        },
      ];
    });
  };

  const updateFocusField = (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ): void => {
    setSelectedFocuses((prev) => prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)));
  };

  const moveFocus = (focusId: string, direction: -1 | 1): void => {
    setSelectedFocuses((prev) => {
      const idx = prev.findIndex((f) => f.focusId === focusId);
      if (idx < 0) {
        return prev;
      }
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) {
        return prev;
      }
      const arr = [...prev];
      const a = arr[idx];
      const b = arr[newIdx];
      if (!a || !b) {
        return prev;
      }
      arr[idx] = b;
      arr[newIdx] = a;
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  };

  return { selectedFocuses, setSelectedFocuses, toggleFocus, updateFocusField, moveFocus };
};

const useEditEditionForm = (configData: EditionConfig | undefined): EditEditionFormResult => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState('');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const focuses = useFocusSelection([]);

  useEffect(() => {
    if (!configData) {
      return;
    }
    setName(configData.name);
    setIcon(configData.icon);
    setSchedule(configData.schedule);
    setLookbackHours(configData.lookbackHours);
    setExcludePriorEditions(configData.excludePriorEditions);
    setEnabled(configData.enabled);
    focuses.setSelectedFocuses(
      configData.focuses.map((f) => ({
        focusId: f.focusId,
        position: f.position,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData]);

  return {
    name,
    setName,
    icon,
    setIcon,
    schedule,
    setSchedule,
    lookbackHours,
    setLookbackHours,
    excludePriorEditions,
    setExcludePriorEditions,
    enabled,
    setEnabled,
    selectedFocuses: focuses.selectedFocuses,
    toggleFocus: focuses.toggleFocus,
    updateFocusField: focuses.updateFocusField,
    moveFocus: focuses.moveFocus,
  };
};

/* ── Build PATCH body ─────────────────────────────────────────────── */

const buildPatchBody = (
  config: EditionConfig,
  state: {
    name: string;
    icon: string | null;
    schedule: string;
    lookbackHours: number;
    excludePriorEditions: boolean;
    enabled: boolean;
    selectedFocuses: FocusConfig[];
  },
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (state.name !== config.name) {
    body.name = state.name;
  }
  if (state.icon !== config.icon) {
    body.icon = state.icon;
  }
  if (state.schedule !== config.schedule) {
    body.schedule = state.schedule;
  }
  if (state.lookbackHours !== config.lookbackHours) {
    body.lookbackHours = state.lookbackHours;
  }
  if (state.excludePriorEditions !== config.excludePriorEditions) {
    body.excludePriorEditions = state.excludePriorEditions;
  }
  if (state.enabled !== config.enabled) {
    body.enabled = state.enabled;
  }

  const focusesChanged =
    JSON.stringify(state.selectedFocuses) !==
    JSON.stringify(
      config.focuses.map((f) => ({
        focusId: f.focusId,
        position: f.position,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    );

  if (focusesChanged) {
    body.focuses = state.selectedFocuses.map((f, i) => ({
      focusId: f.focusId,
      position: i,
      budgetType: f.budgetType,
      budgetValue: f.budgetValue,
      lookbackHours: f.lookbackHours,
      excludePriorEditions: f.excludePriorEditions,
      weight: f.weight,
    }));
  }

  return body;
};

/* ── Schedule helpers ─────────────────────────────────────────────── */

const isPresetSchedule = (schedule: string): boolean =>
  SCHEDULE_PRESETS.some((p) => p.value !== '__custom__' && p.value === schedule);

const scheduleSelectValue = (schedule: string): string => (isPresetSchedule(schedule) ? schedule : '__custom__');

/* ── Exports ──────────────────────────────────────────────────────── */

export type { EditionConfig, EditEditionFormResult };
export {
  SCHEDULE_PRESETS,
  useEditEditionData,
  useEditEditionForm,
  buildPatchBody,
  isPresetSchedule,
  scheduleSelectValue,
};
