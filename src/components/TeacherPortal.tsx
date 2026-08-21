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
 {title:'오늘은 수의 크기를 비교해요',body:'흑과 백 게임에서는 타일에 적힌 값을 서로 비교하며 더 큰 값을 판단합니다.\n\n기본 숫자뿐 아니라 분수, 소수, 길이 단위(mm·cm·m)처럼 표현이 다른 값의 크기를 비교하고, 그 결과를 이용해 상대의 타일을 추리해 봅니다.'},
 {title:'흑과 백 게임 규칙',body:'① 두 플레이어는 한 게임에서 서로 같은 9개의 타일을 받습니다. 기본 숫자 모드는 0~8을 사용합니다.\n② 학급용 기본 숫자 모드에서는 백색이 0·2·4·6·8, 흑색이 1·3·5·7입니다. 수학 모드도 BLACK/WHITE 타일로 나뉩니다.\n③ 1라운드 선 플레이어는 무작위로 정하고, 이후에는 직전 라운드 승자가 선 플레이어가 됩니다. 무승부라면 기존 선 플레이어가 유지됩니다.\n④ 선 플레이어가 타일 하나를 먼저 제출하면 상대에게는 숫자가 아닌 BLACK/WHITE 정보만 공개되고, 후 플레이어가 이어서 타일을 제출합니다.\n⑤ 두 타일 중 실제 값이 더 큰 쪽이 라운드에서 승리합니다. 상대가 낸 정확한 값은 승패가 결정된 뒤에도 공개되지 않습니다.\n⑥ 사용한 색과 승패, 내가 낸 값을 근거로 상대의 남은 타일을 추리하며 9라운드를 진행합니다.\n⑦ 9라운드 후 승수가 높은 플레이어가 승리하며, 동점이면 새 타일 세트로 연장전을 진행합니다.'},
 {title:'학급에서는 이렇게 운영해요',body:'① 교사는 「교사 게임 시작」으로 들어가 게임 운영 페이지를 열어 둡니다. 화면은 학생들에게 공개해도 되고 교사만 확인해도 됩니다.\n② 학생들은 개별 태블릿으로 교사가 제공한 QR코드 또는 링크를 통해 학생 게임 페이지에 접속합니다.\n③ 두 학생 중 한 명이 게임방을 만들고, 친구는 방의 QR코드를 스캔하거나 6자리 게임 코드를 입력해 참가합니다.\n④ 두 학생이 게임 유형과 난이도를 함께 의논한 뒤 방장이 설정하고 경기를 진행합니다. 기본 숫자는 난이도 선택이 없습니다.\n⑤ 한 경기가 끝나면 다른 친구와 새로운 게임을 이어서 진행합니다.\n⑥ 전체 활동이 끝나면 학생은 「전적 제출」을 누르고 교사 운영 페이지의 6자리 교사 코드를 입력합니다.\n⑦ 제출된 전적은 교사 화면에서 학생별 승·패·승점과 상대별 경기 기록으로 자동 집계되고 순위가 정리됩니다.'},
 {title:'게임을 더 알아보고 싶다면?',body:'YouTube에서 「더 지니어스 흑과 백」 또는 「지니어스 게임 흑과 백」을 검색해 보세요.\n\n실제 방송 게임의 진행 방식과 추리 전략을 살펴본 뒤, 오늘 수학 활동에서는 숫자·분수·소수·길이의 크기 비교를 활용해 자신만의 전략을 만들어 봅시다.'},
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
 if(intro>=0)return <main className="teacher-intro scene-lobby"><div className="lesson-slide teacher-entry-slide"><span className="slide-count">{intro+1} / {introSlides.length}</span><span className="eyebrow">CLASS INTRO</span><h2>{introSlides[intro].title}</h2><p className="intro-body">{introSlides[intro].body}</p><div className="slide-nav"><button className="secondary" disabled={intro===0} onClick={()=>setIntro(Math.max(0,intro-1))}>이전</button>{intro<introSlides.length-1?<button className="primary" onClick={()=>setIntro(intro+1)}>다음</button>:<button className="primary" onClick={()=>void enterOperation()}>게임 운영 시작</button>}</div></div></main>;
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
