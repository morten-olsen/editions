import { DatabaseService } from '../database/database.ts';
import { FocusesService } from '../focuses/focuses.ts';
import { JobService } from '../jobs/jobs.ts';
import type { RefreshSourcePayload } from '../jobs/jobs.handlers.ts';
import { SourcesService } from '../sources/sources.ts';
import { EditionsService } from '../editions/editions.ts';
import type { Services } from '../services/services.ts';

import {
  discoverySources,
  discoveryFocuses,
  discoveryEditionConfigs,
  sourceById,
  focusById,
  editionConfigById,
  allTags,
} from './discovery.catalog.ts';
import type {
  DiscoverySource,
  DiscoveryFocus,
  DiscoveryEditionConfig,
} from './discovery.catalog.ts';

// --- Errors ---

class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

class DiscoveryItemNotFoundError extends DiscoveryError {
  constructor(type: string, id: string) {
    super(`Discovery ${type} not found: ${id}`);
    this.name = 'DiscoveryItemNotFoundError';
  }
}

// --- Query types ---

type DiscoveryListParams = {
  search?: string;
  tag?: string;
  offset?: number;
  limit?: number;
};

type DiscoveryPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

// --- Result types ---

type AdoptSourceResult = {
  sourceId: string;
  created: boolean;
};

type AdoptFocusResult = {
  focusId: string;
  created: boolean;
  sourcesCreated: number;
};

type AdoptEditionConfigResult = {
  editionConfigId: string;
  created: boolean;
  focusesCreated: number;
  sourcesCreated: number;
};

// --- Filtering helpers ---

const matchesSearch = (query: string, fields: string[]): boolean => {
  const q = query.toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(q));
};

const filterItems = <T>(
  items: T[],
  search: string | undefined,
  textFields: (item: T) => string[],
  tag: string | undefined,
  tagFields?: (item: T) => string[],
): T[] => {
  let result = items;
  if (search) {
    result = result.filter((item) => matchesSearch(search, textFields(item)));
  }
  if (tag && tagFields) {
    result = result.filter((item) => tagFields(item).some((t) => t.toLowerCase() === tag.toLowerCase()));
  }
  return result;
};

const paginate = <T>(items: T[], params: DiscoveryListParams): DiscoveryPage<T> => {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
  };
};

// --- Service ---

