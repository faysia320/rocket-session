# 데이터베이스 스키마

PostgreSQL + SQLAlchemy ORM (`backend/app/models/`), 마이그레이션: Alembic (`backend/migrations/`)

## sessions (세션 메타데이터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 세션 ID |
| claude_session_id | String | Claude CLI 세션 ID |
| work_dir | Text | 작업 디렉토리 |
| status | String | idle / running / error / archived |
| created_at | Text | 생성 시각 |
| allowed_tools | Text | 허용 도구 (쉼표 구분) |
| disallowed_tools | Text | 비허용 도구 (쉼표 구분) |
| system_prompt | Text | 시스템 프롬프트 |
| system_prompt_mode | String | replace / append |
| timeout_seconds | Integer | 타임아웃 |
| workflow_enabled | Boolean | 워크플로우 활성화 여부 |
| workflow_phase | String | research / plan / implement |
| workflow_phase_status | String | in_progress / awaiting_approval / approved / revision_requested |
| permission_mode | Boolean | Permission 모드 활성화 |
| permission_required_tools | JSONB | 승인 필요 도구 |
| name | Text | 세션 이름 |
| jsonl_path | Text | JSONL 세션 파일 경로 |
| model | String | 모델명 |
| max_turns | Integer | 최대 턴 수 |
| max_budget_usd | Float | 예산 한도 (USD) |
| mcp_server_ids | JSONB | 연결된 MCP 서버 ID 목록 |
| additional_dirs | JSONB | 추가 작업 디렉토리 목록 |
| fallback_model | String | 폴백 모델명 |
| worktree_name | String | Git 워크트리 이름 |
| workspace_id | String (FK → workspaces) | 워크스페이스 참조 |
| parent_session_id | String | 포크 원본 세션 ID |
| forked_at_message_id | Integer | 포크 시점 메시지 ID |
| search_vector | TSVECTOR | 전문 검색 인덱스 (GIN) |

## messages (대화 기록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 메시지 ID |
| session_id | String (FK → sessions) | 세션 참조 |
| role | String | user / assistant |
| content | Text | 메시지 내용 |
| cost | Float | API 비용 (USD) |
| duration_ms | Integer | 실행 시간 |
| timestamp | Text | 생성 시각 |
| is_error | Boolean | 에러 여부 |
| input_tokens | Integer | 입력 토큰 수 |
| output_tokens | Integer | 출력 토큰 수 |
| cache_creation_tokens | Integer | 캐시 생성 토큰 |
| cache_read_tokens | Integer | 캐시 읽기 토큰 |
| model | String | 사용된 모델명 |
| workflow_phase | String | 메시지 생성 시 워크플로우 단계 |

## session_artifacts (워크플로우 아티팩트)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 아티팩트 ID |
| session_id | String (FK → sessions) | 세션 참조 |
| phase | String | research / plan |
| title | String | 아티팩트 제목 |
| content | Text | 아티팩트 내용 (Markdown) |
| status | String | draft / final |
| version | Integer | 버전 번호 (기본값: 1) |
| parent_artifact_id | Integer (FK → session_artifacts, nullable) | 이전 버전 참조 |
| created_at | DateTime(tz) | 생성 시각 |
| updated_at | DateTime(tz) | 수정 시각 |

## artifact_annotations (아티팩트 인라인 주석)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 주석 ID |
| artifact_id | Integer (FK → session_artifacts) | 아티팩트 참조 |
| line_start | Integer | 시작 행 번호 |
| line_end | Integer (nullable) | 끝 행 번호 |
| content | Text | 주석 내용 |
| annotation_type | String | comment / suggestion / issue |
| status | String | pending / resolved |
| created_at | DateTime(tz) | 생성 시각 |

## file_changes (파일 변경 기록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 변경 ID |
| session_id | String (FK → sessions) | 세션 참조 |
| tool | String | Write / Edit / Bash 등 |
| file | Text | 변경된 파일 경로 |
| timestamp | Text | 변경 시각 |

## events (WebSocket 이벤트 버퍼)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 이벤트 ID |
| session_id | String (FK → sessions) | 세션 참조 |
| seq | Integer | 시퀀스 번호 |
| event_type | String | 이벤트 타입 |
| payload | JSONB | JSON 페이로드 |
| timestamp | Text | 생성 시각 |

