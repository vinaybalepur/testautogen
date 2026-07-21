#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  stop.sh — Stop TestAutoGen local processes
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     TestAutoGen — Stopping               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

kill_pid_file() {
  local name=$1
  local pidfile="$PID_DIR/$2.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && success "Stopped $name (PID: $pid)"
    else
      warn "$name was not running"
    fi
    rm -f "$pidfile"
  else
    warn "No PID file for $name"
  fi
}

# Kill by PID file
kill_pid_file "Backend server" "server"
kill_pid_file "Frontend (Vite)" "client"

# Also kill anything leftover on these ports
for port in 5000 5173; do
  pid=$(lsof -ti:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null && warn "Force-killed stray process on port $port (PID: $pid)"
  fi
done

echo ""
echo -e "${GREEN}✅  All TestAutoGen processes stopped.${NC}"
echo ""
