import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { FileMigrationProvider, Kysely, Migrator, SqliteDialect } from "kysely";

import { ConfigService } from "../config/config.ts";
import { destroySymbol, Services } from "../services/services.ts";

import type { DatabaseSchema } from "./database.types.ts";

// --- Service ---

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

class DatabaseService {
  #services: Services;
  #instance: Promise<Kysely<DatabaseSchema>> | null = null;

  constructor(services: Services) {
    this.#services = services;
  }

  /**
   * Lazy-initialized database instance. On first call, creates the connection,
   * enables WAL + foreign keys, and runs pending migrations. Subsequent calls
   * return the cached promise.
   */
  getInstance = (): Promise<Kysely<DatabaseSchema>> => {
    if (!this.#instance) {
      this.#instance = this.#setup();
    }
    return this.#instance;
  };

  #setup = async (): Promise<Kysely<DatabaseSchema>> => {
    const { database } = this.#services.get(ConfigService).config;
    const sqlite = new Database(database.filename);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({ fs, path, migrationFolder: migrationsFolder }),
    });

    const { error, results } = await migrator.migrateToLatest();

    for (const result of results ?? []) {
      if (result.status === "Success") {
        console.log(`Migration "${result.migrationName}" applied`);
      } else if (result.status === "Error") {
        console.error(`Migration "${result.migrationName}" failed`);
      }
    }

    if (error) {
      throw error;
    }

    return db;
  };

  [destroySymbol] = async (): Promise<void> => {
    if (this.#instance) {
      const db = await this.#instance;
      await db.destroy();
    }
  };
}

export type * from "./database.types.ts";
export { DatabaseService };