class DiscoveryService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  // --- Listing ---

  listTags = (): string[] => {
    return allTags;
  };

  listSources = (params: DiscoveryListParams = {}): DiscoveryPage<DiscoverySource> => {
    return paginate(
      filterItems(discoverySources, params.search, (s) => [s.name, s.description], params.tag, (s) => s.tags),
      params,
    );
  };

  listFocuses = (params: DiscoveryListParams = {}): DiscoveryPage<DiscoveryFocus> => {
    return paginate(
      filterItems(discoveryFocuses, params.search, (f) => [f.name, f.description], params.tag),
      params,
    );
  };

  listEditionConfigs = (params: DiscoveryListParams = {}): DiscoveryPage<DiscoveryEditionConfig> => {
    return paginate(
      filterItems(discoveryEditionConfigs, params.search, (e) => [e.name, e.description], params.tag),
      params,
    );
  };

  // --- Adoption status ---

  getAdoptionStatus = async (
    userId: string,
  ): Promise<{ adoptedSourceUrls: Set<string>; adoptedFocusOrigins: Set<string>; adoptedEditionOrigins: Set<string> }> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const [sources, focuses, configs] = await Promise.all([
      db.selectFrom('sources').select('url').where('user_id', '=', userId).execute(),
      db.selectFrom('focuses').select('origin_id').where('user_id', '=', userId).where('origin_id', 'is not', null).execute(),
      db.selectFrom('edition_configs').select('origin_id').where('user_id', '=', userId).where('origin_id', 'is not', null).execute(),
    ]);

    return {
      adoptedSourceUrls: new Set(sources.map((s) => s.url)),
      adoptedFocusOrigins: new Set(focuses.map((f) => f.origin_id!)),
      adoptedEditionOrigins: new Set(configs.map((c) => c.origin_id!)),
    };
  };

  // --- Adopt a source (by URL dedup) ---

  adoptSource = async (userId: string, discoverySourceId: string): Promise<AdoptSourceResult> => {
    const template = sourceById.get(discoverySourceId);
    if (!template) {
      throw new DiscoveryItemNotFoundError('source', discoverySourceId);
    }

    const db = await this.#services.get(DatabaseService).getInstance();

    // Check if user already has a source with this URL
    const existing = await db
      .selectFrom('sources')
      .select('id')
      .where('user_id', '=', userId)
      .where('url', '=', template.url)
      .executeTakeFirst();

    if (existing) {
      return { sourceId: existing.id, created: false };
    }

    const source = await this.#services.get(SourcesService).create({
      userId,
      name: template.name,
      url: template.url,
      type: template.type,
    });

    // Trigger initial fetch so the source has articles for focus classification
    this.#services.get(JobService).enqueue<RefreshSourcePayload>(
      'refresh_source',
      { sourceId: source.id, userId },
      { userId },
    );

    return { sourceId: source.id, created: true };
  };

  // --- Adopt a focus (by origin_id dedup, cascades to sources) ---

  adoptFocus = async (userId: string, discoveryFocusId: string): Promise<AdoptFocusResult> => {
    const template = focusById.get(discoveryFocusId);
    if (!template) {
      throw new DiscoveryItemNotFoundError('focus', discoveryFocusId);
    }

    const db = await this.#services.get(DatabaseService).getInstance();

    // Check if user already adopted this focus
    const existing = await db
      .selectFrom('focuses')
      .select('id')
      .where('user_id', '=', userId)
      .where('origin_id', '=', discoveryFocusId)
      .executeTakeFirst();

    if (existing) {
      return { focusId: existing.id, created: false, sourcesCreated: 0 };
    }

    // Adopt all sources for this focus
    let sourcesCreated = 0;
    const sourceIdMap = new Map<string, string>(); // discovery source id → user source id

    for (const focusSource of template.sources) {
      const result = await this.adoptSource(userId, focusSource.sourceId);
      sourceIdMap.set(focusSource.sourceId, result.sourceId);
      if (result.created) {
        sourcesCreated++;
      }
    }

    const focus = await this.#services.get(FocusesService).create({
      userId,
      name: template.name,
      description: template.description,
      icon: template.icon,
      originId: discoveryFocusId,
      minConfidence: template.minConfidence,
      sources: template.sources.map((s) => ({
        sourceId: sourceIdMap.get(s.sourceId)!,
        weight: s.weight,
        minConfidence: null,
      })),
    });

    return { focusId: focus.id, created: true, sourcesCreated };
  };

  // --- Adopt an edition config (cascades to focuses and sources) ---

  adoptEditionConfig = async (userId: string, discoveryConfigId: string): Promise<AdoptEditionConfigResult> => {
    const template = editionConfigById.get(discoveryConfigId);
    if (!template) {
      throw new DiscoveryItemNotFoundError('edition config', discoveryConfigId);
    }

    const db = await this.#services.get(DatabaseService).getInstance();

    // Check if user already adopted this edition config
    const existing = await db
      .selectFrom('edition_configs')
      .select('id')
      .where('user_id', '=', userId)
      .where('origin_id', '=', discoveryConfigId)
      .executeTakeFirst();

    if (existing) {
      return { editionConfigId: existing.id, created: false, focusesCreated: 0, sourcesCreated: 0 };
    }

    // Adopt all focuses (which cascades to sources)
    let focusesCreated = 0;
    let sourcesCreated = 0;
    const focusIdMap = new Map<string, string>(); // discovery focus id → user focus id

    for (const editionFocus of template.focuses) {
      const result = await this.adoptFocus(userId, editionFocus.focusId);
      focusIdMap.set(editionFocus.focusId, result.focusId);
      if (result.created) {
        focusesCreated++;
      }
      sourcesCreated += result.sourcesCreated;
    }

    // Create the edition config with origin_id
    const config = await this.#services.get(EditionsService).createConfig({
      userId,
      name: template.name,
      icon: template.icon,
      originId: discoveryConfigId,
      schedule: template.schedule,
      lookbackHours: template.lookbackHours,
      focuses: template.focuses.map((f) => ({
        focusId: focusIdMap.get(f.focusId)!,
        position: f.position,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        weight: f.weight,
      })),
    });

    return { editionConfigId: config.id, created: true, focusesCreated, sourcesCreated };
  };
}

export type { DiscoveryListParams, DiscoveryPage, AdoptSourceResult, AdoptFocusResult, AdoptEditionConfigResult };
export { DiscoveryService, DiscoveryError, DiscoveryItemNotFoundError };
