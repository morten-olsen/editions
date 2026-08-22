import { DatabaseService } from '../database/database.ts';
import type { Services } from '../services/services.ts';

import { exportUserData } from './data-portability.export.ts';
import { importUserData } from './data-portability.import.ts';
import type { ImportResult } from './data-portability.import.ts';
import type { DataExport } from './data-portability.schemas.ts';

// --- Errors ---

class UnsupportedExportVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported export version: ${version}`);
    this.name = 'UnsupportedExportVersionError';
  }
}

// --- Service ---

// Owns the portable data format: a full, user-agnostic snapshot of a user's
// sources, articles (with embeddings and classifications), focuses, edition
// configs, editions, and scoring weights. All cross-references use names/URLs
// instead of IDs so an export can be imported into any instance.
// The heavy lifting lives in data-portability.export.ts / data-portability.import.ts.
class DataPortabilityService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  export = async (userId: string): Promise<DataExport> => {
    return exportUserData(this.#services, userId);
  };

  import = async (userId: string, data: DataExport): Promise<ImportResult> => {
    if (data.version !== 1) {
      throw new UnsupportedExportVersionError(data.version);
    }

    // Clear all existing user data first for a clean slate
    await this.#clearUserData(userId);

    return importUserData({ services: this.#services, userId, data });
  };

  #clearUserData = async (userId: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Delete in dependency order — FK cascades handle junction tables.
    // edition_configs → editions, edition_config_focuses, edition_config_source_budgets
    await db.deleteFrom('edition_configs').where('user_id', '=', userId).execute();
    // bookmarks (references articles, no cascade on this FK)
    await db.deleteFrom('bookmarks').where('user_id', '=', userId).execute();
    // article_votes
    await db.deleteFrom('article_votes').where('user_id', '=', userId).execute();
    // focuses → focus_sources, article_focuses
    await db.deleteFrom('focuses').where('user_id', '=', userId).execute();
    // sources (non-bookmarks) → articles → article_embeddings
    const nonBookmarkSources = await db
      .selectFrom('sources')
      .select('id')
      .where('user_id', '=', userId)
      .where('type', '!=', 'bookmarks')
      .execute();
    if (nonBookmarkSources.length > 0) {
      await db
        .deleteFrom('sources')
        .where(
          'id',
          'in',
          nonBookmarkSources.map((s) => s.id),
        )
        .execute();
    }
    // Reset scoring weights
    await db.updateTable('users').set({ scoring_weights: null }).where('id', '=', userId).execute();
  };
}

export type { ImportResult } from './data-portability.import.ts';
export type { DataExport } from './data-portability.schemas.ts';
export { DataPortabilityService, UnsupportedExportVersionError };
export { dataExportSchema, dataImportResultSchema } from './data-portability.schemas.ts';
