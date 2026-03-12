import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../api/api.ts';
import { useAuthHeaders, queryKeys } from '../api/api.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Checkbox } from '../components/checkbox.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';
import { FocusConfigCard, AvailableFocusesList } from '../views/editions/focus-config-card.tsx';
import type { FocusConfig, Focus } from '../views/editions/focus-config-card.tsx';
import { ScheduleField, LookbackField } from '../views/editions/edition-form-fields.tsx';
import {
  useEditEditionData,
  useEditEditionForm,
  buildPatchBody,
  isPresetSchedule,
  scheduleSelectValue,
} from '../hooks/editions/editions.edit-hooks.ts';
import type { EditionConfig, EditEditionFormResult } from '../hooks/editions/editions.edit-hooks.ts';

/* ---- Mutation hook ---- */

const useUpdateEditionConfig = (
  configId: string,
  headers: Record<string, string> | undefined,
): { mutate: (body: Record<string, unknown>) => void; isPending: boolean; error: string | null } => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.PATCH('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        body,
        headers,
      });
      if (err) {
        throw new Error('Failed to update edition config');
      }
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.config(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions/$configId', params: { configId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending, error };
};

/* ---- Main page component ---- */

const EditEditionConfigPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const { configId } = Route.useParams();

  const { configQuery, focusesQuery } = useEditEditionData(configId, headers);
  const form = useEditEditionForm(configQuery.data);
  const update = useUpdateEditionConfig(configId, headers);

  if (!headers) {
    return null;
  }

  if (configQuery.isLoading || focusesQuery.isLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  const config = configQuery.data ?? null;
  if (!config) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">
          {update.error ?? configQuery.error?.message ?? 'Edition config not found'}
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const body = buildPatchBody(config, form);
    if (Object.keys(body).length === 0) {
      void navigate({ to: '/editions/$configId', params: { configId } });
      return;
    }
    update.mutate(body);
  };

  return (
    <EditEditionForm
      form={form}
      config={config}
      allFocuses={focusesQuery.data ?? []}
      isPending={update.isPending}
      error={update.error}
      onSubmit={handleSubmit}
      onCancel={() => void navigate({ to: '/editions/$configId', params: { configId } })}
    />
  );
};

/* ---- Form layout ---- */

