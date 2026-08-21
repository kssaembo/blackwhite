import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TileButton } from './components/TileButton';
import { DeductionBoard } from './components/DeductionBoard';
import { QRScanner } from './components/QRScanner';
import { commitHash, nonce, verifyCommit } from './game/commitReveal';
import { freshMatch, mirrorCheckpointForOpponent, nextRound, recoveryCheckpoint, resolveRound, startSet, useTile } from './game/gameEngine';
import { gameTypeLabel, difficultyLabel, generateTileSet, getSpec } from './game/tileGenerator';
import { msg, type GameMessage } from './network/messageProtocol';
import { PeerTransport, type NetStatus } from './network/peerConnection';
import { AudioManager } from './audio/AudioManager';
import { TeacherPortal } from './components/TeacherPortal';
import { GameGuide } from './components/GameGuide';
import { RecordSubmitModal } from './components/RecordSubmitModal';
import { clearCurrent, getProfile, getRecord, saveCurrent, saveProfile, saveResult, resetAccount } from './storage/storage';
import type { Difficulty, GameType, MatchState, PlayerRecord, Profile, RecordSummary, Result, Tile, TileColor } from './types';
import './styles.css';

const newMatchId=()=>String(Math.floor(1000+Math.random()*9000));
const resultText=(r:Result)=>r==='WIN'?'WIN':r==='LOSE'?'LOSE':'DRAW';
const resultKo=(r:Result)=>r==='WIN'?'승리':r==='LOSE'?'패배':'무승부';
const colorKo=(c:TileColor)=>c==='BLACK'?'검정':'흰색';
const GAME_TYPES:GameType[]=['BASIC','FRACTION','DECIMAL','LENGTH','MIXED'];
const DIFFICULTIES:Difficulty[]=['EASY','NORMAL','HARD'];
const recordSummary=(r:PlayerRecord):RecordSummary=>({wins:r.wins,draws:r.draws||0,losses:r.losses,games:r.games,points:r.points});
const modeText=(s:Pick<MatchState,'gameType'|'difficulty'>)=>s.gameType==='BASIC'?gameTypeLabel(s.gameType):`${gameTypeLabel(s.gameType)} · ${difficultyLabel(s.difficulty)}`;
const recordLine=(r?:RecordSummary)=>r?`${r.games}경기 · ${r.wins}승 ${r.draws}무 ${r.losses}패 · 승점 ${r.points}`:'전적 확인 중';

