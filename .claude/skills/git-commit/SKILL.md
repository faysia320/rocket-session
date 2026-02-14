---
name: git-commit
description: 변경사항을 작업 단위별로 분석하여 자동으로 커밋하고 푸시합니다. .gitmessage.txt 형식을 따르며, 논리적으로 관련된 변경사항을 그룹화하여 여러 커밋으로 나눕니다. 커밋 전 작업 이력 문서를 자동 생성합니다.
argument-hint: "[--no-push] [--no-history]"
metadata:
  author: query-manager
  version: "1.1.0"
---

# Smart Commit & Push

변경사항을 분석하여 작업 단위별로 커밋하고 원격 저장소에 푸시합니다.
**커밋 전에 작업 이력 문서를 `docs/history/` 폴더에 자동 생성합니다.**

## 작업 이력 문서 생성

### 파일명 형식

```
docs/history/YYYY-MM-DD-<간단한-설명>.md
```

예시: `docs/history/2026-01-28-query-execution-feature.md`

### 문서 템플릿

```markdown
# 작업 이력: <작업 제목>

- **날짜**: YYYY-MM-DD
- **작업자**: Claude + 사용자
- **브랜치**: <현재 브랜치명>

## 변경 요약

<이번 커밋에서 수행한 작업의 간단한 요약>

## 변경 파일 목록

### Backend

- `backend/app/...` - 변경 내용 설명

### Frontend

- `frontend/src/...` - 변경 내용 설명

## 상세 변경 내용

### 1. <기능/수정 사항 1>

- 무엇을 변경했는지
- 왜 변경했는지
- 어떻게 동작하는지

### 2. <기능/수정 사항 2>

...

## 관련 커밋

- `<커밋 해시>` - <커밋 메시지>

## 테스트 방법

<변경사항을 테스트하는 방법 (해당되는 경우)>

## 비고

<추가 참고사항 (선택사항)>
```

## 커밋 메시지 형식

프로젝트 루트의 `.gitmessage.txt` 파일을 참조하여 커밋 메시지를 생성합니다:

### 타입 리스트

| 타입     | 설명                              |
| -------- | --------------------------------- |
| Feat     | 새로운 기능 추가                  |
| Fix      | 버그 수정                         |
| Design   | CSS 등 사용자 UI 디자인 변경      |
| Refactor | 리팩토링                          |
| Comment  | 주석 추가 및 변경                 |
| style    | 코드 포맷팅, 오타, 함수명 수정 등 |
| Docs     | 문서 수정                         |
| Test     | 테스트 코드                       |
| Chore    | 기타 변경사항 (빌드, 패키지 등)   |
| Rename   | 파일/폴더명 수정 또는 이동        |
| Remove   | 파일 삭제                         |

### 메시지 규칙

- 제목: 최대 50글자, 첫 글자 대문자, 마침표 금지
- 형식: `<타입>: <동사> <내용>` (예: `Feat: Add 조회 API`)
- 제목과 본문 사이 빈 줄 추가
- 본문: "무엇을", "왜"를 설명 (선택사항)

## 실행 절차

### 1단계: 변경사항 분석

```bash
git status
git diff --staged
git diff
```

### 2단계: 작업 단위 분류

변경된 파일들을 논리적 작업 단위로 그룹화:

- **기능별**: 같은 기능에 관련된 frontend + backend 변경
- **레이어별**: API, Service, Repository 등 같은 레이어 변경
- **파일 유형별**: 설정 파일, 스키마, 컴포넌트 등

### 3단계: 작업 이력 문서 생성 (--no-history 옵션이 없는 경우)

1. `docs/history/` 폴더 존재 확인 (없으면 생성)
2. 오늘 날짜와 작업 내용을 기반으로 파일명 생성
3. 변경사항을 분석하여 문서 템플릿에 맞게 내용 작성
4. 문서 파일 생성

### 4단계: 순차적 커밋

각 작업 단위마다:

1. 해당 파일들만 스테이징: `git add <files>`
2. 커밋 메시지 생성 (.gitmessage.txt 형식 준수)
3. 커밋 실행

