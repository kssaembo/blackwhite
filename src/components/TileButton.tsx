import type { Tile, TileSpec } from '../types';

export function TileButton({tile,spec,disabled,selected,onClick,onDragStart,onDragEnter,onDragMove,onDragEnd}:{tile:Tile;spec:TileSpec;disabled?:boolean;selected?:boolean;onClick:()=>void;onDragStart?:(tile:Tile)=>void;onDragEnter?:(tile:Tile)=>void;onDragMove?:(x:number,y:number)=>void;onDragEnd?:()=>void}) {
  const c=spec.color;
  return (
    <button
      className={`tile ${c.toLowerCase()} ${selected?'selected':''} ${disabled?'disabled':''}`}
      onClick={()=>{if(!disabled)onClick()}}
      aria-disabled={disabled}
      draggable
      onDragStart={()=>onDragStart?.(tile)}
      onDragEnter={(e)=>{e.preventDefault();onDragEnter?.(tile)}}
      onDragOver={e=>e.preventDefault()}
      onDragEnd={onDragEnd}
      onPointerDown={(e)=>{e.currentTarget.setPointerCapture?.(e.pointerId);onDragStart?.(tile)}}
      onPointerMove={(e)=>{if(e.buttons||e.pressure>0)onDragMove?.(e.clientX,e.clientY)}}
      onPointerUp={(e)=>{e.currentTarget.releasePointerCapture?.(e.pointerId);onDragEnd?.()}}
      onPointerCancel={onDragEnd}
      aria-label={`${spec.display} ${c} 타일`}
      data-tile-id={tile}
    >
      <img src={`/assets/images/tiles/tile_${c.toLowerCase()}.png`} alt="" draggable={false}/>
      <span className={`tile-text ${spec.display.length>=6?'small':''}`}>{spec.display}</span>
    </button>
  );
}
