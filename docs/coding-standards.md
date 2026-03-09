# TypeScript Coding Standards

This document defines the TypeScript coding standards and best practices for this project.

## Core Principles

1. **Consistency**: Code should be predictable and uniform across the codebase
2. **Type Safety**: Leverage TypeScript's type system to catch errors at compile time
3. **Readability**: Code is read more often than written
4. **Maintainability**: Make future changes easy and safe

---

## Type Definitions

### Types vs Interfaces

**ALWAYS use `type` over `interface`**

```typescript
// ✅ Good
type User = {
  id: string;
  name: string;
  email: string;
};

type UserWithRole = User & {
  role: string;
};

// ❌ Bad
interface User {
  id: string;
  name: string;
  email: string;
}

interface UserWithRole extends User {
  role: string;
}
```

**Rationale**: Types are more flexible, support union types, intersection types, and mapped types more naturally. They provide a consistent API for all type definitions.

### Type Naming

- Use PascalCase for type names
- Use descriptive names that reflect the domain
- Suffix callback types with `Fn` or `Callback`
- Suffix type predicates with `Guard`

```typescript
// ✅ Good
type UserProfile = { ... };
type ValidationCallbackFn = (value: string) => boolean;
type StringGuard = (value: unknown) => value is string;

// ❌ Bad
type userprofile = { ... };
type IUserProfile = { ... };
type ValidateFn = (value: string) => boolean;
```

---

## Functions

### Always Use Arrow Functions

**ALWAYS use arrow function syntax** for function declarations

```typescript
// ✅ Good
const getUserById = (id: string): User | null => {
  return users.find((user) => user.id === id) ?? null;
};

const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// Single expression - omit braces
const double = (n: number): number => n * 2;

// ❌ Bad
function getUserById(id: string): User | null {
  return users.find((user) => user.id === id) ?? null;
}
```

**Rationale**: Arrow functions provide consistent syntax, proper `this` binding, and are more concise. They prevent common bugs related to function context.

### Function Parameters

**Prefer a single object parameter** over multiple primitive arguments - improves readability and extensibility

```typescript
// ✅ Good - object parameter
type CreateUserInput = {
  name: string;
  email: string;
  role?: string;
};

const createUser = (input: CreateUserInput): User => {
  return {
    id: generateId(),
    name: input.name,
    email: input.email,
    role: input.role ?? "user",
  };
};

// Usage with named fields
createUser({ name: "Alice", email: "alice@example.com" });

// ❌ Bad - multiple string arguments
const createUser = (name: string, email: string, role?: string): User => {
  return {
    id: generateId(),
    name,
    email,
    role: role ?? "user",
  };
};

// Hard to read, easy to swap arguments
createUser("Alice", "alice@example.com");
```

**Exception**: Simple utility functions with 1-2 obvious parameters can use positional arguments

```typescript
// ✅ OK - single obvious parameter
const hashPassword = (password: string): string => { ... };

// ✅ OK - two obvious, unambiguous parameters
const formatDate = (date: Date, format: string): string => { ... };
```

### Function Type Annotations

Always annotate return types explicitly

```typescript
// ✅ Good
const fetchUser = async (id: string): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};

// ❌ Bad - missing return type
const fetchUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};
```

---

## Exports

### Consolidated Exports

**ALWAYS export at the end of the file** using a single `export {}` statement and/or a single `export type {}` statement

```typescript
// ✅ Good
type User = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  title: string;
};

const createUser = (data: Omit<User, "id">): User => {
  return { id: generateId(), ...data };
};

const deleteUser = (id: string): void => {
  users.delete(id);
};

// All exports at the end
export type { User, Product };
export { createUser, deleteUser };
```

```typescript
// ❌ Bad - scattered exports
export type User = {
  id: string;
  name: string;
};

export const createUser = (data: Omit<User, "id">): User => {
  return { id: generateId(), ...data };
};

export type Product = {
  id: string;
  title: string;
};

export const deleteUser = (id: string): void => {
  users.delete(id);
};
```

**Rationale**: Consolidated exports make it easy to see the public API of a module at a glance. They separate the implementation from what's exposed.

### Default Exports

Avoid default exports - prefer named exports

```typescript
// ✅ Good
const userService = {
  create: createUser,
  delete: deleteUser,
};

export { userService };

// ❌ Bad
export default {
  create: createUser,
  delete: deleteUser,
};
```

