import { useState } from 'react';

import { Button } from '../../components/button.tsx';
import { Input } from '../../components/input.tsx';
import { Separator } from '../../components/separator.tsx';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../../hooks/api-keys/api-keys.hooks.ts';
import type { ApiKey, ApiKeyScope, CreatedApiKey } from '../../hooks/api-keys/api-keys.hooks.ts';

/* ── Scope metadata ──────────────────────────────────────────────── */

const SCOPES: { value: ApiKeyScope; label: string; blurb: string }[] = [
  { value: 'read', label: 'Read', blurb: 'Look at sources, focuses and previews. Cannot change anything.' },
  { value: 'write', label: 'Write', blurb: 'Add sources, create focuses and generate editions. Cannot delete.' },
  { value: 'admin', label: 'Admin', blurb: 'Everything, including permanently deleting sources and focuses.' },
];

const scopeLabel = (scope: ApiKeyScope): string => SCOPES.find((s) => s.value === scope)?.label ?? scope;

const mcpUrl = (): string => `${window.location.origin}/api/mcp`;

const formatDate = (value: string | null): string =>
  value === null ? 'Never' : new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });

/* ── One-time secret reveal ──────────────────────────────────────── */

const SecretReveal = ({ created, onDismiss }: { created: CreatedApiKey; onDismiss: () => void }): React.ReactNode => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(created.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-accent-subtle/40 p-4 flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-medium text-ink">“{created.name}” created</h4>
        <p className="text-xs text-ink-secondary mt-0.5">
          Copy it now — this is the only time it will be shown. Only a hash is stored, so it cannot be recovered.
        </p>
      </div>

      <code className="block break-all rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-ink">
        {created.key}
      </code>

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy key'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
};

/* ── Create form ─────────────────────────────────────────────────── */

const CreateKeyForm = ({ onCreated }: { onCreated: (key: CreatedApiKey) => void }): React.ReactNode => {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('write');
  const create = useCreateApiKey();

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (name.trim().length === 0) {
      return;
    }
    create.mutate(
      { name: name.trim(), scope },
      {
        onSuccess: (created) => {
          setName('');
          setScope('write');
          onCreated(created);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Key name"
        description="Something you'll recognise later, like “Claude Desktop”."
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My agent"
        maxLength={100}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink mb-1">Permissions</legend>
        {SCOPES.map((option) => (
          <label
            key={option.value}
            className={`flex gap-3 rounded-md border p-3 cursor-pointer transition-colors duration-fast ${
              scope === option.value ? 'border-accent bg-accent-subtle/30' : 'border-border hover:bg-surface-sunken'
            }`}
          >
            <input
              type="radio"
              name="scope"
              value={option.value}
              checked={scope === option.value}
              onChange={() => setScope(option.value)}
              className="mt-0.5 accent-accent"
            />
            <span>
              <span className="block text-sm text-ink">{option.label}</span>
              <span className="block text-xs text-ink-tertiary mt-0.5">{option.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {create.isError && <p className="text-xs text-critical">{create.error.message}</p>}

      <div>
        <Button type="submit" variant="primary" size="sm" disabled={create.isPending || name.trim().length === 0}>
          {create.isPending ? 'Creating…' : 'Create key'}
        </Button>
      </div>
    </form>
  );
};

/* ── Key list ────────────────────────────────────────────────────── */

const KeyRow = ({ apiKey }: { apiKey: ApiKey }): React.ReactNode => {
  const revoke = useRevokeApiKey();
  const [confirming, setConfirming] = useState(false);
  const revoked = apiKey.revokedAt !== null;

  return (
    <li className={`flex items-start justify-between gap-4 py-3 ${revoked ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm text-ink truncate">
          {apiKey.name}
          {revoked && <span className="ml-2 text-xs text-ink-faint">revoked</span>}
        </p>
        <p className="text-xs text-ink-tertiary mt-0.5">
          <span className="font-mono">ek_{apiKey.keyPrefix}…</span>
          {' · '}
          {scopeLabel(apiKey.scope)}
          {' · '}
          created {formatDate(apiKey.createdAt)}
          {' · '}
          last used {formatDate(apiKey.lastUsedAt)}
        </p>
      </div>

      {!revoked &&
        (confirming ? (
          <span className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(apiKey.id)}
            >
              Revoke
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setConfirming(true)}>
            Revoke
          </Button>
        ))}
    </li>
  );
};

/* ── Connection help ─────────────────────────────────────────────── */

const ConnectionDetails = (): React.ReactNode => {
  const [copied, setCopied] = useState(false);
  const url = mcpUrl();

  const snippet = JSON.stringify(
    { mcpServers: { editions: { type: 'http', url, headers: { Authorization: 'Bearer YOUR_KEY' } } } },
    null,
    2,
  );

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-ink">Connecting an agent</h3>
        <p className="text-sm text-ink-secondary mt-1">
          Editions speaks the Model Context Protocol over HTTP, so an agent can add sources, tune focuses and compose
          editions for you. Point your client at this URL and send a key as a bearer token — nothing to install.
        </p>
      </div>

      <div>
        <span className="text-xs text-ink-tertiary">Server URL</span>
        <code className="mt-1 block break-all rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-ink">
          {url}
        </code>
      </div>

      <div>
        <span className="text-xs text-ink-tertiary">Example client config</span>
        <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-ink">
          {snippet}
        </pre>
      </div>

      <div>
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy config'}
        </Button>
      </div>
    </div>
  );
};

/* ── Section ─────────────────────────────────────────────────────── */

const IntegrationsSection = (): React.ReactNode => {
  const { data: keys, isLoading } = useApiKeys();
  const [justCreated, setJustCreated] = useState<CreatedApiKey | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <ConnectionDetails />

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium text-ink">API keys</h3>
          <p className="text-sm text-ink-secondary mt-1">
            Each key carries its own permissions. Give an agent the narrowest scope that lets it do the job, and revoke
            the key if you stop using it.
          </p>
        </div>

        {justCreated && <SecretReveal created={justCreated} onDismiss={() => setJustCreated(null)} />}

        {isLoading ? (
          <p className="text-sm text-ink-tertiary">Loading keys…</p>
        ) : keys && keys.length > 0 ? (
          <ul className="divide-y divide-border">
            {keys.map((apiKey) => (
              <KeyRow key={apiKey.id} apiKey={apiKey} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-tertiary">No keys yet.</p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-ink">Create a key</h3>
        <CreateKeyForm onCreated={setJustCreated} />
      </div>
    </div>
  );
};

export { IntegrationsSection };
