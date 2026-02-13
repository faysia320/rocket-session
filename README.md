# Claude Code Dashboard

A web-based dashboard to interact with and monitor Claude Code CLI sessions from your browser.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐    subprocess    ┌──────────────┐
│  React Frontend  │◄──────────────────►│  FastAPI Backend  │◄──────────────►│  Claude Code  │
│ (localhost:8100) │                    │ (localhost:8101)  │                │     CLI       │
└─────────────────┘                     └──────────────────┘                └──────────────┘
```

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app factory + CORS
│   ├── core/config.py           # Pydantic BaseSettings
│   ├── api/
│   │   ├── dependencies.py      # DI providers
│   │   └── v1/
│   │       ├── api.py           # Router aggregation
│   │       └── endpoints/       # health, sessions, ws
│   ├── schemas/session.py       # Request/Response models
│   ├── services/
│   │   ├── session_manager.py   # Session lifecycle
│   │   ├── claude_runner.py     # CLI subprocess runner
│   │   └── websocket_manager.py # WS broadcast
│   └── models/session.py        # Domain models
├── pyproject.toml               # uv package manager
└── .env.example

frontend/
├── src/
│   ├── App.jsx                  # Root layout
│   ├── config/env.js            # Environment config
│   ├── components/ui/           # Shared UI (EmptyState, FormattedText)
│   ├── features/
│   │   ├── session/             # Sidebar + useSessions hook
│   │   ├── chat/                # ChatPanel + MessageBubble + useClaudeSocket
│   │   └── files/               # FilePanel
│   ├── lib/api/                 # API client + domain functions
│   └── styles/global.css        # CSS variables + design system import
├── design-system/               # Shared design tokens (CSS vars, TS tokens)
├── package.json                 # pnpm package manager
└── vite.config.js               # Port 8100, proxy to 8101
```

## Features

- **Send commands** to Claude Code CLI from the browser
- **Real-time streaming** of Claude's responses via WebSocket
- **Session management** - create, resume, and list sessions
- **File change tracking** - see what files Claude modifies
- **Terminal-style UI** with design system tokens

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+
- [pnpm](https://pnpm.io/) (Node package manager)
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Active Claude Pro/Max subscription or API key

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open http://localhost:8100 in your browser.

## Manual Setup

### Backend

```bash
cd backend
cp .env.example .env   # Edit CLAUDE_WORK_DIR
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8101
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## Configuration

Create a `.env` file in the `backend/` directory:

```env
CLAUDE_WORK_DIR=/path/to/your/project
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,Bash
CLAUDE_MODEL=sonnet
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8101
```

## How It Works

1. The FastAPI backend spawns Claude Code CLI as a subprocess using `--output-format stream-json`
2. WebSocket connection streams real-time JSON events from Claude to the frontend
3. The React frontend parses these events and renders them in a terminal-like interface
4. New prompts are sent from the frontend -> backend -> Claude CLI via `--continue` or `--resume`