---

## Imports

### Import Extensions

**ALWAYS include file extensions in imports** — use the actual file extension on disk

- Use `.ts` for server code running with Node.js type stripping (`--experimental-strip-types`)
- Use `.tsx` for files containing JSX (frontend code uses Vite's bundler resolution, which does **not** resolve `.ts` to `.tsx`)
- Use `.js` for distributable library code (will be the actual output extension after compilation)

```typescript
// ✅ Good (server code with Node.js type stripping)
import { createUser } from "./user-service.ts";
import type { User } from "./types.ts";

// ✅ Good (frontend code — use actual extension)
import { useAuth } from "./auth/auth.tsx";
import { client } from "./api/api.ts";

// ✅ Good (library code compiled with tsc)
import { createUser } from "./user-service.js";
import type { User } from "./types.js";

// ❌ Bad - no extension
import { createUser } from "./user-service";

// ❌ Bad - .ts when the file is .tsx (won't resolve in Vite)
import { useAuth } from "./auth/auth.ts";
```

**Rationale**:

- `.ts`/`.tsx` extensions match the actual file on disk
- Vite's bundler resolution requires exact extensions — `.ts` will not resolve to a `.tsx` file
- `.js` extensions for libraries match the compiled output after TypeScript compilation
- Explicit extensions ensure compatibility with modern ES modules and avoid ambiguity

### Import Organization

Group and order imports as follows:

1. External dependencies
2. Internal absolute imports
3. Internal relative imports

```typescript
// ✅ Good
import { z } from "zod";
import { EventEmitter } from "events";

import { config } from "@/config.ts";
import { logger } from "@/utils/logger.ts";

import { getUserById } from "./user-service.ts";
import { formatDate } from "../utils/date.ts";
```

---

## Schema Validation

### Use Zod for Runtime Validation

**ALWAYS use Zod** for schema validation and runtime type checking

**Naming convention**:

- Schema: `{name}Schema` (camelCase with `Schema` suffix)
- Inferred type: `{Name}` (PascalCase, no suffix)

```typescript
// ✅ Good
import { z } from "zod";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

type User = z.infer<typeof userSchema>;

const validateUser = (data: unknown): User => {
  return userSchema.parse(data);
};

export type { User };
export { userSchema, validateUser };
```

```typescript
// ❌ Bad - inconsistent naming
const UserSchema = z.object({ ... });  // Should be userSchema
type UserType = z.infer<typeof UserSchema>;  // Should be User
```

### Zod Best Practices

- Define schemas with `{name}Schema` naming (camelCase + `Schema` suffix)
- Infer TypeScript types as `{Name}` (PascalCase, no suffix) using `z.infer<typeof schema>`
- Use `.parse()` when you want to throw on invalid data
- Use `.safeParse()` when you want to handle errors gracefully

```typescript
// ✅ Good
const configSchema = z.object({
  apiUrl: z.string().url(),
  timeout: z.number().default(5000),
});

type Config = z.infer<typeof configSchema>;

const loadConfig = (raw: unknown): Config => {
  const result = configSchema.safeParse(raw);

  if (!result.success) {
    throw new Error("Configuration validation failed");
  }

  return result.data;
};

export type { Config };
export { configSchema, loadConfig };
```

### Zod Gotchas

A few Zod patterns to be aware of:

**`z.record()` requires two arguments** — always provide both key and value schemas:

```typescript
z.record(z.string(), z.unknown());
```

**`.default()` must appear before `.transform()`** in method chains:

```typescript
z.string()
  .default("[]")
  .transform((val) => JSON.parse(val));
```

**OpenAPI schema registration** — schemas register themselves at their definition site using `z.globalRegistry`. Add new schemas in `api.schemas.ts`:

```typescript
z.globalRegistry.add(taskSchema, { id: "Task" });
z.globalRegistry.add(messageSchema, { id: "Message" });
```

**JSON Schema conversion** — use the native `z.toJSONSchema()`:

```typescript
const jsonSchema = z.toJSONSchema(mySchema, { target: "draft-07" });
```

---

## Variable Declarations

### const vs let

- Use `const` by default
- Use `let` only when reassignment is necessary
- Never use `var`

```typescript
// ✅ Good
const users = await fetchUsers();
let currentIndex = 0;

for (const user of users) {
  currentIndex++;
}

// ❌ Bad
let users = await fetchUsers(); // Should be const
var currentIndex = 0; // Never use var
```

---

## Type Safety

### Strict Null Checks

Always handle `null` and `undefined` explicitly

```typescript
// ✅ Good
const getUsername = (user: User | null): string => {
  return user?.name ?? "Anonymous";
};

// ❌ Bad
const getUsername = (user: User | null): string => {
  return user.name; // TypeScript error
};
```

### Avoid `any`

Never use `any` - use `unknown` when the type is truly unknown

```typescript
// ✅ Good
const parseJson = (text: string): unknown => {
  return JSON.parse(text);
};

const processData = (data: unknown): void => {
  if (typeof data === "object" && data !== null && "id" in data) {
    console.log(data.id);
  }
};

// ❌ Bad
const parseJson = (text: string): any => {
  return JSON.parse(text);
};
```

### Type Guards

Create type guards for runtime type checking

```typescript
// ✅ Good
const isUser = (value: unknown): value is User => {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
};

// Better: Use Zod for complex type guards
const isUser = (value: unknown): value is User => {
  return userSchema.safeParse(value).success;
};

export { isUser };
```

---

## Async/Await

### Always Use Async/Await

Prefer `async`/`await` over raw promises

```typescript
// ✅ Good
const fetchUserData = async (id: string): Promise<UserData> => {
  const user = await fetchUser(id);
  const posts = await fetchUserPosts(id);

  return { user, posts };
};

// ❌ Bad
const fetchUserData = (id: string): Promise<UserData> => {
  return fetchUser(id).then((user) => {
    return fetchUserPosts(id).then((posts) => {
      return { user, posts };
    });
  });
};
```

### Error Handling

Always handle errors in async functions - throw meaningful errors and let consumers decide how to handle them

```typescript
// ✅ Good
class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}

class UserFetchError extends Error {
  constructor(id: string, cause: unknown) {
    super(`Failed to fetch user: ${id}`);
    this.name = "UserFetchError";
    this.cause = cause;
  }
}

const fetchUser = async (id: string): Promise<User> => {
  try {
    const response = await fetch(`/api/users/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new UserNotFoundError(id);
      }
      throw new UserFetchError(id, `HTTP ${response.status}`);
    }

    const data = await response.json();
    return userSchema.parse(data);
  } catch (error) {
    if (error instanceof UserNotFoundError || error instanceof UserFetchError) {
      throw error;
    }
    throw new UserFetchError(id, error);
  }
};

