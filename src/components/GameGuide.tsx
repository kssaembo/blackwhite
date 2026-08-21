import { useState } from 'react';

const slides=[
  {kind:'learn',title:'수의 크기를 비교하며 추리해요',body:'「백과 흑」에서는 타일의 값을 비교해 더 큰 값을 판단하고, 그 결과를 이용해 상대가 가진 타일을 추리합니다. 기본 숫자뿐 아니라 분수, 소수, 길이 단위처럼 표현이 다른 값도 비교합니다.'},
  {kind:'rules',title:'백과 흑 게임 규칙',body:'두 플레이어는 서로 같은 9개의 타일을 받습니다. 선 플레이어가 먼저 타일을 제출하면 상대에게는 값이 아니라 백/흑 색만 공개됩니다. 후 플레이어가 타일을 제출한 뒤 더 큰 값을 낸 사람이 그 라운드에서 승리합니다. 상대가 낸 실제 값은 끝까지 공개되지 않습니다. 9라운드 후 승수가 더 높은 사람이 승리하고, 승수가 같으면 최종 결과는 무승부입니다.'},
  {kind:'class',title:'학급에서는 이렇게 운영해요',body:'교사는 교사 게임 운영 페이지를 열고 학생 접속 QR·링크, 타이머, 교사 코드를 안내합니다. 학생 두 명이 게임 유형과 난이도를 의논한 뒤 한 명이 방을 만들고 다른 학생이 QR 또는 6자리 코드로 참가합니다. 한 경기가 끝나면 다른 친구와 계속 경기하고, 수업 종료 후 교사 코드로 전적을 제출합니다.'},
  {kind:'video',title:'게임을 더 알아보고 싶다면?',body:'YouTube에서 「더 지니어스 흑과 백」 또는 「지니어스 게임 흑과 백」을 검색해 보세요. 방송 속 추리 전략을 살펴보고 오늘 게임에서는 어떤 수학적 비교 전략을 사용할지 생각해 봅시다.'},
] as const;

function Graphic({kind}:{kind:(typeof slides)[number]['kind']}){
  if(kind==='learn')return <div className="guide-graphic learn-grid"><span>기본 숫자<b>0 · 1 · 2 · …</b></span><span>분수<b>1/3 · 1/2</b></span><span>소수<b>0.4 · 0.75</b></span><span>길이<b>35mm · 4cm</b></span><span>분수+소수<b>1/2 · 0.6</b></span></div>;
  if(kind==='rules')return <div className="guide-graphic rule-flow"><span>① 같은 9개 타일</span><i>→</i><span>② 선 플레이어 제출</span><i>→</i><span>③ 색만 공개</span><i>→</i><span>④ 후 플레이어 제출</span><i>→</i><span>⑤ 큰 값 승리</span></div>;
  if(kind==='class')return <div className="guide-graphic class-flow"><span>교사 운영 화면</span><i>→</i><span>학생 QR 접속</span><i>→</i><span>방 만들기·참가</span><i>→</i><span>여러 친구와 경기</span><i>→</i><span>전적 제출·집계</span></div>;
  return <div className="guide-graphic youtube-card"><b>▶ YouTube</b><span>더 지니어스 흑과 백</span><small>검색해서 실제 게임의 추리 방식을 살펴보세요.</small></div>;
}

export function GameGuide({onBack}:{onBack:()=>void}){
  const [i,setI]=useState(0);const slide=slides[i];
  return <main className="guide-page scene-main"><button className="back" onClick={onBack}>← 메인 화면</button><section className="guide-shell"><span className="eyebrow">GAME MANUAL</span><h1>게임 설명서</h1><div className="guide-progress">{slides.map((_,n)=><i key={n} className={n===i?'active':''}/>)}</div><article className="guide-slide graphic-guide"><small>{i+1} / {slides.length}</small><h2>{slide.title}</h2><Graphic kind={slide.kind}/><p>{slide.body}</p></article><div className="guide-nav"><button className="secondary" disabled={i===0} onClick={()=>setI(i-1)}>이전</button>{i<slides.length-1?<button className="primary" onClick={()=>setI(i+1)}>다음</button>:<button className="primary" onClick={onBack}>설명서 닫기</button>}</div></section></main>;
}
