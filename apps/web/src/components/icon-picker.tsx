import { useState } from "react";

import { EntityIcon, iconNames } from "./entity-icon.tsx";

type IconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
};

const iconLabels: Record<string, string> = {
  Newspaper: "Newspaper",
  Globe: "Globe",
  Code: "Code",
  Cpu: "CPU",
  Rocket: "Rocket",
  FlaskConical: "Science",
  Microscope: "Microscope",
  BookOpen: "Book",
  GraduationCap: "Education",
  Briefcase: "Business",
  TrendingUp: "Trending",
  DollarSign: "Finance",
  BarChart3: "Charts",
  Heart: "Health",
  Shield: "Security",
  Scale: "Law",
  Landmark: "Government",
  Building2: "Building",
  Users: "People",
  MessageCircle: "Chat",
  Pen: "Writing",
  Camera: "Photo",
  Film: "Film",
  Music: "Music",
  Palette: "Art",
  Gamepad2: "Gaming",
  Trophy: "Sports",
  Dumbbell: "Fitness",
  Leaf: "Nature",
  Sun: "Sun",
  Cloud: "Weather",
  Plane: "Travel",
  Car: "Auto",
  Utensils: "Food",
  Coffee: "Coffee",
  ShoppingBag: "Shopping",
  Hammer: "Build",
  Wrench: "Tools",
  Zap: "Energy",
  Star: "Star",
  Flame: "Fire",
  Target: "Target",
  Compass: "Compass",
  Map: "Map",
  Mountain: "Mountain",
  Waves: "Ocean",
  Dog: "Pets",
  Lightbulb: "Ideas",
};

const IconPicker = ({ value, onChange }: IconPickerProps): React.ReactElement => {
  const [search, setSearch] = useState("");

  const filtered = search
    ? iconNames.filter((name) => {
        const label = iconLabels[name] ?? name;
        return label.toLowerCase().includes(search.toLowerCase()) ||
          name.toLowerCase().includes(search.toLowerCase());
      })
    : iconNames;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">Icon</label>
      <p className="text-xs text-ink-tertiary -mt-0.5">
        Optional — shown in the sidebar
      </p>

      {value && (
        <div className="flex items-center gap-2 mb-1">
          <EntityIcon icon={value} size={18} className="text-accent" />
          <span className="text-sm text-ink-secondary">{iconLabels[value] ?? value}</span>
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
        placeholder="Search icons..."
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
            title={iconLabels[name] ?? name}
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
    </div>
  );
};

export type { IconPickerProps };
export { IconPicker };
