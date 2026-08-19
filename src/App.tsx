import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TileButton } from './components/TileButton';
import { DeductionBoard } from './components/DeductionBoard';
import { QRScanner } from './components/QRScanner';
import { commitHash, nonce, verifyCommit } from './game/commitReveal';
import { freshMatch, nextRound, resolveRound, startSet, useTile } from './game/gameEngine';
import { tileColor } from './game/rules';
import { msg, type GameMessage } from './network/messageProtocol';
import { PeerTransport, type NetStatus } from './network/peerConnection';
import { AudioManager } from './audio/AudioManager';
import { TeacherPortal } from './components/TeacherPortal';
import { GameGuide } from './components/GameGuide';
import { RecordSubmitModal } from './components/RecordSubmitModal';
import { clearCurrent, getProfile, getRecord, saveCurrent, saveProfile, saveResult } from './storage/storage';
import type { MatchState, PlayerRecord, Profile, Result, Tile } from './types';
import './styles.css';

const newMatchId=()=>String(Math.floor(100000+Math.random()*900000));
const resultText=(r:Result)=>r==='WIN'?'WIN':r==='LOSE'?'LOSE':'DRAW';

export default function App(){
  const [profile,setProfile]=useState<Profile>(()=>getProfile());
  const [record,setRecord]=useState<PlayerRecord>(()=>getRecord());
  const [screen,setScreen]=useState<'LANDING'|'HOME'|'CREATE'|'JOIN'|'GAME'|'RECORD'|'TEACHER'|'GUIDE'>(()=>location.hash==='#teacher'?'TEACHER':location.hash==='#student'?'HOME':'LANDING');
  const [match,setMatch]=useState<MatchState|null>(null);
  const matchRef=useRef<MatchState|null>(null);
  const applyMatch=useCallback((next:MatchState|null)=>{matchRef.current=next;setMatch(next)},[]);
  const [netStatus,setNetStatus]=useState<NetStatus>('idle');
  const [joinCode,setJoinCode]=useState('');
  const [scanner,setScanner]=useState(false);
  const [deductionOpen,setDeductionOpen]=useState(false);
  const [selected,setSelected]=useState<Tile|undefined>();
  const [debug]=useState(new URLSearchParams(location.search).get('debug')==='true');
  const [notice,setNotice]=useState('');
  const sessionId=useMemo(()=>crypto.randomUUID(),[]);
  const transportRef=useRef(new PeerTransport());
  const processed=useRef(new Set<string>());
  const continueGuard=useRef(false);
  const audio=useMemo(()=>new AudioManager(),[]);
  const [nameLocked,setNameLocked]=useState(()=>Boolean(getProfile().name.trim()));
  const [submitOpen,setSubmitOpen]=useState(false);
  const [confirmTile,setConfirmTile]=useState<Tile|undefined>();

  useEffect(()=>{if(match)saveCurrent(match)},[match]);
  useEffect(()=>{const refresh=()=>setRecord(getRecord());window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const id=window.setInterval(refresh,60000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(id)}},[]);
  useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(id)},[notice]);
  useEffect(()=>()=>transportRef.current.close(),[]);

  const send=useCallback((m:GameMessage)=>transportRef.current.send(m),[]);
  const sendPing=useCallback(()=>{
    const s=matchRef.current; if(!s)return false; return send(msg('PING',s.matchId,sessionId,s.set,s.round,{sentAt:Date.now()}));
  },[send,sessionId]);

  const finishGame=useCallback((s:MatchState)=>{
    const win=s.myScore>s.opponentScore;
    audio.play(win?'gameWin':'gameLose');
    const r=saveResult(s.matchId,s.opponentName,win?'WIN':'LOSE');
    setRecord({...r}); applyMatch({...s,phase:'GAME_RESULT'});
  },[audio,applyMatch]);

  const advanceIfBoth=useCallback((s:MatchState)=>{
    if(!s.myContinue||!s.opponentContinue||continueGuard.current)return;
    continueGuard.current=true;
    setTimeout(()=>continueGuard.current=false,150);
    if(s.round<9){audio.play('nextRound');applyMatch(nextRound(s));return;}
    if(s.myScore===s.opponentScore){audio.play('overtime');applyMatch(startSet({...s,set:s.set+1},s.firstPlayerId,s.set+1));setNotice(`연장 ${s.set} 시작`);return;}
    finishGame(s);
  },[audio,finishGame,applyMatch]);

  const processMessage=useCallback(async(m:GameMessage)=>{
    if(processed.current.has(m.messageId))return; processed.current.add(m.messageId);
    const s=matchRef.current; if(!s||m.matchId!==s.matchId)return;
    if(m.type==='HELLO'){
      const updated={...s,opponentId:m.payload.playerId,opponentName:m.payload.playerName,phase:'CONNECTED' as const};
      applyMatch(updated); if(s.role==='HOST')send(msg('HELLO',s.matchId,sessionId,s.set,s.round,{playerId:s.playerId,playerName:s.playerName})); return;
    }
    if(m.type==='READY'){
      const updated={...s,opponentReady:m.payload.ready,phase:'READY' as const}; applyMatch(updated);
      if(updated.role==='HOST'&&updated.myReady&&updated.opponentReady){const first=Math.random()<.5?updated.playerId:updated.opponentId;send(msg('MATCH_START',updated.matchId,sessionId,1,1,{firstPlayerId:first}));audio.play('gameStart');applyMatch(startSet(updated,first,1));}
      return;
    }
    if(m.type==='MATCH_START'){audio.play('gameStart');applyMatch(startSet(s,m.payload.firstPlayerId,1));return;}
    if(m.set!==s.set||m.round!==s.round)return;
    if(m.type==='FIRST_COMMIT'){
      if(s.firstPlayerId===s.playerId)return;
      audio.play('opponentSubmit');applyMatch({...s,pendingCommitHash:m.payload.commitHash,revealedOpponentColor:m.payload.color,phase:'SECOND_SELECTING'});return;
    }
    if(m.type==='SECOND_SUBMIT'){
      if(s.firstPlayerId!==s.playerId||s.phase!=='FIRST_LOCKED'||s.pendingMyTile===undefined||!s.pendingNonce)return;
      const reveal=msg('FIRST_REVEAL',s.matchId,sessionId,s.set,s.round,{tile:s.pendingMyTile,nonce:s.pendingNonce}); send(reveal);
      audio.play('reveal');const resolved=resolveRound({...s,pendingOpponentTile:m.payload.tile},s.pendingMyTile,m.payload.tile);{const r=resolved.history.at(-1)?.result;if(r==='WIN')audio.play('roundWin');else if(r==='DRAW')audio.play('roundDraw');}applyMatch(resolved);return;
    }
    if(m.type==='FIRST_REVEAL'){
      if(s.firstPlayerId===s.playerId||s.pendingMyTile===undefined||!s.pendingCommitHash)return;
      const ok=await verifyCommit(m.payload.tile,m.payload.nonce,s.matchId,s.set,s.round,s.pendingCommitHash);
      if(!ok){setNotice('검증 오류: 상대의 제출 정보가 최초 Commit과 일치하지 않습니다.');return;}
      audio.play('reveal');const resolved=resolveRound(s,s.pendingMyTile,m.payload.tile);{const r=resolved.history.at(-1)?.result;if(r==='WIN')audio.play('roundWin');else if(r==='DRAW')audio.play('roundDraw');}applyMatch(resolved);return;
    }
    if(m.type==='ROUND_CONTINUE'){
      const updated={...s,opponentContinue:true}; applyMatch(updated); advanceIfBoth(updated); return;
    }
    if(m.type==='PING'){send(msg('PONG',s.matchId,sessionId,s.set,s.round,{sentAt:m.payload.sentAt}));}
  },[advanceIfBoth,send,sessionId,audio,applyMatch]);

  useEffect(()=>{const t=transportRef.current;let previous:NetStatus='idle';t.onMessage=processMessage;t.onStatus=(st)=>{setNetStatus(st);if((st==='disconnected'||st==='error')&&previous==='connected')audio.play('connectionLost');if(st==='connected'&&(previous==='disconnected'||previous==='error'||previous==='connecting'))audio.play('connectionRestored');previous=st;const s=matchRef.current;if(st==='connected'&&s){send(msg('HELLO',s.matchId,sessionId,s.set,s.round,{playerId:s.playerId,playerName:s.playerName}));}};},[processMessage,send,sessionId,audio]);

  const updateName=(name:string)=>{if(nameLocked)return;setProfile({...profile,name})};
  const confirmName=()=>{const name=profile.name.trim();if(!name){setNotice('이름 또는 별명을 입력하세요.');return;}const p={...profile,name};setProfile(p);saveProfile(p);setNameLocked(true);setNotice(`${name} 플레이어로 확정되었습니다.`)};
  const createGame=()=>{if(!profile.name.trim()){setNotice('먼저 이름을 입력하세요.');return;}const id=newMatchId();const s=freshMatch({matchId:id,role:'HOST',playerId:profile.id,playerName:profile.name,opponentId:'',opponentName:''});applyMatch(s);setScreen('CREATE');transportRef.current.host(id);};
  const joinGame=(code=joinCode)=>{const raw=code.startsWith('BWJOIN:')?code.slice(7):code;const clean=raw.replace(/\D/g,'').slice(0,6);if(!profile.name.trim()){setNotice('먼저 이름을 입력하세요.');return;}if(!/^\d{6}$/.test(clean)){setNotice('게임 코드는 6자리 숫자입니다.');return;}const s=freshMatch({matchId:clean,role:'JOIN',playerId:profile.id,playerName:profile.name,opponentId:'',opponentName:''});applyMatch(s);setScreen('GAME');transportRef.current.join(clean);};
  const ready=()=>{if(!match)return;const updated={...match,myReady:true,phase:'READY' as const};applyMatch(updated);send(msg('READY',updated.matchId,sessionId,updated.set,updated.round,{ready:true}));if(updated.role==='HOST'&&updated.opponentReady){const first=Math.random()<.5?updated.playerId:updated.opponentId;send(msg('MATCH_START',updated.matchId,sessionId,1,1,{firstPlayerId:first}));audio.play('gameStart');applyMatch(startSet(updated,first,1));}};

  const submitTile=async()=>{
    const s=matchRef.current;if(!s||selected===undefined)return;
    audio.play('tileSubmit');
    if(!s.myRemainingTiles.includes(selected)){setSelected(undefined);return;}
    if(s.firstPlayerId===s.playerId&&s.phase==='FIRST_SELECTING'){
      const n=nonce();const h=await commitHash(selected,n,s.matchId,s.set,s.round);const updated=useTile({...s,pendingNonce:n,pendingCommitHash:h},selected);
      const locked={...updated,phase:'FIRST_LOCKED' as const};applyMatch(locked);send(msg('FIRST_COMMIT',s.matchId,sessionId,s.set,s.round,{color:tileColor(selected),commitHash:h}));setSelected(undefined);return;
    }
    if(s.firstPlayerId!==s.playerId&&s.phase==='SECOND_SELECTING'){
      const updated=useTile(s,selected);const locked={...updated,phase:'SECOND_LOCKED' as const};applyMatch(locked);send(msg('SECOND_SUBMIT',s.matchId,sessionId,s.set,s.round,{tile:selected}));setSelected(undefined);
    }
  };
  const continueRound=()=>{const s=matchRef.current;if(!s||s.phase!=='ROUND_RESULT')return;const updated={...s,myContinue:true};applyMatch(updated);send(msg('ROUND_CONTINUE',s.matchId,sessionId,s.set,s.round,{}));advanceIfBoth(updated);};
  const leaveToHome=()=>{transportRef.current.close();clearCurrent();applyMatch(null);setSelected(undefined);setScreen('HOME');setNetStatus('idle');};
  const rematch=()=>{transportRef.current.close();clearCurrent();applyMatch(null);setSelected(undefined);setScreen('HOME');setNetStatus('idle');};

  const phaseMessage=()=>{if(!match)return'';if(match.phase==='DISCONNECTED')return'연결이 끊어졌습니다. 게임 상태는 보존되었습니다.';if(match.phase==='READY'||match.phase==='CONNECTED')return'두 플레이어가 READY를 눌러주세요.';if(match.phase==='ROUND_START')return'상대가 먼저 타일을 냅니다.';if(match.phase==='FIRST_SELECTING')return'당신이 먼저 냅니다. 타일을 선택하세요.';if(match.phase==='FIRST_LOCKED')return'제출 완료. 상대방의 선택을 기다리고 있습니다.';if(match.phase==='SECOND_SELECTING')return`상대가 ${match.revealedOpponentColor}을 냈습니다. 타일을 선택하세요.`;if(match.phase==='SECOND_LOCKED')return'제출 완료. 상대의 타일을 검증하고 있습니다.';return'';};
  const last=match?.history.at(-1);

  if(screen==='LANDING') return <main className="shell home landing-home scene-main"><header className="brand image-brand"><img src="/assets/images/logo/logo_blackwhite.png" alt="백과 흑 - 더 지니어스 한 학급 놀이"/><div className="brand-rule"><span/>심리 추리 숫자 대결<span/></div></header><div className="landing-actions"><button className="primary teacher-start" onClick={()=>{location.hash='teacher';setScreen('TEACHER')}}><small>수업 운영 · 타이머 · 결과 집계</small>교사 게임 시작</button><button className="light student-start" onClick={()=>{location.hash='student';setScreen('HOME')}}><small>2인 연결 · 대결 · 개인 전적</small>학생 게임 시작</button><button className="manual-start" onClick={()=>setScreen('GUIDE')}><small>교사/학생 사용 방법</small>게임 설명서</button></div></main>;

  if(screen==='GUIDE') return <GameGuide onBack={()=>setScreen('LANDING')}/>;
  if(screen==='TEACHER') return <TeacherPortal onBack={()=>{location.hash='';setScreen('LANDING')}}/>;

  if(screen==='HOME') return <main className="shell home scene-main student-home"><button className="back home-back" onClick={()=>{location.hash='';setScreen('LANDING')}}>← 메인 화면</button><header className="brand image-brand"><img src="/assets/images/logo/logo_blackwhite.png" alt="백과 흑"/><div className="brand-rule"><span/>STUDENT GAME<span/></div></header><section className="record-card glass"><div className="today-record"><small>오늘의 전적</small><strong>총 {record.games}경기 · {record.wins}승 · {record.losses}패</strong></div><div className="points"><small>승점</small><strong>{record.points}</strong></div></section><section className={`name-box glass compact ${nameLocked?'locked':''}`}><label>PLAYER NAME</label><div className="name-confirm-row"><input value={profile.name} disabled={nameLocked} maxLength={12} placeholder="이름 또는 별명" onChange={e=>updateName(e.target.value)}/>{!nameLocked?<button className="name-confirm" onClick={confirmName}>확인</button>:<span className="fixed-badge">✓ 플레이어 확정</span>}</div></section><div className="student-action-grid"><button className="primary" disabled={!nameLocked} onClick={()=>{audio.play('buttonClick');createGame()}}>게임 만들기</button><button className="light" disabled={!nameLocked} onClick={()=>{audio.play('buttonClick');setScreen('JOIN')}}>게임 참가</button><button className="record-main-btn" onClick={()=>setScreen('RECORD')}>▤ 내 경기 기록 <b>{record.games}</b></button><button className="submit-record-btn" disabled={!nameLocked} onClick={()=>setSubmitOpen(true)}>↑ 전적 제출</button></div>{!nameLocked&&<p className="name-help">게임을 시작하려면 이름을 입력하고 <b>확인</b>을 눌러 플레이어를 확정하세요.</p>}{submitOpen&&<RecordSubmitModal profile={profile} record={record} onClose={()=>setSubmitOpen(false)} onDone={setNotice}/>} {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}</div>}</main>;

  if(screen==='JOIN') return <main className="shell center scene-lobby"><button className="back" onClick={()=>setScreen('HOME')}>← 돌아가기</button><div className="panel join"><div className="eyebrow">JOIN MATCH</div><h2>게임 참가</h2><button className="scan" onClick={()=>setScanner(true)}>▣ QR 코드 스캔</button><div className="or"><span/>또는<span/></div><label>게임 코드</label><input className="code-input" inputMode="numeric" maxLength={6} value={joinCode} onChange={e=>setJoinCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/><button className="primary" onClick={()=>joinGame()}>입장</button></div>{scanner&&<QRScanner onCode={(c)=>{setScanner(false);setJoinCode(c);joinGame(c)}} onClose={()=>setScanner(false)}/>} {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}</div>}</main>;

  if(screen==='CREATE'&&match) return <main className="shell center scene-lobby"><button className="back" onClick={leaveToHome}>← 취소</button><div className="panel create"><div className="eyebrow">CREATE MATCH</div><h2>상대방에게 보여주세요</h2><div className="qr"><QRCodeSVG value={`BWJOIN:${match.matchId}`} size={220} level="M"/></div><div className="match-code">{match.matchId}</div><div className={`connection ${netStatus}`}><span/> {netStatus==='connected'?'상대 연결됨':'상대방을 기다리는 중...'}</div>{netStatus==='connected'&&<button className="primary" onClick={()=>setScreen('GAME')}>READY 화면으로</button>}</div></main>;

  if(screen==='RECORD') return <main className="shell records scene-main"><button className="back" onClick={()=>setScreen('HOME')}>← 돌아가기</button><div className="panel"><div className="eyebrow">MY RECORD</div><h2>내 경기 기록</h2><div className="record-summary"><strong>{record.games}경기</strong><span>{record.wins}승 · {record.losses}패 · 승점 {record.points}</span></div><div className="history-list">{record.matches.length===0?<p className="muted">아직 경기 기록이 없습니다.</p>:record.matches.map((m,i)=><div className="history-item" key={m.matchId}><b>{record.matches.length-i}경기</b><span>{m.opponentName}</span><strong className={m.result.toLowerCase()}>{m.result}</strong></div>)}</div></div></main>;

  if(screen==='GAME'&&match){
    const canSelect=match.phase==='FIRST_SELECTING'||match.phase==='SECOND_SELECTING';
    const myTurnFirst=match.firstPlayerId===match.playerId;
    const offline=netStatus==='disconnected'||netStatus==='error';
    return <main className={`game-shell scene-game ${match.phase==='GAME_RESULT'?'scene-result':''}`}><header className="game-top"><div><b>BLACK <i>&</i> WHITE</b><span>{match.set===1?'본게임':`연장 ${match.set-1}`} · ROUND {match.round}/9</span></div><div className="game-top-actions"><div className={`connection ${netStatus}`}><span/> {netStatus==='connected'?'연결됨':netStatus==='connecting'?'연결 중':'연결 복구 필요'}</div><button className="game-reset-btn" onClick={leaveToHome}>메인화면(게임 초기화)</button></div></header><section className="scoreboard"><div><small>나</small><strong>{match.playerName}</strong><b>{match.myScore}</b></div><i>:</i><div><small>상대</small><strong>{match.opponentName||'연결 중'}</strong><b>{match.opponentScore}</b></div></section>
    {!offline&&(match.phase==='CONNECTED'||match.phase==='READY')&&<section className="ready-panel"><h2>{match.opponentName?`${match.playerName} VS ${match.opponentName}`:'상대 정보를 확인하는 중...'}</h2><div className="ready-state"><span>나 <b>{match.myReady?'READY ●':'WAITING ○'}</b></span><span>상대 <b>{match.opponentReady?'READY ●':'WAITING ○'}</b></span></div><button className="primary" disabled={match.myReady||!match.opponentName} onClick={ready}>{match.myReady?'READY 완료':'READY'}</button></section>}
    {offline&&<section className="action-stage"><div className="big-message">연결이 끊어졌습니다.</div><p>게임 상태는 이 기기에 보존되어 있습니다.</p><button className="primary" onClick={()=>transportRef.current.reconnect()}>다시 연결</button></section>}
    {!offline&&!['CONNECTED','READY','DISCONNECTED','ROUND_RESULT','GAME_RESULT'].includes(match.phase)&&<><section className="action-stage"><div className="turn-chip">{myTurnFirst?'선 플레이어':'후 플레이어'}</div><div className="big-message">{phaseMessage()}</div>{match.revealedOpponentColor&&match.phase==='SECOND_SELECTING'&&<div className={`opponent-color ${match.revealedOpponentColor.toLowerCase()}`}>{match.revealedOpponentColor}<small>{match.revealedOpponentColor==='BLACK'?'0 · 2 · 4 · 6 · 8':'1 · 3 · 5 · 7'}</small></div>}{match.phase==='FIRST_LOCKED'&&match.pendingMyTile!==undefined&&<div className="locked-info">내가 제출한 타일 <b>{match.pendingMyTile}</b> <span>{tileColor(match.pendingMyTile)}</span></div>}</section><section className="tiles"><h3>내 타일</h3><div className="tile-row">{([0,1,2,3,4,5,6,7,8] as Tile[]).map(t=><TileButton key={t} tile={t} disabled={!canSelect||!match.myRemainingTiles.includes(t)} selected={selected===t} onClick={()=>{audio.play('tileSelect');setSelected(t)}}/>)}</div>{canSelect&&<button className="submit" disabled={selected===undefined} onClick={()=>{if(selected!==undefined)setConfirmTile(selected)}}>이 타일 제출</button>}</section></>}
    {!offline&&match.phase==='ROUND_RESULT'&&last&&<section className="result-stage"><div className={`result-word ${last.result.toLowerCase()}`}>{resultText(last.result)}</div><div className="result-cards"><div><small>내 타일</small><b>{last.myTile}</b><span>{last.myColor}</span></div><div><small>상대 타일</small><b>?</b><span>{last.opponentColor}</span><em>숫자 비공개</em></div></div><div className="result-score">현재 점수 <b>{match.myScore} : {match.opponentScore}</b></div><button className="primary" disabled={match.myContinue} onClick={continueRound}>{match.myContinue?'상대 확인을 기다리는 중':match.round===9?'게임 종료':'다음 라운드'}</button></section>}
    {match.phase==='GAME_RESULT'&&<section className="gameover"><div className="eyebrow">GAME OVER</div><h2>{match.myScore>match.opponentScore?'승리!':'패배'}</h2><div className="final-score">{match.myScore} <i>:</i> {match.opponentScore}</div>{match.myScore>match.opponentScore&&<div className="point-up">+1 승점</div>}<div className="mini-record">오늘의 전적 <b>{record.wins}승 · {record.losses}패</b> 승점 <strong>{record.points}</strong></div><button className="primary" onClick={rematch}>다른 상대와 경기하기</button></section>}
    {!['CONNECTED','READY','GAME_RESULT','DISCONNECTED'].includes(match.phase)&&<nav className="game-nav"><button onClick={()=>setDeductionOpen(true)}>추리판</button><button onClick={()=>setNotice(match.opponentUsedColors.length?match.opponentUsedColors.map((c,i)=>`R${i+1} ${c}`).join(' · '):'아직 상대 사용 기록이 없습니다.')}>상대 기록</button><button onClick={()=>setNotice(match.history.length?match.history.map(h=>`R${h.round} ${h.myTile}${h.myColor[0]} / ${h.opponentColor} / ${h.result}`).join(' · '):'아직 라운드 기록이 없습니다.')}>라운드 기록</button></nav>}
    {deductionOpen&&<DeductionBoard value={match.deduction} onChange={d=>applyMatch({...match,deduction:d})} onClose={()=>setDeductionOpen(false)}/>} {confirmTile!==undefined&&<div className="modal-back"><div className="modal game-confirm-modal"><span className="eyebrow">TILE SUBMIT</span><h2>{confirmTile}번 타일을 제출할까요?</h2><p>제출하면 이 라운드에서는 변경할 수 없습니다.</p><div className="modal-actions"><button className="secondary" onClick={()=>setConfirmTile(undefined)}>취소</button><button className="primary" onClick={()=>{setConfirmTile(undefined);void submitTile()}}>제출</button></div></div></div>} {notice&&<div className="toast wide" onClick={()=>setNotice('')}>{notice}</div>}{debug&&<aside className="debug"><b>NETWORK DEBUG</b><span>Match {match.matchId}</span><span>Peer {netStatus}</span><span>Sent {transportRef.current.sent}</span><span>Received {transportRef.current.received}</span><span>Reconnect {transportRef.current.reconnects}</span><button onClick={sendPing}>연결 테스트</button></aside>}</main>;
  }
  return null;
}
