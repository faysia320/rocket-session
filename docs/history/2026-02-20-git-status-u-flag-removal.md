# 작업 이력: git status -u 플래그 제거

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`get_git_status` 메서드에서 `git status --porcelain=v1 -u` 명령의 `-u` 플래그를 제거하여 untracked 디렉토리 재귀 확장을 방지합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/filesystem_service.py` - `get_git_status`의 `-u` 플래그 제거

## 상세 변경 내용

### 1. `-u` 플래그 제거

- **문제**: `-u` 플래그는 `--untracked-files=all`과 동일하게 동작하여 untracked 디렉토리 내부의 모든 파일을 재귀적으로 나열
- **영향**: `node_modules/`, `dist/` 등이 `.gitignore`에 없는 저장소에서 수천 개의 파일이 개별 항목으로 표시됨
- **수정**: `-u` 플래그 제거 → 기본값 `--untracked-files=normal` 동작, untracked 디렉토리는 단일 항목으로 표시

## 관련 커밋

- 이 커밋에서 반영

## 비고

- CRLF phantom 변경 문제(WSL2 환경)는 `git config core.autocrlf input` 설정으로 근본 해결
- 백엔드 코드에서의 CRLF 필터링은 불필요하므로 미적용
