---
name: git-merge-rebase
description: 현재 worktree 브랜치의 작업 내용을 main 브랜치에 rebase 병합합니다. 충돌 해결, main 푸시, worktree 및 로컬 브랜치 정리까지 전체 워크플로우를 처리합니다.
argument-hint: [--no-cleanup]
metadata:
  author: query-manager
  version: "1.0.0"
---

# Git Merge with Rebase

현재 worktree 브랜치의 작업을 main 브랜치에 rebase 방식으로 병합하고, 정리 작업까지 수행합니다.

## 왜 Rebase인가?

- **깔끔한 히스토리**: merge commit 없이 선형적인 커밋 히스토리 유지
- **추적 용이**: 각 커밋이 어떤 작업인지 명확하게 파악 가능
- **bisect 친화적**: 문제 발생 시 git bisect로 쉽게 원인 추적

## 실행 절차

### 1단계: 현재 상태 확인

```bash
# 현재 브랜치 확인
git branch --show-current

# 작업 디렉토리 상태 확인
git status

# 커밋되지 않은 변경사항 확인
git diff --stat
```

**주의**: 커밋되지 않은 변경사항이 있으면 먼저 `/git-commit`을 실행하거나 stash 처리

### 2단계: main 브랜치 최신화

```bash
git fetch origin main
```

### 3단계: Rebase 실행

```bash
git rebase origin/main
```

### 4단계: 충돌 처리 (발생 시)

충돌이 발생하면:

1. **충돌 파일 확인**

   ```bash
   git status
   git diff --name-only --diff-filter=U
   ```

2. **충돌 내용 분석**
   - 각 충돌 파일의 `<<<<<<<`, `=======`, `>>>>>>>` 마커 확인
   - 사용자에게 충돌 내용과 해결 방안 제시

3. **해결 방안 제안**
   - **Ours 선택**: 현재 브랜치(worktree)의 변경사항 유지
   - **Theirs 선택**: main 브랜치의 변경사항 유지
   - **수동 병합**: 양쪽 변경사항을 조합

4. **충돌 해결 후**

   ```bash
   git add <resolved-files>
   git rebase --continue
   ```

5. **Rebase 중단 (필요시)**
   ```bash
   git rebase --abort
   ```

### 5단계: main 브랜치로 이동 및 Fast-forward

```bash
# 메인 저장소로 이동 (worktree 밖)
cd <project-root>

# main 브랜치 체크아웃
git checkout main

# 최신화
git pull origin main

# rebase된 브랜치를 main에 fast-forward merge
git merge <branch-name> --ff-only
```

### 6단계: main 브랜치 푸시

```bash
git push origin main
```

### 7단계: worktree 브랜치 이동

```bash
cd <worktree-path>
```

## 충돌 해결 가이드

### 일반적인 충돌 유형

| 유형                  | 설명                         | 권장 해결 방법          |
| --------------------- | ---------------------------- | ----------------------- |
| **동일 라인 수정**    | 같은 줄을 양쪽에서 수정      | 내용 검토 후 수동 병합  |
| **파일 삭제 vs 수정** | 한쪽은 삭제, 한쪽은 수정     | 의도 확인 후 선택       |
| **이름 변경 충돌**    | 파일명/변수명 변경 충돌      | 최신 네이밍 컨벤션 따름 |
| **import 충돌**       | 같은 위치에 다른 import 추가 | 모두 포함하고 정렬      |

### 충돌 해결 명령어

```bash
# 특정 파일을 현재 브랜치(ours) 버전으로
git checkout --ours <file>

# 특정 파일을 main(theirs) 버전으로
git checkout --theirs <file>

# 충돌 마커가 있는 파일 목록
git diff --name-only --diff-filter=U

# 충돌 상세 보기
git diff
```

## 사용 예시

```
/git-merge-rebase              # rebase 병합 + 정리
```

## 전체 워크플로우 요약

```
1. 상태 확인 (uncommitted 변경 체크)
2. git fetch origin main
3. git rebase origin/main
4. [충돌 시] 해결 → git add → git rebase --continue
5. cd <project-root>
6. git checkout main && git pull
7. git merge <branch> --ff-only
8. git push origin main
```

## 주의사항

1. **Force push 금지**: main 브랜치에 force push하지 않음
2. **커밋 확인**: rebase 전 모든 변경사항이 커밋되어 있어야 함
3. **충돌 주의**: rebase 중 충돌 발생 시 신중하게 해결
4. **백업**: 중요한 작업은 rebase 전 별도 브랜치로 백업 권장
5. **팀 협업**: 공유된 브랜치는 rebase 대신 merge 고려

## 롤백 방법

문제 발생 시:

```bash
# Rebase 중단
git rebase --abort

# main 되돌리기 (아직 push 안했을 경우)
git checkout main
git reset --hard origin/main

# 삭제된 브랜치 복구 (reflog 사용)
git reflog
git checkout -b <branch-name> <commit-hash>
```
