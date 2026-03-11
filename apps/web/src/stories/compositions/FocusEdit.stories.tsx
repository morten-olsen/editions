import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "../../components/input.tsx";
import { Textarea } from "../../components/textarea.tsx";
import { Button } from "../../components/button.tsx";
import { Checkbox } from "../../components/checkbox.tsx";
import { Separator } from "../../components/separator.tsx";
import { IconPicker } from "../../components/icon-picker.tsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const selectClasses =
  "rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent";

const priorityLabel = (w: number): string => {
  if (w <= 0.1) return "Off";
  if (w < 0.75) return "Low";
  if (w <= 1.25) return "Normal";
  if (w <= 2.1) return "High";
  return "Top";
};

const confidenceHint = (v: number): string => {
  if (v === 0) return "All articles";
  if (v <= 30) return "Loose match";
  if (v <= 60) return "Moderate";
  if (v <= 80) return "Strong match";
  return "Exact match";
};

// ─── Sample data ─────────────────────────────────────────────────────────────

type SourceSelection = {
  sourceId: string;
  mode: "always" | "match";
  weight: number;
};

const ALL_SOURCES = [
  { id: "1", name: "Ars Technica", url: "https://arstechnica.com" },
  { id: "2", name: "Hacker News", url: "https://news.ycombinator.com" },
  { id: "3", name: "The Verge", url: "https://theverge.com" },
  { id: "4", name: "Reuters", url: "https://reuters.com" },
  { id: "5", name: "The Guardian", url: "https://theguardian.com" },
];

// ─── Form component ───────────────────────────────────────────────────────────

const FocusEditForm = ({ mode }: { mode: "create" | "edit" }): React.ReactElement => {
  const [name, setName] = useState(mode === "edit" ? "Technology" : "");
  const [description, setDescription] = useState(
    mode === "edit" ? "News about software, startups, and the tech industry" : "",
  );
  const [icon, setIcon] = useState<string | null>(mode === "edit" ? "cpu" : null);
  const [minConfidence, setMinConfidence] = useState(mode === "edit" ? 40 : 0);
  const [minReadingTime, setMinReadingTime] = useState(mode === "edit" ? "2" : "");
  const [maxReadingTime, setMaxReadingTime] = useState(mode === "edit" ? "20" : "");
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>(
    mode === "edit"
      ? [
          { sourceId: "1", mode: "always", weight: 2 },
          { sourceId: "2", mode: "match", weight: 1 },
        ]
      : [],
  );

  const selectedIds = new Set(selectedSources.map((s) => s.sourceId));

  const toggleSource = (sourceId: string): void => {
    setSelectedSources((prev) => {
      const existing = prev.find((s) => s.sourceId === sourceId);
      if (existing) return prev.filter((s) => s.sourceId !== sourceId);
      return [...prev, { sourceId, mode: "always", weight: 1 }];
    });
  };

  const changeMode = (sourceId: string, m: "always" | "match"): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, mode: m } : s)));
  };

  const changeWeight = (sourceId: string, weight: number): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, weight } : s)));
  };

  return (
    <form className="max-w-lg flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-5">
        <Input
          label="Name"
          placeholder="Technology"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description"
          description="Helps the app recognise which articles belong here — the more specific, the better."
          placeholder="News about software, startups, and the tech industry"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <IconPicker value={icon} onChange={setIcon} />

        {/* Match strength */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            How closely articles must match
          </label>
          <p className="text-xs text-ink-tertiary -mt-0.5">
            Raise this to only include articles that are clearly a strong match. At 0%, anything potentially relevant is included.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
              {minConfidence === 0 ? "All articles" : `${minConfidence}% — ${confidenceHint(minConfidence)}`}
            </span>
          </div>
        </div>

        {/* Reading time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Reading time</label>
          <p className="text-xs text-ink-tertiary -mt-0.5">
            Only include articles within this length. Leave blank for any length.
          </p>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Min"
              type="number"
              min={0}
              value={minReadingTime}
              onChange={(e) => setMinReadingTime(e.target.value)}
              className="flex-1"
            />
            <span className="text-xs text-ink-tertiary">to</span>
            <Input
              placeholder="Max"
              type="number"
              min={0}
              value={maxReadingTime}
              onChange={(e) => setMaxReadingTime(e.target.value)}
              className="flex-1"
            />
            <span className="text-xs text-ink-tertiary whitespace-nowrap">minutes</span>
          </div>
        </div>
      </div>

      <Separator soft />

      {/* Sources */}
      <div>
        <div className="text-sm font-medium text-ink mb-0.5">Sources</div>
        <p className="text-xs text-ink-tertiary mb-4">
          Choose which sources feed this topic and how articles from each are selected.
        </p>
        <div className="flex flex-col gap-1">
          {ALL_SOURCES.map((source) => {
            const isSelected = selectedIds.has(source.id);
            const selection = selectedSources.find((s) => s.sourceId === source.id);

            return (
              <div
                key={source.id}
                className={`rounded-md transition-colors duration-fast ${isSelected ? "bg-surface-sunken/50 p-3" : "px-3 py-2"}`}
              >
                <div className="flex items-center justify-between">
                  <Checkbox
                    label={source.name}
                    checked={isSelected}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  {isSelected && selection && (
                    <select
                      value={selection.mode}
                      onChange={(e) => changeMode(source.id, e.target.value as "always" | "match")}
                      className={selectClasses}
                    >
                      <option value="always">All articles</option>
                      <option value="match">Matching only</option>
                    </select>
                  )}
                </div>
                {isSelected && selection && (
                  <div className="mt-2 pl-7 flex items-center gap-3">
                    <span className="text-xs text-ink-tertiary shrink-0">Priority</span>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={selection.weight}
                      onChange={(e) => changeWeight(source.id, Number(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
                      {priorityLabel(selection.weight)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" type="submit">
          {mode === "edit" ? "Save changes" : "Create topic"}
        </Button>
        <Button variant="ghost" type="button">
          Cancel
        </Button>
      </div>
    </form>
  );
};

// ─── Stories ──────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Design System/Compositions/Focus Edit",
  parameters: {
    layout: "padded",
  },
};

type Story = StoryObj;

const CreateFocus: Story = {
  name: "Create topic",
  render: () => (
    <div className="py-8 px-6 max-w-2xl">
      <div className="mb-8">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">New topic</div>
        <h1 className="text-2xl font-serif tracking-tight text-ink mb-1">New topic</h1>
        <p className="text-sm text-ink-secondary">A topic that shapes what appears in your editions</p>
      </div>
      <FocusEditForm mode="create" />
    </div>
  ),
};

const EditFocus: Story = {
  name: "Edit topic",
  render: () => (
    <div className="py-8 px-6 max-w-2xl">
      <div className="mb-8">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">Edit topic</div>
        <h1 className="text-2xl font-serif tracking-tight text-ink">Technology</h1>
      </div>
      <FocusEditForm mode="edit" />
    </div>
  ),
};

export default meta;
export { CreateFocus, EditFocus };
