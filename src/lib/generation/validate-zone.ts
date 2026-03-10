import type { GenerativeZone } from '@/types/world';

const TILE = {
  GRASS: 0, TREE: 1, PATH: 2, TALL_GRASS: 3, BUILDING: 4,
  DOOR: 5, FLOWER: 6, FENCE: 7, SIGN: 8, WATER: 9,
  ROUTE_EXIT: 10, GRAVE: 11,
} as const;

/**
 * Auto-stamp object tiles into the tilemap based on structured arrays.
 * The LLM only needs to set terrain tiles; buildings, signs, graves, and doors
 * are stamped automatically from the structured data.
 */
export function stampObjectTiles(zone: GenerativeZone): void {
  for (const b of zone.buildings) {
    for (let row = b.y; row < b.y + b.height; row++) {
      for (let col = b.x; col < b.x + b.width; col++) {
        if (row >= 0 && row < zone.height && col >= 0 && col < zone.width) {
          zone.tilemap[row][col] = TILE.BUILDING;
        }
      }
    }
    if (b.doorY >= 0 && b.doorY < zone.height && b.doorX >= 0 && b.doorX < zone.width) {
      zone.tilemap[b.doorY][b.doorX] = TILE.DOOR;
    }
  }

  for (const s of zone.signs) {
    if (s.y >= 0 && s.y < zone.height && s.x >= 0 && s.x < zone.width) {
      zone.tilemap[s.y][s.x] = TILE.SIGN;
    }
  }

  for (const g of zone.graves) {
    if (g.y >= 0 && g.y < zone.height && g.x >= 0 && g.x < zone.width) {
      zone.tilemap[g.y][g.x] = TILE.GRAVE;
    }
  }
}

export function validateZone(zone: GenerativeZone): string | null {
  if (zone.width < 8 || zone.width > 60) return `Width must be 8-60, got ${zone.width}`;
  if (zone.height < 8 || zone.height > 60) return `Height must be 8-60, got ${zone.height}`;
  if (zone.width * zone.height > 2500) return `Total tiles (${zone.width * zone.height}) exceeds 2500 limit`;
  if (zone.tilemap.length !== zone.height) return `Tilemap has ${zone.tilemap.length} rows, expected ${zone.height}`;
  for (let r = 0; r < zone.tilemap.length; r++) {
    if (zone.tilemap[r].length !== zone.width) {
      return `Tilemap row ${r} has ${zone.tilemap[r].length} cols, expected ${zone.width}`;
    }
  }

  const { x, y } = zone.playerStart;
  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) {
    return `playerStart (${x},${y}) is out of bounds`;
  }

  let hasExit = false;
  for (let r = 0; r < zone.height && !hasExit; r++) {
    for (let c = 0; c < zone.width && !hasExit; c++) {
      if (zone.tilemap[r][c] === TILE.ROUTE_EXIT) hasExit = true;
    }
  }
  if (!hasExit) return "Zone must have at least one ROUTE_EXIT (tile 10) so the player can leave";

  return null;
}
