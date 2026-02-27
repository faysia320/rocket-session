# ── Stage 1: Python 의존성 빌드 ──
FROM python:3.14-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev


# ── Stage 2: 런타임 ──
FROM python:3.14-slim AS runtime

# Claude Code CLI 버전 고정 (업데이트 시 이 값만 변경)
ARG CLAUDE_CODE_VERSION=2.1.51

# 런타임 의존성만 설치 (빌드 도구 제외)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git libpq5 && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Claude Code CLI 설치 (버전 고정)
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# pnpm 설치 (frontend TypeScript 검증용 node_modules 자동 설치)
RUN npm install -g pnpm

# uv + Python 의존성 복사
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/pyproject.toml /app/uv.lock /app/

WORKDIR /app

# 앱 코드 복사
COPY app/ app/

# Alembic 마이그레이션 파일 복사
COPY alembic.ini ./
COPY migrations/ migrations/

# entrypoint 스크립트 복사 (CRLF→LF 변환 + 실행 권한)
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8101

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
