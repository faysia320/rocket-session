# 작업 이력: Analytics 토큰 스냅샷 도입

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Analytics 토큰 사용량 집계를 개선하기 위해 `token_snapshots` 독립 테이블을 도입했습니다. 세션 삭제 시에도 토큰 데이터가 보존되며, Workflow Phase(Research/Plan/Implement)별 토큰 사용량 추적이 가능해졌습니다.

## 변경 파일 목록

### Backend

- `backend/app/models/token_snapshot.py` - TokenSnapshot ORM 모델 (신규)
- `backend/app/models/__init__.py` - TokenSnapshot import 추가
- `backend/app/repositories/token_snapshot_repo.py` - 토큰 스냅샷 Repository (신규)
- `backend/migrations/versions/20260225_0016_add_token_snapshots.py` - Alembic 마이그레이션 (신규)
- `backend/app/schemas/analytics.py` - PhaseTokenUsage 스키마 추가
- `backend/app/services/analytics_service.py` - TokenSnapshotRepository 기반으로 전환
- `backend/app/services/session_manager.py` - add_token_snapshot() 메서드 추가
- `backend/app/services/claude_runner.py` - result 이벤트 시 토큰 스냅샷 기록
- `backend/app/services/jsonl_watcher.py` - result 이벤트 시 토큰 스냅샷 기록

### Frontend

- `frontend/src/types/analytics.ts` - PhaseTokenUsage 타입 추가
- `frontend/src/types/index.ts` - PhaseTokenUsage re-export
- `frontend/src/features/analytics/components/PhaseTokenBreakdown.tsx` - Phase별 토큰 차트 (신규)
- `frontend/src/features/analytics/components/AnalyticsDashboard.tsx` - PhaseTokenBreakdown 컴포넌트 배치

## 상세 변경 내용

### 1. token_snapshots 독립 테이블

- sessions 테이블에 FK를 걸지 않아 세션 삭제 시에도 토큰 데이터 영구 보존
- session_id, work_dir, workflow_phase, model, input/output/cache 토큰, timestamp 기록
- Alembic 마이그레이션에서 기존 messages 데이터를 자동 복사 (data migration)

### 2. Dual-write 패턴

- ClaudeRunner와 JsonlWatcher의 result 이벤트 핸들러에서 기존 messages 기록과 함께 token_snapshots에도 동시 기록
- ClaudeRunner는 turn_state에서 workflow_phase를 함께 기록
- JsonlWatcher는 workflow 컨텍스트가 없어 workflow_phase=None으로 기록
- 스냅샷 기록 실패 시 경고 로그만 남기고 메인 흐름에 영향 없음

### 3. Phase별 토큰 시각화

- PhaseTokenBreakdown 컴포넌트: Research/Plan/Implement별 input/output 토큰을 수평 바 차트로 표시
- 데이터 없으면 렌더링하지 않음 (기존 데이터는 phase 정보 없음)

## 테스트 방법

1. `alembic upgrade head` 실행 후 token_snapshots 테이블 및 기존 데이터 마이그레이션 확인
2. 세션에서 프롬프트 실행 후 token_snapshots에 행 추가 확인
3. 세션 삭제 후 Analytics 대시보드에서 해당 토큰 데이터 보존 확인
4. Workflow 활성화 세션에서 Phase별 토큰 분리 확인

## 비고

- 사용자는 Max Plan 구독을 사용하므로 cost_usd 필드는 불필요하여 제외
- 기존 마이그레이션된 데이터의 workflow_phase는 모두 NULL (이후 생성된 세션부터 추적)
