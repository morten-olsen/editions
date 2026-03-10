import { useMemo, useState } from "react";

import { EntityIcon, iconNames } from "./entity-icon.tsx";

type IconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
};

const curatedIcons = [
  // Technology
  "monitor", "laptop", "smartphone", "tablet", "cpu", "code", "terminal",
  "globe", "wifi", "database", "server", "hard-drive", "cloud", "bug",
  "git-branch", "circuit-board", "radio", "satellite", "bot", "computer",
  "binary", "braces",
  // Science & education
  "flask-conical", "microscope", "atom", "dna", "test-tube", "book-open",
  "book", "library", "graduation-cap", "school", "pen", "pencil",
  // Business & finance
  "briefcase", "trending-up", "dollar-sign", "bar-chart-3", "pie-chart",
  "line-chart", "banknote", "wallet", "credit-card", "building-2",
  "landmark", "store", "shopping-cart", "package", "truck",
  // People & communication
  "users", "user", "message-circle", "message-square", "mail", "at-sign",
  "phone", "video", "megaphone", "bell",
  // Media & creative
  "camera", "film", "music", "headphones", "mic", "palette", "brush",
  "image", "file-text", "newspaper", "tv",
  // Health & wellness
  "heart", "heart-pulse", "activity", "stethoscope", "pill", "apple",
  "dumbbell",
  // Nature & environment
  "leaf", "tree-pine", "flower-2", "sun", "moon", "snowflake", "droplets",
  "waves", "mountain", "flame", "wind",
  // Travel & transport
  "plane", "car", "train", "ship", "bike", "map-pin", "map", "compass",
  "navigation",
  // Food & drink
  "utensils", "coffee", "wine", "cooking-pot", "sandwich", "ice-cream-cone",
  // Gaming & sports
  "gamepad-2", "trophy", "medal", "swords", "puzzle", "dice-5",
  // Security & law
  "shield", "shield-check", "lock", "key", "fingerprint", "eye", "scale",
  "gavel",
  // Tools
  "hammer", "wrench", "settings", "cog", "sliders-horizontal", "ruler",
  "scissors",
  // Symbols
  "zap", "star", "sparkles", "target", "crosshair", "lightbulb", "rocket",
  "crown", "diamond", "gem", "flag", "bookmark", "tag", "hash", "link",
  "infinity",
  // Animals
  "dog", "cat", "bird", "fish", "rabbit",
  // Misc
  "home", "calendar", "clock", "timer", "alarm-clock", "gift",
  "party-popper", "handshake", "thumbs-up", "award",
];

const formatLabel = (name: string): string =>
  name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const IconPicker = ({ value, onChange }: IconPickerProps): React.ReactElement => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return curatedIcons;
    const q = search.toLowerCase();
    const matches = iconNames.filter((name) => name.includes(q));
    // Show curated matches first, then the rest
    const curated = new Set(curatedIcons);
    return [
      ...matches.filter((n) => curated.has(n)),
      ...matches.filter((n) => !curated.has(n)),
    ];
  }, [search]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">Icon</label>
      <p className="text-xs text-ink-tertiary -mt-0.5">
        Optional — shown in the sidebar
      </p>

      {value && (
        <div className="flex items-center gap-2 mb-1">
          <EntityIcon icon={value} size={18} className="text-accent" />
          <span className="text-sm text-ink-secondary">{formatLabel(value)}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-xs text-ink-tertiary hover:text-ink cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Search all icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface p-2">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            title={formatLabel(name)}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-fast cursor-pointer ${
              value === name
                ? "bg-accent-subtle text-accent"
                : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <EntityIcon icon={name} size={16} />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-8 text-xs text-ink-tertiary py-3 text-center">
            No icons found
          </div>
        )}
      </div>

      {search && filtered.length > 0 && (
        <p className="text-xs text-ink-faint">
          {filtered.length} icon{filtered.length === 1 ? "" : "s"} found
        </p>
      )}
    </div>
  );
};

export type { IconPickerProps };
export { IconPicker };
