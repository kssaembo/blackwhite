import type { Tile, TileColor } from '../types';
export const ALL_TILES: Tile[] = [0,1,2,3,4,5,6,7,8];
export const tileColor = (tile:Tile):TileColor => tile % 2 === 0 ? 'BLACK' : 'WHITE';
export const compareTiles = (a:Tile,b:Tile) => a===b ? 0 : a>b ? 1 : -1;
