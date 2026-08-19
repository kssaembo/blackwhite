import Peer, { DataConnection } from 'peerjs';
import type { GameMessage } from './messageProtocol';
export type NetStatus='idle'|'connecting'|'connected'|'disconnected'|'error';
export class PeerTransport{
  private peer?:Peer; private conn?:DataConnection; private hostPeerId=''; private role:'HOST'|'JOIN'='HOST';
  onMessage:(m:GameMessage)=>void=()=>{}; onStatus:(s:NetStatus)=>void=()=>{}; sent=0; received=0; reconnects=0;
  private attach(c:DataConnection){this.conn=c;c.on('open',()=>this.onStatus('connected'));c.on('data',(d)=>{this.received++;this.onMessage(d as GameMessage)});c.on('close',()=>this.onStatus('disconnected'));c.on('error',()=>this.onStatus('error'));}
  host(matchId:string){this.close();this.role='HOST';this.hostPeerId=`bw-game-${matchId}`;this.onStatus('connecting');this.peer=new Peer(this.hostPeerId);this.peer.on('connection',c=>this.attach(c));this.peer.on('error',()=>this.onStatus('error'));}
  join(matchId:string){this.close();this.role='JOIN';this.hostPeerId=`bw-game-${matchId}`;this.onStatus('connecting');this.peer=new Peer();this.peer.on('open',()=>this.attach(this.peer!.connect(this.hostPeerId,{reliable:true,serialization:'json'})));this.peer.on('error',()=>this.onStatus('error'));}
  send(m:GameMessage){if(this.conn?.open){this.conn.send(m);this.sent++;return true;}return false;}
  reconnect(){this.reconnects++; if(this.role==='JOIN'&&this.peer?.open)this.attach(this.peer.connect(this.hostPeerId,{reliable:true,serialization:'json'})); else this.onStatus('connecting');}
  close(){try{this.conn?.close();this.peer?.destroy();}catch{} this.conn=undefined;this.peer=undefined;}
  isOpen(){return !!this.conn?.open;}
}
