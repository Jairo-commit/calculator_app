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
```

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
```
