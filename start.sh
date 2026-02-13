#!/bin/bash
set -e

echo "═══════════════════════════════════════════════"
echo "  Claude Code Dashboard - Quick Start"
echo "═══════════════════════════════════════════════"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi
echo "✅ Python3 found"

if ! command -v uv &> /dev/null; then
    echo "❌ uv not found. Please install uv: https://docs.astral.sh/uv/"
    exit 1
fi
echo "✅ uv found"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ Node.js found"

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Install with: npm install -g pnpm"
    exit 1
fi
echo "✅ pnpm found"

if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI not found."
    echo "   Install with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi
echo "✅ Claude Code CLI found"

# Setup backend
echo ""
echo "Setting up backend..."
cd backend

if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env from .env.example - please edit CLAUDE_WORK_DIR"
fi

uv sync --quiet
echo "✅ Backend dependencies installed"

# Start backend in background
echo "🚀 Starting backend on :8101..."
uv run uvicorn app.main:app --host 0.0.0.0 --port 8101 &
BACKEND_PID=$!

cd ..

# Setup frontend
echo ""
echo "Setting up frontend..."
cd frontend
pnpm install --silent 2>/dev/null
echo "✅ Frontend dependencies installed"

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT

# Start frontend
echo "🚀 Starting frontend on :8100..."
echo ""
echo "═══════════════════════════════════════════════"
echo "  Open http://localhost:8100 in your browser"
echo "═══════════════════════════════════════════════"
echo ""
pnpm dev
