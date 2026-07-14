# 🤖 Jira Test Automation Platform

An AI-powered platform that generates BDD test cases from Jira requirements, creates Postman collections, runs automated tests and manages defects — all in one place.

---

## What It Does

```
Jira Ticket → AI BDD Test Cases → Review & Approve →
Postman Collection → Run Tests → HTML Report → Jira Defects
```

---

## Tech Stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL
- **AI Providers:** GitHub Copilot, Google Gemini, Anthropic Claude
- **Test Runner:** Newman (Postman CLI)
- **Infrastructure:** Docker + Docker Compose

---

## Prerequisites

- Docker and Docker Compose
- Jira Cloud account with API token
- At least one AI provider API key (Copilot, Gemini or Claude)

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/jira-testautogen.git
cd jira-testautogen
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
DB_USER=admin
DB_PASSWORD=your_db_password
DB_NAME=postgres
DB_PORT=5432
DATABASE_URL=postgresql://admin:your_db_password@db:5432/postgres

# Server
PORT=5000
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=production

# Jira
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_TEST_PROJECT_KEY=TEST

# AI Providers
GITHUB_TOKEN=your_github_oauth_token
COPILOT_MODEL=gpt-4o
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Newman
NEWMAN_TIMEOUT_MS=180000
REPORT_RETENTION_DAYS=60
```

---

## Deployment

### Start

```bash
docker compose up --build -d
```

### Stop

```bash
docker compose down
```

### Reset (clears all data)

```bash
docker compose down -v
```

### View Logs

```bash
docker compose logs -f server
```

---

## First Time Setup

The first user to register is automatically assigned the **admin** role:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name":  "Doe",
    "email":      "john@company.com",
    "password":   "yourpassword"
  }'
```

---

## Health Check

```bash
curl http://localhost:5000/health
```