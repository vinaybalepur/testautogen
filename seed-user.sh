#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  seed-user.sh — Create a default admin user via the API
#  Run this AFTER ./start.sh has the server up on port 5000
# ─────────────────────────────────────────────────────────────

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# ── Read PORT from .env ───────────────────────────────
PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' | head -1)
PORT=${PORT:-5000}
API="http://localhost:${PORT}/api"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🌱  TestAutoGen — Seed Default User        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Check server is running ───────────────────────────
if ! curl -sf "${API%/api}/health" > /dev/null 2>&1; then
  echo -e "${RED}[ERR]${NC}  Server is not running on port $PORT"
  echo -e "       Start it first: ${BLUE}./start.sh${NC}"
  exit 1
fi
echo -e "${GREEN}[ OK ]${NC}  Server is running on port $PORT"

# ── Default credentials ───────────────────────────────
FIRST_NAME="Admin"
LAST_NAME="User"
EMAIL="admin@testautogen.com"
PASSWORD="Admin@1234"

echo -e "${BLUE}[INFO]${NC}  Creating default admin user..."
echo -e "${BLUE}[INFO]${NC}  Email:    ${EMAIL}"
echo -e "${BLUE}[INFO]${NC}  Password: ${PASSWORD}"
echo ""

# ── Call register API ─────────────────────────────────
RESPONSE=$(curl -s -X POST "${API}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"first_name\": \"${FIRST_NAME}\",
    \"last_name\":  \"${LAST_NAME}\",
    \"email\":      \"${EMAIL}\",
    \"password\":   \"${PASSWORD}\"
  }")

# ── Check result ──────────────────────────────────────
if echo "$RESPONSE" | grep -q '"id"'; then
  ROLE=$(echo "$RESPONSE" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅  Default user created successfully!      ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║  Email    →  ${EMAIL}          ║${NC}"
  echo -e "${GREEN}║  Password →  ${PASSWORD}                  ║${NC}"
  echo -e "${GREEN}║  Role     →  ${ROLE} (first user = admin)    ║${NC}"
  echo -e "${GREEN}║                                              ║${NC}"
  echo -e "${GREEN}║  Login at →  http://localhost:5173/login     ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
elif echo "$RESPONSE" | grep -q "already registered"; then
  echo -e "${GREEN}[ OK ]${NC}  User already exists. Login with:"
  echo -e "        Email:    ${EMAIL}"
  echo -e "        Password: ${PASSWORD}"
else
  echo -e "${RED}[ERR]${NC}  Registration failed. Response:"
  echo "$RESPONSE"
  echo ""
  echo "Make sure the database is set up and the server is running."
fi
echo ""
