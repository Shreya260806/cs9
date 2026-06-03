#!/bin/bash
set -e

ROOT=$(cd "$(dirname "$0")" && pwd)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting Active Dev Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "▶ Starting backend (port 5000)..."
cd "$ROOT/backend"
PORT=5000 node src/server.js &
BACKEND_PID=$!

echo "    pid: $BACKEND_PID"
echo ""

echo "▶ Starting frontend (port 5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo "    pid: $FRONTEND_PID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Running"
echo "  Backend  → http://localhost:5000"
echo "  Frontend → http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop both."

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
