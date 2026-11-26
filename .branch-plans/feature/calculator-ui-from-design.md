# Plan: simplify to an old-style calculator with one endpoint per operation

## Context
PR #1 built an expression calculator: it parses expressions like `(12 + 8) × 3` with parentheses and precedence, using two engines (Go and TS) that share a fixture. You want something much simpler: an **old pocket calculator**.
- The user enters one number, an operator, then another number.
- Pressing a second operator (or `=`) computes the pending operation through the backend, shows the result and waits for the next number.
- Pressing two operators in a row just swaps the pending operation.
- The backend exposes **one endpoint per operation**. The frontend does no math.

This removes the expression engine (about 1,000 lines in Go and TS), the shared fixture, and every Go/JS parity problem the reviews kept finding.

## Your decisions
- **Operations:** `+ − × ÷ xʸ` are binary. `√` and `%` are unary and act immediately on the number on screen: `9 √` → 3; `%` divides by 100, so `80 × 15 %` → 0.15, and then `=` gives 12.
- **Endpoints:** `POST /api/<op>` with a JSON body:
  - binary: `{"a": 2, "b": 3}`
  - unary: `{"a": 9}`
  - response: `200 {"result": 5}` or `400 {"error": "…"}`
- **Keep:** history panel (localStorage and the mobile drawer), physical keyboard input, a small pending-operation line above the display, and the offline snackbar with Retry.
- **Extras:** `⌫` backspace and `CE` (clear entry). There's no `±` key and no repeat on `=`.
- **PR split:** a new **backend PR** from `main`. PR #1 becomes the **frontend PR**, stacked on the backend PR's branch. The README is split by section.

## Backend (new branch `feature/calculator-backend` from `main`, new PR)

**`backend/calc/calc.go`**: rewrite as a small operations package, and delete the tokenizer, validator and parser.
- Add `type Code string` with one constant per error. This applies final review comment 3.
- Errors:
  - `DIV_ZERO`: "Can’t divide by zero"
  - `SQRT_NEGATIVE`: "Can’t take the square root of a negative number"
  - `ZERO_NEG_POWER`: "Can’t raise 0 to a negative power"
  - `NOT_REAL`: "Result isn’t a real number"
  - `TOO_LARGE`: "Result is too large to display"

  The copy is reused from today's `Messages`.
- `Error` has `Code` and `Message` but no `Pos`. This applies comment 4.
- Functions: `Add`, `Subtract`, `Multiply`, `Divide`, `Power(a, b)`, `Sqrt(a)` and `Percent(a)` (a/100).
- Every function goes through a `finish(x)` step:
  - NaN → `NOT_REAL`
  - ±Inf → `TOO_LARGE`
  - otherwise **reuse the existing `round10`** as is (10 decimals and 15 significant digits), then turn `-0` into `0`
- Expose `Binary map[string]func(a, b float64) (float64, error)` (`add`, `subtract`, `multiply`, `divide`, `power`) and `Unary map[string]func(a float64) (float64, error)` (`sqrt`, `percent`).

**`backend/calc/calc_test.go`**:
- Table tests per operation:
  - basic results: `2+3=5`, `0.1+0.2=0.3`
  - every error code
  - `-0` normalisation
- Keep the existing `TestRound10` cases.
- `testdata/cases.json` is no longer needed. It was never on `main`, so it simply isn't added.

**`backend/handler.go`**:
- Keep `observe` (one wide log line per request), `writeJSON` and `writeError`, including the uncommitted step 1 fixes for review comments 1 and 2 (strict type assertion, and the `err` field logged at ERROR).
- Register the routes in a loop: `POST /api/{name}` for each entry in `calc.Binary` and `calc.Unary`.
- Request decoding:
  - binary requests decode `{"a": *float64, "b": *float64}`
  - unary requests decode `{"a": *float64}`
  - a missing operand → 400 "Enter a number"
  - malformed JSON, an unknown field (`DisallowUnknownFields`) or a body over 1 KiB → 400 "Invalid request body"
  - a `*calc.Error` → 400 with its message
  - any other error → 500
- The log event replaces `expr_len` with an `op` field.
- Keep `GET /api/health`.

**`backend/handler_test.go`**: rewrite for the new routes. Cover:
- 200 for each op
- 400 for divide by zero, a missing `b`, an unknown op path (404 from the mux), and a bad body
- 405 on GET
- 500 and panic, each producing a single log line (the step 1 test, kept)
- one log line per request that includes `op`

**`backend/main.go`**: change `newHandler(calc.Evaluate)` to `newHandler()`, because the ops come from the `calc` maps. Keep a test seam: `newHandler(binary, unary)` takes the maps, so tests can inject a failing or panicking op.

**`README.md`** (backend PR part): an API section with the seven endpoints, their request and response bodies, curl examples, the error messages and the Go test commands.

## Frontend (PR #1, retargeted onto the backend branch)

**State machine** in `frontend/src/hooks/useCalculator.ts`, rewritten as a reducer.

