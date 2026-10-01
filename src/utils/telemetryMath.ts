import type { ElevationPoint, GeoPoint, SportType } from '../types/fitness';

/** Result of fitting a GPS track into an SVG viewport. */
export interface SvgProjectionResult {
  pathD: string;
  startPoint: { x: number; y: number } | null;
  endPoint: { x: number; y: number } | null;
  points: { x: number; y: number }[];
}

/** A flat, SVG-ready coordinate. */
export interface ProjectedPoint {
  x: number;
  y: number;
}

/** Mean earth radius in meters (IUGG). */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Fits a GPS track into a fixed SVG viewport, preserving aspect ratio.
 *
 * Longitude degrees shrink toward the poles, so the horizontal span is scaled
 * by `cos(midLat)` to stop routes from looking horizontally stretched. Bounds
 * are collected in a single pass to stay safe on long tracks, and every write
 * is an `Array#map` rather than chained spread appends.
 */
export function projectCoordinates(
  coords: GeoPoint[],
  svgWidth: number,
  svgHeight: number,
  padding: number = 24
): SvgProjectionResult {
  if (!coords || coords.length === 0) {
    return { pathD: '', startPoint: null, endPoint: null, points: [] };
  }

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (let i = 1; i < coords.length; i++) {
    const lat = coords[i].latitude;
    const lng = coords[i].longitude;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cosMidLat = Math.max(0.1, Math.cos(midLat));

  // Guard against a perfectly flat or perfectly straight track (zero span).
  const deltaLat = maxLat - minLat || 0.0001;
  const deltaLng = (maxLng - minLng) * cosMidLat || 0.0001;

  const drawableWidth = Math.max(10, svgWidth - padding * 2);
  const drawableHeight = Math.max(10, svgHeight - padding * 2);

  const scale = Math.min(drawableWidth / deltaLng, drawableHeight / deltaLat);

  const offsetX = padding + (drawableWidth - deltaLng * scale) / 2;
  const offsetY = padding + (drawableHeight - deltaLat * scale) / 2;

  const points = coords.map((c) => {
    const projectedLng = (c.longitude - minLng) * cosMidLat;
    const x = offsetX + projectedLng * scale;
    const y = svgHeight - (offsetY + (c.latitude - minLat) * scale);
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });

  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return {
    pathD,
    startPoint: points[0] ?? null,
    endPoint: points[points.length - 1] ?? null,
    points,
  };
}

/** Great-circle distance between two coordinates, in meters. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Converts a GPS track into an elevation-vs-distance series.
 *
 * The profile is always derived on demand from `coordinates` so a route and its
 * chart can never drift out of sync.
 */
export function deriveElevationProfile(coords: GeoPoint[]): ElevationPoint[] {
  if (!coords || coords.length === 0) return [];

  const profile: ElevationPoint[] = [
    { distanceMeters: 0, elevationMeters: Math.round(coords[0].elevationMeters) },
  ];
  let accumulatedDistance = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    accumulatedDistance += haversineMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
    profile.push({
      distanceMeters: Math.round(accumulatedDistance),
      elevationMeters: Math.round(curr.elevationMeters),
    });
  }

  return profile;
}

/** Metabolic equivalents per sport, used for the energy estimate. */
const MET_MAP: Record<SportType, number> = {
  run: 9.8,
  ride: 7.5,
  swim: 8.0,
  hike: 6.0,
  workout: 5.5,
};

/** Estimates calories burned from duration, MET and body weight. */
export function calculateCalories(
  durationSeconds: number,
  sport: SportType,
  weightKg: number = 72
): number {
  if (durationSeconds <= 0 || weightKg <= 0) return 0;
  const hours = durationSeconds / 3600;
  return Math.round(MET_MAP[sport] * weightKg * hours);
}
