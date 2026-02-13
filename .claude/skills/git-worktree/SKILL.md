---
name: git-worktree
description: Git worktree를 생성하고 해당 워크트리에서 작업을 시작합니다. 기능 개발이나 버그 수정을 위한 독립적인 작업 환경을 빠르게 구성합니다.
argument-hint: <branch-name>
metadata:
  author: query-manager
  version: "1.0.0"
---

# Git Worktree 생성 및 작업 환경 설정

새로운 git worktree를 생성하고 해당 워크트리 디렉토리에서 작업을 진행합니다.

## 워크트리란?

Git worktree는 동일한 저장소의 여러 브랜치를 동시에 체크아웃할 수 있게 해주는 기능입니다:
- 메인 작업을 방해하지 않고 새 기능 개발 가능
- 여러 브랜치 간 빠른 전환
- 독립적인 작업 환경 보장

## 실행 절차

### 1단계: 인자 확인

사용자가 제공한 브랜치 이름을 확인합니다:
- 브랜치 이름이 없으면 사용자에게 요청
- 브랜치 이름 규칙: `feature/`, `fix/`, `refactor/` 등의 prefix 권장

### 2단계: 워크트리 생성

프로젝트 루트의 스크립트를 실행하여 워크트리를 생성합니다:

```bash
# Windows (Git Bash 또는 WSL)
bash scripts/git-worktree.sh <branch-name>

# 또는 직접 명령어 실행
git fetch origin
mkdir -p .worktrees
git worktree add ".worktrees/wt-<branch-name>" -b "<branch-name>" main
```

워크트리 디렉토리: `.worktrees/wt-<branch-name>/`

### 3단계: 의존성 설치 (필수)

워크트리는 새 디렉토리에 코드만 체크아웃하므로 `node_modules/`와 `.venv/`는 포함되지 않습니다.
**반드시** 의존성을 설치해야 개발/빌드/테스트가 가능합니다.

```bash
# Frontend 의존성 설치
pnpm install --dir .worktrees/wt-<branch-name>/frontend

# Backend 의존성 설치
cd .worktrees/wt-<branch-name>/backend && uv sync && cd ../../..
```

두 명령어를 병렬로 실행하여 시간을 절약할 수 있습니다.

### 4단계: 작업 디렉토리 이동 (필수)

의존성 설치 완료 후 **반드시** 워크트리 디렉토리로 이동합니다:

```bash
cd .worktrees/wt-<branch-name>
```

이렇게 하면 이후 모든 Bash 명령어와 파일 작업이 워크트리 내에서 수행됩니다.

### 5단계: 작업 환경 안내

디렉토리 이동 후 사용자에게 안내:
1. 현재 작업 디렉토리가 워크트리임을 알림
2. 이후 파일 읽기/쓰기는 상대 경로 사용 가능 (예: `frontend/src/...`)

## 워크트리 관리 명령어

### 목록 확인
```bash
git worktree list
```

### 워크트리 삭제
```bash
git worktree remove .worktrees/wt-<branch-name>
```

### 워크트리 정리 (삭제된 브랜치의 워크트리 제거)
```bash
git worktree prune
```

## 사용 예시

```
/git-worktree feature/user-auth     # feature/user-auth 브랜치로 워크트리 생성
/git-worktree fix/query-bug         # fix/query-bug 브랜치로 워크트리 생성
/git-worktree refactor/api-layer    # refactor/api-layer 브랜치로 워크트리 생성
```

## 주의사항

1. **브랜치 이름 중복**: 이미 존재하는 브랜치 이름은 사용 불가
2. **워크트리 경로**: `.worktrees/wt-<branch-name>` 디렉토리에 생성
3. **base 브랜치**: 항상 `main` 브랜치를 기준으로 생성
4. **의존성 설치 필수**: 워크트리 생성 시 `pnpm install`과 `uv sync`가 자동 실행됨
5. **gitignore**: `.worktrees/` 디렉토리가 gitignore에 등록되어 있어야 함

## 워크트리 작업 완료 후

작업이 완료되면:
1. 변경사항 커밋 및 푸시: `/git-commit`
2. PR 생성 (필요시)
3. 워크트리 삭제: `git worktree remove .worktrees/wt-<branch-name>`
4. 브랜치 머지 후 삭제 (필요시)
