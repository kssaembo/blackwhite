import type { Difficulty, GameType, Tile, TileColor, TileSpec } from '../types';

const IDS:Tile[]=[0,1,2,3,4,5,6,7,8];
const gcd=(a:number,b:number):number=>b===0?Math.abs(a):gcd(b,a%b);
const norm=(n:number,d:number)=>{const g=gcd(n,d);return [n/g,d/g] as const};
const valueKey=(n:number,d:number)=>{const [a,b]=norm(n,d);return `${a}/${b}`};
const val=(n:number,d:number)=>n/d;
const shuffle=<T,>(arr:T[])=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a};
const pick=<T,>(arr:T[])=>arr[Math.floor(Math.random()*arr.length)];

export const gameTypeLabel=(t:GameType)=>({BASIC:'기본 숫자',FRACTION:'분수',DECIMAL:'소수',LENGTH:'단위',MIXED:'분수 + 소수'}[t]);
export const difficultyLabel=(d:Difficulty)=>({EASY:'쉬움',NORMAL:'보통',HARD:'어려움'}[d]);

interface Candidate {display:string;n:number;d:number}
function select(pool:Candidate[],count=9,minGap=0){
  const clean=shuffle(pool).filter((c,i,a)=>a.findIndex(x=>valueKey(x.n,x.d)===valueKey(c.n,c.d))===i);
  const out:Candidate[]=[];
  for(const c of clean){if(out.every(x=>Math.abs(val(x.n,x.d)-val(c.n,c.d))>=minGap-1e-9))out.push(c);if(out.length===count)break;}
  if(out.length<count) throw new Error('타일 후보 생성 조건을 만족하지 못했습니다.');
  return out;
}
function colors():TileColor[]{return ['WHITE','BLACK','WHITE','BLACK','WHITE','BLACK','WHITE','BLACK','WHITE'];}
function make(_gameType:GameType,candidates:Candidate[]):TileSpec[]{
  const ordered=[...candidates].sort((a,b)=>val(a.n,a.d)-val(b.n,b.d));
  const cs=colors();return ordered.map((c,i)=>({id:IDS[i],display:c.display,color:cs[i],valueNum:norm(c.n,c.d)[0],valueDen:norm(c.n,c.d)[1]}));
}

