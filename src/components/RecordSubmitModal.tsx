import { useState } from 'react';
import type { PlayerRecord, Profile } from '../types';
import { submitRecordToTeacher } from '../network/teacherCollector';
export function RecordSubmitModal({profile,record,onClose,onDone}:{profile:Profile;record:PlayerRecord;onClose:()=>void;onDone:(message:string)=>void}){
 const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const submit=async()=>{if(!profile.name){setError('먼저 플레이어 이름을 확정하세요.');return;}setBusy(true);setError('');try{await submitRecordToTeacher(code,profile,record);onDone('전적이 교사 페이지로 전송되었습니다.');onClose()}catch(e){setError(e instanceof Error?e.message:'전송에 실패했습니다.')}finally{setBusy(false)}};
 return <div className="modal-back"><div className="modal submit-modal"><span className="eyebrow">SUBMIT RECORD</span><h2>전적 제출</h2><p>교사 화면에 표시된 6자리 코드를 입력하세요.</p><div className="submit-summary"><b>{profile.name||'이름 미확정'}</b><span>{record.wins}승 · {record.losses}패 · 승점 {record.points}</span><small>대결 기록 {record.matches.length}건도 함께 전송됩니다.</small></div><input className="code-input" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy||code.length!==6} onClick={submit}>{busy?'전송 중...':'제출'}</button></div></div></div>
}
