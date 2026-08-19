import { useState } from 'react';
const slides=[
  {title:'1. 메인 화면',body:'교사는 ‘교사 게임 시작’, 학생은 ‘학생 게임 시작’을 선택합니다. 교사는 수업 타이머·BGM·학생 접속 QR·전적 집계를 한 화면에서 운영할 수 있습니다.'},
  {title:'2. 교사 게임 시작',body:'교사 페이지를 열면 6자리 교사 코드가 생성됩니다. 학생 접속용 QR/링크를 안내하고, 필요하면 수업 인트로를 진행한 뒤 타이머와 BGM을 시작합니다.'},
  {title:'3. 학생 게임 시작',body:'학생은 처음 한 번 자신의 이름을 입력하고 확인합니다. 방장은 ‘게임 만들기’에서 기본 숫자·분수·소수·길이·분수+소수 유형과 쉬움·보통·어려움 난이도를 정합니다. 참가 학생은 방에 들어가기 전 유형과 난이도를 확인합니다.'},
  {title:'4. 게임 진행',body:'양쪽 READY 후 두 학생은 같은 9개의 타일을 사용합니다. 기본 숫자를 제외한 타일 값은 매 경기 새로 생성됩니다. 타일은 처음에 무작위로 배치되며 각자 드래그해 원하는 순서로 정렬할 수 있습니다. 선 플레이어가 먼저 타일을 내면 상대에게는 값이 아닌 BLACK/WHITE 색만 공개됩니다.'},
  {title:'5. 추리와 라운드',body:'사용한 자신의 타일은 다시 쓸 수 없습니다. 상대의 색 기록과 추리판(X · ? · ★)을 활용해 상대의 남은 숫자를 추리합니다. 9라운드 동점이면 연장전을 진행합니다.'},
  {title:'6. 전적 제출',body:'수업 시간이 끝나면 학생 페이지의 ‘전적 제출’ 버튼을 누릅니다. 교사가 보여주는 6자리 교사 코드를 입력하면 승·패·승점과 어떤 친구와 대결했는지가 교사 화면으로 전송됩니다.'},
  {title:'7. 더 알아보기',body:'게임의 원작 분위기와 진행 방식을 더 보고 싶다면 YouTube에서 “더 지니어스 흑과 백”을 검색해 보세요. 영상 시청 시 학교의 영상 이용 기준과 연령 적합성을 확인하세요.'},
];
export function GameGuide({onBack}:{onBack:()=>void}){const [i,setI]=useState(0);return <main className="guide-page scene-main"><button className="back" onClick={onBack}>← 메인 화면</button><section className="guide-shell"><span className="eyebrow">GAME MANUAL</span><h1>게임 설명서</h1><div className="guide-progress">{slides.map((_,n)=><i key={n} className={n===i?'active':''}/>)}</div><article className="guide-slide"><small>{i+1} / {slides.length}</small><h2>{slides[i].title}</h2><p>{slides[i].body}</p></article><div className="guide-nav"><button className="secondary" disabled={i===0} onClick={()=>setI(i-1)}>이전</button>{i<slides.length-1?<button className="primary" onClick={()=>setI(i+1)}>다음</button>:<button className="primary" onClick={onBack}>설명서 닫기</button>}</div></section></main>}
