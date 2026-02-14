# 작업 이력: 디렉토리 탐색 경계 제한

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 환경에서 디렉토리 선택 모달이 `/projects`(CLAUDE_WORK_DIR)를 초기 경로로 열리도록 하고,
그 상위로는 이동할 수 없도록 경계를 설정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/filesystem_service.py` - root_dir 경계 로직 추가
- `backend/app/api/dependencies.py` - FilesystemService에 CLAUDE_WORK_DIR 주입
- `backend/app/schemas/settings.py` - GlobalSettingsResponse에 root_dir 필드 추가
- `backend/app/api/v1/endpoints/settings.py` - 설정 응답에 root_dir 포함

### Frontend

- `frontend/src/types/settings.ts` - GlobalSettings에 root_dir 추가
- `frontend/src/features/directory/components/DirectoryPicker.tsx` - 초기 경로를 root_dir로 설정

## 상세 변경 내용

### 1. FilesystemService 경계 적용

- `__init__`에 `root_dir` 파라미터 추가, `CLAUDE_WORK_DIR` 환경변수 값 사용
- `_is_within_root()`: 요청 경로가 root_dir 내부인지 확인
- `list_directory()`: 경계 밖 접근 시 root_dir로 리다이렉트, root_dir에서 parent=null 반환
- Settings API를 통해 프론트엔드에 root_dir 값 전달

### 2. 프론트엔드 초기 경로 변경

- DirectoryPicker에서 `initialPath`를 `value || globalSettings.root_dir || "~"` 순서로 폴백
- 백엔드가 parent=null을 반환하면 "상위 디렉토리" 버튼이 자동으로 숨겨짐

## 테스트 방법

```bash
# Settings API에서 root_dir 확인
curl -s http://localhost:8100/api/settings/ | python -m json.tool
# → "root_dir": "/projects"

# /projects에서 parent=null 확인
curl -s "http://localhost:8100/api/fs/list?path=/projects" | python -m json.tool | head -5
# → "parent": null

# 상위 경로 접근 시 리다이렉트 확인
curl -s "http://localhost:8100/api/fs/list?path=/" | python -m json.tool | head -5
# → "path": "/projects", "parent": null
```
