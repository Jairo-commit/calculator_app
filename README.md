# Calculator App

An old-style pocket calculator with one backend endpoint per operation. Full-stack practice project: **React (Vite + TypeScript)** frontend and **Go (net/http)** backend, both running in Docker. Nothing needs to be installed locally except Docker. It started from the design in [DESIGN.md](DESIGN.md); see [Design decisions and assumptions](#design-decisions-and-assumptions).

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
| POST | `/api/add` | `{"firstOperand": 2, "secondOperand": 3}` | firstOperand + secondOperand |
| POST | `/api/subtract` | `{"firstOperand": 2, "secondOperand": 3}` | firstOperand − secondOperand |
| POST | `/api/multiply` | `{"firstOperand": 2, "secondOperand": 3}` | firstOperand × secondOperand |
| POST | `/api/divide` | `{"firstOperand": 6, "secondOperand": 3}` | firstOperand ÷ secondOperand |
| POST | `/api/power` | `{"firstOperand": 2, "secondOperand": 10}` | firstOperand to the power secondOperand |
| POST | `/api/sqrt` | `{"firstOperand": 9}` | square root of firstOperand |
| POST | `/api/percent` | `{"firstOperand": 15}` | firstOperand ÷ 100 |

A success is `200 {"result": 5}`. Results are rounded to at most 10 decimal places and 15 significant digits, so every digit returned is exact (`123456789 ÷ 7` gives `17636684.1428571`), and `-0` becomes `0`. A result must lie between −999,999,999,999,999 and 999,999,999,999,999; a non-zero result that would round to `0` is an error.

```bash
curl -s -X POST localhost:8080/api/add -H 'Content-Type: application/json' \
  --data '{"firstOperand":2,"secondOperand":3}'
# 200 {"result":5}

curl -s -X POST localhost:8080/api/divide -H 'Content-Type: application/json' \
  --data '{"firstOperand":1,"secondOperand":0}'
# 400 {"error":"Can’t divide by zero"}

curl -s -X POST localhost:8080/api/sqrt -H 'Content-Type: application/json' \
  --data '{"firstOperand":9}'
# 200 {"result":3}

curl -s -X POST localhost:8080/api/percent -H 'Content-Type: application/json' \
  --data '{"firstOperand":15}'
# 200 {"result":0.15}
```

### Errors

Anything the user can fix returns `400 {"error": "..."}`:

| Message | When |
|---|---|
| Can’t divide by zero | `divide` with `secondOperand` = 0 |
| Can’t take the square root of a negative number | `sqrt` with `firstOperand` < 0 |
| Can’t raise 0 to a negative power | `power` with `firstOperand` = 0 and `secondOperand` < 0 |
| Result isn’t a real number | for example `power` of a negative base to a fractional power |
| Result is too large to display | the result has more than 15 digits before the decimal point (above 999,999,999,999,999 or below −999,999,999,999,999) |
| Result is too small to display | the result is not zero but rounds to `0` at 10 decimals (closer to zero than 0.00000000005) |
| Enter a number | an operand is missing or `null` |
| Invalid request body | malformed JSON, an empty body, an unknown field, or a body over 1 KiB |

An unknown path is `404`, a wrong method is `405`, and any other failure returns `500 {"error": "Internal server error"}`.

## Backend tests

Everything runs in Docker, so nothing needs to be installed locally.

```bash
docker compose run --rm --no-deps backend gofmt -l .      # must print nothing
docker compose run --rm --no-deps backend go vet ./...
docker compose run --rm --no-deps backend go test -count=1 ./...

# coverage: per-function table in the terminal, HTML report in backend/coverage.html
docker compose run --rm --no-deps backend sh -c 'go test -count=1 -coverpkg=./... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out && go tool cover -html=coverage.out -o coverage.html'
```

`-coverpkg=./...` counts every test toward every package. Without it the HTTP handlers would show 0%, because they are tested through the routes in `main_test.go`, which lives in another package.

## Frontend

React + Vite + TypeScript with MUI (UI), Axios (HTTP) and TanStack Query (request state), at http://localhost:3000. It works like an old pocket calculator:

1. Enter a number, press an operator (`+ − × ÷ xʸ`), then enter another number.
2. A second operator or `=` computes the pending operation through the backend, shows the result and waits for the next number. `2 + 3 +` shows 5. Two operators in a row swap the pending operation.
3. `√` and `%` act at once on the number on screen. `%` divides by 100, so `80 × 15 %` shows 0.15 and `=` gives 12.
4. After `=`, a digit starts a new number and an operator continues from the result.
5. `⌫` removes the last digit, and `C` resets everything.

A small line above the display shows the pending operation (`5 +`) or the finished equation (`2 + 3 =`). An error such as dividing by zero shows its message on the display; a digit or `C` recovers. If the server can’t be reached (network, timeout of 10 s or a 5xx), a snackbar offers Retry and the calculator keeps its state.

Keyboard: `0-9 .`, `+ - * / ^`, `Enter` or `=` (equals), `Backspace` (⌫), `Escape` (C), `r` (√) and `%`.

### Limits and edge cases

The calculator is a 15-digit calculator with 10 decimal places. Every number it shows is exact: when a result would not fit, it shows an error instead of a wrong number. After any error, type a digit to start a new number or press `C` to start over; the calculator never gets stuck.

#### What you can type

| You type | The display shows | Why |
|---|---|---|
| `9999999999999999` (16 nines) | `999999999999999` | At most **15 digits** can be typed. Extra digits are ignored. |
| `0.123456789012345` | `0.1234567890` | At most **10 digits after the decimal point**. The leading `0` counts toward the 15 digits too. |
| `12345678901234.56` | `12345678901234.5` | 14 digits before the point plus 1 after it already makes 15. |
| `0.0000000000001` | `0.0000000000` | The `1` would be the 13th decimal, so it is ignored and the number is zero. |
| `1.2.3` | `1.23` | A second decimal point is ignored. |
| `007` | `7` | Leading zeros are dropped. |
| A negative number | — | There is no minus key for typing a negative number. Get one from a calculation, for example `0 − 5 =` gives `−5`. |

#### How big a result can be

Results go from **−999,999,999,999,999** to **999,999,999,999,999** (15 digits). Past that, the display shows **"Result is too large to display"**.

| You calculate | The display shows | Why |
|---|---|---|
| `999999999999998 + 1 =` | `999,999,999,999,999` | The largest result. |
| `999999999999999 + 1 =` | Result is too large to display | 1,000,000,000,000,000 has 16 digits. |
| `−999999999999999 − 1 =` | Result is too large to display | The limit applies to negative results too. |
| `999999999999999 × 999999999999 =` | Result is too large to display | The answer has 27 digits. |
| `99999999 × 99999999 =` | Result is too large to display | The exact answer, 9,999,999,800,000,001, has 16 digits. |
| `999999999999999 + 0.6 =` | Result is too large to display | 999,999,999,999,999.6 rounds up to 16 digits. |
| `10 xʸ 14 =` | `100,000,000,000,000` | 15 digits fit. |
| `10 xʸ 15 =` | Result is too large to display | 16 digits do not. |

#### Decimals and rounding

Results keep **at most 10 decimals** and **at most 15 significant digits** in total. Anything beyond that is rounded, the same way a pocket calculator rounds `1 ÷ 3`.

| You calculate | The display shows | Why |
|---|---|---|
| `1 ÷ 3 =` | `0.3333333333` | Rounded to 10 decimals. |
| `2 ÷ 3 =` | `0.6666666667` | The 10th decimal rounds up. |
| `2 √` | `1.4142135624` | Rounded to 10 decimals. |
| `123456789 ÷ 7 =` | `17,636,684.1428571` | 8 digits before the point leave room for 7 decimals (15 significant digits). |
| `12345678901234.5 + 0.05 =` | `12,345,678,901,234.6` | 14 digits before the point leave room for 1 decimal. |
| `0.1 + 0.2 =` | `0.3` | No floating-point noise such as 0.30000000000000004. |
| `0.5 × 0.0000000002 =` | `0.0000000001` | The smallest result other than zero. |
| `0.0000000001 ÷ 3 =` | Result is too small to display | 0.0000000000333… is not zero but rounds to 0 at 10 decimals. |
| `0.0000000001 %` | Result is too small to display | `%` divides by 100, giving 0.000000000001. |
| `0.00000001 %` | `0.0000000001` | Still fits in 10 decimals. |
| `0 − 1 = × 0 =` | `0` | −1 × 0 is exactly zero, and it never shows as `−0`. |

#### Math errors

| You calculate | The display shows |
|---|---|
| `1 ÷ 0 =` | Can’t divide by zero |
| `0 − 4 = √` | Can’t take the square root of a negative number |
| `0 − 8 = xʸ 0.5 =`, i.e. −8 to the power 0.5 | Result isn’t a real number |

The backend also answers "Can’t raise 0 to a negative power", for example `0 xʸ −1`. The keypad can't produce it, because a negative number can't be typed as the exponent.

#### When the server can't answer

| What happens | What you see |
|---|---|
| The backend is down, the network fails, it takes more than 10 s, or it returns a 5xx | A snackbar: "Couldn't calculate right now. Your input is kept." with **Retry**. The display keeps what you typed, and Retry sends the same calculation again. |
| A calculation is still waiting for its answer | Every key is disabled and the progress bar runs. Typing on the keyboard is ignored, except `Esc` while the calculator has keyboard focus, which clears it and discards the late answer. |

#### Long numbers on small screens

A result always stays on one line. When it is too wide for the display, for example `−999,999,999,999,999` on a phone, its font shrinks until it fits.

## Frontend tests

Vitest and Testing Library run in Docker. [MSW](https://mswjs.io) answers the `/api` requests at the network level, so no backend is needed. The handlers are in `src/mocks/handlers.ts`, the one server in `src/mocks/node.ts`, and tests override a handler with `server.use()`. Any request without a handler fails the test. MSW needs Node 22.12 or newer, which the frontend image has.

```bash
docker compose run --rm --no-deps frontend npm test
docker compose run --rm --no-deps frontend npm run lint
docker compose run --rm --no-deps frontend npm run format:check   # or: npm run format
docker compose run --rm --no-deps frontend npm run build          # tsc + vite build
docker compose run --rm --no-deps frontend npm run coverage       # table in the terminal, HTML report in frontend/coverage/index.html
```

If `npm run coverage` says `@vitest/coverage-v8` is missing, rebuild the image so it installs the new dev dependency: `docker compose build frontend`.

## Test coverage

Measured with `go test -coverpkg=./...` (backend) and Vitest's V8 coverage (frontend), using the commands above.

| Layer | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Backend (Go) | 96.1% | — | — | — |
| Frontend (React) | 97.4% | 93.8% | 100% | 98.5% |

Go reports statement coverage only. What is not covered, and why:

- **Backend:** `main()`, which only starts the HTTP server, and the one-line `Error()` method of `CalculationError`. The math in `operations/` is at 100%.
- **Frontend:** two guards that throw on states the code can't reach (Retry without a failed request, `=` answered without a pending operation), the snackbar's top position on phones (tests run at desktop width), and a fallback for a non-numeric theme font size. `main.tsx`, which only mounts the app, plus the test helpers and MSW mocks are excluded from the measurement.

## Design decisions and assumptions

### Starting point: DESIGN.md

The project began with [DESIGN.md](DESIGN.md), a one-page design for the whole app: how an old pocket calculator should behave, the keypad, the error rules, one REST endpoint per operation, and a deliberately small code layout (`main.go` with one route per line, `handlers/`, `models/` and `operations/` in Go; `App.tsx`, `components/`, `hooks/`, `lib/` and `api/` in React). Everything else was built on top of that structure and then refined over many iterations, polishing details with AI tooling (Claude Code with my own skills and plugins). The sections below record the decisions made along the way; where they go beyond DESIGN.md, such as the 15-digit limits, the README is the current reference.

### Architecture

- **Two services.** A Go REST API and a React single-page app, each in its own Docker container, started together with `docker compose`. The frontend calls the backend through the Vite proxy (`/api` → `http://backend:8080`), so the browser sees one origin and no CORS setup is needed.
- **The backend does all the math, the frontend none.** Every result, rounding rule and limit lives in `backend/operations/`. The frontend only collects keys, sends one request per operation and shows the answer, so the rules exist in exactly one place.
- **Go standard library only.** `net/http` with Go 1.22+ method-and-path routing (`POST /api/add`) covers everything a seven-endpoint API needs, with no dependencies to keep up to date.

### Backend API

- **One endpoint per operation** (`/api/add`, `/api/sqrt`, …) instead of a single `/api/calculate` with an operator field. Each handler is a one-liner, each route says what it does, and two-operand and one-operand operations validate their own inputs. An earlier version evaluated whole expressions; it was dropped as more code than the assignment needs.
- **Strict input.** Bodies are JSON `{ "firstOperand": …, "secondOperand": … }`, limited to 1 KiB. Unknown fields, malformed JSON or a trailing second object answer "Invalid request body", and a missing or `null` operand answers "Enter a number". Anything the user can fix is a `400 {"error": "…"}` with a message written for the screen; an unexpected failure is a `500` that hides the details.
- **Exact numbers or an error, never a wrong number.** Values are 64-bit floats, which hold about 15–17 significant digits. So every result is rounded to 10 decimals and 15 significant digits, and must lie between −999,999,999,999,999 and 999,999,999,999,999. Outside that, the API answers "Result is too large to display" or "Result is too small to display" instead of a number whose last digits are wrong. Rounding also removes floating-point noise (`0.1 + 0.2` gives `0.3`), and `−0` becomes `0`.

### Frontend

- **A pocket calculator, not an expression field.** You type a number, an operator, then another number, and each operator or `=` sends one request. There is no parser, no precedence rules and no way to type an invalid expression, so input validation comes down to the typing limits (15 digits, 10 decimals, one decimal point).
- **Logic separated from rendering.**
  - `lib/calculatorState.ts` is a pure reducer: given the state and a key, it returns the next state, and `requestFor` decides whether the key needs the backend. It has no React and no network, so it is unit-tested directly.
  - `hooks/useCalculator.ts` owns the state and the side effects: it sends requests with TanStack Query's `useMutation`, turns a `400` into a message on the display and anything else into the Retry snackbar, and drops a late answer after `C`.
  - `App.tsx` wires the hook to the components, which only render their props and call back.
- **One Axios instance** (`api/client.ts`) with the base URL and a 10-second timeout. `callOperation` turns a `400` into an `ApiValidationError`, so the hook can tell a math error from a server that can't be reached.
- **TanStack Query for request state.** It tracks the pending request (keys are disabled meanwhile), keeps the last request for Retry, and `reset()` discards an answer that arrives after `C`.
- **MUI with one custom theme.** `theme.ts` holds every color, font, size and component default (key colors, the `keypad` button size, the monospace display styles), and each component's `.sx.ts` file holds only layout. Restyling the app means editing one file.
- **Responsive by default.** A single centered column up to 560px wide, bigger keys on phones, and a result that shrinks its font to stay on one line.

### Testing

- **Backend:** table-driven unit tests for every operation and limit, plus HTTP tests that send real requests through the router with `httptest`.
- **Frontend:** the reducer is tested on its own, and the whole app is tested as a user would use it (Testing Library clicks and keyboard input). The backend is replaced by [MSW](https://mswjs.io) at the network level, so the real Axios and TanStack Query code runs in the tests.

### Assumptions

- **Immediate execution**, like a pocket calculator: `2 + 3 × 4 =` gives `20`, not `14`.
- **`%` divides the number on screen by 100**, so `80 × 15 % =` gives `12`.
- **No minus key for typing a negative number.** Negative numbers come from results, for example `0 − 5 =`.
- **No history, accounts or saved state.** Every calculation stands alone, and reloading the page starts from `0`.
- **Docker runs development servers** (`go run .` and Vite with hot reload), which suits this exercise. A production deployment would build a static frontend and a compiled Go binary instead.
