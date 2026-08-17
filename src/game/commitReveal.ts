import type { Tile } from '../types';
const toHex = (buf:ArrayBuffer) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
export const nonce = () => crypto.getRandomValues(new Uint32Array(4)).join('-');
export async function commitHash(tile:Tile, nonceValue:string, matchId:string, set:number, round:number){
  const payload = `${tile}|${nonceValue}|${matchId}|${set}|${round}`;
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
}
export async function verifyCommit(tile:Tile, nonceValue:string, matchId:string,set:number,round:number,hash:string){
  return (await commitHash(tile,nonceValue,matchId,set,round))===hash;
}
