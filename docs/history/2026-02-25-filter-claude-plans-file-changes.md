# 작업 이력: .claude/plans/ 파일 변경 감지 필터링

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

파일 변경 추적에서 `.claude/plans/` 경로의 계획 md 파일을 필터링하여 감지되지 않도록 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - subprocess 경로에서 .claude/plans/ 파일 변경 필터링 추가
- `backend/app/services/jsonl_watcher.py` - JSONL import 경로에서 동일 필터링 추가

## 상세 변경 내용

### 1. 파일 변경 감지 필터링

- Write/Edit/MultiEdit 도구 사용 시 정규화된 파일 경로가 `.claude/plans/`를 포함하면 건너뜀
- DB 저장(add_file_change)과 WebSocket 브로드캐스트 모두 스킵
- Windows 역슬래시 경로를 `/`로 변환하여 크로스 플랫폼 호환

## 테스트 방법

1. 세션에서 Claude가 `.claude/plans/` 경로에 파일을 생성/수정하는 작업 실행
2. File Changes 패널에 해당 파일이 표시되지 않는지 확인
