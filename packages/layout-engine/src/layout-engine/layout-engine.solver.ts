/**
 * Layout Engine — Placement solver
 *
 * Finds somewhere to put a rect when its ideal position is already taken.
 * The strategy names describe intent ("push it down", "keep the x, find a y"),
 * so layout functions can express a design rule rather than a search.
 */

import type { FitStrategy, Rect } from './layout-engine.types.ts';
import { overlapsAnyZone, rectWithinBounds } from './layout-engine.geometry.ts';

/* ── Types ────────────────────────────────────────────────────── */

type FitParams = {
  width: number;
  height: number;
  target: { x: number; y: number };
  strategy: FitStrategy;
  zones: readonly Rect[];
  bounds: Rect;
};

/* ── Constants ────────────────────────────────────────────────── */

const SEARCH_STEP = 1;
const MAX_SEARCH_DISTANCE = 5000;
const MAX_JUMPS = 1000;

/* ── Private helpers ──────────────────────────────────────────── */

const candidateAt = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

const isValid = (rect: Rect, zones: readonly Rect[], bounds: Rect): boolean =>
  rectWithinBounds(rect, bounds) && !overlapsAnyZone(rect, zones);

/** Expanding concentric squares around the target. */
const solveNearest = (params: FitParams): Rect | null => {
  const { width, height, target, zones, bounds } = params;

  for (let dist = SEARCH_STEP; dist < MAX_SEARCH_DISTANCE; dist += SEARCH_STEP) {
    for (let offset = -dist; offset <= dist; offset += SEARCH_STEP) {
      const candidates = [
        candidateAt(target.x + offset, target.y - dist, width, height),
        candidateAt(target.x + offset, target.y + dist, width, height),
        candidateAt(target.x - dist, target.y + offset, width, height),
        candidateAt(target.x + dist, target.y + offset, width, height),
      ];
      for (const candidate of candidates) {
        if (isValid(candidate, zones, bounds)) {
          return candidate;
        }
      }
    }
  }

  return null;
};

/** Step in one direction until it fits or leaves the page. */
const solveDirectional = (params: FitParams, dx: number, dy: number): Rect | null => {
  const { width, height, target, zones, bounds } = params;

  for (let step = SEARCH_STEP; step < MAX_SEARCH_DISTANCE; step += SEARCH_STEP) {
    const candidate = candidateAt(target.x + dx * step, target.y + dy * step, width, height);
    if (!rectWithinBounds(candidate, bounds)) {
      return null;
    }
    if (!overlapsAnyZone(candidate, zones)) {
      return candidate;
    }
  }

  return null;
};

/** First opening below the target, jumping past each blocking zone. */
const solveBelow = (params: FitParams): Rect | null => {
  const { width, height, target, zones, bounds } = params;

  let y = target.y;
  for (let i = 0; i < MAX_JUMPS; i++) {
    const candidate = candidateAt(target.x, y, width, height);
    if (!rectWithinBounds(candidate, bounds)) {
      return null;
    }
    if (!overlapsAnyZone(candidate, zones)) {
      return candidate;
    }

    let nextY = y + SEARCH_STEP;
    for (const zone of zones) {
      if (
        zone.x < candidate.x + candidate.width &&
        zone.x + zone.width > candidate.x &&
        zone.y < candidate.y + candidate.height &&
        zone.y + zone.height > candidate.y
      ) {
        nextY = Math.max(nextY, zone.y + zone.height);
      }
    }
    y = nextY;
  }

  return null;
};

/** Search along a single axis, both ways. */
const solveConstrained = (params: FitParams, fixX: boolean, fixY: boolean): Rect | null => {
  const { width, height, target, zones, bounds } = params;

  for (let dist = SEARCH_STEP; dist < MAX_SEARCH_DISTANCE; dist += SEARCH_STEP) {
    for (const delta of [dist, -dist]) {
      const candidate = candidateAt(
        fixX ? target.x : target.x + delta,
        fixY ? target.y : target.y + delta,
        width,
        height,
      );
      if (isValid(candidate, zones, bounds)) {
        return candidate;
      }
    }
  }

  return null;
};

/* ── Public functions ─────────────────────────────────────────── */

/** Find a valid placement near the target, or null if there is nowhere to put it. */
const solvePlacement = (params: FitParams): Rect | null => {
  const exact = candidateAt(params.target.x, params.target.y, params.width, params.height);
  if (isValid(exact, params.zones, params.bounds)) {
    return exact;
  }

  switch (params.strategy) {
    case 'nearest':
      return solveNearest(params);
    case 'push-down':
      return solveDirectional(params, 0, SEARCH_STEP);
    case 'push-right':
      return solveDirectional(params, SEARCH_STEP, 0);
    case 'push-left':
      return solveDirectional(params, -SEARCH_STEP, 0);
    case 'below':
      return solveBelow(params);
    case 'constrain-x':
      return solveConstrained(params, true, false);
    case 'constrain-y':
      return solveConstrained(params, false, true);
  }
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FitParams };
export { solvePlacement };
