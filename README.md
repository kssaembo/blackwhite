# 백과 흑 — 학급용 2인 WebRTC 두뇌게임

React + TypeScript + Vite 기반의 학급용 1:1 P2P 두뇌게임입니다. 제공된 이미지·효과음·BGM을 실제 UI에 통합한 디자인 고도화 버전입니다.

## 실행

```bash
npm install
npm run dev
```

두 기기 테스트와 QR 카메라 스캔은 HTTPS 환경(Vercel 등)을 권장합니다.

## 구현 핵심

- 0~8 숫자 타일 / BLACK(짝수)·WHITE(홀수)
- 선 플레이어 → 색 공개 → 후 플레이어 순차 제출
- SHA-256 Commit → Reveal 검증
- 9라운드 / 동점 시 연장전
- 직전 라운드 승자가 다음 선 플레이어, DRAW 시 기존 선 유지
- PeerJS 기반 WebRTC DataConnection
- 게임 만들기 / 코드 참가 / QR 생성·스캔 / 양쪽 READY
- LocalStorage 이름·전적·승점·경기기록
- processedMatchIds / messageId 중복 방지
- 추리판 X/?/★ 및 자유메모(로컬 전용)
- 상대 사용 색 기록 / 라운드 기록
- 연결 상태·재연결 / `?debug=true` 진단 패널

## 디자인·오디오 적용

- 메인: `bg_main.webp`
- 연결/READY: `bg_lobby.webp`
- 게임: `bg_game.webp`
- 최종 결과: `bg_result.webp`
- 로고: `logo_blackwhite.png`
- 실제 흑/백 타일 이미지를 버튼 베이스로 사용하고 숫자는 HTML/CSS로 출력
- 제공된 `game_start`, `reveal`, `round_win`, `overtime`, `game_win` SFX 연결
- 제공되지 않은 LOSE/DRAW/클릭/타일 선택/연결 알림 등은 Web Audio API로 자체 생성
- 교사용 BGM 화면에서 `bgm_game_main.mp3` 반복 재생, 일시정지, 재시작, 볼륨 조절

메인 화면의 **교사용 BGM** 버튼으로 들어갈 수 있습니다. 학생 태블릿에는 BGM이 자동 재생되지 않습니다.

## 에셋 위치

```text
public/assets/
├─ images/
│  ├─ backgrounds/
│  ├─ logo/
│  └─ tiles/
└─ audio/
   ├─ sfx/
   └─ bgm/
```

업로드된 타일/로고 이미지의 체크무늬 배경이 이미지 픽셀에 포함되어 있어 서비스용 사본에서는 바깥 배경을 투명 처리했습니다. 원본 에셋의 주된 디자인은 유지했습니다.

## 배포

Vercel Build command: `npm run build`  
Output directory: `dist`

이 버전의 TypeScript 설정에는 Vercel에서 발생했던 TS5096 오류를 방지하기 위해 `tsconfig.node.json`의 `noEmit: true`가 포함되어 있습니다. Vite 7.3.6 / `@vitejs/plugin-react` 5.0.4 조합을 사용합니다.

## 교실 검증 권장

1. 동일 Wi-Fi 태블릿 2대
2. 10대 / 5경기
3. 20대 / 10경기
4. 26대 / 13경기

학교망에서 PeerJS signaling 또는 WebRTC ICE가 차단되면 signaling 계층만 교체할 수 있도록 게임 엔진·저장소와 분리되어 있습니다.

## v5 classroom update
- Main entrance: Teacher game / Student game / Game manual
- Match codes: six numeric digits
- Teacher page: student access QR/link, class timer, intro slides, teacher-only BGM, six-digit record collection code, live result table
- Student page: confirmed/locked player name, prominent match-history button, record submission to teacher over temporary PeerJS/WebRTC connection
- Record submission contains wins/losses/points and opponent-by-opponent match records. No central game database is used.
