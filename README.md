# BLACK & WHITE — 학급용 2인 WebRTC 두뇌게임

첨부 명세를 기반으로 구현한 React + TypeScript + Vite 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

두 기기 테스트는 HTTPS 환경(Vercel 등)에 배포하는 것을 권장합니다. 카메라 QR 스캔은 HTTPS가 필요합니다.

## 구현된 핵심 기능

- 0~8 숫자 타일 / BLACK(짝수)·WHITE(홀수)
- 선 플레이어 → 색 공개 → 후 플레이어 순차 제출
- SHA-256 Commit → Reveal 검증
- 9라운드, 동점 시 연장전 반복
- 직전 라운드 승자가 다음 라운드 선 플레이어, DRAW 시 기존 선 유지
- PeerJS 기반 WebRTC DataConnection(영상/음성 없음)
- 게임 만들기 / 코드 참가 / QR 생성·카메라 스캔
- 양쪽 READY 후 게임 시작
- LocalStorage 이름·전적·승점·경기기록 저장
- processedMatchIds 기반 결과 중복 저장 방지
- messageId 기반 네트워크 메시지 중복 처리 방지
- 추리판 X/?/★ 및 자유메모(로컬 전용)
- 상대 사용 색 기록 / 라운드 기록
- 연결 상태·수동 재연결
- `?debug=true` 네트워크 진단 패널
- AudioManager 확장 지점

## 네트워크 구조

PeerJS는 signaling 계층에만 사용합니다. 연결 이후 게임 메시지는 두 브라우저 사이 WebRTC DataChannel로 교환됩니다. 게임 상태 DB는 사용하지 않습니다.

## 배포

Vercel에 저장소를 연결하고 기본 Vite 설정으로 배포할 수 있습니다.

Build command: `npm run build`
Output directory: `dist`

## 다음 검증 권장 순서

1. 한 PC의 서로 다른 브라우저/프로필 2개
2. 동일 Wi-Fi의 태블릿 2대
3. 10대 / 5경기
4. 20대 / 10경기
5. 26대 / 13경기

학교망에서 PeerJS signaling 접속 또는 WebRTC ICE가 차단될 경우 self-hosted PeerServer 또는 별도 signaling 모듈로 교체해야 합니다. 게임 엔진과 저장소 코드는 그대로 유지할 수 있습니다.
