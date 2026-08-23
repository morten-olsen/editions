import crypto from 'node:crypto';

import { DatabaseService } from '../database/database.ts';
import type { ApiKeyScope } from '../database/database.types.ts';
import type { Services } from '../services/services.ts';

// --- Errors ---

class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

class ApiKeyNotFoundError extends ApiKeyError {
  constructor(id: string) {
    super(`API key not found: ${id}`);
    this.name = 'ApiKeyNotFoundError';
  }
}

class InvalidApiKeyError extends ApiKeyError {
  constructor(reason = 'Invalid API key') {
    super(reason);
    this.name = 'InvalidApiKeyError';
  }
}

// --- Constants ---

const KEY_PREFIX_LABEL = 'ek';
/**
 * Hex, not base64url, for the prefix. base64url's alphabet includes `_`, which
 * is also the field separator — a prefix containing one would make the boundary
 * between prefix and secret ambiguous. Hex keeps the second separator the last
 * structural one in the key, so the secret can safely contain `_` itself.
 */
const PREFIX_BYTES = 6; // 12 hex chars
const SECRET_BYTES = 32; // 43 base64url chars — 256 bits of entropy

/**
 * Scopes are cumulative, ordered weakest to strongest. A key satisfies a
 * requirement when its own rank is at least the required rank.
 */
const SCOPE_RANK: Record<ApiKeyScope, number> = { read: 0, write: 1, admin: 2 };

/**
 * `last_used_at` is a diagnostic, not an audit log — writing it on every MCP
 * call would mean a write per tool invocation. One write per minute per key is
 * enough to answer "is this key still in use?".
 */
const LAST_USED_THROTTLE_MS = 60_000;

// --- Types ---

type ApiKey = {
  id: string;
  userId: string;
  name: string;
  /** The public half — safe to display. Never the full key. */
  keyPrefix: string;
  scope: ApiKeyScope;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** Returned only from `create` — the one moment the secret exists outside the client. */
type CreatedApiKey = ApiKey & { key: string };

type VerifiedApiKey = {
  id: string;
  userId: string;
  scope: ApiKeyScope;
};

type CreateApiKeyParams = {
  userId: string;
  name: string;
  scope: ApiKeyScope;
  expiresAt?: string | null;
};

// --- Hashing ---

/**
 * sha256, not the `crypto.scrypt` used for passwords in `auth/auth.ts`.
 *
 * Key stretching exists to make guessing a low-entropy human-chosen secret
 * expensive. An API key secret is 256 bits from `crypto.randomBytes`, so there
 * is nothing to guess and nothing to stretch against. Meanwhile every MCP tool
 * call authenticates, and scrypt at N=16384 would add ~100ms to each one.
 */
const hashSecret = (secret: string): string => crypto.createHash('sha256').update(secret).digest('hex');

const secretMatches = (secret: string, storedHash: string): boolean => {
  const candidate = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidate, stored);
};

/**
 * Parses `ek_<hexPrefix>_<secret>` — the prefix locates the row, the secret
 * proves ownership.
 *
 * Split on the first two separators only, never on all of them: the secret is
 * base64url and legitimately contains `_` about half the time.
 */
const parseKey = (raw: string): { prefix: string; secret: string } | null => {
  const trimmed = raw.trim();

  const firstSep = trimmed.indexOf('_');
  if (firstSep === -1 || trimmed.slice(0, firstSep) !== KEY_PREFIX_LABEL) {
    return null;
  }

  const secondSep = trimmed.indexOf('_', firstSep + 1);
  if (secondSep === -1) {
    return null;
  }

  const prefix = trimmed.slice(firstSep + 1, secondSep);
  const secret = trimmed.slice(secondSep + 1);
  if (prefix.length === 0 || secret.length === 0) {
    return null;
  }

  return { prefix, secret };
};