type EditEditionFormProps = {
  form: EditEditionFormResult;
  config: EditionConfig;
  allFocuses: Focus[];
  isPending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

const EditEditionForm = ({
  form,
  config: _config,
  allFocuses,
  isPending,
  error,
  onSubmit,
  onCancel,
}: EditEditionFormProps): React.ReactNode => {
  const selectedIds = new Set(form.selectedFocuses.map((f) => f.focusId));

  return (
    <>
      <PageHeader title="Edit edition" />
      {error && <FormError error={error} />}
      <form
        onSubmit={onSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edit-edition-form"
        data-ai-role="form"
        data-ai-label="Edit edition form"
      >
        <EditEditionFields form={form} />
        <Separator soft />
        <FocusesSection
          selectedFocuses={form.selectedFocuses}
          allFocuses={allFocuses}
          toggleFocus={form.toggleFocus}
          updateFocusField={form.updateFocusField}
          moveFocus={form.moveFocus}
        />
        <AvailableFocusesList
          allFocuses={allFocuses}
          selectedIds={selectedIds}
          onToggle={form.toggleFocus}
          idPrefix="edit-edition"
        />
        <FormActions isPending={isPending} onCancel={onCancel} />
      </form>
    </>
  );
};

/* ---- Small presentational components ---- */

const FormError = ({ error }: { error: string }): React.ReactNode => (
  <div
    className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
    data-ai-id="edit-edition-error"
    data-ai-role="error"
    data-ai-error={error}
  >
    {error}
  </div>
);

const FormActions = ({ isPending, onCancel }: { isPending: boolean; onCancel: () => void }): React.ReactNode => (
  <div className="flex items-center gap-3">
    <Button
      variant="primary"
      type="submit"
      disabled={isPending}
      data-ai-id="edit-edition-submit"
      data-ai-role="button"
      data-ai-label="Save changes"
      data-ai-state={isPending ? 'loading' : 'idle'}
    >
      {isPending ? 'Saving…' : 'Save changes'}
    </Button>
    <Button
      variant="ghost"
      type="button"
      onClick={onCancel}
      data-ai-id="edit-edition-cancel"
      data-ai-role="button"
      data-ai-label="Cancel"
    >
      Cancel
    </Button>
  </div>
);

/* ---- Form fields ---- */

const EditEditionFields = ({ form }: { form: EditEditionFormResult }): React.ReactNode => (
  <div className="flex flex-col gap-5">
    <Input
      label="Name"
      required
      value={form.name}
      onChange={(e) => form.setName(e.target.value)}
      data-ai-id="edit-edition-name"
      data-ai-role="input"
      data-ai-label="Edition name"
      data-ai-value={form.name}
    />
    <IconPicker value={form.icon} onChange={form.setIcon} />
    <ScheduleField
      schedule={form.schedule}
      setSchedule={form.setSchedule}
      isPresetSchedule={isPresetSchedule(form.schedule)}
      scheduleSelectValue={scheduleSelectValue(form.schedule)}
    />
    <LookbackField lookbackHours={form.lookbackHours} setLookbackHours={form.setLookbackHours} />
    <Checkbox
      label="Don't repeat articles across editions"
      description="Articles that appeared in a previous issue of this digest won't be included again"
      checked={form.excludePriorEditions}
      onCheckedChange={(checked) => form.setExcludePriorEditions(checked === true)}
      data-ai-id="edit-edition-exclude-prior"
      data-ai-role="checkbox"
      data-ai-label="Don't repeat articles across editions"
      data-ai-state={form.excludePriorEditions ? 'checked' : 'unchecked'}
    />
    <Checkbox
      label="Active"
      description="When off, this edition won't be generated automatically"
      checked={form.enabled}
      onCheckedChange={(checked) => form.setEnabled(checked === true)}
      data-ai-id="edit-edition-enabled"
      data-ai-role="checkbox"
      data-ai-label="Active"
      data-ai-state={form.enabled ? 'checked' : 'unchecked'}
    />
  </div>
);

/* ---- Selected focuses section ---- */

const FocusesSection = ({
  selectedFocuses,
  allFocuses,
  toggleFocus,
  updateFocusField,
  moveFocus,
}: {
  selectedFocuses: FocusConfig[];
  allFocuses: Focus[];
  toggleFocus: (focusId: string) => void;
  updateFocusField: (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ) => void;
  moveFocus: (focusId: string, direction: -1 | 1) => void;
}): React.ReactNode => (
  <div>
    <div className="text-sm font-medium text-ink mb-0.5">
      Topics{' '}
      {selectedFocuses.length > 0 && <span className="text-ink-tertiary font-normal">({selectedFocuses.length})</span>}
    </div>
    <p className="text-xs text-ink-tertiary mb-4">
      Each topic becomes a section in your edition. Use the arrows to reorder.
    </p>
    {selectedFocuses.length === 0 ? (
      <FocusesEmptyState />
    ) : (
      <div className="flex flex-col gap-3">
        {selectedFocuses.map((fc, idx) => {
          const focus = allFocuses.find((f) => f.id === fc.focusId);
          if (!focus) {
            return null;
          }
          return (
            <FocusConfigCard
              key={fc.focusId}
              focusConfig={fc}
              focus={focus}
              idx={idx}
              total={selectedFocuses.length}
              onMove={(dir) => moveFocus(fc.focusId, dir)}
              onRemove={() => toggleFocus(fc.focusId)}
              onUpdateField={(field, value) => updateFocusField(fc.focusId, field, value)}
            />
          );
        })}
      </div>
    )}
  </div>
);

const FocusesEmptyState = (): React.ReactNode => (
  <div className="rounded-lg border border-dashed border-border py-6 text-center">
    <p className="text-sm text-ink-tertiary">No topics added yet.</p>
    <p className="text-xs text-ink-faint mt-1">Choose from the list below to get started.</p>
  </div>
);

const Route = createFileRoute('/editions/$configId/edit')({
  component: EditEditionConfigPage,
});

export { Route };