// Consumer decides how to handle
const loadUserProfile = async (id: string): Promise<User | null> => {
  try {
    return await fetchUser(id);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      // This is expected, return null
      return null;
    }
    // Log and rethrow unexpected errors
    logger.error("Unexpected error loading user profile", { id, error });
    throw error;
  }
};

export type { User };
export { UserNotFoundError, UserFetchError, fetchUser };
```

**Rationale**: Don't swallow errors or make error handling decisions for consumers. Throw specific, actionable errors that callers can catch and handle appropriately. Logging is a cross-cutting concern that should happen at application boundaries, not in library code.

---

## Classes

### Prefer Functions Over Classes

Only use classes when you need:

- Private state management with multiple methods
- Inheritance (rare)
- Explicit instance management

```typescript
// ✅ Good - simple case, use functions
const createCounter = (initial = 0) => {
  let count = initial;

  const increment = (): number => {
    count++;
    return count;
  };

  const decrement = (): number => {
    count--;
    return count;
  };

  const getValue = (): number => count;

  return { increment, decrement, getValue };
};

// ✅ Good - complex state management, use class
class UserRepository {
  #cache: Map<string, User>;
  #maxSize: number;

  constructor(maxSize = 1000) {
    this.#cache = new Map();
    this.#maxSize = maxSize;
  }

  get = async (id: string): Promise<User | null> => {
    if (this.#cache.has(id)) {
      return this.#cache.get(id)!;
    }

    const user = await this.#fetchFromDb(id);
    if (user) {
      this.#addToCache(id, user);
    }
    return user;
  };