const satisfiesScope = (held: ApiKeyScope, required: ApiKeyScope): boolean => SCOPE_RANK[held] >= SCOPE_RANK[required];

// --- Row mapping ---

type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scope: ApiKeyScope;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const toApiKey = (row: ApiKeyRow): ApiKey => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  keyPrefix: row.key_prefix,
  scope: row.scope,
  lastUsedAt: row.last_used_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
});

// --- Service ---

class ApiKeysService {
  #services: Services;
  /** Prefix → epoch ms of the last `last_used_at` write, for throttling. */
  #lastUsedWrites = new Map<string, number>();

  constructor(services: Services) {
    this.#services = services;
  }

  /** A user's keys, newest first. Never includes the secret. */
  list = async (userId: string): Promise<ApiKey[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom('api_keys')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map(toApiKey);
  };

  /**
   * Mint a key. The returned `key` is the only time the secret is available —
   * only its sha256 is stored, so it cannot be recovered or re-shown later.
   */
  create = async (params: CreateApiKeyParams): Promise<CreatedApiKey> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const id = crypto.randomUUID();
    const prefix = crypto.randomBytes(PREFIX_BYTES).toString('hex');
    const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');

    await db
      .insertInto('api_keys')
      .values({
        id,
        user_id: params.userId,
        name: params.name,
        key_prefix: prefix,
        key_hash: hashSecret(secret),
        scope: params.scope,
        expires_at: params.expiresAt ?? null,
      })
      .execute();

    const row = await db.selectFrom('api_keys').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

    return { ...toApiKey(row), key: `${KEY_PREFIX_LABEL}_${prefix}_${secret}` };
  };

  /**
   * Resolve a presented key to its owner and scope.
   *
   * Throws `InvalidApiKeyError` for malformed, unknown, revoked and expired
   * keys alike — the caller gets 401 either way, and distinguishing them would
   * tell an attacker which prefixes exist.
   */
  verify = async (raw: string): Promise<VerifiedApiKey> => {
    const parsed = parseKey(raw);
    if (!parsed) {
      throw new InvalidApiKeyError();
    }

    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom('api_keys')
      .select(['id', 'user_id', 'key_hash', 'scope', 'expires_at', 'revoked_at'])
      .where('key_prefix', '=', parsed.prefix)
      .executeTakeFirst();

    if (!row || !secretMatches(parsed.secret, row.key_hash)) {
      throw new InvalidApiKeyError();
    }
    if (row.revoked_at !== null) {
      throw new InvalidApiKeyError();
    }
    if (row.expires_at !== null && row.expires_at <= new Date().toISOString()) {
      throw new InvalidApiKeyError();
    }

    await this.#touch(parsed.prefix);

    return { id: row.id, userId: row.user_id, scope: row.scope };
  };

  /** Revoke by id. Idempotent — re-revoking an already-revoked key is a no-op. */
  revoke = async (userId: string, id: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const existing = await db
      .selectFrom('api_keys')
      .select('id')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new ApiKeyNotFoundError(id);
    }

    await db
      .updateTable('api_keys')
      .set({ revoked_at: new Date().toISOString() })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  };

  #touch = async (prefix: string): Promise<void> => {
    const now = Date.now();
    const last = this.#lastUsedWrites.get(prefix);
    if (last !== undefined && now - last < LAST_USED_THROTTLE_MS) {
      return;
    }
    this.#lastUsedWrites.set(prefix, now);

    const db = await this.#services.get(DatabaseService).getInstance();
    await db
      .updateTable('api_keys')
      .set({ last_used_at: new Date().toISOString() })
      .where('key_prefix', '=', prefix)
      .execute();
  };
}

export type { ApiKey, ApiKeyScope, CreatedApiKey, CreateApiKeyParams, VerifiedApiKey };
export { ApiKeysService, ApiKeyError, ApiKeyNotFoundError, InvalidApiKeyError, satisfiesScope, SCOPE_RANK };
