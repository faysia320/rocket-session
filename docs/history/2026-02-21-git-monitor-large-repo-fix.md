# 작업 이력: Git Monitor 대형 레포 Cross-Platform 안정화

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor에서 Windows clone → WSL2 백엔드 환경의 대형 레포(10,000+ 파일)를 모니터링할 때 변경점이 처음에 2980개로 표시되다가 새로고침 시 0개로 바뀌는 문제를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/filesystem_service.py` - cross-platform git 옵션 확장, update-index 제거, --no-optional-locks 추가

## 상세 변경 내용

### 1. `_GIT_CROSS_PLATFORM_OPTS` 확장

기존 `core.fileMode=false` 하나에서 4개 옵션으로 확장:

- `core.fileMode=false`: Windows/Linux 파일 권한 차이 무시
- `core.autocrlf=input`: CRLF→LF 정규화로 line ending 차이 해소
- `core.trustctime=false`: WSL2의 9P 프로토콜에서 신뢰할 수 없는 ctime 무시
- `core.checkStat=minimal`: stat 비교를 mtime+size만으로 최소화 (inode/dev/uid 무시)

### 2. `update-index --refresh` 제거

대형 레포에서 WSL2의 9P 프로토콜을 통한 파일 I/O가 매우 느려(파일당 1-5ms) `update-index --refresh`가 타임아웃되는 것이 근본 원인이었습니다. `git status`가 내부적으로 `refresh_index()`를 호출하므로 별도 실행은 불필요합니다.

### 3. `--no-optional-locks` 추가

`git status`와 `git info` 조회 시 `--no-optional-locks` 플래그를 추가하여 `index.lock` 파일 경합을 원천 방지합니다. VS Code git 확장 등 다른 프로세스와 안전하게 동시 실행 가능합니다.

### 4. 타임아웃 60초로 증가

WSL2의 9P 프로토콜을 통한 대형 레포 `git status` 실행에 충분한 시간을 확보합니다.

### 5. 진단 로깅 강화

대형 결과 로깅 시 staged/unstaged/untracked 파일 유형별 분류를 추가하여 디버깅을 용이하게 합니다.

## 근본 원인 분석

| 원인 | 설명 | 해결 |
|------|------|------|
| `update-index --refresh` 타임아웃 | 9P에서 10,000+ 파일 lstat() → 30초 초과 | 제거 (git status 내부 처리) |
| `core.autocrlf` 미설정 | CRLF/LF 차이로 모든 파일이 변경으로 감지 | `autocrlf=input` |
| `core.trustctime` 미설정 | WSL2 ctime 불일치 → false positive | `trustctime=false` |
| `core.checkStat` 미설정 | inode/dev/uid 차이 → false positive | `checkStat=minimal` |

## 테스트 방법

1. Windows에서 clone한 대형 레포를 Git Monitor에 추가
2. 처음 표시되는 변경점 수 확인
3. 새로고침 후 변경점 수가 일관되는지 확인
4. 백엔드 로그에서 `git status 대형 결과` 메시지 확인
