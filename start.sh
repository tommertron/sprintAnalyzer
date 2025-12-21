#!/bin/bash

# Sprint Analyzer - First-time setup and startup script
# This script will install all dependencies and start the development servers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}!${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║     Jira Sprint Analyzer Setup        ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

print_step "Checking system requirements..."

# ============================================
# Homebrew (macOS only)
# ============================================
if [[ "$OS" == "macos" ]]; then
    if ! command -v brew &> /dev/null; then
        print_warning "Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        print_success "Homebrew installed"
    else
        print_success "Homebrew found"
    fi
fi

# ============================================
# Python
# ============================================
if ! command -v python3 &> /dev/null; then
    print_warning "Python 3 not found. Installing..."
    if [[ "$OS" == "macos" ]]; then
        brew install python3
    else
        sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv
    fi
    print_success "Python 3 installed"
else
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    print_success "Python 3 found (v$PYTHON_VERSION)"
fi

# ============================================
# Node.js and npm
# ============================================
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing..."
    if [[ "$OS" == "macos" ]]; then
        brew install node
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    print_success "Node.js installed"
else
    NODE_VERSION=$(node --version)
    print_success "Node.js found ($NODE_VERSION)"
fi

if ! command -v npm &> /dev/null; then
    print_error "npm not found even after Node.js installation"
    exit 1
else
    NPM_VERSION=$(npm --version)
    print_success "npm found (v$NPM_VERSION)"
fi

# ============================================
# Backend Setup
# ============================================
print_step "Setting up backend..."

cd "$SCRIPT_DIR/backend"

# Create virtual environment if it doesn't exist
if [[ ! -d "venv" ]]; then
    print_warning "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_success "Virtual environment exists"
fi

# Activate virtual environment
source venv/bin/activate

# Install/update Python dependencies
print_warning "Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q
print_success "Python dependencies installed"

# ============================================
# Frontend Setup
# ============================================
print_step "Setting up frontend..."

cd "$SCRIPT_DIR/frontend"

# Install npm dependencies
if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
    print_warning "Installing npm dependencies..."
    npm install --silent
    print_success "npm dependencies installed"
else
    print_success "npm dependencies up to date"
fi

# ============================================
# Start Development Servers
# ============================================
print_step "Starting development servers..."

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Starting servers...           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Backend:${NC}  http://localhost:5001"
echo -e "  ${BLUE}Frontend:${NC} http://localhost:5173"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    print_step "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    print_success "Servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend server
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
python run.py &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend server
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