  #addToCache = (id: string, user: User): void => {
    if (this.#cache.size >= this.#maxSize) {
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }
    this.#cache.set(id, user);
  };

  #fetchFromDb = async (id: string): Promise<User | null> => {
    // Database fetch logic
    return null;
  };
}
```

### Private Fields

**ALWAYS use `#` for private fields** instead of the `private` keyword

```typescript
// ✅ Good
class ApiClient {
  #baseUrl: string;
  #timeout: number;

  constructor(baseUrl: string, timeout = 5000) {
    this.#baseUrl = baseUrl;
    this.#timeout = timeout;
  }

  get = async (path: string): Promise<Response> => {
    return fetch(`${this.#baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.#timeout),
    });
  };
}

// ❌ Bad
class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }
}
```

**Rationale**: The `#` syntax provides true runtime privacy (not just compile-time), is part of the JavaScript standard, and is more explicit.

### Extract to Utils

**Only add methods to classes if they need `this`** - otherwise extract to utility functions

```typescript
// ✅ Good
class OrderProcessor {
  #discount: number;

  constructor(discount: number) {
    this.#discount = discount;
  }

  calculateTotal = (items: Item[]): number => {
    const subtotal = calculateSubtotal(items);
    return applyDiscount(subtotal, this.#discount);
  };
}

// Extracted utilities (don't need `this`)
const calculateSubtotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

const applyDiscount = (amount: number, discount: number): number => {
  return amount * (1 - discount);
};

export { OrderProcessor, calculateSubtotal, applyDiscount };
```

```typescript
// ❌ Bad - methods don't use `this`, should be utils
class OrderProcessor {
  #discount: number;

  constructor(discount: number) {
    this.#discount = discount;
  }

  // This method doesn't use any instance state - should be a utility
  #calculateSubtotal = (items: Item[]): number => {
    return items.reduce((sum, item) => sum + item.price, 0);
  };

  // This method doesn't use instance state - should be a utility
  #applyDiscount = (amount: number, discount: number): number => {
    return amount * (1 - discount);
  };

  calculateTotal = (items: Item[]): number => {
    const subtotal = this.#calculateSubtotal(items);
    return this.#applyDiscount(subtotal, this.#discount);
  };
}
```

### Getters and Setters

**Use getters and setters** to access private fields - never expose public fields directly

Only add setters if the value should actually be mutable

```typescript
// ✅ Good
class UserRepository {
  #users: Map<string, User>;
  #maxSize: number;

  constructor(maxSize = 1000) {
    this.#users = new Map();
    this.#maxSize = maxSize;
  }

  // Getter for read-only access
  get size(): number {
    return this.#users.size;
  }

  // Getter with computed value
  get isFull(): boolean {
    return this.#users.size >= this.#maxSize;
  }

  // Getter and setter for mutable value
  get maxSize(): number {
    return this.#maxSize;
  }

  set maxSize(value: number) {
    if (value < 1) {
      throw new Error("maxSize must be positive");
    }
    this.#maxSize = value;
  }

  add = (user: User): void => {
    if (this.isFull) {
      throw new Error("Repository is full");
    }
    this.#users.set(user.id, user);
  };
}

// ❌ Bad - public fields exposed directly
class UserRepository {
  users: Map<string, User>; // Should be private
  maxSize: number; // Should be private with getter/setter

  constructor(maxSize = 1000) {
    this.users = new Map();
    this.maxSize = maxSize;
  }
}
```

**Rationale**: Getters and setters provide encapsulation, allow validation, and enable computed properties without changing the API.

### Class Structure Order

```typescript
class Example {
  // 1. Private fields (all state should be private)
  #config: Config;
  #cache: Map<string, unknown>;
  #count: number;

  // 2. Constructor
  constructor(config: Config) {
    this.#config = config;
    this.#cache = new Map();
    this.#count = 0;
  }

  // 3. Getters and setters
  get count(): number {
    return this.#count;
  }

  get cacheSize(): number {
    return this.#cache.size;
  }

  // 4. Private methods
  #fetchWithCache = async (id: string): Promise<Data> => {
    // Implementation
  };

  // 5. Public methods
  fetch = async (id: string): Promise<Data> => {
    this.#count++;
    return this.#fetchWithCache(id);
  };

  clear = (): void => {
    this.#cache.clear();
    this.#count = 0;
  };
}
```

---

## Logging