export default function App(){
  const [profile,setProfile]=useState<Profile>(()=>getProfile());
  const [record,setRecord]=useState<PlayerRecord>(()=>getRecord());
  const [screen,setScreen]=useState<'LANDING'|'HOME'|'CREATE'|'JOIN'|'PREVIEW'|'GAME'|'RECORD'|'TEACHER'|'GUIDE'>(()=>location.hash==='#teacher'?'TEACHER':location.hash==='#student'?'HOME':'LANDING');
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
  const [detailNotice,setDetailNotice]=useState<{title:string;lines:string[]}|null>(null);
  const sessionId=useMemo(()=>crypto.randomUUID(),[]);
  const transportRef=useRef(new PeerTransport());
  const processed=useRef(new Set<string>());
  const continueGuard=useRef(false);
  const audio=useMemo(()=>new AudioManager(),[]);
  const [nameLocked,setNameLocked]=useState(()=>Boolean(getProfile().name.trim()));
  const [submitOpen,setSubmitOpen]=useState(false);
  const [confirmTile,setConfirmTile]=useState<Tile|undefined>();
  const [resetAccountOpen,setResetAccountOpen]=useState(false);
  const [gameResetOpen,setGameResetOpen]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [createType,setCreateType]=useState<GameType>('BASIC');
  const [createDifficulty,setCreateDifficulty]=useState<Difficulty>('EASY');
  const [dragTile,setDragTile]=useState<Tile|undefined>();
  const dragMoved=useRef(false);
  const [recoveryCode,setRecoveryCode]=useState('');
  const lastPeerActivity=useRef(Date.now());

  useEffect(()=>{if(match)saveCurrent(match)},[match]);
  useEffect(()=>{const refresh=()=>setRecord(getRecord());window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const id=window.setInterval(refresh,60000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(id)}},[]);
  useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(id)},[notice]);
  useEffect(()=>{if(!detailNotice)return;const id=window.setTimeout(()=>setDetailNotice(null),3300);return()=>clearTimeout(id)},[detailNotice]);
  useEffect(()=>()=>transportRef.current.close(),[]);

  const send=useCallback((m:GameMessage)=>transportRef.current.send(m),[]);
  const helloPayload=useCallback(()=>({playerId:profile.id,playerName:profile.name,record:recordSummary(getRecord())}),[profile.id,profile.name]);
  const sendPing=useCallback(()=>{const s=matchRef.current;if(!s)return false;return send(msg('PING',s.matchId,sessionId,s.set,s.round,{sentAt:Date.now()}));},[send,sessionId]);

  const finishGame=useCallback((s:MatchState)=>{
    const result:Result=s.myScore>s.opponentScore?'WIN':s.myScore<s.opponentScore?'LOSE':'DRAW';
    audio.play(result==='WIN'?'gameWin':result==='LOSE'?'gameLose':'roundDraw');
    const r=saveResult(s.matchId,s.opponentName,result,s.gameType,s.difficulty);
    setRecord({...r});applyMatch({...s,phase:'GAME_RESULT'});
  },[audio,applyMatch]);

  const advanceIfBoth=useCallback((s:MatchState)=>{
    if(!s.myContinue||!s.opponentContinue||continueGuard.current)return;
    continueGuard.current=true;setTimeout(()=>continueGuard.current=false,150);
    if(s.round<9){audio.play('nextRound');applyMatch(nextRound(s));return;}
    finishGame(s);
  },[audio,finishGame,applyMatch]);

  const processMessage=useCallback(async(m:GameMessage)=>{
    lastPeerActivity.current=Date.now();
    if(processed.current.has(m.messageId))return;processed.current.add(m.messageId);
    let s=matchRef.current;if(!s)return;
    if(m.type==='HELLO'){
      // A recovery room uses a new connection code but keeps the original matchId.
      if(s.role==='JOIN'&&m.matchId!==s.matchId){s={...s,matchId:m.matchId};}
      if(m.matchId!==s.matchId && !(s.role==='HOST'&&Boolean(recoveryCode)))return;
      const oldOpponentId=s.opponentId;
      const mappedFirst=s.firstPlayerId===oldOpponentId&&oldOpponentId&&oldOpponentId!==m.payload.playerId?m.payload.playerId:s.firstPlayerId;
      const updated={...s,firstPlayerId:mappedFirst,opponentId:m.payload.playerId,opponentName:m.payload.playerName,opponentRecord:m.payload.record,phase:(s.phase==='READY'||s.phase==='CONNECTED')?'CONNECTED' as const:s.phase};
      applyMatch(updated);
      if(updated.role==='HOST'){
        send(msg('HELLO',updated.matchId,sessionId,updated.set,updated.round,helloPayload()));
        send(msg('ROOM_CONFIG',updated.matchId,sessionId,updated.set,updated.round,{gameType:updated.gameType,difficulty:updated.difficulty,tileSet:updated.tileSet}));
        if(recoveryCode){
          const snapshot=mirrorCheckpointForOpponent(updated,m.payload.playerId,m.payload.playerName);
          snapshot.opponentRecord=recordSummary(getRecord());
          send(msg('STATE_SYNC',updated.matchId,sessionId,updated.set,updated.round,{state:snapshot}));
          setRecoveryCode('');
        }
      }
      return;
    }
    if(m.matchId!==s.matchId)return;
    if(m.type==='STATE_SYNC'){
      const restored={...m.payload.state,playerId:profile.id,playerName:profile.name,opponentRecord:m.payload.state.opponentRecord};
      applyMatch(restored);setRecoveryCode('');setScreen('GAME');setNotice('마지막으로 완료된 라운드까지 복구했습니다.');return;
    }
    if(m.type==='ROOM_CONFIG'){
      if(s.role!=='JOIN')return;
      applyMatch({...s,gameType:m.payload.gameType,difficulty:m.payload.difficulty,tileSet:m.payload.tileSet,phase:'CONNECTED'});
      setScreen('PREVIEW');return;
    }
    if(m.type==='READY'){
      const updated={...s,opponentReady:m.payload.ready,phase:'READY' as const};applyMatch(updated);
      if(updated.role==='HOST'&&updated.myReady&&updated.opponentReady){const first=Math.random()<.5?updated.playerId:updated.opponentId;send(msg('MATCH_START',updated.matchId,sessionId,1,1,{firstPlayerId:first}));audio.play('gameStart');applyMatch(startSet(updated,first,1));}
      return;
    }
    if(m.type==='MATCH_START'){audio.play('gameStart');applyMatch(startSet(s,m.payload.firstPlayerId,1));return;}
    if(m.set!==s.set||m.round!==s.round)return;
    if(m.type==='FIRST_COMMIT'){
      if(s.firstPlayerId===s.playerId)return;audio.play('opponentSubmit');applyMatch({...s,pendingCommitHash:m.payload.commitHash,revealedOpponentColor:m.payload.color,phase:'SECOND_SELECTING'});return;
    }
    if(m.type==='SECOND_SUBMIT'){
      if(s.firstPlayerId!==s.playerId||s.phase!=='FIRST_LOCKED'||s.pendingMyTile===undefined||!s.pendingNonce)return;
      send(msg('FIRST_REVEAL',s.matchId,sessionId,s.set,s.round,{tile:s.pendingMyTile,nonce:s.pendingNonce}));audio.play('reveal');
      const resolved=resolveRound({...s,pendingOpponentTile:m.payload.tile},s.pendingMyTile,m.payload.tile);const r=resolved.history.at(-1)?.result;if(r==='WIN')audio.play('roundWin');else if(r==='DRAW')audio.play('roundDraw');applyMatch(resolved);return;
    }
    if(m.type==='FIRST_REVEAL'){
      if(s.firstPlayerId===s.playerId||s.pendingMyTile===undefined||!s.pendingCommitHash)return;
      const ok=await verifyCommit(m.payload.tile,m.payload.nonce,s.matchId,s.set,s.round,s.pendingCommitHash);if(!ok){setNotice('검증 오류: 상대 제출 정보가 최초 Commit과 일치하지 않습니다.');return;}
      audio.play('reveal');const resolved=resolveRound(s,s.pendingMyTile,m.payload.tile);const r=resolved.history.at(-1)?.result;if(r==='WIN')audio.play('roundWin');else if(r==='DRAW')audio.play('roundDraw');applyMatch(resolved);return;
    }
    if(m.type==='ROUND_CONTINUE'){const updated={...s,opponentContinue:true};applyMatch(updated);advanceIfBoth(updated);return;}
    if(m.type==='PING'){send(msg('PONG',s.matchId,sessionId,s.set,s.round,{sentAt:m.payload.sentAt}));return;}
    if(m.type==='PONG')return;
  },[advanceIfBoth,send,sessionId,audio,applyMatch,helloPayload,profile.id,profile.name,recoveryCode]);

  useEffect(()=>{const t=transportRef.current;let previous:NetStatus='idle';t.onMessage=processMessage;t.onStatus=(st)=>{setNetStatus(st);if((st==='disconnected'||st==='error')&&previous==='connected')audio.play('connectionLost');if(st==='connected'){lastPeerActivity.current=Date.now();if(previous==='disconnected'||previous==='error'||previous==='connecting')audio.play('connectionRestored');}previous=st;const s=matchRef.current;if(st==='connected'&&s)send(msg('HELLO',s.matchId,sessionId,s.set,s.round,helloPayload()));};},[processMessage,send,sessionId,audio,helloPayload]);
  useEffect(()=>{if(screen!=='GAME'||netStatus!=='connected'||!match)return;lastPeerActivity.current=Date.now();const id=window.setInterval(()=>{sendPing();if(Date.now()-lastPeerActivity.current>10000){setNetStatus('disconnected');audio.play('connectionLost');}},3000);return()=>clearInterval(id)},[screen,netStatus,match?.matchId,sendPing,audio]);

  const updateName=(name:string)=>{if(!nameLocked)setProfile({...profile,name})};
  const confirmName=()=>{const name=profile.name.trim();if(!name){setNotice('이름 또는 별명을 입력하세요.');return;}const p={...profile,name};setProfile(p);saveProfile(p);setNameLocked(true);setNotice(`${name} 플레이어로 확정되었습니다.`)};
  const createGame=(gameType:GameType,difficulty:Difficulty)=>{
    if(!profile.name.trim()){setNotice('먼저 이름을 입력하세요.');return;}
    const id=newMatchId(),tileSet=generateTileSet(gameType,difficulty);
    const s=freshMatch({matchId:id,role:'HOST',playerId:profile.id,playerName:profile.name,opponentId:'',opponentName:'',gameType,difficulty,tileSet});
    applyMatch(s);setCreateOpen(false);setScreen('CREATE');transportRef.current.host(id);
  };
  const joinGame=useCallback((code=joinCode)=>{
    const raw=code.replace(/^BWJOIN:/,'').replace(/^BWREC:/,'').split(':')[0],clean=raw.replace(/\D/g,'').slice(0,4);
    if(!profile.name.trim()){setNotice('먼저 이름을 입력하세요.');return;}if(!/^\d{4}$/.test(clean)){setNotice('게임 코드는 4자리 숫자입니다.');return;}
    const s=freshMatch({matchId:clean,role:'JOIN',playerId:profile.id,playerName:profile.name,opponentId:'',opponentName:'',gameType:'BASIC',difficulty:'EASY'});
    applyMatch(s);setScreen('JOIN');transportRef.current.join(clean);setNotice('게임방 정보를 불러오는 중입니다.');
  },[joinCode,profile.id,profile.name,applyMatch]);
  const handleScannedCode=useCallback((c:string)=>{setScanner(false);setJoinCode(c);joinGame(c)},[joinGame]);
  const ready=()=>{if(!match)return;const updated={...match,myReady:true,phase:'READY' as const};applyMatch(updated);send(msg('READY',updated.matchId,sessionId,updated.set,updated.round,{ready:true}));if(updated.role==='HOST'&&updated.opponentReady){const first=Math.random()<.5?updated.playerId:updated.opponentId;send(msg('MATCH_START',updated.matchId,sessionId,1,1,{firstPlayerId:first}));audio.play('gameStart');applyMatch(startSet(updated,first,1));}};

  const submitTile=async()=>{
    const s=matchRef.current;if(!s||selected===undefined)return;audio.play('buttonClick');if(!s.myRemainingTiles.includes(selected)){setSelected(undefined);return;}
    const spec=getSpec(s.tileSet,selected);
    if(s.firstPlayerId===s.playerId&&s.phase==='FIRST_SELECTING'){
      const n=nonce(),h=await commitHash(selected,n,s.matchId,s.set,s.round);const updated=useTile({...s,pendingNonce:n,pendingCommitHash:h},selected);applyMatch({...updated,phase:'FIRST_LOCKED'});send(msg('FIRST_COMMIT',s.matchId,sessionId,s.set,s.round,{color:spec.color,commitHash:h}));setSelected(undefined);return;
    }
    if(s.firstPlayerId!==s.playerId&&s.phase==='SECOND_SELECTING'){
      const updated=useTile(s,selected);applyMatch({...updated,phase:'SECOND_LOCKED'});send(msg('SECOND_SUBMIT',s.matchId,sessionId,s.set,s.round,{tile:selected}));setSelected(undefined);
    }
  };
  const continueRound=()=>{const s=matchRef.current;if(!s||s.phase!=='ROUND_RESULT')return;const updated={...s,myContinue:true};applyMatch(updated);send(msg('ROUND_CONTINUE',s.matchId,sessionId,s.set,s.round,{}));advanceIfBoth(updated);};
  const leaveToHome=()=>{transportRef.current.close();clearCurrent();applyMatch(null);setSelected(undefined);setRecoveryCode('');setScreen('HOME');setNetStatus('idle');};
  const rematch=leaveToHome;
  const reorder=(over:Tile)=>{const s=matchRef.current;if(!s||s.gameType==='BASIC'||dragTile===undefined||dragTile===over)return;const arr=[...s.tileOrder],from=arr.indexOf(dragTile),to=arr.indexOf(over);if(from<0||to<0)return;arr.splice(from,1);arr.splice(to,0,dragTile);dragMoved.current=true;applyMatch({...s,tileOrder:arr});};
  const reorderAtPoint=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest?.('[data-tile-id]') as HTMLElement|null;if(!el)return;const n=Number(el.dataset.tileId);if(Number.isInteger(n)&&n>=0&&n<=8)reorder(n as Tile);};
  const startRecovery=()=>{const current=matchRef.current;if(!current)return;const code=newMatchId();const checkpoint=recoveryCheckpoint(current);applyMatch(checkpoint);setRecoveryCode(code);processed.current.clear();transportRef.current.host(code);setNetStatus('connecting');};
  const showOpponentRecord=()=>{const s=matchRef.current;if(!s)return;setDetailNotice({title:'상대 전적',lines:[s.opponentRecord?`${s.opponentRecord.games}경기 · ${s.opponentRecord.wins}승 ${s.opponentRecord.draws}무 ${s.opponentRecord.losses}패`:'상대 전적을 확인할 수 없습니다.',s.opponentRecord?`승점 ${s.opponentRecord.points}`:'']})};
  const showRoundHistory=()=>{const s=matchRef.current;if(!s)return;const w=s.history.filter(h=>h.result==='WIN').length,d=s.history.filter(h=>h.result==='DRAW').length,l=s.history.filter(h=>h.result==='LOSE').length;setDetailNotice({title:`라운드 기록 · ${w}승 ${d}무 ${l}패`,lines:s.history.length?s.history.map(h=>`${h.round}라운드 · ${resultKo(h.result)}(${colorKo(h.opponentColor)}) · 내 타일 ${getSpec(s.tileSet,h.myTile).display}`):['아직 라운드 기록이 없습니다.']})};

  const phaseMessage=()=>{if(!match)return'';if(match.phase==='READY'||match.phase==='CONNECTED')return'두 플레이어가 READY를 눌러주세요.';if(match.phase==='ROUND_START')return'상대가 먼저 타일을 냅니다.';if(match.phase==='FIRST_SELECTING')return'당신이 먼저 냅니다. 타일을 선택하세요.';if(match.phase==='FIRST_LOCKED')return'제출 완료. 상대방의 선택을 기다리고 있습니다.';if(match.phase==='SECOND_SELECTING')return`상대가 ${match.revealedOpponentColor==='BLACK'?'검정':'흰색'} 타일을 냈습니다. 타일을 선택하세요.`;if(match.phase==='SECOND_LOCKED')return'제출 완료. 상대의 타일을 검증하고 있습니다.';return'';};
  const last=match?.history.at(-1);

  if(screen==='LANDING')return <main className="shell home landing-home scene-main"><header className="brand image-brand"><img src="/assets/images/logo/logo_main.png" alt="백과 흑 - 더 지니어스 한 학급 놀이"/><div className="brand-rule"><span/>심리 추리 숫자 대결<span/></div></header><div className="curriculum-copy"><b>초등 3,4학년 수의 크기 비교</b><span>초등 5,6학년 규칙 찾기, 추론, 문제해결 게임</span></div><div className="landing-actions"><button className="primary teacher-start" onClick={()=>{location.hash='teacher';setScreen('TEACHER')}}><small>수업 운영 · 타이머 · 결과 집계</small>교사 게임 시작</button><button className="light student-start" onClick={()=>{location.hash='student';setScreen('HOME')}}><small>2인 연결 · 대결 · 개인 전적</small>학생 게임 시작</button><button className="manual-start" onClick={()=>setScreen('GUIDE')}><small>교사/학생 사용 방법</small>게임 설명서</button></div></main>;
  if(screen==='GUIDE')return <GameGuide onBack={()=>setScreen('LANDING')}/>;
  if(screen==='TEACHER')return <TeacherPortal onBack={()=>{location.hash='';setScreen('LANDING')}}/>;

  if(screen==='HOME')return <main className="shell home scene-main student-home"><header className="brand image-brand"><img src="/assets/images/logo/logo_main.png" alt="백과 흑"/><div className="brand-rule"><span/>STUDENT GAME<span/></div></header><section className="record-card glass"><div className="today-record"><small>오늘의 전적</small><strong>총 {record.games}경기 · {record.wins}승 · {record.draws}무 · {record.losses}패</strong></div><div className="points"><small>승점</small><strong>{record.points}</strong></div></section><section className={`name-box glass compact ${nameLocked?'locked':''}`}><label>PLAYER NAME</label><div className="name-confirm-row"><input value={profile.name} disabled={nameLocked} maxLength={12} placeholder="이름 또는 별명" onChange={e=>updateName(e.target.value)}/>{!nameLocked?<button className="name-confirm" onClick={()=>{audio.play('buttonClick');confirmName()}}>확인</button>:<span className="fixed-badge">✓ 플레이어 확정</span>}<button className="account-reset-btn" onClick={()=>{audio.play('buttonClick');setResetAccountOpen(true)}}>계정 초기화</button></div></section><div className="student-action-grid"><button className="primary" disabled={!nameLocked} onClick={()=>{audio.play('buttonClick');setCreateOpen(true)}}>게임 만들기</button><button className="light" disabled={!nameLocked} onClick={()=>{audio.play('buttonClick');setScreen('JOIN')}}>게임 참가</button><button className="record-main-btn" onClick={()=>setScreen('RECORD')}>▤ 내 경기 기록 <b>{record.games}</b></button><button className="submit-record-btn" disabled={!nameLocked} onClick={()=>setSubmitOpen(true)}>↑ 전적 제출</button></div>{!nameLocked&&<p className="name-help">게임을 시작하려면 이름을 입력하고 <b>확인</b>을 눌러 플레이어를 확정하세요.</p>}{createOpen&&<div className="modal-back"><div className="modal create-settings-modal"><span className="eyebrow">CREATE MATCH</span><h2>게임 설정</h2><p>두 친구가 유형과 난이도를 의논한 뒤 방장이 설정합니다.</p><h3>1. 게임 유형</h3><div className="option-grid game-type-grid">{GAME_TYPES.map(t=><button key={t} className={createType===t?'active':''} onClick={()=>setCreateType(t)}>{gameTypeLabel(t)}{t==='MIXED'&&<small>고학년 추천</small>}</button>)}</div>{createType!=='BASIC'&&<><h3>2. 난이도</h3><div className="option-grid difficulty-grid">{DIFFICULTIES.map(d=><button key={d} className={createDifficulty===d?'active':''} onClick={()=>setCreateDifficulty(d)}>{difficultyLabel(d)}</button>)}</div></>}<div className="setting-summary"><b>{gameTypeLabel(createType)}</b>{createType!=='BASIC'&&<><span>·</span><b>{difficultyLabel(createDifficulty)}</b></>}<small>{createType==='BASIC'?'0~8 타일을 순서대로 사용합니다. 백은 0·2·4·6·8, 흑은 1·3·5·7입니다. 기본 숫자는 난이도 설정이 없습니다.':'매 경기 새로운 9개 값이 생성되며, 작은 값부터 정렬하면 백-흑-백-흑 순으로 색이 배정됩니다.'}</small>{createType!=='BASIC'&&<strong className="random-order-warning">⚠ 타일은 작은 숫자에서 큰 숫자로 자동 정렬되지 않습니다. 랜덤 배정됩니다.</strong>}</div><div className="modal-actions"><button className="secondary" onClick={()=>setCreateOpen(false)}>취소</button><button className="primary" onClick={()=>createGame(createType,createType==='BASIC'?'EASY':createDifficulty)}>게임방 만들기</button></div></div></div>}{resetAccountOpen&&<div className="modal-back"><div className="modal account-reset-modal"><span className="eyebrow">RESET ACCOUNT</span><h2>계정을 초기화할까요?</h2><p>플레이어 이름과 오늘의 전적, 경기 기록, 승점이 모두 삭제됩니다.</p><p className="reset-warning">초기화한 기록은 복구할 수 없습니다.</p><div className="modal-actions"><button className="secondary" onClick={()=>setResetAccountOpen(false)}>취소</button><button className="danger" onClick={()=>{audio.play('buttonClick');const x=resetAccount();setProfile(x.profile);setRecord(x.record);setNameLocked(false);setResetAccountOpen(false);setNotice('계정이 초기화되었습니다. 새 플레이어 이름을 입력하세요.')}}>초기화</button></div></div></div>}{submitOpen&&<RecordSubmitModal profile={profile} record={record} onClose={()=>setSubmitOpen(false)} onDone={setNotice}/>} {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}</div>}</main>;

  if(screen==='JOIN')return <main className="shell center scene-lobby"><button className="back" onClick={()=>{transportRef.current.close();applyMatch(null);setScreen('HOME')}}>← 돌아가기</button><div className="panel join"><div className="eyebrow">JOIN MATCH</div><h2>게임 참가</h2><button className="scan" onClick={()=>setScanner(true)}>▣ QR 코드 스캔</button><div className="or"><span/>또는<span/></div><label>게임 코드</label><input className="code-input" inputMode="numeric" maxLength={4} value={joinCode} onChange={e=>setJoinCode(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="0000"/><button className="primary" disabled={netStatus==='connecting'} onClick={()=>joinGame()}>{netStatus==='connecting'?'방 정보 확인 중...':'입장'}</button></div>{scanner&&<QRScanner onCode={handleScannedCode} onClose={()=>setScanner(false)}/>} {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}</div>}</main>;

  if(screen==='PREVIEW'&&match)return <main className="shell center scene-lobby"><button className="back" onClick={leaveToHome}>← 참가 취소</button><div className="panel room-preview"><div className="eyebrow">ROOM FOUND</div><h2>게임방을 찾았습니다</h2><div className="preview-host">방장 <b>{match.opponentName||'확인 중'}</b><small className="opponent-record-preview">{recordLine(match.opponentRecord)}</small></div><div className="room-config-card"><span>게임 유형<strong>{gameTypeLabel(match.gameType)}</strong></span><span>난이도<strong>{match.gameType==='BASIC'?'없음':difficultyLabel(match.difficulty)}</strong></span></div>{match.gameType==='BASIC'&&<div className="basic-rule-note">백 0·2·4·6·8 / 흑 1·3·5·7</div>}{match.gameType==='MIXED'&&<div className="grade-badge">고학년 추천 모드</div>}<p>참가하면 방장과 동일한 9개의 타일을 사용합니다.</p><button className="primary" onClick={()=>setScreen('GAME')}>이 게임에 참가하기</button></div></main>;

  if(screen==='CREATE'&&match)return <main className="shell center scene-lobby"><button className="back" onClick={leaveToHome}>← 취소</button><div className="panel create"><div className="eyebrow">CREATE MATCH</div><h2>상대방에게 보여주세요</h2><div className="room-config-inline"><b>{gameTypeLabel(match.gameType)}</b>{match.gameType!=='BASIC'&&<><span>·</span><b>{difficultyLabel(match.difficulty)}</b></>}</div>{match.gameType==='BASIC'&&<div className="basic-rule-note">백 0·2·4·6·8 / 흑 1·3·5·7</div>}<div className="qr"><QRCodeSVG value={`BWJOIN:${match.matchId}`} size={220} level="M"/></div><div className="match-code">{match.matchId}</div><div className={`connection ${netStatus}`}><span/> {netStatus==='connected'?'상대 연결됨':'상대방을 기다리는 중...'}</div>{netStatus==='connected'&&<button className="primary" onClick={()=>setScreen('GAME')}>READY 화면으로</button>}</div></main>;

  if(screen==='RECORD')return <main className="shell records scene-main"><button className="back" onClick={()=>setScreen('HOME')}>← 돌아가기</button><div className="panel"><div className="eyebrow">MY RECORD</div><h2>내 경기 기록</h2><div className="record-summary"><strong>{record.games}경기</strong><span>{record.wins}승 · {record.draws}무 · {record.losses}패 · 승점 {record.points}</span></div><div className="history-list">{record.matches.length===0?<p className="muted">아직 경기 기록이 없습니다.</p>:record.matches.map((m,i)=><div className="history-item" key={m.matchId}><b>{record.matches.length-i}경기</b><span>{m.opponentName}<small>{gameTypeLabel(m.gameType??'BASIC')} · {m.gameType==='BASIC'?'난이도 없음':difficultyLabel(m.difficulty??'EASY')}</small></span><strong className={m.result.toLowerCase()}>{resultKo(m.result)}</strong></div>)}</div></div></main>;

  if(screen==='GAME'&&match){
    const canSelect=match.phase==='FIRST_SELECTING'||match.phase==='SECOND_SELECTING',myTurnFirst=match.firstPlayerId===match.playerId,offline=netStatus==='disconnected'||netStatus==='error'||Boolean(recoveryCode);
    const mySpec=match.pendingMyTile!==undefined?getSpec(match.tileSet,match.pendingMyTile):undefined;
    const finalResult:Result=match.myScore>match.opponentScore?'WIN':match.myScore<match.opponentScore?'LOSE':'DRAW';
    return <main className={`game-shell scene-game ${match.phase==='GAME_RESULT'?'scene-result':''}`}><header className="game-top"><div><b>백과 흑</b><span>{modeText(match)} · {match.set===1?'본게임':`세트 ${match.set}`} · {match.round}라운드/9</span></div><div className="game-room-info"><b>방 코드 {recoveryCode||match.matchId}</b><small>게임에서 튕기거나 잘못 종료되었을 경우 다시 코드를 입력하고 게임에 참여하세요.</small></div><div className="game-top-actions"><div className={`connection ${netStatus}`}><span/> {netStatus==='connected'?'연결됨':netStatus==='connecting'?'연결 중':'연결 복구 필요'}</div><button className="game-reset-btn" onClick={()=>{audio.play('buttonClick');setGameResetOpen(true)}}>게임 종료(게임 초기화)</button></div></header><section className="scoreboard"><div><small>나</small><strong>{match.playerName}</strong><b>{match.myScore}</b></div><i>:</i><div><small>상대</small><strong>{match.opponentName||'연결 중'}</strong><b>{match.opponentScore}</b></div></section>
    {!offline&&(match.phase==='CONNECTED'||match.phase==='READY')&&<section className="ready-panel"><div className="game-mode-pill">{modeText(match)}</div><h2>{match.opponentName?`${match.playerName} VS ${match.opponentName}`:'상대 정보를 확인하는 중...'}</h2>{match.opponentName&&<div className="ready-opponent-record">상대 전적 · {recordLine(match.opponentRecord)}</div>}<div className="ready-state"><span>나 <b>{match.myReady?'READY ●':'WAITING ○'}</b></span><span>상대 <b>{match.opponentReady?'READY ●':'WAITING ○'}</b></span></div><button className="primary" disabled={match.myReady||!match.opponentName} onClick={ready}>{match.myReady?'READY 완료':'READY'}</button></section>}
    {offline&&<section className="action-stage recovery-stage"><div className="big-message">연결이 끊어졌습니다.</div><p>완료된 라운드 정보는 이 기기에 보존되어 있습니다.</p>{!recoveryCode?<><button className="primary" onClick={startRecovery}>다시 연결</button><small>새 복구 방을 만든 뒤 상대가 새 코드로 참가하면 마지막 완료 라운드부터 이어집니다.</small></>:<div className="recovery-room"><b>복구용 새 게임방</b><div className="qr"><QRCodeSVG value={`BWREC:${recoveryCode}`} size={170} level="M"/></div><strong className="match-code">{recoveryCode}</strong><span>상대가 학생 페이지 → 게임 참가에서 이 코드를 입력하도록 안내하세요.</span><div className={`connection ${netStatus}`}><span/> 상대방의 복구 참가를 기다리는 중...</div></div>}</section>}
    {!offline&&!['CONNECTED','READY','DISCONNECTED','ROUND_RESULT','GAME_RESULT'].includes(match.phase)&&<><section className="action-stage"><div className="turn-chip">{myTurnFirst?'선 플레이어':'후 플레이어'}</div><div className="big-message">{phaseMessage()}</div>{match.revealedOpponentColor&&match.phase==='SECOND_SELECTING'&&<div className={`opponent-color ${match.revealedOpponentColor.toLowerCase()}`}>{match.revealedOpponentColor==='BLACK'?'검정':'흰색'}<small>{match.tileSet.filter(t=>t.color===match.revealedOpponentColor).map(t=>t.display).join(' · ')}</small></div>}{match.phase==='FIRST_LOCKED'&&mySpec&&<div className="locked-info">내가 제출한 타일 <b>{mySpec.display}</b> <span>{mySpec.color==='BLACK'?'검정':'흰색'}</span></div>}</section><section className="tiles"><div className="tiles-heading"><h3>내 타일</h3><small>{match.gameType==='BASIC'?'기본 숫자는 0~8 순서로 고정됩니다.':'타일을 드래그하여 나만의 순서로 정렬할 수 있습니다.'}</small></div><div className="tile-row sortable">{match.tileOrder.map(t=>{const spec=getSpec(match.tileSet,t);return <TileButton key={t} tile={t} spec={spec} canDrag={match.gameType!=='BASIC'} disabled={!canSelect||!match.myRemainingTiles.includes(t)} selected={selected===t} onClick={()=>{if(dragMoved.current){dragMoved.current=false;return;}audio.play('tileSelect');setSelected(t)}} onDragStart={(id)=>{dragMoved.current=false;setDragTile(id)}} onDragEnter={reorder} onDragMove={reorderAtPoint} onDragEnd={()=>setDragTile(undefined)}/>})}</div><div className="game-action-bar"><div className="game-action-left"><button onClick={showOpponentRecord}>상대 전적</button><button onClick={showRoundHistory}>라운드 기록</button></div><button className="submit" disabled={!canSelect||selected===undefined} onClick={()=>{audio.play('buttonClick');if(selected!==undefined)setConfirmTile(selected)}}>이 타일 제출</button><div className="game-action-right"><button className="deduction-action" onClick={()=>setDeductionOpen(true)}>추리판</button></div></div></section></>}
    {!offline&&match.phase==='ROUND_RESULT'&&last&&<section className="result-stage"><div className={`result-word ${last.result.toLowerCase()}`}>{resultText(last.result)}</div><div className="result-cards"><div><small>내 타일</small><b>{getSpec(match.tileSet,last.myTile).display}</b><span>{colorKo(last.myColor)}</span></div><div><small>상대 타일</small><b>?</b><span>{colorKo(last.opponentColor)}</span><em>값 비공개</em></div></div><div className="result-score">현재 점수 <b>{match.myScore} : {match.opponentScore}</b></div><button className="primary" disabled={match.myContinue} onClick={continueRound}>{match.myContinue?'상대 확인을 기다리는 중':match.round===9?'게임 종료':'다음 라운드'}</button></section>}
    {match.phase==='GAME_RESULT'&&<section className="gameover"><div className="eyebrow">GAME OVER</div><div className="game-mode-pill">{modeText(match)}</div><h2>{finalResult==='WIN'?'승리!':finalResult==='DRAW'?'무승부':'패배'}</h2><div className="final-score">{match.myScore} <i>:</i> {match.opponentScore}</div><div className="point-up">+{finalResult==='WIN'?3:finalResult==='DRAW'?2:1} 승점</div><div className="mini-record">오늘의 전적 <b>{record.wins}승 · {record.draws}무 · {record.losses}패</b> 승점 <strong>{record.points}</strong></div><button className="primary" onClick={rematch}>다른 상대와 경기하기</button></section>}
    {deductionOpen&&<DeductionBoard value={match.deduction} tileSet={match.tileSet} onChange={d=>applyMatch({...match,deduction:d})} onClose={()=>setDeductionOpen(false)}/>} 
    {gameResetOpen&&<div className="modal-back"><div className="modal game-confirm-modal"><span className="eyebrow">END GAME</span><h2>현재 게임을 종료할까요?</h2><p>현재 진행 중인 게임 상태가 초기화되고 학생 게임 시작 화면으로 돌아갑니다.</p><div className="modal-actions"><button className="secondary" onClick={()=>setGameResetOpen(false)}>계속 게임하기</button><button className="danger" onClick={()=>{audio.play('buttonClick');setGameResetOpen(false);leaveToHome()}}>게임 종료 및 초기화</button></div></div></div>}
    {confirmTile!==undefined&&<div className="modal-back"><div className="modal game-confirm-modal"><span className="eyebrow">TILE SUBMIT</span><h2>{getSpec(match.tileSet,confirmTile).display} 타일을 제출할까요?</h2><p>제출하면 이 라운드에서는 변경할 수 없습니다.</p><div className="modal-actions"><button className="secondary" onClick={()=>setConfirmTile(undefined)}>취소</button><button className="primary" onClick={()=>{setConfirmTile(undefined);void submitTile()}}>제출</button></div></div></div>}
    {detailNotice&&<div className="detail-toast" onClick={()=>setDetailNotice(null)}><b>{detailNotice.title}</b>{detailNotice.lines.map((line,i)=><span key={i}>{line}</span>)}</div>}
    {notice&&<div className="toast wide" onClick={()=>setNotice('')}>{notice}</div>}{debug&&<aside className="debug"><b>NETWORK DEBUG</b><span>Match {match.matchId}</span><span>Peer {netStatus}</span><span>Sent {transportRef.current.sent}</span><span>Received {transportRef.current.received}</span><span>Reconnect {transportRef.current.reconnects}</span><button onClick={sendPing}>연결 테스트</button></aside>}</main>;
  }
  return null;
}
