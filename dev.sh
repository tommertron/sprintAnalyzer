#!/bin/bash

# Sprint Analyzer - Development Environment Starter
# Starts both backend (Flask) and frontend (Vite) servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Sprint Analyzer Development Environment${NC}"
echo "================================================"

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if backend venv exists
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    source "$SCRIPT_DIR/backend/venv/bin/activate"
    pip install -r "$SCRIPT_DIR/backend/requirements.txt"
else
    source "$SCRIPT_DIR/backend/venv/bin/activate"
fi

# Check if frontend node_modules exists
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd "$SCRIPT_DIR/frontend"
    npm install
    cd "$SCRIPT_DIR"
fi

# Start backend
echo -e "${GREEN}Starting backend on http://localhost:5001${NC}"
cd "$SCRIPT_DIR/backend"
python run.py &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend on http://localhost:5173${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}Development servers running:${NC}"
echo "  Backend:  http://localhost:5001"
echo "  Frontend: http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for both processes
wait
