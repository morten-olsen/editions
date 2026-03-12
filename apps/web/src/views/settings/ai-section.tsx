import { useState } from 'react';

import { useAi } from '../../ai/ai.ts';
import { Button } from '../../components/button.tsx';
import { Input } from '../../components/input.tsx';
import type { AiConfig } from '../../ai/ai.ts';

const AiSection = (): React.ReactNode => {
  const { config, setConfig, removeConfig, isEnabled } = useAi();
  const [endpoint, setEndpoint] = useState(config?.endpoint ?? '');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [model, setModel] = useState(config?.model ?? '');
  const [dirty, setDirty] = useState(false);

  const handleSave = (): void => {
    if (!endpoint.trim() || !apiKey.trim() || !model.trim()) {
      return;
    }
    const newConfig: AiConfig = {
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    };
    setConfig(newConfig);
    setDirty(false);
  };

  const handleRemove = (): void => {
    removeConfig();
    setEndpoint('');
    setApiKey('');
    setModel('');
    setDirty(false);
  };

  const handleChange = (field: 'endpoint' | 'apiKey' | 'model', value: string): void => {
    if (field === 'endpoint') {
      setEndpoint(value);
    }
    if (field === 'apiKey') {
      setApiKey(value);
    }
    if (field === 'model') {
      setModel(value);
    }
    setDirty(true);
  };

  return (
    <div
      className="flex flex-col gap-6"
      data-ai-id="settings-assistant"
      data-ai-role="section"
      data-ai-label="Assistant configuration"
    >
      <div className="text-sm text-ink-secondary leading-relaxed flex flex-col gap-2">
        <p>
          Connect an OpenAI-compatible AI provider to enable the AI assistant. The assistant can help you set up
          sources, focuses, and editions through natural conversation.
        </p>
        <p className="text-xs text-ink-tertiary">
          Your API key is stored locally in your browser and only sent to your configured provider.
        </p>
      </div>

      <AiFormFields endpoint={endpoint} apiKey={apiKey} model={model} onChange={handleChange} />

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || !endpoint.trim() || !apiKey.trim() || !model.trim()}
          onClick={handleSave}
          data-ai-id="settings-ai-save"
          data-ai-role="button"
          data-ai-label={isEnabled ? 'Update assistant' : 'Enable assistant'}
        >
          {isEnabled ? 'Update' : 'Enable assistant'}
        </Button>
        {isEnabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            data-ai-id="settings-ai-disable"
            data-ai-role="button"
            data-ai-label="Disable assistant"
          >
            Disable assistant
          </Button>
        )}
      </div>

      {isEnabled && (
        <div
          className="rounded-md bg-positive-subtle px-3.5 py-2.5 text-xs text-positive"
          data-ai-id="settings-ai-status"
          data-ai-role="status"
          data-ai-label="Assistant is enabled"
        >
          Assistant is enabled. Look for the sparkle icon in the sidebar.
        </div>
      )}
    </div>
  );
};

const AiFormFields = ({
  endpoint,
  apiKey,
  model,
  onChange,
}: {
  endpoint: string;
  apiKey: string;
  model: string;
  onChange: (field: 'endpoint' | 'apiKey' | 'model', value: string) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-4">
    <Input
      label="API Endpoint"
      description="The base URL of your OpenAI-compatible API"
      placeholder="https://api.openai.com/v1"
      value={endpoint}
      onChange={(e) => onChange('endpoint', e.target.value)}
      data-ai-id="settings-ai-endpoint"
      data-ai-role="input"
      data-ai-label="API Endpoint"
      data-ai-value={endpoint}
    />
    <Input
      label="API Key"
      type="password"
      description="Your API key for authentication"
      placeholder="sk-..."
      value={apiKey}
      onChange={(e) => onChange('apiKey', e.target.value)}
      data-ai-id="settings-ai-key"
      data-ai-role="input"
      data-ai-label="API Key"
      data-ai-value={apiKey ? '••••••' : ''}
    />
    <Input
      label="Model"
      description="The model identifier to use"
      placeholder="gpt-4o"
      value={model}
      onChange={(e) => onChange('model', e.target.value)}
      data-ai-id="settings-ai-model"
      data-ai-role="input"
      data-ai-label="Model"
      data-ai-value={model}
    />
  </div>
);

export { AiSection };
