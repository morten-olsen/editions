import { useRef, useState } from 'react';

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
      const res = await fetch('/api/data/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Export failed: ${res.statusText}`);
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editions-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      if (typeof data !== 'object' || data === null || !('version' in data)) {
        throw new Error('Invalid export file format');
      }

      const res = await fetch('/api/data/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: text,
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Import failed: ${res.statusText}`);
      }

      const result = (await res.json()) as ImportResult;
      setImportResult(result);
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
      {/* Export */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">Export</h3>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Download all your data as a JSON file: sources, articles, embeddings, focuses, edition configs, editions,
            and scoring weights. The export is portable — it can be imported into any Editions instance.
          </p>
        </div>
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={exportStatus === 'loading'}
            onClick={() => void handleExport()}
          >
            {exportStatus === 'loading' ? 'Exporting...' : 'Download export'}
          </Button>
          {exportStatus === 'success' && <span className="ml-3 text-xs text-positive">Export downloaded</span>}
        </div>
      </div>

      <Separator soft />

      {/* Import */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">Import</h3>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Import data from an Editions export file. This replaces all existing sources, focuses, edition configs, and
            scoring weights with the contents of the file.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={onFileChange}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={importStatus === 'loading'}
            onClick={() => fileInputRef.current?.click()}
          >
            {importStatus === 'loading' ? 'Importing...' : 'Choose file to import'}
          </Button>
        </div>

        {/* Import results */}
        {importResult && (
          <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-xs text-ink-secondary flex flex-col gap-1">
            {importResult.sources > 0 && <span className="text-positive">{importResult.sources} sources imported</span>}
            {importResult.articles > 0 && <span className="text-positive">{importResult.articles} articles imported</span>}
            {importResult.focuses > 0 && <span className="text-positive">{importResult.focuses} focuses imported</span>}
            {importResult.editionConfigs > 0 && (
              <span className="text-positive">{importResult.editionConfigs} edition configs imported</span>
            )}
            {importResult.editions > 0 && (
              <span className="text-positive">{importResult.editions} editions imported</span>
            )}
            {importResult.scoringWeightsImported && <span className="text-positive">Scoring weights imported</span>}
            {importResult.sources === 0 &&
              importResult.articles === 0 &&
              importResult.focuses === 0 &&
              importResult.editionConfigs === 0 &&
              importResult.editions === 0 &&
              !importResult.scoringWeightsImported && <span className="text-ink-faint">Nothing to import</span>}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-critical/20 bg-critical/5 px-4 py-3 text-xs text-critical">{error}</div>
      )}
    </div>
  );
};

export { DataSection };
