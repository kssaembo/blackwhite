import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TeacherBgmController } from '../audio/AudioManager';
import { TeacherCollector, type CollectorStatus, type SubmittedRecord } from '../network/teacherCollector';
import { gameTypeLabel, difficultyLabel } from '../game/tileGenerator';

const code6=()=>String(Math.floor(100000+Math.random()*900000));
const loadTeacherCode=()=>sessionStorage.getItem('bw_teacher_code')||code6();
const loadSubmissions=():SubmittedRecord[]=>{try{return JSON.parse(sessionStorage.getItem('bw_teacher_submissions')||'[]')}catch{return[]}};
const fmt=(sec:number)=>`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
const introSlides=[
 {title:'정보를 관찰하세요',body:'상대가 공개하는 것은 타일의 값이 아니라 BLACK 또는 WHITE입니다. 보이는 정보와 보이지 않는 정보를 구분하며 시작합니다.'},
 {title:'근거를 쌓아 추론하세요',body:'상대가 사용한 색, 승패, 내가 낸 타일 값을 근거로 상대가 어떤 숫자를 사용했을지 가능성을 좁혀갑니다.'},
 {title:'가설은 계속 수정됩니다',body:'새로운 라운드의 정보가 들어오면 기존 추리를 그대로 믿지 말고 X · ? · ★ 추리판을 활용해 판단을 수정합니다.'},
 {title:'오늘의 미션',body:'정답을 맞히는 것보다 중요한 것은 “왜 그렇게 생각했는지”입니다. 근거를 가지고 선택하고, 경기 뒤 자신의 추리 과정을 설명해 보세요.'},
];

export function TeacherPortal({onBack}:{onBack:()=>void}){
 const collector=useRef(new TeacherCollector()); const bgm=useMemo(()=>new TeacherBgmController(),[]);
 const [teacherCode,setTeacherCode]=useState(loadTeacherCode); const [collectorStatus,setCollectorStatus]=useState<CollectorStatus>('idle');
 const [submissions,setSubmissions]=useState<SubmittedRecord[]>(loadSubmissions); const [minutes,setMinutes]=useState(20); const [seconds,setSeconds]=useState(1200); const [timerRunning,setTimerRunning]=useState(false);
 const [bgmPlaying,setBgmPlaying]=useState(false); const [volume,setVolume]=useState(.45); const [intro,setIntro]=useState(0); const [notice,setNotice]=useState('');
 const studentUrl=`${location.origin}${location.pathname}#student`;
 useEffect(()=>()=>bgm.pause(),[bgm]); useEffect(()=>{sessionStorage.setItem('bw_teacher_code',teacherCode)},[teacherCode]); useEffect(()=>{sessionStorage.setItem('bw_teacher_submissions',JSON.stringify(submissions))},[submissions]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(id)},[notice]);
 useEffect(()=>{const c=collector.current;c.onStatus=setCollectorStatus;c.onSubmission=incoming=>setSubmissions(prev=>{const idx=prev.findIndex(v=>v.profileId===incoming.profileId);if(idx<0)return [...prev,incoming];const copy=[...prev];copy[idx]=incoming;return copy});c.start(teacherCode);return()=>c.close()},[teacherCode]);
 useEffect(()=>{if(!timerRunning)return;const id=setInterval(()=>setSeconds(s=>{if(s<=1){setTimerRunning(false);return 0}return s-1}),1000);return()=>clearInterval(id)},[timerRunning]);
 const resetTimer=()=>{setTimerRunning(false);setSeconds(minutes*60)};
 const enterOperation=async()=>{setIntro(-1);try{await bgm.play();setBgmPlaying(true)}catch{setBgmPlaying(false)}};
 const toggleBgm=async()=>{if(bgmPlaying){bgm.pause();setBgmPlaying(false)}else{try{await bgm.play();setBgmPlaying(true)}catch{setBgmPlaying(false)}}};
 const copyStudentLink=async()=>{await navigator.clipboard?.writeText(studentUrl);setNotice('학생 페이지 링크를 복사했습니다.')};
 const copyResults=async()=>{const rows=[['순위','이름','승점','승','패','총경기','대결기록','제출시각']];[...submissions].sort((a,b)=>b.record.points-a.record.points||b.record.wins-a.record.wins).forEach((s,i)=>rows.push([String(i+1),s.playerName,String(s.record.points),String(s.record.wins),String(s.record.losses),String(s.record.games),s.record.matches.map(m=>`${m.opponentName} ${m.result} ${gameTypeLabel(m.gameType??'BASIC')} ${difficultyLabel(m.difficulty??'EASY')}`).join(' / '),new Date(s.submittedAt).toLocaleString('ko-KR')]));const tsv=rows.map(r=>r.join('\t')).join('\n');await navigator.clipboard?.writeText(tsv);setNotice('학생 전적 결과를 복사했습니다.')};
 const endTeacherGame=()=>{bgm.pause();collector.current.close();sessionStorage.removeItem('bw_teacher_code');sessionStorage.removeItem('bw_teacher_submissions');setSubmissions([]);setTimerRunning(false);onBack()};
 if(intro>=0)return <main className="teacher-intro scene-lobby"><div className="lesson-slide teacher-entry-slide"><span className="slide-count">{intro+1} / {introSlides.length}</span><span className="eyebrow">CLASS INTRO</span><h2>{introSlides[intro].title}</h2><p>{introSlides[intro].body}</p><div className="slide-nav"><button className="secondary" disabled={intro===0} onClick={()=>setIntro(Math.max(0,intro-1))}>이전</button>{intro<introSlides.length-1?<button className="primary" onClick={()=>setIntro(intro+1)}>다음</button>:<button className="primary" onClick={()=>void enterOperation()}>게임 운영 시작</button>}</div></div></main>;
 return <main className="teacher-page scene-lobby">
  <header className="teacher-header"><div><span className="eyebrow">TEACHER CONTROL</span><h1>교사 게임 운영</h1></div><div className="teacher-header-actions"><div className={`collector-pill ${collectorStatus}`}>● {collectorStatus==='open'?'전적 수신 대기 중':'집계 연결 준비 중'}</div><button className="teacher-end-btn" onClick={endTeacherGame}>게임 종료(전적 초기화)</button></div></header>
  <section className="teacher-grid teacher-grid-v6">
   <article className="teacher-card access-card"><div className="card-title"><b>학생 접속</b><span>학생용 페이지를 바로 열 수 있습니다.</span></div><div className="student-access"><div className="qr"><QRCodeSVG value={studentUrl} size={150}/></div><div><label>학생 페이지 링크</label><div className="copy-line"><input readOnly value={studentUrl}/><button onClick={()=>void copyStudentLink()}>복사</button></div><small>학생들은 QR 또는 링크로 접속해 게임을 시작합니다.</small></div></div></article>
   <article className="teacher-card timer-card timer-card-large"><div className="card-title"><b>수업 타이머</b><span>시간 종료 후 학생들에게 전적 제출을 안내하세요.</span></div><div className={`timer-display ${seconds===0?'done':''}`}>{fmt(seconds)}</div><div className="timer-row"><input type="number" min="1" max="90" value={minutes} onChange={e=>setMinutes(Math.max(1,Number(e.target.value)||1))}/><span>분</span><button className="primary" onClick={()=>setTimerRunning(v=>!v)}>{timerRunning?'일시정지':'시작'}</button><button className="secondary" onClick={resetTimer}>초기화</button></div></article>
  </section>
  <section className="teacher-results teacher-card"><div className="results-head"><div><span className="eyebrow">CLASS RESULT</span><h2>학생 전적 집계</h2><p>게임 종료 후 학생이 자신의 기기에서 전적을 제출하면 자동으로 갱신됩니다.</p></div><div className="teacher-code-area"><div className="teacher-code-box"><small>교사 코드</small><strong>{teacherCode}</strong></div><button className="copy-results-btn" onClick={()=>void copyResults()}>학생 전적 결과 복사하기</button><small>한셀/엑셀에 붙여넣기 하시면 학생 전적을 저장하실 수 있습니다.</small></div></div>
   <div className="result-stats"><span>제출 <b>{submissions.length}명</b></span><span>총 경기 기록 <b>{submissions.reduce((a,s)=>a+s.record.games,0)}</b></span><span>총 승점 <b>{submissions.reduce((a,s)=>a+s.record.points,0)}</b></span></div>
   {submissions.length===0?<div className="empty-submit">아직 제출된 전적이 없습니다.<br/><small>학생 페이지 → 전적 제출 → 교사 코드 {teacherCode}</small></div>:<div className="teacher-table-wrap"><table className="teacher-table"><thead><tr><th>순위</th><th>이름</th><th>승점</th><th>전적</th><th>대결 기록</th><th>제출 시각</th></tr></thead><tbody>{[...submissions].sort((a,b)=>b.record.points-a.record.points||b.record.wins-a.record.wins).map((s,i)=><tr key={s.profileId}><td>{i+1}</td><td><b>{s.playerName}</b></td><td><strong>{s.record.points}</strong></td><td>{s.record.games}경기 · {s.record.wins}승 {s.record.losses}패</td><td className="opponent-list">{s.record.matches.length?s.record.matches.map((m,j)=><span key={`${m.matchId}-${j}`}>{m.opponentName} <b className={m.result.toLowerCase()}>{m.result}</b> <small>{gameTypeLabel(m.gameType??'BASIC')} · {difficultyLabel(m.difficulty??'EASY')}</small></span>):'기록 없음'}</td><td>{new Date(s.submittedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</td></tr>)}</tbody></table></div>}
  </section>
  <div className="bgm-mini"><button onClick={()=>void toggleBgm()}>{bgmPlaying?'Ⅱ':'▶'}</button><b>BGM</b><input aria-label="BGM 음량" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);bgm.setVolume(v)}}/></div>
  {notice&&<div className="toast top-toast">{notice}</div>}
 </main>
}
