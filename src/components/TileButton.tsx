import { useRef, useState } from 'react';
import type { Tile, TileSpec } from '../types';

type DragVisual={x:number;y:number;w:number;h:number;dx:number;dy:number}|null;
export function TileButton({tile,spec,disabled,selected,onClick,onDragStart,onDragEnter,onDragMove,onDragEnd}:{tile:Tile;spec:TileSpec;disabled?:boolean;selected?:boolean;onClick:()=>void;onDragStart?:(tile:Tile)=>void;onDragEnter?:(tile:Tile)=>void;onDragMove?:(x:number,y:number)=>void;onDragEnd?:()=>void}) {
  const c=spec.color;
  const [drag,setDrag]=useState<DragVisual>(null);
  const moved=useRef(false);
  const finish=()=>{if(drag){setDrag(null);onDragEnd?.();setTimeout(()=>{moved.current=false},0)}};
  return <>
    <button className={`tile ${c.toLowerCase()} ${selected?'selected':''} ${disabled?'disabled':''} ${drag?'drag-source':''}`}
      onClick={()=>{if(!disabled&&!moved.current)onClick()}} aria-disabled={disabled}
      onPointerDown={e=>{if(e.button!==0)return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.setPointerCapture(e.pointerId);moved.current=false;setDrag({x:e.clientX,y:e.clientY,w:r.width,h:r.height,dx:e.clientX-r.left,dy:e.clientY-r.top});onDragStart?.(tile)}}
      onPointerMove={e=>{if(!drag)return;const distance=Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y);if(distance>5)moved.current=true;setDrag({...drag,x:e.clientX,y:e.clientY});if(moved.current)onDragMove?.(e.clientX,e.clientY)}}
      onPointerUp={e=>{try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{} finish()}} onPointerCancel={finish}
      aria-label={`${spec.display} ${c} 타일`} data-tile-id={tile}>
      <img src={`/assets/images/tiles/tile_${c.toLowerCase()}.png`} alt="" draggable={false}/><span className={`tile-text ${spec.display.length>=6?'small':''}`}>{spec.display}</span>
    </button>
    {drag&&moved.current&&<div className={`tile drag-ghost ${c.toLowerCase()}`} style={{left:drag.x-drag.dx,top:drag.y-drag.dy,width:drag.w,height:drag.h}}><img src={`/assets/images/tiles/tile_${c.toLowerCase()}.png`} alt=""/><span className={`tile-text ${spec.display.length>=6?'small':''}`}>{spec.display}</span></div>}
  </>;
}
