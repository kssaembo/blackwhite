import type { Tile } from '../types';
import { tileColor } from '../game/rules';
export function TileButton({tile,disabled,selected,onClick}:{tile:Tile;disabled?:boolean;selected?:boolean;onClick:()=>void}){const c=tileColor(tile);return <button className={`tile ${c.toLowerCase()} ${selected?'selected':''} ${disabled?'disabled':''}`} onClick={onClick} disabled={disabled}><span>{tile}</span></button>}
