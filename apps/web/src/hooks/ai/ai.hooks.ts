import { useState } from "react";

import { useAi } from "../../ai/ai.ts";

import type { AiConfig } from "../../ai/ai.ts";

type UseAiSettingsResult = {
  endpoint: string;
  apiKey: string;
  model: string;
  dirty: boolean;
  isEnabled: boolean;
  handleChange: (field: "endpoint" | "apiKey" | "model", value: string) => void;
  save: () => void;
  remove: () => void;
  canSave: boolean;
};

const useAiSettings = (): UseAiSettingsResult => {
  const { config, setConfig, removeConfig, isEnabled } = useAi();
  const [endpoint, setEndpoint] = useState(config?.endpoint ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(config?.model ?? "");
  const [dirty, setDirty] = useState(false);

  const canSave = dirty && !!endpoint.trim() && !!apiKey.trim() && !!model.trim();

  const handleChange = (field: "endpoint" | "apiKey" | "model", value: string): void => {
    if (field === "endpoint") setEndpoint(value);
    if (field === "apiKey") setApiKey(value);
    if (field === "model") setModel(value);
    setDirty(true);
  };

  const save = (): void => {
    if (!endpoint.trim() || !apiKey.trim() || !model.trim()) return;
    const newConfig: AiConfig = {
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    };
    setConfig(newConfig);
    setDirty(false);
  };

  const remove = (): void => {
    removeConfig();
    setEndpoint("");
    setApiKey("");
    setModel("");
    setDirty(false);
  };

  return {
    endpoint,
    apiKey,
    model,
    dirty,
    isEnabled,
    handleChange,
    save,
    remove,
    canSave,
  };
};

export type { UseAiSettingsResult };
export { useAiSettings };
