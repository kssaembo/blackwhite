import type { Difficulty, GameType, MatchState, PlayerRecord, Profile, Result } from '../types';
const PROFILE='bw_player_profile', RECORD='bw_player_record', CURRENT='bw_current_match';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const emptyRecord=():PlayerRecord=>({recordDate:today(),wins:0,draws:0,losses:0,games:0,points:0,matches:[],processedMatchIds:[]});
export function getProfile():Profile{const v=localStorage.getItem(PROFILE); if(v) return JSON.parse(v); const p={id:crypto.randomUUID(),name:''}; localStorage.setItem(PROFILE,JSON.stringify(p)); return p;}
export function saveProfile(p:Profile){localStorage.setItem(PROFILE,JSON.stringify(p));}
export function getRecord():PlayerRecord{
  const v=localStorage.getItem(RECORD);
  if(v){try{const raw=JSON.parse(v) as Partial<PlayerRecord>;if(raw.recordDate===today()){
    const r:PlayerRecord={recordDate:raw.recordDate,wins:Number(raw.wins||0),draws:Number(raw.draws||0),losses:Number(raw.losses||0),games:Number(raw.games||0),points:Number(raw.points||0),matches:Array.isArray(raw.matches)?raw.matches as PlayerRecord['matches']:[],processedMatchIds:Array.isArray(raw.processedMatchIds)?raw.processedMatchIds:[]};
    if(raw.draws===undefined){r.draws=r.matches.filter(m=>m.result==='DRAW').length;}
    return r;
  }}catch{}}
  const r=emptyRecord();localStorage.setItem(RECORD,JSON.stringify(r));return r;
}
export function saveResult(matchId:string,opponentName:string,result:Result,gameType:GameType,difficulty:Difficulty){
  const r=getRecord(); if(r.processedMatchIds.includes(matchId)) return r;
  r.games++;
  if(result==='WIN'){r.wins++;r.points+=3;}
  else if(result==='DRAW'){r.draws++;r.points+=2;}
  else {r.losses++;r.points+=1;}
  r.matches.unshift({matchId,opponentName,result,playedAt:new Date().toISOString(),gameType,difficulty});
  r.processedMatchIds.push(matchId); localStorage.setItem(RECORD,JSON.stringify(r)); return r;
}
export function resetRecord(){const r=emptyRecord();localStorage.setItem(RECORD,JSON.stringify(r));return r;}
export function saveCurrent(s:MatchState){localStorage.setItem(CURRENT,JSON.stringify(s));}
export function getCurrent():MatchState|null{const v=localStorage.getItem(CURRENT);return v?JSON.parse(v):null;}
export function clearCurrent(){localStorage.removeItem(CURRENT);}
export function resetAccount(){localStorage.removeItem(PROFILE);localStorage.removeItem(RECORD);localStorage.removeItem(CURRENT);const p={id:crypto.randomUUID(),name:''};localStorage.setItem(PROFILE,JSON.stringify(p));const r=emptyRecord();localStorage.setItem(RECORD,JSON.stringify(r));return {profile:p,record:r};}
