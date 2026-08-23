# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies (shared base for build + runtime)
# ---------------------------------------------------------------------------
FROM node:24-slim AS deps

RUN corepack enable pnpm

# Native modules (better-sqlite3, sharp) need build tools
RUN apt-get update && \
  apt-get install -y --no-install-recommends python3 make g++ && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install all dependencies (layer-cached separately from source)
# The root tsconfig is extended by workspace packages, and Vite reads it while
# transforming their sources.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
# apps/web links this as workspace:*, so the manifest has to be here for the
# lockfile to resolve.
COPY packages/layout-engine/package.json packages/layout-engine/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2 — Build frontend
# ---------------------------------------------------------------------------
FROM deps AS frontend-build

COPY apps/web/ apps/web/
# The layout engine is consumed as source — its package exports point at .ts.
COPY packages/layout-engine/ packages/layout-engine/

RUN pnpm --filter @editions/web build

# ---------------------------------------------------------------------------
# Stage 3 — Production runtime
# ---------------------------------------------------------------------------
FROM node:24-slim AS runtime

RUN corepack enable pnpm

# Native modules (better-sqlite3, sharp) need build tools
RUN apt-get update && \
  apt-get install -y --no-install-recommends python3 make g++ && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile --prod

# Copy server source (runs directly via --experimental-strip-types)
COPY apps/server/src/ apps/server/src/
COPY apps/server/tsconfig.json apps/server/

# Copy built frontend into server's public directory
COPY --from=frontend-build /build/apps/web/dist/ apps/server/public/

# Non-root user
RUN groupadd --gid 1001 editions && \
  useradd --uid 1001 --gid editions --shell /bin/false editions

# Data directory for SQLite database (ownership preserved on fresh volume mount)
RUN mkdir -p /data && chown editions:editions /data

# Model cache directory for @huggingface/transformers
RUN mkdir -p /data/models && chown editions:editions /data/models

ENV EDITIONS_DB=/data/editions.db
ENV HF_HOME=/data/models
ENV EDITIONS_HOST=0.0.0.0
ENV EDITIONS_PORT=3007

EXPOSE 3007

WORKDIR /app/apps/server

USER 1001

CMD ["node", "--experimental-strip-types", "src/server.ts"]
