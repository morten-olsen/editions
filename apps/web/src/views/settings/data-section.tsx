import { useRef, useState } from 'react';

import { bearer, client } from '../../api/api.ts';
import type { ApiBody } from '../../api/api.ts';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';

type Status = 'idle' | 'loading' | 'success' | 'error';

type ImportResult = {
  sources: number;
  articles: number;
  focuses: number;
  editionConfigs: number;
  editions: number;
  scoringWeightsImported: boolean;
};

/* ── Private helpers ───────────────────────────────────────────────── */

const downloadExport = async (token: string): Promise<void> => {
  const { data, error: err } = await client.GET('/api/data/export', { headers: bearer(token) });
  if (err || !data) {
    throw new Error('Export failed');
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `editions-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const uploadImport = async (token: string, file: File): Promise<ImportResult> => {
  const parsed = JSON.parse(await file.text()) as unknown;
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error('Invalid export file format');
  }

  const { data, error: err } = await client.POST('/api/data/import', {
    body: parsed as ApiBody<'/api/data/import', 'post'>,
    headers: bearer(token),
  });

  if (err || !data) {
    throw new Error((err as { error?: string } | undefined)?.error ?? 'Import failed');
  }

  return data as ImportResult;
};

/* ── Subcomponents ─────────────────────────────────────────────────── */

const ExportPanel = ({ status, onExport }: { status: Status; onExport: () => void }): React.ReactElement => (
  <div className="flex flex-col gap-3">
    <div>
      <h3 className="text-sm font-medium text-ink">Export</h3>
      <p className="text-xs text-ink-tertiary mt-0.5">
        Download all your data as a JSON file: sources, articles, embeddings, focuses, edition configs, editions, and
        scoring weights. The export is portable — it can be imported into any Editions instance.
      </p>
    </div>
    <div>
      <Button variant="secondary" size="sm" disabled={status === 'loading'} onClick={onExport}>
        {status === 'loading' ? 'Exporting...' : 'Download export'}
      </Button>
      {status === 'success' && <span className="ml-3 text-xs text-positive">Export downloaded</span>}
    </div>
  </div>
);

const ImportResultSummary = ({ result }: { result: ImportResult }): React.ReactElement => {
  const isEmpty =
    result.sources === 0 &&
    result.articles === 0 &&
    result.focuses === 0 &&
    result.editionConfigs === 0 &&
    result.editions === 0 &&
    !result.scoringWeightsImported;

  return (
    <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-xs text-ink-secondary flex flex-col gap-1">
      {result.sources > 0 && <span className="text-positive">{result.sources} sources imported</span>}
      {result.articles > 0 && <span className="text-positive">{result.articles} articles imported</span>}
      {result.focuses > 0 && <span className="text-positive">{result.focuses} focuses imported</span>}
      {result.editionConfigs > 0 && (
        <span className="text-positive">{result.editionConfigs} edition configs imported</span>
      )}
      {result.editions > 0 && <span className="text-positive">{result.editions} editions imported</span>}
      {result.scoringWeightsImported && <span className="text-positive">Scoring weights imported</span>}
      {isEmpty && <span className="text-ink-faint">Nothing to import</span>}
    </div>
  );
};

type ImportPanelProps = {
  status: Status;
  result: ImportResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const ImportPanel = ({ status, result, fileInputRef, onFileChange }: ImportPanelProps): React.ReactElement => (
  <div className="flex flex-col gap-3">
    <div>
      <h3 className="text-sm font-medium text-ink">Import</h3>
      <p className="text-xs text-ink-tertiary mt-0.5">
        Import data from an Editions export file. This replaces all existing sources, focuses, edition configs, and
        scoring weights with the contents of the file.
      </p>
    </div>
    <div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={onFileChange} className="hidden" />
      <Button
        variant="secondary"
        size="sm"
        disabled={status === 'loading'}
        onClick={() => fileInputRef.current?.click()}
      >
        {status === 'loading' ? 'Importing...' : 'Choose file to import'}
      </Button>
    </div>

    {result && <ImportResultSummary result={result} />}
  </div>
);

/* ── Section ───────────────────────────────────────────────────────── */

const DataSection = ({ token }: { token: string }): React.ReactNode => {
  const [exportStatus, setExportStatus] = useState<Status>('idle');
  const [importStatus, setImportStatus] = useState<Status>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (): Promise<void> => {
    setExportStatus('loading');
    setError(null);
    try {
      await downloadExport(token);
      setExportStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setExportStatus('error');
    }
  };

  const handleImport = async (file: File): Promise<void> => {
    setImportStatus('loading');
    setImportResult(null);
    setError(null);
    try {
      setImportResult(await uploadImport(token, file));
      setImportStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('error');
    }
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      const confirmed = window.confirm(
        'This will replace all your existing sources, focuses, edition configs, and scoring weights. Continue?',
      );
      if (confirmed) {
        void handleImport(file);
      } else if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ExportPanel status={exportStatus} onExport={() => void handleExport()} />

      <Separator soft />

      <ImportPanel
        status={importStatus}
        result={importResult}
        fileInputRef={fileInputRef}
        onFileChange={onFileChange}
      />

      {error && (
        <div className="rounded-lg border border-critical/20 bg-critical/5 px-4 py-3 text-xs text-critical">
          {error}
        </div>
      )}
    </div>
  );
};

export { DataSection };
