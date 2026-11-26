# Calculator App

An old-style pocket calculator with one backend endpoint per operation. Full-stack practice project: **React (Vite + TypeScript)** frontend and **Go (net/http)** backend, both running in Docker. Nothing needs to be installed locally except Docker.

## Run

```bash
cp .env.example .env      # required: defines the host ports
docker compose up -d --build
docker compose ps
```

- Frontend: http://localhost:3000 (hot reload)

The frontend calls the backend through the Vite proxy (`/api` → `http://backend:8080`), so no CORS setup is needed.

## Everyday commands

```bash
docker compose logs -f                 # follow logs
docker compose restart backend         # apply Go code changes
docker compose exec frontend npm install <pkg>   # add a frontend dependency
docker compose down                    # stop everything
```

After adding npm packages, rebuild so the image picks them up: `docker compose up -d --build frontend`.

## Backend API

Every operation has its own endpoint, and the backend does all the math. It is plain Go `net/http` with no dependencies.

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/add` | `{"a": 2, "b": 3}` | a + b |
| POST | `/api/subtract` | `{"a": 2, "b": 3}` | a − b |
| POST | `/api/multiply` | `{"a": 2, "b": 3}` | a × b |
| POST | `/api/divide` | `{"a": 6, "b": 3}` | a ÷ b |
| POST | `/api/power` | `{"a": 2, "b": 10}` | a to the power b |
| POST | `/api/sqrt` | `{"a": 9}` | square root of a |
| POST | `/api/percent` | `{"a": 15}` | a ÷ 100 |

A success is `200 {"result": 5}`. Results are rounded to at most 10 decimal places, and `-0` becomes `0`.

```bash
curl -s -X POST localhost:8080/api/add -H 'Content-Type: application/json' \
  --data '{"a":2,"b":3}'
# 200 {"result":5}

curl -s -X POST localhost:8080/api/divide -H 'Content-Type: application/json' \
  --data '{"a":1,"b":0}'
# 400 {"error":"Can’t divide by zero"}

curl -s -X POST localhost:8080/api/sqrt -H 'Content-Type: application/json' \
  --data '{"a":9}'
# 200 {"result":3}

curl -s -X POST localhost:8080/api/percent -H 'Content-Type: application/json' \
  --data '{"a":15}'
# 200 {"result":0.15}
```

### Errors

Anything the user can fix returns `400 {"error": "..."}`:

| Message | When |
|---|---|
| Can’t divide by zero | `divide` with `b` = 0 |
| Can’t take the square root of a negative number | `sqrt` with `a` < 0 |
| Can’t raise 0 to a negative power | `power` with `a` = 0 and `b` < 0 |
| Result isn’t a real number | for example `power` of a negative base to a fractional power |
| Result is too large to display | the result overflows |
| Enter a number | an operand is missing or `null` |
| Invalid request body | malformed JSON, an empty body, an unknown field, or a body over 1 KiB |

An unknown path is `404`, a wrong method is `405`, and any other failure returns `500 {"error": "Internal server error"}`.

## Backend tests

Everything runs in Docker, so nothing needs to be installed locally.

```bash
docker compose run --rm --no-deps backend gofmt -l .      # must print nothing
docker compose run --rm --no-deps backend go vet ./...
docker compose run --rm --no-deps backend go test -count=1 ./...
```

## Frontend

React + Vite + TypeScript with MUI (UI), Axios (HTTP) and TanStack Query (request state), at http://localhost:3000. It works like an old pocket calculator:

1. Enter a number, press an operator (`+ − × ÷ xʸ`), then enter another number.
2. A second operator or `=` computes the pending operation through the backend, shows the result and waits for the next number. `2 + 3 +` shows 5. Two operators in a row swap the pending operation.
3. `√` and `%` act at once on the number on screen. `%` divides by 100, so `80 × 15 %` shows 0.15 and `=` gives 12.
4. After `=`, a digit starts a new number and an operator continues from the result.
5. `CE` clears the number being entered and keeps the pending operation, `⌫` removes the last digit, and `C` resets everything.

A small line above the display shows the pending operation (`5 +`) or the finished equation (`2 + 3 =`). An error such as dividing by zero shows its message on the display; a digit, `C` or `CE` recovers. If the server can’t be reached (network, timeout of 10 s or a 5xx), a snackbar offers Retry and the calculator keeps its state. The history keeps the last 8 calculations in `localStorage`; clicking one loads its result. Below 900px wide the history is a drawer. The design spec is in [DESIGN.md](DESIGN.md).

Keyboard: `0-9 .`, `+ - * / ^`, `Enter` or `=` (equals), `Backspace` (⌫), `Delete` (CE), `Escape` (C), `r` (√) and `%`.

## Frontend tests

Vitest and Testing Library run in Docker, with the Axios adapter faked, so no backend is needed.

```bash
docker compose run --rm --no-deps frontend npm test
docker compose run --rm --no-deps frontend npm run lint
docker compose run --rm --no-deps frontend npm run format:check   # or: npm run format
docker compose run --rm --no-deps frontend npm run build          # tsc + vite build
```