## workspaces (워크스페이스)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 워크스페이스 ID |
| name | String | 워크스페이스 이름 |
| repo_url | Text | Git 저장소 URL |
| branch | String | 기본 브랜치명 |
| local_path | Text | 로컬 클론 경로 (/workspaces/{id}) |
| status | String | cloning / ready / error / deleting |
| error_message | Text | 오류 메시지 |
| disk_usage_mb | Float | 디스크 사용량 (MB) |
| created_at | DateTime(tz) | 생성 시각 |
| updated_at | DateTime(tz) | 수정 시각 |

## global_settings (글로벌 설정)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 설정 ID (기본값: "default") |
| default_workspace_id | String | 기본 워크스페이스 ID |
| allowed_tools | Text | 기본 허용 도구 |
| system_prompt | Text | 기본 시스템 프롬프트 |
| timeout_seconds | Integer | 기본 타임아웃 |
| workflow_enabled | Boolean | 기본 워크플로우 활성화 |
| permission_mode | Boolean | 기본 Permission 모드 |
| model | String | 기본 모델 |
| max_turns | Integer | 기본 최대 턴 |
| max_budget_usd | Float | 기본 예산 한도 |
| mcp_server_ids | JSONB | 기본 MCP 서버 |

## mcp_servers (MCP 서버 설정)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 서버 ID |
| name | String (unique) | 서버 이름 |
| transport_type | String | stdio / sse |
| command | Text | 실행 명령어 |
| args | JSONB | 명령어 인자 |
| url | Text | SSE URL |
| headers | JSONB | HTTP 헤더 |
| env | JSONB | 환경 변수 |
| enabled | Boolean | 활성화 여부 |
| source | String | manual / imported |
| created_at | Text | 생성 시각 |
| updated_at | Text | 수정 시각 |

## tags (태그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 태그 ID |
| name | String (unique) | 태그 이름 |
| color | String | 색상 코드 |
| created_at | Text | 생성 시각 |

## session_tags (세션-태그 연결)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| session_id | String (FK → sessions, PK) | 세션 참조 |
| tag_id | String (FK → tags, PK) | 태그 참조 |
| created_at | Text | 생성 시각 |

## teams (팀)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 팀 ID |
| name | String | 팀 이름 |
| workspace_id | String (FK → workspaces) | 워크스페이스 참조 |
| goal | Text | 팀 목표/작업 설명 |
| status | String | idle / running / completed / error |
| created_at | DateTime(tz) | 생성 시각 |

## team_messages (팀 메시지)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 메시지 ID |
| team_id | String (FK → teams) | 팀 참조 |
| role | String | user / coordinator / agent |
| content | Text | 메시지 내용 |
| sender_name | String | 발신자 이름 |
| created_at | DateTime(tz) | 생성 시각 |

## team_tasks (팀 작업)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 작업 ID |
| team_id | String (FK → teams) | 팀 참조 |
| session_id | String (FK → sessions) | 담당 세션 참조 |
| description | Text | 작업 설명 |
| status | String | pending / in_progress / completed / error |
| result | Text | 작업 결과 |
| created_at | DateTime(tz) | 생성 시각 |

## workflow_definitions (워크플로우 정의)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String (PK) | 정의 ID |
| name | String (unique) | 정의 이름 |
| description | Text (nullable) | 설명 |
| is_builtin | Boolean | 내장 정의 여부 (삭제 불가) |
| is_default | Boolean | 기본 정의 여부 |
| sort_order | Integer | 정렬 순서 |
| steps | JSONB | 워크플로우 단계 배열 (WorkflowStepConfig[]) |
| created_at | DateTime(tz) | 생성 시각 |
| updated_at | DateTime(tz) | 수정 시각 |

## token_snapshots (토큰 사용량 스냅샷)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK, auto) | 스냅샷 ID |
| session_id | String | 세션 ID (FK 없음, 독립 보존) |
| work_dir | Text | 작업 디렉토리 |
| workflow_phase | String (nullable) | 워크플로우 단계 |
| model | String (nullable) | 모델명 |
| input_tokens | Integer | 입력 토큰 수 |
| output_tokens | Integer | 출력 토큰 수 |
| cache_creation_tokens | Integer | 캐시 생성 토큰 |
| cache_read_tokens | Integer | 캐시 읽기 토큰 |
| timestamp | DateTime(tz) | 생성 시각 |

---

> **마이그레이션**: Alembic으로 관리됩니다. `database.py`의 `initialize()` 메서드가 서버 시작 시 `alembic upgrade head`를 프로그래매틱으로 실행합니다. 새 마이그레이션 생성: `cd backend && uv run alembic revision --autogenerate -m "설명"`