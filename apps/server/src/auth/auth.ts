import crypto from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { ConfigService } from "../config/config.ts";
import { DatabaseService } from "../database/database.ts";
import { Services } from "../services/services.ts";

import type { JWTPayload } from "jose";

// --- Password hashing (scrypt) ---

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derived) => {
        if (err) return reject(err);
        resolve(`${salt}:${derived.toString("hex")}`);
      },
    );
  });
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derived) => {
        if (err) return reject(err);
        resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derived));
      },
    );
  });
};

// --- JWT ---

type TokenPayload = JWTPayload & {
  sub: string;
  username: string;
  role: string;
};

// --- Errors ---

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

class UsernameExistsError extends AuthError {
  constructor(username: string) {
    super(`Username already exists: ${username}`);
    this.name = "UsernameExistsError";
  }
}

class InvalidCredentialsError extends AuthError {
  constructor() {
    super("Invalid username or password");
    this.name = "InvalidCredentialsError";
  }
}

class InvalidTokenError extends AuthError {
  constructor() {
    super("Invalid or expired token");
    this.name = "InvalidTokenError";
  }
}

// --- Service ---

class AuthService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  #jwtSecret = (): Uint8Array => {
    const secret = this.#services.get(ConfigService).config.auth.jwtSecret;
    return new TextEncoder().encode(secret);
  };

  register = async (username: string, password: string): Promise<{ id: string; role: string; token: string }> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();

    if (existing) {
      throw new UsernameExistsError(username);
    }

    // First user ever created becomes admin
    const userCount = await db
      .selectFrom("users")
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    const role = Number(userCount.count) === 0 ? "admin" : "user";

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await db
      .insertInto("users")
      .values({ id, username, password_hash: passwordHash, role })
      .execute();

    const token = await this.#signToken({ sub: id, username, role });
    return { id, role, token };
  };

  login = async (username: string, password: string): Promise<{ id: string; role: string; token: string }> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const user = await db
      .selectFrom("users")
      .select(["id", "username", "password_hash", "role"])
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user?.password_hash) {
      throw new InvalidCredentialsError();
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const token = await this.#signToken({ sub: user.id, username: user.username, role: user.role });
    return { id: user.id, role: user.role, token };
  };

  verifyToken = async (token: string): Promise<TokenPayload> => {
    try {
      const { payload } = await jwtVerify(token, this.#jwtSecret(), {
        issuer: "editions",
      });
      return payload as TokenPayload;
    } catch {
      throw new InvalidTokenError();
    }
  };

  #signToken = async (payload: { sub: string; username: string; role: string }): Promise<string> => {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("editions")
      .sign(this.#jwtSecret());
  };
}

export type { TokenPayload };
export {
  AuthService,
  AuthError,
  UsernameExistsError,
  InvalidCredentialsError,
  InvalidTokenError,
};
