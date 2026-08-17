import type { MatchState, PlayerRecord, Profile } from '../types';
const PROFILE='bw_player_profile', RECORD='bw_player_record', CURRENT='bw_current_match';
const today=()=>new Date().toISOString().slice(0,10);
export function getProfile():Profile{const v=localStorage.getItem(PROFILE); if(v) return JSON.parse(v); const p={id:crypto.randomUUID(),name:''}; localStorage.setItem(PROFILE,JSON.stringify(p)); return p;}
export function saveProfile(p:Profile){localStorage.setItem(PROFILE,JSON.stringify(p));}
export function getRecord():PlayerRecord{const v=localStorage.getItem(RECORD); return v?JSON.parse(v):{recordDate:today(),wins:0,losses:0,games:0,points:0,matches:[],processedMatchIds:[]};}
export function saveResult(matchId:string,opponentName:string,result:'WIN'|'LOSE'){const r=getRecord(); if(r.processedMatchIds.includes(matchId)) return r; r.games++; if(result==='WIN'){r.wins++;r.points++;}else r.losses++; r.matches.unshift({matchId,opponentName,result,playedAt:new Date().toISOString()}); r.processedMatchIds.push(matchId); localStorage.setItem(RECORD,JSON.stringify(r)); return r;}
export function resetRecord(){const r:PlayerRecord={recordDate:today(),wins:0,losses:0,games:0,points:0,matches:[],processedMatchIds:[]}; localStorage.setItem(RECORD,JSON.stringify(r)); return r;}
export function saveCurrent(s:MatchState){localStorage.setItem(CURRENT,JSON.stringify(s));}
export function getCurrent():MatchState|null{const v=localStorage.getItem(CURRENT);return v?JSON.parse(v):null;}
export function clearCurrent(){localStorage.removeItem(CURRENT);}
