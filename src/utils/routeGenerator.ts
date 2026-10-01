import type { GeoPoint } from '../types/fitness';

/** Route shapes the generator can synthesize. */
export type RoutePattern = 'loop' | 'out_and_back' | 'climb' | 'stationary';

/** Reference anchor: San Francisco. Keeps every demo track in one metro area. */
const BASE_LAT = 37.7749;
const BASE_LNG = -122.4194;
const BASE_ELEVATION_METERS = 25;

/** Hard ceiling on generated samples so localStorage stays small and DOM stays cheap. */
const MAX_POINTS = 120;
const MIN_POINTS = 30;
const METERS_PER_POINT_TARGET = 150;

/** Meters per degree of latitude, near enough for a city-scale route. */
const METERS_PER_DEGREE_LAT = 111000;

/** Deterministic PRNG: same seed always yields the same GPS track. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesizes a lightweight GPS track locally — no network, no static blobs.
 *
 * Point count scales with the requested distance (capped at 120 samples) and
 * the latitude/longitude span is derived from that same distance, so a 50 km
 * ride produces a visibly larger route than a 2 km swim.
 */
export function generateSyntheticRoute(
  pattern: RoutePattern,
  distanceMeters: number,
  elevationGainMeters: number,
  seed: number = 42
): GeoPoint[] {
  if (pattern === 'stationary' || distanceMeters <= 0) return [];

  const prng = mulberry32(seed);
  const pointCount = Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(distanceMeters / METERS_PER_POINT_TARGET)));

  const cosBaseLat = Math.cos((BASE_LAT * Math.PI) / 180);
  const linearDegSpan = (distanceMeters / METERS_PER_DEGREE_LAT) * 0.7;
  const gain = Math.max(0, elevationGainMeters);

  const coords: GeoPoint[] = [];

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1);
    const jitterLat = (prng() - 0.5) * 0.0003;
    const jitterLng = (prng() - 0.5) * 0.0003;
    const jitterEle = prng() * 2;

    // Every branch below writes all three before use.
    let latitude: number;
    let longitude: number;
    let elevation: number;

    if (pattern === 'loop') {
      const angle = progress * 2 * Math.PI;
      const radiusDeg = distanceMeters / (2 * Math.PI) / METERS_PER_DEGREE_LAT;
      latitude = BASE_LAT + radiusDeg * Math.sin(angle) + jitterLat;
      longitude = BASE_LNG + (radiusDeg * Math.cos(angle)) / cosBaseLat + jitterLng;
      elevation = BASE_ELEVATION_METERS + Math.sin(progress * Math.PI) * gain + jitterEle;
    } else if (pattern === 'out_and_back') {
      const normalizedProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
      latitude = BASE_LAT + normalizedProgress * linearDegSpan * 0.8 + jitterLat * 0.66;
      longitude = BASE_LNG + (normalizedProgress * linearDegSpan * 0.6) / cosBaseLat + jitterLng * 0.66;
      elevation = BASE_ELEVATION_METERS + normalizedProgress * gain + jitterEle;
    } else {
      // 'climb': a one-way ascent that keeps gaining elevation to the summit.
      latitude = BASE_LAT + progress * linearDegSpan * 0.85 + jitterLat * 0.66;
      longitude = BASE_LNG + (progress * linearDegSpan * 0.5) / cosBaseLat + jitterLng * 0.66;
      elevation = BASE_ELEVATION_METERS + progress * gain + prng() * 1.5;
    }

    coords.push({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      elevationMeters: Math.max(0, Math.round(elevation)),
      timestampOffsetSeconds: Math.round(progress * 3600),
    });
  }

  return coords;
}
