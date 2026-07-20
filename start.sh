#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  start.sh — One command to start the entire TestAutoGen app
#  Usage: ./start.sh
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
ENV_FILE="$ROOT_DIR/.env"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"

# ── Colors ────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[ OK ]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERR ]${NC}  $1"; exit 1; }
step()    { echo -e "\n${CYAN}▶  $1${NC}"; }

# ── Cleanup on Ctrl+C ─────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down..."
  [ -f "$PID_DIR/server.pid" ] && kill "$(cat "$PID_DIR/server.pid")" 2>/dev/null
  [ -f "$PID_DIR/client.pid" ] && kill "$(cat "$PID_DIR/client.pid")" 2>/dev/null
  # Kill anything on the ports too
  lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✅  Stopped. Goodbye!${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀  TestAutoGen — Starting Application     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Load nvm ──────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install via: nvm install 18"
fi
success "Node.js $(node -v) found"

# ── Add PostgreSQL 15 (EDB) to PATH ───────────────────
export PATH="/Library/PostgreSQL/15/bin:/usr/local/bin:$PATH"

# ── Check .env ────────────────────────────────────────
step "Checking configuration"
[ ! -f "$ENV_FILE" ] && error ".env not found. Copy .env.example and fill in your values."
success ".env file found"

# ── Parse .env values ─────────────────────────────────
get_env() { grep -E "^${1}=" "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]"' | head -1; }

PORT=$(get_env PORT); PORT=${PORT:-5000}
DB_USER=$(get_env DB_USER)
DB_PASSWORD=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)
DB_PORT=$(get_env DB_PORT); DB_PORT=${DB_PORT:-5432}

# Always use localhost for local dev (not Docker hostname)
LOCAL_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
log "Database → localhost:${DB_PORT}/${DB_NAME}"
log "Backend  → http://localhost:${PORT}"
log "Frontend → http://localhost:5173"

# ── Check PostgreSQL ──────────────────────────────────
step "Checking PostgreSQL"
if ! pg_isready -h localhost -p "$DB_PORT" -q 2>/dev/null; then
  warn "PostgreSQL not running — attempting to start..."
  # EDB installer (most common on Mac without Homebrew)
  if [ -f "/Library/PostgreSQL/15/bin/pg_ctl" ]; then
    sudo -u postgres /Library/PostgreSQL/15/bin/pg_ctl start \
      -D /Library/PostgreSQL/15/data -l /tmp/pg.log 2>/dev/null || true
  fi
  # Homebrew fallback
  brew services start postgresql@16 2>/dev/null \
    || brew services start postgresql@15 2>/dev/null \
    || brew services start postgresql 2>/dev/null \
    || true
  sleep 3
  if ! pg_isready -h localhost -p "$DB_PORT" -q 2>/dev/null; then
    error "PostgreSQL still not running.\nStart it manually from: /Applications/PostgreSQL\\ 15/pgAdmin\\ 4.app\nor run: sudo -u postgres /Library/PostgreSQL/15/bin/pg_ctl start -D /Library/PostgreSQL/15/data"
  fi
fi
success "PostgreSQL is running"

# ── Ensure database exists and schema is applied ──────
step "Checking database"
export PGPASSWORD="$DB_PASSWORD"
DB_EXISTS=$(psql -h localhost -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null \
  | cut -d'|' -f1 | grep -w "$DB_NAME" | wc -l | tr -d ' ')

if [ "$DB_EXISTS" = "0" ]; then
  log "Creating database '$DB_NAME'..."
  PGPASSWORD="$DB_PASSWORD" createdb -h localhost -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
    || PGPASSWORD="$DB_PASSWORD" psql -h localhost -p "$DB_PORT" -U "$DB_USER" \
       -c "CREATE DATABASE \"${DB_NAME}\";" 2>/dev/null \
    || error "Could not create database '$DB_NAME'.\nRun manually:\n  createdb -h localhost -U $DB_USER $DB_NAME"
  success "Database '$DB_NAME' created"
  log "Applying schema (init.sql)..."
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -p "$DB_PORT" -U "$DB_USER" \
       -d "$DB_NAME" -f "$ROOT_DIR/init.sql" > /dev/null 2>&1 \
    && success "Schema applied" \
    || warn "Schema may already be applied (safe to ignore)"
else
  success "Database '$DB_NAME' exists"
fi
unset PGPASSWORD

# ── Install dependencies ──────────────────────────────
step "Checking dependencies"
mkdir -p "$PID_DIR" "$LOG_DIR"

if [ ! -f "$SERVER_DIR/node_modules/.bin/nodemon" ]; then
  log "Installing server dependencies (first time — takes ~1 min)..."
  (cd "$SERVER_DIR" && npm install --silent) || error "Server npm install failed"
  success "Server dependencies installed"
else
  success "Server dependencies ready"
fi

if [ ! -f "$CLIENT_DIR/node_modules/.bin/vite" ]; then
  log "Installing client dependencies (first time — takes ~1 min)..."
  (cd "$CLIENT_DIR" && npm install --silent) || error "Client npm install failed"
  success "Client dependencies installed"
else
  success "Client dependencies ready"
fi

# ── Kill anything on our ports ────────────────────────
for p in "$PORT" 5173; do
  existing=$(lsof -ti:"$p" 2>/dev/null)
  if [ -n "$existing" ]; then
    warn "Port $p already in use — killing PID $existing"
    kill -9 $existing 2>/dev/null || true
    sleep 1
  fi
done

# ── Start backend ─────────────────────────────────────
step "Starting backend server"
(
  set -a
  source "$ENV_FILE"
  set +a
  # Override Docker-specific values with local ones
  export DATABASE_URL="$LOCAL_DB_URL"
  export NODE_ENV="development"
  export PORT="$PORT"
  cd "$SERVER_DIR"
  npm run dev 2>&1
) >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_DIR/server.pid"

# Wait for backend health check
log "Waiting for backend to be ready..."
READY=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    READY=1; break
  fi
  # Check if process died
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo ""
    error "Backend process crashed. Check logs:\n  cat .logs/server.log"
  fi
  printf "."
  sleep 1
done
echo ""

if [ $READY -eq 0 ]; then
  warn "Backend not responding after 30s. Check: cat .logs/server.log"
  tail -20 "$LOG_DIR/server.log"
  error "Backend failed to start"
fi
success "Backend is up → http://localhost:${PORT}"

# ── Start frontend ────────────────────────────────────
step "Starting frontend"
(
  cd "$CLIENT_DIR"
  npm run dev 2>&1
) >> "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID=$!
echo $CLIENT_PID > "$PID_DIR/client.pid"

# Wait for Vite to start
sleep 3
if ! kill -0 $CLIENT_PID 2>/dev/null; then
  error "Frontend failed to start. Check: cat .logs/client.log"
fi
success "Frontend is up → http://localhost:5173"

# ── All systems go ────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  TestAutoGen is fully running!           ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  🌐  App       →  http://localhost:5173      ║${NC}"
echo -e "${GREEN}║  ⚙️   Backend   →  http://localhost:${PORT}       ║${NC}"
echo -e "${GREEN}║  💚  Health    →  http://localhost:${PORT}/health ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  📋  Logs:                                   ║${NC}"
echo -e "${GREEN}║      tail -f .logs/server.log                ║${NC}"
echo -e "${GREEN}║      tail -f .logs/client.log                ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  🛑  Press Ctrl+C to stop everything         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Tail both logs live so you can see output ─────────
echo -e "${CYAN}── Live logs (Ctrl+C to stop) ──────────────────${NC}"
tail -f "$LOG_DIR/server.log" "$LOG_DIR/client.log" &
TAIL_PID=$!

# Keep script alive — wait for Ctrl+C
wait $SERVER_PID $CLIENT_PID 2>/dev/null