State:
- `display`: the string shown
- `stored: number | null`: the accumulator
- `pendingOp: BinaryOp | null`
- `entry: "typing" | "result"`
- `operandReady`: whether the second operand has been entered since the operator
- `error: string | null`
- `loading`, `serverErrorOpen`, `lastRequest` (for Retry) and `history`

Key behaviour:
- **Digit or `.`**
  - If `entry === "result"` or there is an error, start a new number. Otherwise append.
  - Allow one `.`, cap the entry at 15 digits, and avoid leading zeros.
  - Set `operandReady = true`.
- **Binary op (+ − × ÷ xʸ)**
  - If `pendingOp` is set and `operandReady`: call `pendingOp(stored, display)`. On success, show the result, set `stored = result` and `pendingOp = new op`, set `entry = result`, and add history entry `a op b = r`.
  - Else if `pendingOp` is set (**two signs in a row**): only replace `pendingOp`.
  - Else: `stored = Number(display)`, `pendingOp = op`, `entry = result`, `operandReady = false`.
- **`=`**
  - If `pendingOp` is set and `operandReady`: compute, show the result, add a history entry, set `stored = null` and `pendingOp = null`, and set `entry = result`.
  - Otherwise do nothing.
  - After `=`, a digit starts fresh and an operator continues from the result.
- **`√` / `%`**: call the unary endpoint on `display`, show the result, set `entry = result` and `operandReady = true`. This means `2 + 9 √ =` gives 5 and `80 × 15 % =` gives 12. Add a history entry (`√9 = 3`, `15% = 0.15`).
- **`CE`**: `display = "0"` and `operandReady = false`. Keep `stored` and `pendingOp`, and clear the error.
- **`⌫`**: only while typing. Remove the last character, falling back to `"0"`.
- **`C`**: reset everything.
- **400 error** (e.g. ÷0): the display shows the message in the error colour, and `stored` and `pendingOp` are cleared. Only a digit, `C` or `CE` work next.
- **Network, 5xx or timeout**: open the snackbar and leave the state unchanged. Retry re-sends `lastRequest` and applies the result as if it had just succeeded.
- **While loading**: every key except `C` is ignored, a `LinearProgress` shows, and `=` is disabled.
- **Pending line**: shows `5 +` while an operator is pending, `2 + 3 =` after equals, or nothing.

**Files**
- `frontend/src/api/calculate.ts`: replace `calculateRemote` with `callOperation(op, operands)`, which POSTs to `/api/${op}`. **Reuse the existing timeout, abort and error mapping** (`ApiValidationError`, `ServerUnavailableError`, the 10 s timeout). Update `calculate.test.ts` to match.
- `frontend/src/lib/calculator.ts`: rewrite to hold only:
  - `KEYPAD`, with `KeyDef.id` typed as a union of key ids (applies comment 5)
  - `BinaryOp`, `UnaryOp`
  - op symbols
  - `formatResult` (kept as is)
  The engine and its tests go. `calculator.test.ts` becomes `KEYPAD` and `formatResult` tests.
- New keypad layout (4 columns, `=` spans 2 rows):
  ```
  C   CE  ⌫   ÷
  √   xʸ  %   ×
  7   8   9   −
  4   5   6   +
  1   2   3   =
  0 (span 2)  .   =
  ```
  `Keypad.tsx` and `KeypadButton.tsx` gain `gridRow` span support, and the key kinds and colours stay (`num`, `op`, `fn`, `util`, `clear`, `equals`).
- `frontend/src/components/CalculatorPanel.tsx`:
  - Remove the expression `TextField`.
  - Show the pending line and the display (reworked `ResultDisplay.tsx`): a large right-aligned mono value, plus a small pending line above it in the secondary colour.
  - The display is `aria-live="polite"`; the error state uses the error colour.
- **Physical keyboard**: an `onKeyDown` on the calculator Paper (`tabIndex=0`, focused on mount).
  - Key mapping:
    - `0-9` and `.`
    - `+ - * /` and `^`
    - `Enter` or `=` → `=`
    - `Backspace` → ⌫
    - `Delete` → CE
    - `Escape` → C
    - `r` → √
    - `%` → %
  - If Enter or Space comes from a focused `<button>`, it's skipped so the key isn't pressed twice.
- `HistoryPanel.tsx` and `history.ts` stay. Entries become `{expr: "2 + 3", result: 5}`, and clicking one loads its **result** into the display as a fresh number.
- `ErrorSnackbar.tsx` stays. `App.tsx` stays, apart from the wiring; pass `calc.retry` directly (applies comment 6).
- `theme.ts`, `main.tsx` and `test/setup.ts` stay.
- Remove the frontend's read-only fixture mount from `docker-compose.yml`, and drop `resolveJsonModule` from `tsconfig.json`. The frontend no longer reads backend files, so the two PRs have no test dependency on each other. The stack only fixes the merge order.
- `README.md` (frontend part): how the calculator works, keyboard shortcuts, and the frontend test commands.
- `DESIGN.md`: update §1, §2, §4–§9 and §12 to the old-calculator behaviour, so the spec matches the code.
- `.branch-plans/feature/calculator-ui-from-design.md`: replace it with this plan.

