# Claude Code Dashboard

A web-based dashboard to interact with and monitor Claude Code CLI sessions from your browser.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐    subprocess    ┌──────────────┐
│   React Frontend │◄──────────────────►│  FastAPI Backend  │◄──────────────►│  Claude Code  │
│   (localhost:5173)│                    │  (localhost:8000) │                │     CLI       │
└─────────────────┘                     └──────────────────┘                └──────────────┘
```

## Features

- 🚀 **Send commands** to Claude Code CLI from the browser
- 📺 **Real-time streaming** of Claude's responses via WebSocket
- 📜 **Session management** - create, resume, and list sessions
- 📁 **File change tracking** - see what files Claude modifies
- 🎨 **Beautiful terminal-style UI** with syntax highlighting

## Prerequisites

- Python 3.10+
- Node.js 18+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Active Claude Pro/Max subscription or API key

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

Create a `.env` file in the `backend/` directory:

```env
# Working directory for Claude Code (your project folder)
CLAUDE_WORK_DIR=/path/to/your/project

# Optional: specify allowed tools
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,Bash

# Optional: specify model
CLAUDE_MODEL=sonnet
```

## How It Works

1. The FastAPI backend spawns Claude Code CLI as a subprocess using `--output-format stream-json`
2. WebSocket connection streams real-time JSON events from Claude to the frontend
3. The React frontend parses these events and renders them in a beautiful terminal-like interface
4. New prompts are sent from the frontend → backend → Claude CLI via `--continue` or `--resume`
