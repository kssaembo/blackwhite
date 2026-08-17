import type { Tile, TileColor } from '../types';
export type GameMessage =
 | Base<'HELLO',{playerId:string;playerName:string}>
 | Base<'READY',{ready:boolean}>
 | Base<'MATCH_START',{firstPlayerId:string}>
 | Base<'FIRST_COMMIT',{color:TileColor;commitHash:string}>
 | Base<'SECOND_SUBMIT',{tile:Tile}>
 | Base<'FIRST_REVEAL',{tile:Tile;nonce:string}>
 | Base<'ROUND_CONTINUE',{}>
 | Base<'PING',{sentAt:number}>
 | Base<'PONG',{sentAt:number}>;
type Base<T,P>={type:T;matchId:string;sessionId:string;messageId:string;set:number;round:number;timestamp:number;payload:P};
export function msg<T extends GameMessage['type']>(type:T,matchId:string,sessionId:string,set:number,round:number,payload:Extract<GameMessage,{type:T}>['payload']):Extract<GameMessage,{type:T}>{return {type,matchId,sessionId,messageId:crypto.randomUUID(),set,round,timestamp:Date.now(),payload} as Extract<GameMessage,{type:T}>;}
