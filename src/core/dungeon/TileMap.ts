import type { RoomTemplate } from '@content/schemas';

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
} as const;
export type TileKind = (typeof Tile)[keyof typeof Tile];

export type DecorKind = 'mushroom';

export interface Decor {
  kind: DecorKind;
  /** Tile centre, simulation units. */
  x: number;
  y: number;
}

/**
 * Grid of 1×1 tiles. Tile (tx, ty) covers [tx, tx+1) × [ty, ty+1) in simulation space;
 * row 0 of the template is the far (top-of-screen) edge.
 */
export class TileMap {
  readonly width: number;
  readonly height: number;
  private readonly tiles: Uint8Array;
  /** Player spawn point (tile centre). */
  readonly spawn: { readonly x: number; readonly y: number };
  readonly decor: readonly Decor[];

  private constructor(
    width: number,
    height: number,
    tiles: Uint8Array,
    spawn: { x: number; y: number },
    decor: Decor[],
  ) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.spawn = spawn;
    this.decor = decor;
  }

  /** Builds a map from a validated room template (see `RoomTemplateSchema`). */
  static fromTemplate(template: RoomTemplate): TileMap {
    const height = template.rows.length;
    const width = template.rows[0]?.length ?? 0;
    const tiles = new Uint8Array(width * height);
    const decor: Decor[] = [];
    let spawn: { x: number; y: number } | undefined;

    template.rows.forEach((row, ty) => {
      if (row.length !== width) throw new Error(`TileMap: row ${ty} of '${template.id}' has a wrong length`);
      for (let tx = 0; tx < width; tx++) {
        const ch = row[tx];
        let tile: TileKind;
        switch (ch) {
          case '#':
            tile = Tile.Wall;
            break;
          case ' ':
            tile = Tile.Void;
            break;
          case '.':
            tile = Tile.Floor;
            break;
          case 'P':
            tile = Tile.Floor;
            spawn = { x: tx + 0.5, y: ty + 0.5 };
            break;
          case 'm':
            tile = Tile.Floor;
            decor.push({ kind: 'mushroom', x: tx + 0.5, y: ty + 0.5 });
            break;
          default:
            throw new Error(`TileMap: unknown tile '${ch}' at ${tx},${ty} in '${template.id}'`);
        }
        tiles[ty * width + tx] = tile;
      }
    });
    if (!spawn) throw new Error(`TileMap: room '${template.id}' has no spawn 'P'`);
    return new TileMap(width, height, tiles, spawn, decor);
  }

  /** Tile at integer coordinates; outside the grid is Void. */
  get(tx: number, ty: number): TileKind {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return Tile.Void;
    return this.tiles[ty * this.width + tx] as TileKind;
  }

  /** Walls and void block movement. */
  isSolid(tx: number, ty: number): boolean {
    return this.get(tx, ty) !== Tile.Floor;
  }
}