**Tests**
- `useCalculator.test.tsx`: reducer and hook tests with `fetch` stubbed per endpoint:
  - `2 + 3 =` → 5, with one call to `/api/add` carrying `{a: 2, b: 3}`
  - `2 + 3 ×` → shows 5, pending `5 ×`
  - `2 + ×` → no request, pending `2 ×`
  - after `=`, a digit starts fresh and an operator continues
  - `9 √`
  - `80 × 15 % =` → 12
  - CE keeps the pending op, ⌫, C
  - ÷0 → error message shown, then a digit recovers
  - network failure → snackbar, state kept, Retry succeeds
  - keys ignored while loading
  - history capped at 8
- `App.test.tsx`: keypad clicks and physical keyboard, the pending line, the history drawer at 390px, and the snackbar.

## Git and PR mechanics
1. Stash nothing. Create `feature/calculator-backend` from `main`, then check out the final backend files: rewritten `calc.go`, `calc_test.go`, `handler.go`, `handler_test.go`, `main.go`, and the backend README section. Commit, push, and open a draft PR into `main` (about 6 files).
2. On `feature/calculator-ui-from-design`, merge `feature/calculator-backend` (a merge commit, no force-push), remove `backend/calc/testdata/cases.json` and the old engine code, then do the frontend rewrite. Commit and push.
3. Retarget PR #1's base to `feature/calculator-backend` with `gh api -X PATCH …/pulls/1 -f base=…`, because `gh pr edit` hits the Projects error. Update its title and body to "frontend". Its diff should then show only frontend, compose, DESIGN, README-frontend and plan files, about 25.
4. The unsubmitted draft review on #1 stays as is. All six of its comments are covered by the rewrite (see above).
5. Run the internal review rounds and the final review per the implement workflow for each PR.

## Verification
- Backend: `docker compose run --rm --no-deps backend sh -c 'test -z "$(gofmt -l .)" && go vet ./... && go test -count=1 ./...'`
- Frontend: `docker compose run --rm --no-deps frontend sh -c 'npm test && npm run lint && npm run format:check && npm run build'` (after `docker compose build frontend`)
- Live: `docker compose up -d --build`, then:
  - `curl -s -X POST localhost:8080/api/add -H 'Content-Type: application/json' -d '{"a":2,"b":3}'` → `{"result":5}`
  - `/api/divide` with `{"a":1,"b":0}` → 400 "Can’t divide by zero"
  - `/api/sqrt` with `{"a":9}` → 3
- In the browser at http://localhost:3000:
  - `2 + 3 +` shows 5
  - `+ −` swaps the operator
  - `=` works, and so do keyboard input, CE and ⌫
  - with `docker compose stop backend`, `=` shows the snackbar, the input is kept, and Retry works once the backend is restarted
  - at 390px: single column, history drawer, no horizontal scroll
- Check each PR's file count with `git diff --name-only <base>...HEAD | wc -l`; each must be ≤ 40.

## Follow-up step (user decision): Axios + TanStack Query
Apply after the rewrite, on the frontend PR only.
- Add `axios@^1.21.1` and `@tanstack/react-query@^5.108.4` as dependencies. Install inside the container, then run `docker compose build frontend`.
- `frontend/src/api/calculate.ts`:
  - Use one axios instance: `axios.create({ baseURL: '/api', timeout: 10_000, adapter: 'fetch' })`. The fetch adapter keeps the `fetch` test stubs working.
  - `callOperation(op, operands)` calls `api.post(`/${op}`, operands)` and returns `data.result`.
  - Map errors with `axios.isAxiosError`:
    - 400 with `{error}` → `ApiValidationError`
    - `ECONNABORTED` or `ETIMEDOUT` → `ServerUnavailableError('timeout')`
    - no response → `'network'`
    - 5xx or a bad body → `'server'`
  - Remove the hand-written timer and AbortController plumbing.
- `frontend/src/main.tsx`: wrap the app in `QueryClientProvider`, with a `QueryClient` whose mutations default to `retry: false`.
- `frontend/src/hooks/useCalculator.ts`:
  - Use one `useMutation({ mutationFn: callOperation })` for operation calls.
  - The reducer keeps only calculator state (display, stored, pendingOp, entry, operandReady, error, history).
  - Drop the request state from the reducer: `loading` comes from `isPending`, and the snackbar opens through `onError` when the error is a `ServerUnavailableError`.
  - Retry is `mutation.mutate(mutation.variables)`, which re-sends the same operands; on success the result is applied as normal.
  - Keep the "ignore keys while pending" guard.
- Tests: wrap `renderHook` and `render` in a fresh `QueryClientProvider` per test (put a helper in `src/test/setup.ts` or a test util next to the tests). Keep the `fetch` stubs. Update `calculate.test.ts` for the axios error mapping, including the timeout.
- Update the README's frontend section to list the stack: MUI, Axios, TanStack Query.