Structured logging with environment-based formatting - pretty in dev, JSON in prod. Use `.child()` for context binding.

```typescript
type LogContext = Record<string, unknown>;

class Logger {
  #context: LogContext;
  #isJson: boolean;

  constructor(context: LogContext = {}, isJson = process.env.NODE_ENV === "production") {
    this.#context = context;
    this.#isJson = isJson;
  }

  #log = (level: string, message: string, meta: LogContext = {}): void => {
    const entry = { level, message, timestamp: new Date().toISOString(), ...this.#context, ...meta };
    console.log(
      this.#isJson
        ? JSON.stringify(entry)
        : `[${entry.timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify({ ...this.#context, ...meta })}`,
    );
  };

  info = (msg: string, meta?: LogContext): void => this.#log("info", msg, meta);
  error = (msg: string, meta?: LogContext): void => this.#log("error", msg, meta);
  child = (context: LogContext): Logger => new Logger({ ...this.#context, ...context }, this.#isJson);
}

// Usage
const logger = new Logger();
logger.info("Server starting", { port: 3007 });

const reqLogger = logger.child({ requestId: "123" });
reqLogger.info("Processing request"); // Includes requestId
```

**Key points**: Only log at boundaries (HTTP handlers, CLI, jobs), not in libraries. Use `.child()` for request/context binding.

---

## Dependency Injection

Use a simple service container - avoid heavy DI frameworks. Services receive the container and resolve dependencies lazily in methods (not constructor).

```typescript
// Container with get/set/destroy
const destroySymbol = Symbol("destroy");
class Services {
  #instances = new Map();
  get = <T>(service: new (s: Services) => T): T => {
    if (!this.#instances.has(service)) this.#instances.set(service, new service(this));
    return this.#instances.get(service) as T;
  };
  set = <T>(service: new (s: Services) => T, instance: Partial<T>): void => {
    this.#instances.set(service, instance);
  };
  destroy = async (): Promise<void> => {
    await Promise.all(
      Array.from(this.#instances.values()).map(async (i) =>
        i && typeof i === "object" && destroySymbol in i ? await i[destroySymbol]() : null,
      ),
    );
  };
}

// Service - resolve deps in methods
class PostsService {
  #services: Services;
  constructor(services: Services) {
    this.#services = services;
  }

  getBySlug = async (slug: string): Promise<Post | null> => {
    const db = this.#services.get(DatabaseService); // Lazy loading
    return db.query("posts").where({ slug }).first();
  };
}

// Testing - inject mocks
test("getBySlug", async () => {
  const services = new Services();
  services.set(DatabaseService, { query: () => ({ where: () => ({ first: async () => mockPost }) }) });
  const posts = services.get(PostsService);
  expect(await posts.getBySlug("test")).toEqual(mockPost);
});
```

**Benefits**: Zero dependencies, lazy loading, simple mocking, graceful cleanup.

---

## Object and Array Patterns

### Destructuring

Use destructuring for cleaner code

```typescript
// ✅ Good
const getFullName = ({ firstName, lastName }: User): string => {
  return `${firstName} ${lastName}`;
};

const [first, ...rest] = items;

// ❌ Bad
const getFullName = (user: User): string => {
  return `${user.firstName} ${user.lastName}`;
};
```

### Spread Operator

Use spread for immutable updates

```typescript
// ✅ Good
const updateUser = (user: User, updates: Partial<User>): User => {
  return { ...user, ...updates };
};

// ❌ Bad
const updateUser = (user: User, updates: Partial<User>): User => {
  user.name = updates.name ?? user.name;
  user.email = updates.email ?? user.email;
  return user;
};
```

---

## Comments and Documentation

### JSDoc for Public APIs

Document public functions with JSDoc

```typescript
/**
 * Fetches a user by their unique identifier
 *
 * @param id - The user's UUID
 * @returns The user object if found, null otherwise
 * @throws {ValidationError} If the ID format is invalid
 */
const getUserById = async (id: string): Promise<User | null> => {
  // Implementation
};

export { getUserById };
```

### Avoid Obvious Comments

Don't comment what the code already says

```typescript
// ✅ Good
// Retry with exponential backoff to handle transient failures
const result = await retryWithBackoff(fetchData);

// ❌ Bad
// Set x to 5
const x = 5;
```

---

## File Organization

### Module Structure

**ALWAYS organize code into modules using the pattern**: `{module}/{module}.ts` with support files as `{module}/{module}.{area}.ts`

```
user/
├── user.ts           # Main module file - public API
├── user.schemas.ts   # Zod schemas and inferred types
├── user.utils.ts     # Utility functions
├── user.errors.ts    # Custom error classes
└── user.types.ts     # Additional types (if needed beyond schema inference)
```

**Key principles**:

- **Never use index files** (`index.ts`) - they hide the actual module structure
- **Main file** (`{module}/{module}.ts`) acts as the public API - re-exports everything consumers need
- **Separate concerns** - schemas, utils, errors, types in separate files
- **File naming** - Always use kebab-case (e.g., `user-service.ts`, `api-client.ts`, `data-mapper.ts`)

### Example: User Module

**user/user.schemas.ts** - Schemas and inferred types

```typescript
import { z } from "zod";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

type User = z.infer<typeof userSchema>;

const createUserInputSchema = userSchema.omit({ id: true });
type CreateUserInput = z.infer<typeof createUserInputSchema>;

export type { User, CreateUserInput };
export { userSchema, createUserInputSchema };
```

**user/user.errors.ts** - Custom errors

```typescript
class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}

class UserValidationError extends Error {
  constructor(message: string) {
    super(`User validation failed: ${message}`);
    this.name = "UserValidationError";
  }
}

export { UserNotFoundError, UserValidationError };
```

**user/user.utils.ts** - Utility functions

```typescript
const formatUserId = (id: string): string => {
  return id.toLowerCase().trim();
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export { formatUserId, isValidEmail };
```

**user/user.ts** - Main module file (public API)

```typescript
import { formatUserId } from "./user.utils.ts";
import { UserNotFoundError } from "./user.errors.ts";
import { userSchema, createUserInputSchema } from "./user.schemas.ts";

import type { User, CreateUserInput } from "./user.schemas.ts";

// Module implementation
const users = new Map<string, User>();

const createUser = async (input: CreateUserInput): Promise<User> => {
  const validated = createUserInputSchema.parse(input);

  const user: User = {
    id: crypto.randomUUID(),
    ...validated,
  };

  users.set(user.id, user);
  return user;
};

const getUserById = async (id: string): Promise<User> => {
  const formattedId = formatUserId(id);
  const user = users.get(formattedId);

  if (!user) {
    throw new UserNotFoundError(formattedId);
  }

  return user;
};

const updateUser = async (id: string, updates: Partial<User>): Promise<User> => {
  const user = await getUserById(id);
  const updated = { ...user, ...updates };
  users.set(id, updated);
  return updated;
};

// Re-export public API - everything consumers need
export type { User, CreateUserInput };
export { userSchema, createUserInputSchema };
export { UserNotFoundError, UserValidationError } from "./user.errors.ts";
export { createUser, getUserById, updateUser };
```

### Importing from Modules

Consumers import from the main module file, never from support files:

```typescript
// ✅ Good - import from main module file
import { createUser, getUserById, UserNotFoundError } from "./user/user.ts";
import type { User } from "./user/user.ts";

// ❌ Bad - importing from support files directly
import { userSchema } from "./user/user.schemas.ts";
import { formatUserId } from "./user/user.utils.ts";
```

**Rationale**: The main module file controls what is public API. If consumers need something from a support file, it should be re-exported through the main module file.

### Single File Structure

For simple modules that don't need separation, use this structure within a single file:

```typescript
// 1. Imports (external → internal → types)
import { z } from "zod";
import { logger } from "@/utils/logger.ts";

import type { ApiResponse } from "../api/api.ts";

// 2. Schemas and inferred types
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type User = z.infer<typeof userSchema>;

// 3. Additional types
type UserServiceConfig = {
  baseUrl: string;
  timeout: number;
};

// 4. Constants
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;

// 5. Private helper functions (not exported)
const formatUserId = (id: string): string => {
  return id.toLowerCase().trim();
};

// 6. Public functions
const createUser = async (data: Omit<User, "id">): Promise<User> => {
  // Implementation
};

const getUserById = async (id: string): Promise<User | null> => {
  // Implementation
};

// 7. Exports (single block at end)
export type { User, UserServiceConfig };
export { userSchema, createUser, getUserById };
```

### When to Split Files

Split into multiple files when:

- The single file exceeds ~300-400 lines
- Schemas become complex with many validators
- Multiple utility functions serve different purposes
- Error classes need detailed logic
- The module has distinct concerns that benefit from separation

Keep as a single file when:

- The module is simple and focused
- Total code is under ~300 lines
- Splitting would create files with only 1-2 exports

---

## Tooling Configuration

### TypeScript Config

Ensure strict mode is enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### Linting

Use ESLint with TypeScript-aware rules:

```json
{
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

---

## Tailwind CSS (Frontend)

The frontend uses **Tailwind CSS v4**. Prefer the modern syntax over legacy alternatives.

### Use Modern Utility Names

Tailwind v4 renamed gradient utilities. Use `bg-linear-*` instead of the deprecated `bg-gradient-*`:

```tsx
// Good - Tailwind v4 syntax
<div className="bg-linear-to-br from-blue-500 to-cyan-400" />
<div className="bg-linear-to-r from-violet-500 to-purple-600" />

// Bad - legacy syntax (still works but triggers warnings)
<div className="bg-gradient-to-br from-blue-500 to-cyan-400" />
<div className="bg-gradient-to-r from-violet-500 to-purple-600" />
```

### Use Standard Spacing Scale Over Arbitrary Values

When a Tailwind spacing token exists, prefer it over arbitrary `[Npx]` values:

```tsx
// Good - standard scale
<div className="min-w-40 max-h-70 h-125" />

// Bad - arbitrary values that map to existing tokens
<div className="min-w-[160px] max-h-[280px] h-[500px]" />
```

### Use Simplified Opacity Syntax

Tailwind v4 supports bare integer opacity modifiers:

```tsx
// Good
<div className="bg-white/3" />

// Bad - bracket syntax when a bare value works
<div className="bg-white/[0.03]" />
```

---

## Quick Reference Checklist

When writing TypeScript code, ensure:

- [ ] Using `type` instead of `interface`
- [ ] Using arrow function syntax for all functions
- [ ] Explicit return type annotations on functions
- [ ] All exports consolidated at end of file (`export type {}` and/or `export {}`)
- [ ] Including `.ts` extensions in imports (unless distributable library)
- [ ] Using Zod for schema validation
- [ ] Using `const` by default, `let` only when necessary
- [ ] Never using `any` - using `unknown` instead
- [ ] Handling `null`/`undefined` explicitly
- [ ] Using `async`/`await` instead of `.then()`
- [ ] JSDoc comments on public APIs
- [ ] Proper import organization (external → internal → types)

---

## Examples

### Complete Module Example

```typescript
import { z } from "zod";

import type { ApiClient } from "@/types/api.ts";

// Schema definition
const todoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

type Todo = z.infer<typeof todoSchema>;

type TodoServiceConfig = {
  apiClient: ApiClient;
  cacheTtl: number;
};

// Private helpers
const validateTodo = (data: unknown): Todo => {
  return todoSchema.parse(data);
};

const buildTodoUrl = (id: string): string => {
  return `/api/todos/${id}`;
};

// Public API
const createTodoService = (config: TodoServiceConfig) => {
  const { apiClient, cacheTtl } = config;

  const getTodo = async (id: string): Promise<Todo | null> => {
    try {
      const response = await apiClient.get(buildTodoUrl(id));
      return validateTodo(response.data);
    } catch (error) {
      if (error instanceof TodoNotFoundError) {
        return null;
      }
      throw error;
    }
  };

  const createTodo = async (data: Omit<Todo, "id" | "createdAt">): Promise<Todo> => {
    const response = await apiClient.post("/api/todos", data);
    return validateTodo(response.data);
  };

  const updateTodo = async (id: string, updates: Partial<Todo>): Promise<Todo> => {
    const response = await apiClient.patch(buildTodoUrl(id), updates);
    return validateTodo(response.data);
  };

  return {
    getTodo,
    createTodo,
    updateTodo,
  };
};

export type { Todo, TodoServiceConfig };
export { todoSchema, createTodoService };
```

---

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod v4 Documentation](https://v4.zod.dev/)
- [TypeScript ESLint](https://typescript-eslint.io/)

---

**Remember**: These standards exist to make code more maintainable and less error-prone. Follow them consistently across the codebase.
