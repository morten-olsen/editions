import { useCallback, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { EntityIcon } from "./entity-icon.tsx";
import { navEvents } from "./nav-events.ts";

type NavEditionConfig = {
  id: string;
  name: string;
  icon: string | null;
  hasUnread: boolean;
};

type NavFocus = {
  id: string;
  name: string;
  icon: string | null;
};

type EditionSummary = {
  id: string;
  readAt: string | null;
};

const linkClass = (active: boolean): string =>
  `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-fast ease-gentle ${
    active
      ? "bg-accent-subtle text-accent font-medium"
      : "text-ink-secondary hover:text-ink hover:bg-surface-sunken"
  }`;

const sectionHeadClass = "flex items-center justify-between px-3 mb-1.5";
const sectionLabelClass = "text-xs text-ink-faint tracking-wide uppercase";

const addButtonClass =
  "shrink-0 w-5 h-5 flex items-center justify-center rounded text-ink-faint hover:text-ink hover:bg-surface-sunken transition-colors duration-fast";

const PlusIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
  </svg>
);

const Nav = (): React.ReactElement => {
  const auth = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [configs, setConfigs] = useState<NavEditionConfig[]>([]);
  const [focuses, setFocuses] = useState<NavFocus[]>([]);

  const isActive = (href: string): boolean => {
    if (href === "/") return currentPath === "/";
    return currentPath.startsWith(href);
  };

  const loadNav = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const hdrs = { Authorization: `Bearer ${auth.token}` };

    const [configsRes, focusesRes] = await Promise.all([
      client.GET("/api/editions/configs", { headers: hdrs }),
      client.GET("/api/focuses", { headers: hdrs }),
    ]);

    const rawConfigs = (configsRes.data ?? []) as unknown as { id: string; name: string; icon: string | null }[];
    const rawFocuses = (focusesRes.data ?? []) as unknown as NavFocus[];

    const configsWithUnread = await Promise.all(
      rawConfigs.map(async (cfg): Promise<NavEditionConfig> => {
        const { data } = await client.GET("/api/editions/configs/{configId}/editions", {
          params: { path: { configId: cfg.id } },
          headers: hdrs,
        });
        const editions = (data ?? []) as EditionSummary[];
        return {
          id: cfg.id,
          name: cfg.name,
          icon: cfg.icon,
          hasUnread: editions.some((e) => e.readAt === null),
        };
      }),
    );

    setConfigs(configsWithUnread);
    setFocuses(rawFocuses);
  }, [auth]);

  useEffect(() => {
    void loadNav();
    const handler = (): void => void loadNav();
    navEvents.addEventListener("refresh", handler);
    return () => navEvents.removeEventListener("refresh", handler);
  }, [loadNav]);

  const username = auth.status === "authenticated" ? auth.user.username : undefined;
  const logout = auth.status === "authenticated" ? auth.logout : undefined;

  return (
    <nav className="flex flex-col h-full w-56 border-r border-border bg-surface py-6 px-3">
      {/* Editions header + add */}
      <div className={sectionHeadClass}>
        <div className="font-serif text-lg tracking-tight text-ink">Editions</div>
        <Link to="/editions/new" className={addButtonClass} aria-label="New edition">
          <PlusIcon />
        </Link>
      </div>

      {/* Edition configs */}
      {configs.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-4">
          {configs.map((cfg) => (
            <Link
              key={cfg.id}
              to="/editions/$configId"
              params={{ configId: cfg.id }}
              className={linkClass(isActive(`/editions/${cfg.id}`))}
            >
              <EntityIcon icon={cfg.icon} fallback="newspaper" size={14} className="shrink-0" />
              <span className="truncate flex-1">{cfg.name}</span>
              {cfg.hasUnread && (
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Bookmarks */}
      <div className="mb-6">
        <Link to="/bookmarks" className={linkClass(isActive("/bookmarks"))}>
          Bookmarks
        </Link>
      </div>

      {/* Browse section */}
      <div className="mb-6">
        <div className={sectionHeadClass}>
          <div className={sectionLabelClass}>Browse</div>
          <Link to="/focuses/new" className={addButtonClass} aria-label="New focus">
            <PlusIcon />
          </Link>
        </div>
        <div className="flex flex-col gap-0.5">
          <Link to="/" className={linkClass(currentPath === "/")}>
            All articles
          </Link>
          {focuses.map((focus) => (
            <Link
              key={focus.id}
              to="/focuses/$focusId"
              params={{ focusId: focus.id }}
              className={linkClass(isActive(`/focuses/${focus.id}`))}
            >
              <EntityIcon icon={focus.icon} fallback="target" size={14} className="shrink-0" />
              <span className="truncate">{focus.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-0.5">
        <Link to="/sources" className={linkClass(isActive("/sources"))}>
          Sources
        </Link>
        <Link to="/settings" className={linkClass(isActive("/settings"))}>
          Settings
        </Link>

        <div className="mt-3 pt-3 border-t border-border mx-3">
          {username && (
            <div className="text-xs text-ink-tertiary mb-1">{username}</div>
          )}
          {logout && (
            <button
              type="button"
              onClick={logout}
              className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export { Nav };
