# Calculator App

Calculator with a live preview, keypad and history. Full-stack practice project: **React (Vite + TypeScript)** frontend and **Go (net/http)** backend, both running in Docker. Nothing needs to be installed locally except Docker.

## Run

```bash
cp .env.example .env      # required: defines the host ports
docker compose up -d --build
docker compose ps
```

- Frontend: http://localhost:3000 (hot reload)
- Backend health: http://localhost:8080/api/health → `{"status":"ok"}`

The frontend calls the backend through the Vite proxy (`/api` → `http://backend:8080`), so no CORS setup is needed.

## Everyday commands

```bash
docker compose logs -f                 # follow logs
docker compose restart backend         # apply Go code changes
docker compose exec frontend npm install <pkg>   # add a frontend dependency
docker compose down                    # stop everything
```

After adding npm packages, rebuild so the image picks them up: `docker compose up -d --build frontend`.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` |
| POST | `/api/calculate` | Evaluates an expression |

```bash
curl -s -X POST localhost:8080/api/calculate -H 'Content-Type: application/json' \
  --data '{"expression":"√144 + 2 ^ 3 × 50%"}'
# 200 {"expression":"√144 + 2 ^ 3 × 50%","result":16}

curl -s -X POST localhost:8080/api/calculate -H 'Content-Type: application/json' \
  --data '{"expression":"48 ÷ 0"}'
# 400 {"error":"Can’t divide by zero"}
```

Errors the user can fix (bad expression, expression over 200 characters, malformed or oversized body) return `400 {"error": "..."}`. Anything else returns `500 {"error": "Internal server error"}`.

## Math rules

Operations `+ − × ÷ ^ √ %` (ASCII `+ - * / sqrt` also work), parentheses, and decimals. `%` is a postfix that divides by 100, `^` is right-associative, and results are rounded to at most 10 decimal places and 15 significant digits, half away from zero, using the same decimal-string rounding in both engines. The full rules, precedence and error messages are in [DESIGN.md](DESIGN.md) section 9.

The engine exists twice: `backend/calc/calc.go` (the real calculation) and `frontend/src/lib/calculator.ts` (live preview and validation). Both are tested against the same fixture, `backend/calc/testdata/cases.json`, which holds the error-message catalog and every example expression, so their rules and messages cannot drift apart. One known limit: Go's `math.Pow` and JavaScript's `Math.pow` can differ in the last bit, so for about 2% of `^` results the live preview can differ from the final result in the 15th significant digit. The value shown after `=` always comes from the backend. The frontend container mounts it read-only.

## Tests, lint and format

Everything runs in Docker, so nothing needs to be installed locally.

```bash
# Backend
docker compose run --rm backend gofmt -l .      # must print nothing
docker compose run --rm backend go vet ./...
docker compose run --rm backend go test ./...

# Frontend
docker compose run --rm --no-deps frontend npm test
docker compose run --rm --no-deps frontend npm run lint
docker compose run --rm --no-deps frontend npm run format:check   # or: npm run format
docker compose run --rm --no-deps frontend npm run build          # tsc + vite build
```

To run the frontend tools directly on your machine, you need Node 22.12 or newer (Vite 8, vitest and eslint 10 require it).
