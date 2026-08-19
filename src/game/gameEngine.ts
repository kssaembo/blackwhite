import type { Difficulty, GameType, MatchState, Result, Tile, TileSpec } from '../types';
import { ALL_TILES } from './rules';
import { compareSpec, generateTileSet, getSpec, randomTileOrder } from './tileGenerator';

export function freshMatch(input:Pick<MatchState,'matchId'|'role'|'playerId'|'playerName'|'opponentId'|'opponentName'> & {gameType?:GameType;difficulty?:Difficulty;tileSet?:TileSpec[]}):MatchState{
  const gameType=input.gameType??'BASIC',difficulty=input.difficulty??'EASY';
  const tileSet=input.tileSet??generateTileSet(gameType,difficulty);
  return {...input,gameType,difficulty,tileSet,tileOrder:randomTileOrder(),set:1,round:1,myScore:0,opponentScore:0,firstPlayerId:'',phase:'READY',myRemainingTiles:[...ALL_TILES],myUsedTiles:[],opponentUsedColors:[],history:[],deduction:{marks:Object.fromEntries(ALL_TILES.map(t=>[t,'NONE'])),memo:''},myReady:false,opponentReady:false,myContinue:false,opponentContinue:false};
}
export function startSet(s:MatchState, firstPlayerId:string, nextSet=s.set):MatchState{
  return {...s,set:nextSet,round:1,myScore:0,opponentScore:0,firstPlayerId,myRemainingTiles:[...ALL_TILES],myUsedTiles:[],pendingMyTile:undefined,pendingOpponentTile:undefined,pendingCommitHash:undefined,pendingNonce:undefined,revealedOpponentColor:undefined,myContinue:false,opponentContinue:false,deduction:{marks:Object.fromEntries(ALL_TILES.map(t=>[t,'NONE'])),memo:''},phase:firstPlayerId===s.playerId?'FIRST_SELECTING':'ROUND_START'};
}
export function useTile(s:MatchState,tile:Tile){if(!s.myRemainingTiles.includes(tile)) return s;return {...s,myRemainingTiles:s.myRemainingTiles.filter(t=>t!==tile),myUsedTiles:[...s.myUsedTiles,tile],pendingMyTile:tile};}
export function resolveRound(s:MatchState,myTile:Tile,opponentTile:Tile):MatchState{
  const cmp=compareSpec(s.tileSet,myTile,opponentTile); const result:Result=cmp===0?'DRAW':cmp>0?'WIN':'LOSE';
  const myScore=s.myScore+(result==='WIN'?1:0),opponentScore=s.opponentScore+(result==='LOSE'?1:0);
  const nextFirst=result==='WIN'?s.playerId:result==='LOSE'?s.opponentId:s.firstPlayerId;
  return {...s,myScore,opponentScore,firstPlayerId:nextFirst,phase:'ROUND_RESULT',opponentUsedColors:[...s.opponentUsedColors,getSpec(s.tileSet,opponentTile).color],history:[...s.history,{set:s.set,round:s.round,myTile,myColor:getSpec(s.tileSet,myTile).color,opponentColor:getSpec(s.tileSet,opponentTile).color,result}],myContinue:false,opponentContinue:false,pendingOpponentTile:opponentTile};
}
export function nextRound(s:MatchState):MatchState{if(s.round>=9)return {...s,phase:'SET_RESULT'};const round=s.round+1;return {...s,round,phase:s.firstPlayerId===s.playerId?'FIRST_SELECTING':'ROUND_START',pendingMyTile:undefined,pendingOpponentTile:undefined,pendingCommitHash:undefined,pendingNonce:undefined,revealedOpponentColor:undefined,myContinue:false,opponentContinue:false};}
