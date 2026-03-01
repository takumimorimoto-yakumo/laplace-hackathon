// ============================================================
// Chart Utilities — Pure functions for SVG coordinate mapping
// ============================================================

export interface Coordinate {
  x: number;
  y: number;
}

/**
 * Maps a price data array to SVG coordinates.
 * Points are evenly distributed along the x-axis.
 */
export function mapPriceToCoordinates(
  data: number[],
  width: number,
  height: number,
  padX: number,
  padY: number
): Coordinate[] {
  if (data.length === 0) return [];
  if (data.length === 1) {
    return [{ x: padX + (width - padX * 2) / 2, y: height / 2 }];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;

  return data.map((value, index) => ({
    x: padX + (index / (data.length - 1)) * innerWidth,
    y: padY + innerHeight - ((value - min) / range) * innerHeight,
  }));
}

/**
 * Computes the SVG coordinate for an entry point given its
 * temporal position (hoursAgo from the latest data point) and price.
 */
export function findEntryPointCoordinate(
  hoursAgo: number,
  priceAtEntry: number,
  dataLength: number,
  priceMin: number,
  priceMax: number,
  width: number,
  height: number,
  padX: number,
  padY: number
): Coordinate {
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const range = priceMax - priceMin || 1;

  // hoursAgo=0 → last point, hoursAgo=dataLength-1 → first point
  const dataIndex = Math.max(0, Math.min(dataLength - 1, dataLength - 1 - hoursAgo));
  const x = padX + (dataIndex / Math.max(1, dataLength - 1)) * innerWidth;

  // Clamp price within the visible range
  const clampedPrice = Math.max(priceMin, Math.min(priceMax, priceAtEntry));
  const y = padY + innerHeight - ((clampedPrice - priceMin) / range) * innerHeight;

  return { x, y };
}

/**
 * Converts an array of coordinates to an SVG polyline points string.
 */
export function coordinatesToPolyline(coords: Coordinate[]): string {
  return coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
}

/**
 * Converts an array of coordinates to an SVG path for area fill.
 * Creates a closed path from the line down to the baseline.
 */
export function coordinatesToAreaPath(
  coords: Coordinate[],
  baselineY: number
): string {
  if (coords.length === 0) return "";
  const first = coords[0];
  const last = coords[coords.length - 1];
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}
