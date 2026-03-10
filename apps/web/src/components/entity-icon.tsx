import { lazy, Suspense } from "react";

import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { LucideProps } from "lucide-react";

const iconNames = Object.keys(dynamicIconImports);

// Normalize PascalCase (legacy) to kebab-case: "FlaskConical" → "flask-conical"
const toKebab = (s: string): string =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();

const iconCache = new Map<string, React.ComponentType<LucideProps>>();

const resolveIcon = (name: string): string | undefined => {
  if (name in dynamicIconImports) return name;
  const kebab = toKebab(name);
  if (kebab in dynamicIconImports) return kebab;
  return undefined;
};

const loadIcon = (name: string): React.ComponentType<LucideProps> | undefined => {
  const resolved = resolveIcon(name);
  if (!resolved) return undefined;
  if (iconCache.has(resolved)) return iconCache.get(resolved)!;
  const LazyIcon = lazy(dynamicIconImports[resolved as keyof typeof dynamicIconImports]);
  iconCache.set(resolved, LazyIcon);
  return LazyIcon;
};

type EntityIconProps = {
  icon: string | null;
  fallback?: string;
  size?: number;
  className?: string;
};

const EntityIcon = ({ icon, fallback, size = 16, className }: EntityIconProps): React.ReactElement => {
  const name = icon ?? fallback ?? "";
  const IconComponent = loadIcon(name) ?? (fallback && icon ? loadIcon(fallback) : undefined);

  if (!IconComponent) {
    return <span style={{ width: size, height: size }} className={`inline-block shrink-0 ${className ?? ""}`} />;
  }

  return (
    <Suspense fallback={<span style={{ width: size, height: size }} className={`inline-block shrink-0 ${className ?? ""}`} />}>
      <IconComponent size={size} className={className} />
    </Suspense>
  );
};

export type { EntityIconProps };
export { EntityIcon, iconNames };
