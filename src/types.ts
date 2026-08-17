export type Tile = 0|1|2|3|4|5|6|7|8;
export type TileColor = 'BLACK'|'WHITE';
export type Role = 'HOST'|'JOIN';
export type Result = 'WIN'|'LOSE'|'DRAW';
export type Phase = 'HOME'|'CONNECTING'|'CONNECTED'|'READY'|'ROUND_START'|'FIRST_SELECTING'|'FIRST_LOCKED'|'SECOND_SELECTING'|'SECOND_LOCKED'|'ROUND_RESULT'|'SET_RESULT'|'GAME_RESULT'|'DISCONNECTED';
export type Mark = 'NONE'|'X'|'?'|'★';

export interface RoundRecord { set:number; round:number; myTile:Tile; myColor:TileColor; opponentColor:TileColor; result:Result; }
export interface DeductionState { marks:Record<number,Mark>; memo:string; }
export interface MatchState {
  matchId:string; role:Role; playerId:string; playerName:string; opponentId:string; opponentName:string;
  set:number; round:number; myScore:number; opponentScore:number; firstPlayerId:string; phase:Phase;
  myRemainingTiles:Tile[]; myUsedTiles:Tile[]; opponentUsedColors:TileColor[]; history:RoundRecord[];
  deduction:DeductionState; pendingMyTile?:Tile; pendingOpponentTile?:Tile; pendingCommitHash?:string; pendingNonce?:string;
  revealedOpponentColor?:TileColor; myReady:boolean; opponentReady:boolean; myContinue:boolean; opponentContinue:boolean;
}
export interface MatchRecord { matchId:string; opponentName:string; result:'WIN'|'LOSE'; playedAt:string; }
export interface PlayerRecord { recordDate:string; wins:number; losses:number; games:number; points:number; matches:MatchRecord[]; processedMatchIds:string[]; }
export interface Profile { id:string; name:string; }
