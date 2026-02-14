FROM python:3.11-slim AS base

# Node.js 22 LTS 설치 (Claude Code CLI 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Claude Code CLI 설치
RUN npm install -g @anthropic-ai/claude-code

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 의존성 먼저 설치 (캐시 활용)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 앱 코드 복사
COPY app/ app/

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

# entrypoint 스크립트 복사 (Git 인증 자동 설정)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8101

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