function basic(_d:Difficulty){
  // 기본 숫자 모드는 원형 게임 규칙을 위한 고정 0~8 세트이며 난이도를 사용하지 않는다.
  return [0,1,2,3,4,5,6,7,8].map(n=>({display:String(n),n,d:1}));
}
function fraction(d:Difficulty):Candidate[]{
  if(d==='EASY'){
    const den=pick([10,11,12]);return Array.from({length:9},(_,i)=>({display:`${i+1}/${den}`,n:i+1,d:den}));
  }
  const pool:Candidate[]=[];
  if(d==='NORMAL'){
    for(const den of [4,5,6,8,10,12])for(let n=1;n<den;n++)pool.push({display:`${n}/${den}`,n,d:den});
    return select(pool,9,1/24);
  }
  for(let den=3;den<=12;den++)for(let n=1;n<den;n++){if(n<=9)pool.push({display:`${n}/${den}`,n,d:den});}
  return select(pool,9,1/30);
}
function decimal(d:Difficulty):Candidate[]{
  if(d==='EASY'){
    const whole=pick([0,1]);return Array.from({length:9},(_,i)=>{const n=whole*10+i+1;return{display:(n/10).toFixed(1),n,d:10}});
  }
  const pool:Candidate[]=[];
  if(d==='NORMAL'){
    for(let n=15;n<=145;n+=5){const display=n%10===0?(n/100).toFixed(1):(n/100).toFixed(2);pool.push({display,n,d:100});}
    return select(pool,9,0.05);
  }
  for(let n=20;n<=180;n+=5){const display=n%10===0?(n/100).toFixed(1):(n/100).toFixed(2);pool.push({display,n,d:100});}
  return select(pool,9,0.04);
}
function length(d:Difficulty):Candidate[]{
  if(d==='EASY'){
    const unit=pick(['cm','mm'] as const);const step=unit==='cm'?pick([3,4,5]):pick([5,10]);const start=pick([1,2,3]);return Array.from({length:9},(_,i)=>{const q=(start+i)*step;return{display:`${q}${unit}`,n:unit==='cm'?q*10:q,d:1}});
  }
  if(d==='NORMAL'){
    const mm=[15,20,35,40,55,60,75,80,95,120,150];
    return select(shuffle(mm).map((v,i)=>({display:(i%2===0&&v%10===0)?`${v/10}cm`:`${v}mm`,n:v,d:1})),9,5);
  }
  const values=[80,120,200,350,480,600,750,900,1000,1200,1500,1800];
  const pool=values.map((v,i)=>{let display=`${v}mm`;if(i%3===1&&v%10===0)display=`${v/10}cm`;if(i%3===2&&v%1000===0)display=`${v/1000}m`;else if(i%3===2&&v%10===0)display=`${v/10}cm`;return{display,n:v,d:1}});
  return select(pool,9,30);
}
function mixed(d:Difficulty):Candidate[]{
  const pool:Candidate[]=[];
  if(d==='EASY'){
    const candidates:number[]=[];for(let n=2;n<=18;n++)candidates.push(n);
    const chosen=shuffle(candidates).slice(0,9).sort((a,b)=>a-b);
    return chosen.map((n,i)=>i%2===0?{display:`${n}/20`,n,d:20}:{display:(n/20).toFixed(n%2===0?1:2),n,d:20});
  }
  if(d==='NORMAL'){
    const fracs=[[1,4],[2,5],[1,2],[3,5],[3,4],[4,5],[9,10],[1,5],[7,10]];
    fracs.forEach(([n,den],i)=>pool.push(i%2===0?{display:`${n}/${den}`,n,d:den}:{display:(n/den).toFixed(2).replace(/0$/,''),n,d:den}));
    for(let n=25;n<=90;n+=5)pool.push({display:(n/100).toFixed(n%10===0?1:2),n,d:100});
    return select(pool,9,0.05);
  }
  const fracs=[[1,5],[1,4],[1,3],[3,8],[2,5],[1,2],[5,8],[2,3],[3,4],[4,5],[7,8],[9,10]];
  fracs.forEach(([n,den])=>pool.push({display:`${n}/${den}`,n,d:den}));
  for(let n=20;n<=90;n+=5)pool.push({display:(n/100).toFixed(n%10===0?1:2),n,d:100});
  return select(pool,9,0.045);
}

export function generateTileSet(gameType:GameType,difficulty:Difficulty):TileSpec[]{
  let candidates:Candidate[];
  if(gameType==='BASIC')candidates=basic(difficulty);
  else if(gameType==='FRACTION')candidates=fraction(difficulty);
  else if(gameType==='DECIMAL')candidates=decimal(difficulty);
  else if(gameType==='LENGTH')candidates=length(difficulty);
  else candidates=mixed(difficulty);
  // 최종 동치값 검증. 조건 위반 시 다시 생성한다.
  const keys=candidates.map(c=>valueKey(c.n,c.d));
  if(new Set(keys).size!==9)return generateTileSet(gameType,difficulty);
  return make(gameType,candidates);
}
export function randomTileOrder():Tile[]{return shuffle(IDS)}
export function getSpec(tileSet:TileSpec[],id:Tile){const s=tileSet.find(t=>t.id===id);if(!s)throw new Error(`Unknown tile ${id}`);return s}
export function compareSpec(tileSet:TileSpec[],a:Tile,b:Tile){const x=getSpec(tileSet,a),y=getSpec(tileSet,b);const left=x.valueNum*y.valueDen,right=y.valueNum*x.valueDen;return left===right?0:left>right?1:-1}
