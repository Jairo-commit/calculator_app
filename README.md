# Calculator App

A full-stack calculator that works like an old pocket calculator: a **React + TypeScript** frontend and a **Go** REST backend that does all the math. It started from the design in [DESIGN.md](DESIGN.md).

## Setup

The only requirement is [Docker](https://docs.docker.com/get-docker/) with Docker Compose. Nothing else needs to be installed locally.

```bash
git clone git@github.com:Jairo-commit/calculator_app.git
cd calculator_app
cp .env.example .env      # defines the host ports (3000 and 8080)
```

## Running the frontend and backend

```bash
docker compose up -d --build   # start both services
docker compose logs -f         # follow logs
docker compose down            # stop everything
```

- **Frontend:** http://localhost:3000 (Vite dev server with hot reload)
- **Backend:** http://localhost:8080 (`go run .`; apply Go changes with `docker compose restart backend`)

The frontend reaches the backend through the Vite proxy (`/api` → `http://backend:8080`), so the browser sees one origin and no CORS setup is needed.

**Using the calculator:** enter a number, an operator (`+ − × ÷ xʸ`), another number, then `=` or another operator. `√` and `%` act at once on the number on screen, `⌫` deletes a digit and `C` clears. The keyboard works too: `0-9 .`, `+ - * / ^`, `Enter`, `Backspace`, `Escape`, `r` (√) and `%`.

## API

One `POST` endpoint per operation. The body is JSON, and `secondOperand` is omitted for `sqrt` and `percent`.

| Path | Body | Result |
|---|---|---|
| `/api/add` | `{"firstOperand": 2, "secondOperand": 3}` | `{"result": 5}` |
| `/api/subtract` | `{"firstOperand": 2, "secondOperand": 3}` | `{"result": -1}` |
| `/api/multiply` | `{"firstOperand": 2, "secondOperand": 3}` | `{"result": 6}` |
| `/api/divide` | `{"firstOperand": 6, "secondOperand": 3}` | `{"result": 2}` |
| `/api/power` | `{"firstOperand": 2, "secondOperand": 10}` | `{"result": 1024}` |
| `/api/sqrt` | `{"firstOperand": 9}` | `{"result": 3}` |
| `/api/percent` | `{"firstOperand": 15}` | `{"result": 0.15}` |

```bash
curl -s -X POST localhost:8080/api/add -H 'Content-Type: application/json' \
  --data '{"firstOperand":2,"secondOperand":3}'
# 200 {"result":5}

curl -s -X POST localhost:8080/api/divide -H 'Content-Type: application/json' \
  --data '{"firstOperand":1,"secondOperand":0}'
# 400 {"error":"Can’t divide by zero"}
```

Anything the user can fix returns `400 {"error": "..."}` with a message ready for the screen:

| Message | When |
|---|---|
| Can’t divide by zero | `divide` with `secondOperand` = 0 |
| Can’t take the square root of a negative number | `sqrt` with `firstOperand` < 0 |
| Can’t raise 0 to a negative power | `power` with base 0 and a negative exponent |
| Result isn’t a real number | e.g. a negative base to a fractional power |
| Result is too large / too small to display | outside ±999,999,999,999,999, or non-zero but rounds to 0 at 10 decimals |
| Enter a number | an operand is missing or `null` |
| Invalid request body | malformed JSON, empty body, unknown field, or body over 1 KiB |

An unknown path is `404`, a wrong method `405`, and any other failure `500 {"error": "Internal server error"}`.

## Tests and coverage

```bash
docker compose run --rm --no-deps backend go test -count=1 ./...
docker compose run --rm --no-deps backend sh -c 'go test -count=1 -coverpkg=./... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out && go tool cover -html=coverage.out -o coverage.html'

docker compose run --rm --no-deps frontend npm test
docker compose run --rm --no-deps frontend npm run coverage
docker compose run --rm --no-deps frontend npm run lint    # also: format:check, build
```

| Layer | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Backend (Go) | 96.1% | — | — | — |
| Frontend (React) | 97.4% | 93.8% | 100% | 98.5% |

The coverage commands write HTML reports to `backend/coverage.html` and `frontend/coverage/index.html` (not committed). Open them from the repository root:

```bash
xdg-open backend/coverage.html; xdg-open frontend/coverage/index.html     # Linux
open backend/coverage.html; open frontend/coverage/index.html             # macOS
explorer.exe "$(wslpath -w backend/coverage.html)"                        # WSL, one file per call
```

`-coverpkg=./...` counts the route tests in `main_test.go` toward the handlers package. Not covered: `main()`, which only starts the server, and a few guards for states the UI can't reach. The container writes `frontend/coverage/` as root, so deleting it needs `sudo`.

## Prompts

The prompt used to build this project was to follow [DESIGN.md](DESIGN.md), the one-page design for the whole app, with Claude Code. The result was then refined over several iterations.

## Design decisions

- **The backend does all the math, the frontend none.** Every result, rounding rule and limit lives in `backend/operations/`, so the rules exist in one place.
- **One endpoint per operation** instead of one `/api/calculate` with an operator field. Each route says what it does, and one- and two-operand operations validate their own input.
- **Go standard library only.** `net/http` with Go 1.22+ routing (`POST /api/add`) is enough for seven endpoints, with no dependencies to maintain.
- **Exact numbers or an error, never a wrong number.** Results are rounded to 10 decimals and 15 significant digits, the most a 64-bit float holds exactly, and must fit in 15 digits. This also removes floating-point noise (`0.1 + 0.2` gives `0.3`) and turns `-0` into `0`.
- **A pocket calculator, not an expression field.** There is no parser and no way to type an invalid expression, so frontend validation is just typing limits: 15 digits, 10 decimals, one decimal point.
- **Logic separated from rendering.** `lib/calculatorReducer.ts` is a pure reducer tested on its own, `hooks/useCalculator.ts` owns side effects (TanStack Query for pending state, Retry and dropping late answers), and the components only render props. Shared types live in `models/`, mirroring the backend.
- **Errors split by cause.** A `400` shows its message on the display; a network failure, a 10 s timeout or a 5xx shows a Retry snackbar and keeps the input.
- **MUI with one theme.** `theme.ts` holds every color, font and size; each component's `.sx.ts` file holds only layout. The layout is one centered column with bigger keys on phones, and long results shrink to stay on one line.
- **Tests at the right level.** Table-driven Go tests per operation plus HTTP tests through the real router with `httptest`. On the frontend, the app is tested as a user uses it with Testing Library, and [MSW](https://mswjs.io) replaces the backend at the network level so the real Axios and TanStack Query code runs.

## Assumptions

- **Immediate execution**, like a pocket calculator: `2 + 3 × 4 =` gives `20`, not `14`.
- **`%` divides the number on screen by 100**, so `80 × 15 % =` gives `12`.
- **No minus key**; negative numbers come from results, e.g. `0 − 5 =`.
- **No history or saved state**; reloading the page starts from `0`.