**중요**: 작업 이력 문서는 첫 번째 커밋에 포함하거나, 별도의 `Docs: Add 작업 이력 문서` 커밋으로 분리

### 5단계: 푸시

`--no-push` 옵션이 없으면 원격 저장소에 푸시:

```bash
git push origin <current-branch>
```

## 커밋 분리 예시

### 예시 1: 새 기능 추가

```
변경 파일:
- backend/app/api/v1/endpoints/query_api.py
- backend/app/services/query_service.py
- backend/app/schemas/query.py
- frontend/src/features/query/hooks/useQuery.ts
- frontend/src/features/query/components/QueryForm.tsx

커밋 분리:
1. Feat: Add 쿼리 실행 API 엔드포인트
   - backend/app/api/v1/endpoints/query_api.py
   - backend/app/services/query_service.py
   - backend/app/schemas/query.py

2. Feat: Add 쿼리 실행 UI 컴포넌트
   - frontend/src/features/query/hooks/useQuery.ts
   - frontend/src/features/query/components/QueryForm.tsx
```

### 예시 2: 버그 수정 + 리팩토링

```
변경 파일:
- backend/app/services/query_service.py (버그 수정)
- frontend/src/components/ui/button.tsx (리팩토링)
- frontend/src/lib/utils.ts (리팩토링)

커밋 분리:
1. Fix: 쿼리 실행 시 파라미터 누락 버그 수정
   - backend/app/services/query_service.py

2. Refactor: 버튼 컴포넌트 스타일 정리
   - frontend/src/components/ui/button.tsx
   - frontend/src/lib/utils.ts
```

## 주의사항

1. **민감한 파일 제외**: `.env`, `credentials.json` 등은 커밋하지 않음
2. **충돌 확인**: 푸시 전 원격 브랜치와 충돌 여부 확인
3. **브랜치 확인**: main/master 직접 푸시 시 경고
4. **Co-Author 추가**: 모든 커밋에 Claude 공동 작성자 추가

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## 옵션

| 옵션           | 설명                           |
| -------------- | ------------------------------ |
| `--no-push`    | 커밋만 하고 푸시하지 않음      |
| `--no-history` | 작업 이력 문서를 생성하지 않음 |

## 사용 예시

```
/git-commit                        # 이력 문서 생성 + 커밋 + 푸시
/git-commit --no-push              # 이력 문서 생성 + 커밋만 실행
/git-commit --no-history           # 이력 문서 없이 커밋 + 푸시
/git-commit --no-push --no-history # 이력 문서 없이 커밋만 실행
```

## 작업 이력 문서 예시

```markdown
# 작업 이력: 쿼리 실행 기능 추가

- **날짜**: 2026-01-28
- **작업자**: Claude + 사용자
- **브랜치**: feature/query-execution

## 변경 요약

Trino 쿼리 실행 기능을 추가하고, 결과를 테이블 형태로 표시하는 UI 컴포넌트를 구현했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/query_api.py` - 쿼리 실행 API 엔드포인트 추가
- `backend/app/services/query_service.py` - Trino 쿼리 실행 로직 구현
- `backend/app/schemas/query.py` - 요청/응답 스키마 정의

### Frontend

- `frontend/src/features/query/hooks/useExecuteQuery.ts` - 쿼리 실행 React Query 훅
- `frontend/src/features/query/components/QueryResult.tsx` - 결과 테이블 컴포넌트

## 상세 변경 내용

### 1. 쿼리 실행 API

- POST /api/v1/query/execute 엔드포인트 추가
- Trino 연결 및 쿼리 실행 서비스 구현
- 에러 핸들링 및 타임아웃 처리

### 2. 결과 표시 UI

- Wijmo FlexGrid를 사용한 결과 테이블
- 컬럼 자동 크기 조정
- 대용량 데이터 가상화 스크롤 지원

## 관련 커밋

- `abc1234` - Feat: Add 쿼리 실행 API 엔드포인트
- `def5678` - Feat: Add 쿼리 결과 테이블 컴포넌트

## 테스트 방법

1. 쿼리 에디터에서 SQL 입력
2. Ctrl+Enter로 실행
3. 하단 패널에서 결과 확인
```
