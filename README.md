# CashRunway API

A 13-week cash-flow early-warning API for Australian sole traders and micro-businesses.
Built as the subject project for SIT223/SIT753 7.3HD — DevOps Pipeline with Jenkins.

## What it does

Takes an opening bank balance, a set of unpaid invoices and a set of recurring expenses,
and projects the bank balance week by week. It reports the first week the balance goes
negative (the "break week") and recommends the two actions that would push that week
furthest out.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe used by Docker and Prometheus |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Create an invoice |
| GET | `/api/expenses` | List expenses |
| POST | `/api/expenses` | Create an expense |
| GET | `/api/forecast?weeks=13` | Week-by-week projection and break week |
| GET | `/api/recommendations` | The two highest-impact actions |

## Technologies

Node.js 20, Express, MySQL 8 (with an in-memory fallback), Jest and Supertest for testing,
ESLint and SonarQube for code quality, npm audit and Trivy for security scanning,
Docker and Docker Compose for build and deployment, Prometheus and Grafana for monitoring,
and Jenkins for orchestration.

## Running locally

```bash
npm install
npm start          # http://localhost:3000
npm test           # 38 tests with coverage
```

Without `DB_HOST` set the API uses an in-memory store seeded with sample data, so it runs
anywhere. Under Docker Compose it connects to MySQL.

## Running the whole stack

```bash
docker build -t cashrunway-api:latest .
IMAGE_TAG=latest  docker compose -f docker-compose.staging.yml up -d    # staging  :3001
RELEASE_TAG=stable docker compose -f docker-compose.prod.yml up -d      # production :3002
docker compose -f docker-compose.monitoring.yml up -d                   # Prometheus :9090, Grafana :3003
```

## Pipeline stages

| Stage | Tooling | What it does |
|---|---|---|
| 1. Build | npm, Docker | Installs dependencies and builds a tagged Docker image, archived as a build artefact |
| 2. Test | Jest, Supertest | Runs 38 unit and integration tests with coverage thresholds and JUnit reporting |
| 3. Code Quality | ESLint, SonarQube | Static analysis for complexity, code smells and maintainability |
| 4. Security | npm audit, Trivy | Scans dependencies and the container image for known vulnerabilities |
| 5. Deploy | Docker Compose | Deploys to a staging environment and waits for the health check to pass |
| 6. Release | Docker tags, Compose | Smoke-tests staging, tags the image and promotes it to production, rolling back on failure |
| 7. Monitoring | Prometheus, Grafana | Scrapes application metrics, loads alert rules and verifies collection |

## Project structure

```
src/
  app.js                     Express application
  server.js                  Entry point
  routes/index.js            HTTP layer
  services/forecastService.js Forecasting logic (pure, heavily tested)
  repositories/store.js      MySQL with in-memory fallback
  middleware/metrics.js      Prometheus instrumentation
tests/
  forecastService.test.js    21 unit tests
  api.test.js                17 integration tests
monitoring/                  Prometheus config, alert rules, Grafana datasource
db/init.sql                  Schema and seed data
Jenkinsfile                  Seven-stage pipeline
```
