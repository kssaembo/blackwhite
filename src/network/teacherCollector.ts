import Peer, { DataConnection } from 'peerjs';
import type { PlayerRecord, Profile } from '../types';

export interface SubmittedRecord {
  submissionId: string;
  profileId: string;
  playerName: string;
  submittedAt: string;
  record: PlayerRecord;
}

export type CollectorStatus = 'idle'|'connecting'|'open'|'error'|'closed';

export class TeacherCollector {
  private peer?: Peer;
  private conns = new Set<DataConnection>();
  onStatus: (s: CollectorStatus)=>void = ()=>{};
  onSubmission: (s: SubmittedRecord)=>void = ()=>{};

  start(code: string){
    this.close();
    this.onStatus('connecting');
    this.peer = new Peer(`bw-teacher-${code}`);
    this.peer.on('open',()=>this.onStatus('open'));
    this.peer.on('connection',(conn)=>{
      this.conns.add(conn);
      conn.on('data',(raw)=>{
        const data = raw as {type?:string; payload?:SubmittedRecord};
        if(data?.type==='RECORD_SUBMIT' && data.payload){
          this.onSubmission(data.payload);
          conn.send({type:'RECORD_ACK', submissionId:data.payload.submissionId});
        }
      });
      conn.on('close',()=>this.conns.delete(conn));
      conn.on('error',()=>this.conns.delete(conn));
    });
    this.peer.on('error',()=>this.onStatus('error'));
    this.peer.on('close',()=>this.onStatus('closed'));
  }

  close(){
    for(const c of this.conns){ try{c.close()}catch{} }
    this.conns.clear();
    try{this.peer?.destroy()}catch{}
    this.peer=undefined;
  }
}

export async function submitRecordToTeacher(code:string, profile:Profile, record:PlayerRecord):Promise<void>{
  const clean=code.replace(/\D/g,'');
  if(!/^\d{4}$/.test(clean)) throw new Error('교사 코드는 4자리 숫자입니다.');
  return new Promise((resolve,reject)=>{
    const peer=new Peer();
    const timeout=window.setTimeout(()=>{try{peer.destroy()}catch{};reject(new Error('교사 페이지에 연결할 수 없습니다. 교사 코드와 집계 대기 상태를 확인하세요.'));},8000);
    peer.on('open',()=>{
      const conn=peer.connect(`bw-teacher-${clean}`,{reliable:true,serialization:'json'});
      conn.on('open',()=>{
        const submissionId=crypto.randomUUID();
        conn.send({type:'RECORD_SUBMIT',payload:{submissionId,profileId:profile.id,playerName:profile.name,submittedAt:new Date().toISOString(),record} satisfies SubmittedRecord});
        conn.on('data',(raw)=>{
          const data=raw as {type?:string;submissionId?:string};
          if(data?.type==='RECORD_ACK'&&data.submissionId===submissionId){
            clearTimeout(timeout); try{conn.close();peer.destroy()}catch{}; resolve();
          }
        });
      });
      conn.on('error',()=>{clearTimeout(timeout);try{peer.destroy()}catch{};reject(new Error('전적 전송 중 연결 오류가 발생했습니다.'));});
    });
    peer.on('error',()=>{clearTimeout(timeout);try{peer.destroy()}catch{};reject(new Error('교사 페이지를 찾지 못했습니다.'));});
  });
}
