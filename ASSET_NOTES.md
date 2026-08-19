# 제공 에셋 적용 현황

## 이미지
- bg_main.webp → 메인/전적 화면
- bg_lobby.webp → 참가/게임 생성/READY/교사용 BGM 화면
- bg_game.webp → 실제 라운드 화면
- bg_result.webp → 최종 결과 화면
- logo_blackwhite.png → 메인 로고
- tile_black.png / tile_white.png → 실제 숫자 타일 베이스

로고와 타일의 원본 PNG에는 체크무늬 배경이 실제 픽셀로 포함되어 있었습니다. 웹 UI에서 체크무늬가 노출되지 않도록 바깥 밝은 중성 배경만 투명 처리한 서비스용 사본을 사용합니다.

## 외부 효과음
- sfx_game_start.wav
- sfx_reveal.wav
- sfx_round_win.wav
- sfx_overtime.wav
- sfx_game_win.wav

## 자체 생성 효과음
업로드에 없던 round lose를 포함하여 다음은 Web Audio API로 생성합니다.
- button click
- tile select / tile submit
- opponent submit
- round lose / draw
- next round
- game lose
- connection lost / restored
- deduction mark

## BGM
- bgm_game_main.mp3

업로드에 ready/final BGM은 없으므로 별도 가상 파일을 만들지 않았습니다. 제공된 메인 BGM 1곡을 교사용 BGM 콘솔에서 반복 재생합니다.
