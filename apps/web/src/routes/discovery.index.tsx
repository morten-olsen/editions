import { useState, useMemo, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import type { DiscoveryQuery } from '../hooks/discovery/discovery.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EntityIcon } from '../components/entity-icon.tsx';
import { StaggerList, StaggerItem } from '../components/animate.tsx';
import {
  useDiscoverySources,
  useDiscoveryFocuses,
  useDiscoveryEditionConfigs,
  useDiscoveryTags,
  useAdoptSource,
  useAdoptFocus,
  useAdoptEditionConfig,
} from '../hooks/discovery/discovery.hooks.ts';
import { DiscoverySourceCard } from '../views/discovery/discovery-source-card.tsx';
import { DiscoveryFocusCard } from '../views/discovery/discovery-focus-card.tsx';
import { DiscoveryEditionCard } from '../views/discovery/discovery-edition-card.tsx';

/* ── Constants ─────────────────────────────────────────────────────── */

type Tab = 'editions' | 'focuses' | 'sources';

const PAGE_SIZE = 12;

const tabList: { id: Tab; label: string }[] = [
  { id: 'editions', label: 'Editions' },
  { id: 'focuses', label: 'Focuses' },
  { id: 'sources', label: 'Sources' },
];

/* ── Filter state hook ─────────────────────────────────────────────── */

type DiscoveryFiltersState = {
  activeTab: Tab;
  search: string;
  activeTag: string | undefined;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  handleTabChange: (tab: Tab) => void;
  handleSearchChange: (value: string) => void;
  handleTagChange: (tag: string | undefined) => void;
  query: DiscoveryQuery;
  emptyQuery: DiscoveryQuery;
};

const useDiscoveryFilters = (): DiscoveryFiltersState => {
  const [activeTab, setActiveTab] = useState<Tab>('editions');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);

  // Reset page when filters change
  const handleTabChange = useCallback((tab: Tab): void => {
    setActiveTab(tab);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleTagChange = useCallback((tag: string | undefined): void => {
    setActiveTag(tag);
    setPage(0);
  }, []);

  const query = useMemo(
    (): DiscoveryQuery => ({
      search: search || undefined,
      tag: activeTag,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [search, activeTag, page],
  );

  const emptyQuery = useMemo((): DiscoveryQuery => ({}), []);

  return {
    activeTab,
    search,
    activeTag,
    page,
    setPage,
    handleTabChange,
    handleSearchChange,
    handleTagChange,
    query,
    emptyQuery,
  };
};

/* ── Subcomponents ─────────────────────────────────────────────────── */

type DiscoveryTabsProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

const DiscoveryTabs = ({ activeTab, onTabChange }: DiscoveryTabsProps): React.ReactNode => (
  <div className="flex gap-1 mb-4 border-b border-border">
    {tabList.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative px-3 py-2 font-mono text-xs tracking-wide uppercase transition-colors duration-fast ease-gentle cursor-pointer ${
            isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-tertiary'
          }`}
          data-ai-id={`discovery-tab-${tab.id}`}
          data-ai-state={isActive ? 'selected' : 'idle'}
        >
          {tab.label}
          {isActive && <span className="absolute inset-x-3 bottom-0 h-px bg-ink" />}
        </button>
      );
    })}
  </div>
);

type DiscoverySearchFilterProps = {
  activeTab: Tab;
  search: string;
  onSearchChange: (value: string) => void;
  tags: string[];
  activeTag: string | undefined;
  onTagChange: (tag: string | undefined) => void;
};

const DiscoverySearchFilter = ({
  activeTab,
  search,
  onSearchChange,
  tags,
  activeTag,
  onTagChange,
}: DiscoverySearchFilterProps): React.ReactNode => (
  <div className="flex flex-col gap-3 mb-6">
    <div className="relative max-w-md">
      <EntityIcon
        icon="search"
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
      />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or description..."
        className="h-9 w-full rounded-md border border-border bg-surface-raised pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </div>

    {activeTab === 'sources' && tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={() => onTagChange(undefined)}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors duration-fast cursor-pointer ${
            !activeTag ? 'bg-accent text-accent-ink' : 'bg-surface-sunken text-ink-tertiary hover:text-ink-secondary'
          }`}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTagChange(activeTag === tag ? undefined : tag)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors duration-fast cursor-pointer ${
              activeTag === tag
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-sunken text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    )}
  </div>
);

type DiscoveryResultsProps = {
  activeTab: Tab;
  editionConfigs: Parameters<typeof DiscoveryEditionCard>[0]['config'][];
  focuses: Parameters<typeof DiscoveryFocusCard>[0]['focus'][];
  sources: Parameters<typeof DiscoverySourceCard>[0]['source'][];
  focusNames: Map<string, string>;
  sourceNames: Map<string, string>;
  adoptEdition: Parameters<typeof DiscoveryEditionCard>[0]['onAdopt'];
  adoptFocus: Parameters<typeof DiscoveryFocusCard>[0]['onAdopt'];
  adoptSource: Parameters<typeof DiscoverySourceCard>[0]['onAdopt'];
  adoptingEdition: boolean;
  adoptingFocus: boolean;
  adoptingSource: boolean;
};

const DiscoveryResults = ({
  activeTab,
  editionConfigs,
  focuses,
  sources,
  focusNames,
  sourceNames,
  adoptEdition,
  adoptFocus,
  adoptSource,
  adoptingEdition,
  adoptingFocus,
  adoptingSource,
}: DiscoveryResultsProps): React.ReactNode => (
  <>
    {activeTab === 'editions' && (
      <StaggerList className="columns-1 md:columns-2 gap-4 space-y-4">
        {editionConfigs.map((config) => (
          <StaggerItem key={config.id}>
            <DiscoveryEditionCard
              config={config}
              focusNames={focusNames}
              onAdopt={adoptEdition}
              adopting={adoptingEdition}
            />
          </StaggerItem>
        ))}
      </StaggerList>
    )}

    {activeTab === 'focuses' && (
      <StaggerList className="columns-1 md:columns-2 gap-3 space-y-3">
        {focuses.map((focus) => (
          <StaggerItem key={focus.id}>
            <DiscoveryFocusCard focus={focus} sourceNames={sourceNames} onAdopt={adoptFocus} adopting={adoptingFocus} />
          </StaggerItem>
        ))}
      </StaggerList>
    )}

    {activeTab === 'sources' && (
      <StaggerList className="columns-1 md:columns-2 gap-3 space-y-3">
        {sources.map((source) => (
          <StaggerItem key={source.id}>
            <DiscoverySourceCard source={source} onAdopt={adoptSource} adopting={adoptingSource} />
          </StaggerItem>
        ))}
      </StaggerList>
    )}
  </>
);

type DiscoveryPaginationProps = {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
};

const DiscoveryPagination = ({ page, totalPages, setPage }: DiscoveryPaginationProps): React.ReactNode => {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
        Previous
      </Button>
      <span className="font-mono text-xs text-ink-tertiary tracking-wide">
        {page + 1} / {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        disabled={page >= totalPages - 1}
      >
        Next
      </Button>
    </div>
  );
};

/* ── Page component ────────────────────────────────────────────────── */

const DiscoveryPage = (): React.ReactNode => {
  const filters = useDiscoveryFilters();
  const { activeTab, query, emptyQuery, page, setPage } = filters;

  const {
    items: sources,
    total: totalSources,
    isLoading: loadingSources,
  } = useDiscoverySources(activeTab === 'sources' ? query : emptyQuery);
  const {
    items: focuses,
    total: totalFocuses,
    isLoading: loadingFocuses,
  } = useDiscoveryFocuses(activeTab === 'focuses' ? query : emptyQuery);
  const {
    items: editionConfigs,
    total: totalEditions,
    isLoading: loadingEditions,
  } = useDiscoveryEditionConfigs(activeTab === 'editions' ? query : emptyQuery);
  const { tags } = useDiscoveryTags();

  const { adopt: adoptSource, isPending: adoptingSource } = useAdoptSource();
  const { adopt: adoptFocus, isPending: adoptingFocus } = useAdoptFocus();
  const { adopt: adoptEdition, isPending: adoptingEdition } = useAdoptEditionConfig();

  const sourceNames = useMemo(() => new Map(sources.map((s) => [s.id, s.name])), [sources]);
  const focusNames = useMemo(() => new Map(focuses.map((f) => [f.id, f.name])), [focuses]);

  const activeTotal = activeTab === 'sources' ? totalSources : activeTab === 'focuses' ? totalFocuses : totalEditions;
  const totalPages = Math.ceil(activeTotal / PAGE_SIZE);
  const isLoading =
    activeTab === 'sources' ? loadingSources : activeTab === 'focuses' ? loadingFocuses : loadingEditions;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Discover"
        subtitle="Browse curated sources, focuses, and edition configurations to get started quickly"
        serif
      />

      <DiscoveryTabs activeTab={activeTab} onTabChange={filters.handleTabChange} />

      <DiscoverySearchFilter
        activeTab={activeTab}
        search={filters.search}
        onSearchChange={filters.handleSearchChange}
        tags={tags}
        activeTag={filters.activeTag}
        onTagChange={filters.handleTagChange}
      />

      {!isLoading && (
        <>
          <DiscoveryResults
            activeTab={activeTab}
            editionConfigs={editionConfigs}
            focuses={focuses}
            sources={sources}
            focusNames={focusNames}
            sourceNames={sourceNames}
            adoptEdition={adoptEdition}
            adoptFocus={adoptFocus}
            adoptSource={adoptSource}
            adoptingEdition={adoptingEdition}
            adoptingFocus={adoptingFocus}
            adoptingSource={adoptingSource}
          />
          <DiscoveryPagination page={page} totalPages={totalPages} setPage={setPage} />
        </>
      )}
    </div>
  );
};

const Route = createFileRoute('/discovery/')({
  component: DiscoveryPage,
});

export { Route };
