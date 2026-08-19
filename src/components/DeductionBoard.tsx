import type { DeductionState, Mark, Tile, TileSpec } from '../types';
const marks:Mark[]=['NONE','X','?','★'];
export function DeductionBoard({value,tileSet,onChange,onClose}:{value:DeductionState;tileSet:TileSpec[];onChange:(d:DeductionState)=>void;onClose:()=>void}){
 const cycle=(t:Tile)=>{const cur=value.marks[t]||'NONE';const next=marks[(marks.indexOf(cur)+1)%marks.length];onChange({...value,marks:{...value.marks,[t]:next}})};
 return <div className="drawer"><div className="drawer-head"><h2>추리판</h2><button onClick={onClose}>닫기</button></div><p className="muted">타일을 터치해 기본 → X → ? → ★ 순서로 표시하세요.</p>{(['BLACK','WHITE'] as const).map(color=><div key={color}><h3>{color}</h3><div className="deduce-grid">{tileSet.filter(t=>t.color===color).map(spec=><button key={spec.id} className={`deduce ${color.toLowerCase()}`} onClick={()=>cycle(spec.id)}><b>{spec.display}</b><span>{value.marks[spec.id]==='NONE'?'·':value.marks[spec.id]}</span></button>)}</div></div>)}<label className="memo">자유 메모<textarea value={value.memo} onChange={e=>onChange({...value,memo:e.target.value})} placeholder="예: 내가 0.6을 냈는데 상대 BLACK에게 졌음"/></label></div>
}
