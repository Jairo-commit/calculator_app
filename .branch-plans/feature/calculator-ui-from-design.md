# Plan: calculator UI from DESIGN.md

Branch: `feature/calculator-ui-from-design` · Spec: `DESIGN.md` (no Jira ticket; §9 tables and §12 acceptance checks are the acceptance criteria).

## User decisions (verbatim answers)

1. `calculator.ts` / `theme.ts` are missing: **"Write them from spec"**.
2. Go backend: **"Port engine to Go"**, with identical messages and a shared test fixture.
3. History: **"localStorage"**, last 8 entries, newest first.
4. One PR, under 40 changed files (estimate is about 33).

## 0. Environment facts

- Host Node is 18.19.1, which can't run Vite 8, vitest 5, jsdom 31 or eslint 10. **All frontend tooling runs in the container**: `docker compose run --rm --no-deps frontend npm <script>` (Node 26).
- The frontend service has an anonymous `/app/node_modules` volume. After changing `package.json`, run `docker compose build frontend`.
- Go isn't on the host. Run `docker compose run --rm backend go ...` (golang:1.27-alpine, `./backend` mounted at `/app`). Use no `-race`, because there is no cgo.

## 1. Key decisions

| Topic | Decision |
|---|---|
| Shared fixture | `backend/calc/testdata/cases.json`. It sits inside the Go build context and mount, and `go build` ignores `testdata/`. |
| Frontend access to fixture | Read-only mount in compose: `./backend/calc/testdata:/backend/calc/testdata:ro`. The test imports `../../../backend/calc/testdata/cases.json`, which resolves the same on the host and in the container. |
| Parity guard | The fixture has a `messages` catalog (code → exact copy) and `cases` (expr → result or error). Both suites check their catalog equals `messages`, then run every case. |
| Length cap | `MAX_EXPRESSION_LENGTH = 200`, enforced inside both `evaluate` functions and counted in code points (`Array.from(s).length` / `utf8.RuneCountInString`). Message: "Expression is too long". The handler maps it to 400. |
| Math errors | Always shown on the field. The optional `<Alert>` isn't built (§8 placement rule). |
| History | localStorage key `calculator.history.v1`, newest first, capped at 8. |

## 2. Files (about 33)

| # | Path | A/M | Purpose |
|---|---|---|---|
| 1 | `backend/calc/calc.go` | A | `type Error struct{Code, Message string; Pos int}` implementing `error`; `Messages map[string]string`; `MaxExpressionLength = 200`; `func Evaluate(expr string) (float64, error)`; unexported tokenize, validate, parser and `round10` |
| 2 | `backend/calc/calc_test.go` | A | Fixture cases, catalog parity, `round10` symmetry for negatives, too-long counted in runes (201×"1" fails; 200 runes of "1×…" passes), no `-0` |
| 3 | `backend/calc/testdata/cases.json` | A | Shared fixture (§3.6) |
| 4 | `backend/handler.go` | A | `newMux(eval func(string)(float64, error)) *http.ServeMux` with `GET /api/health` and `POST /api/calculate`; `writeJSON`; recover middleware; one `slog` JSON line per request (method, path, status, duration_ms, expr_len, error_code; never the full expression) |
| 5 | `backend/handler_test.go` | A | httptest (§7.3) |
| 6 | `backend/main.go` | M | `http.Server{Addr: ":8080", Handler: newMux(calc.Evaluate), ReadHeaderTimeout: 5s, ReadTimeout: 10s, WriteTimeout: 10s}` |
| 7 | `docker-compose.yml` | M | Fixture mount on the frontend service |
| 8 | `README.md` | M | API, tests, lint, Node note (§9) |
| 9–10 | `frontend/package.json`, `package-lock.json` | M | Deps and scripts (§6); lockfile regenerated in the container |
| 11 | `frontend/vite.config.ts` | M | `defineConfig` from `vitest/config`; `test: {environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false}`; proxy unchanged |
| 12 | `frontend/tsconfig.json` | M | `"resolveJsonModule": true` |
| 13 | `frontend/eslint.config.js` | A | Flat config (§6) |
| 14–15 | `frontend/.prettierrc.json`, `.prettierignore` | A | Defaults (double quotes, semicolons, trailing commas); ignore dist, node_modules, package-lock.json, coverage |
| 16 | `frontend/src/main.tsx` | M | `@fontsource` (roboto 400/500/700, roboto-mono 400/500), ThemeProvider, CssBaseline, StrictMode |
| 17 | `frontend/src/theme.ts` | A | `theme`, `keyColors: Record<KeyKind, KeyColor>`, `tokens`, `MONO_FONT` |
| 18 | `frontend/src/lib/calculator.ts` | A | `evaluate`, `preview`, `liveError`, `formatResult`, `CalcError`, `ERRORS`, `ErrorCode`, `KEYPAD`, `KeyDef`, `KeyKind`, `MAX_EXPRESSION_LENGTH` |
| 19 | `frontend/src/lib/calculator.test.ts` | A | Fixture cases, catalog parity, TS-only tests |
| 20 | `frontend/src/lib/history.ts` | A | `HistoryEntry {expr: string; result: number}`, `HISTORY_LIMIT = 8`, `HISTORY_KEY`, `loadHistory()` (validates shape; survives corrupt JSON and a throwing localStorage), `saveHistory()`, `addEntry(list, entry)` |
| 21 | `frontend/src/api/calculate.ts` | A | `calculateRemote(expression, {signal?, timeoutMs = 10_000}): Promise<number>`, `ApiValidationError` (400), `ServerUnavailableError` (`kind: 'network' \| 'timeout' \| 'server'`) |
| 22 | `frontend/src/api/calculate.test.ts` | A | 200, 400, 500, bad JSON, fetch reject, 10 s timeout with fake timers, external abort |
| 23 | `frontend/src/hooks/useCalculator.ts` | A | Reducer, `useCalculator()`, exported pure `nextExpression(expr, key, hasResult)` |
| 24 | `frontend/src/hooks/useCalculator.test.tsx` | A | renderHook tests (§7.2) |
| 25 | `frontend/src/components/CalculatorPanel.tsx` | A | TextField, ResultDisplay, progress slot, Keypad |
| 26 | `frontend/src/components/ResultDisplay.tsx` | A | Props `{label, value, tone}`; renders `<output>` |
| 27 | `frontend/src/components/Keypad.tsx` | A | 4-column grid that maps `KEYPAD` to `KeypadButton` |
| 28 | `frontend/src/components/KeypadButton.tsx` | A | `styled(Button)` coloured by kind |
| 29 | `frontend/src/components/HistoryPanel.tsx` | A | Header, list, empty state |
| 30 | `frontend/src/components/ErrorSnackbar.tsx` | A | Network-error Snackbar with Retry |
| 31 | `frontend/src/App.tsx` | M | AppBar, layout, Drawer on mobile; removes the health-check demo |
| 32 | `frontend/src/App.test.tsx` | A | Integration tests with user-event |
| 33 | `frontend/src/test/setup.ts` | A | jest-dom/vitest; `afterEach(cleanup)`; matchMedia stub driven by a test-set width; `localStorage.clear()`; `vi.restoreAllMocks()`; `vi.unstubAllGlobals()` |

No changes to `go.mod` (still no deps) or either Dockerfile.

## 3. Engine (same logic in TS and Go)

### 3.1 Pipeline and error priority
1. Longer than 200 code points → `TOO_LONG`.
2. `trim() === ''` → `EMPTY`.
3. Tokenize in one full left-to-right pass. The first lexical error is thrown with `pos`.
4. Validate: a left-to-right state machine, then end-of-input checks. The first error wins.
5. Parse and evaluate in one recursive descent.
6. After each arithmetic step: NaN → `NOT_REAL`, ±Inf → `TOO_LARGE`. The ÷0, √negative and 0^negative checks run *before* the operation.
7. `round10`, then turn `-0` into `0`.

Parser errors that get past validation are "can't happen". TS throws a plain `Error`; Go returns a non-`*Error` error, which the handler maps to 500.

### 3.2 Tokenizer
- Skip whitespace.
- Map symbols to tokens:
  - `×`/`*` → MUL
  - `÷`/`/` → DIV
  - `−` (U+2212)/`-` → MINUS
  - `+` → PLUS
  - `^` → POW
  - `√` or `sqrt` (case-insensitive) → SQRT
  - `%` → PCT
  - `(` → LPAREN and `)` → RPAREN
- Numbers are the longest run of `[0-9.]`.
  - More than one `.` → `MULTI_DECIMAL`.
  - No digits → `BARE_DECIMAL`.
  - `1.` and `.5` are valid.
  - An overflowing literal is not a tokenizer error. It becomes `TOO_LARGE` at evaluation, so syntax errors win.
- Whitespace separates numbers.
- Any other character (`,`, `e` in `1e5`, `x`, letters other than sqrt) → `INVALID_CHAR`.

### 3.3 Validator

Terms used in the table:
- **Value-end:** NUM, RPAREN or PCT.
- **Binary op:** PLUS, MUL, DIV or POW; also MINUS when it follows a value-end.
- **Unary MINUS:** any other MINUS.

| §9 situation | Code | Rule |
|---|---|---|
| `2 3`, `(1)2` | MISSING_OPERATOR | cur = NUM and prev is a value-end |
| `2√9` | MISSING_OP_BEFORE_SQRT | cur = SQRT and prev is a value-end |
| `2(3)` | MISSING_OP_BEFORE_PAREN | cur = LPAREN and prev is a value-end |
| `%5` | PERCENT_PLACEMENT | cur = PCT and prev ∉ {NUM, RPAREN} (so `5%%` fails too) |
| `× 5` | START_OPERATOR | binary non-MINUS op at the start |
| `12 + × 4` | TWO_OPERATORS | binary non-MINUS op after a binary op or unary MINUS (`5 × −3` and `5 − − 3` are OK) |
| `(× 2)` | OPERATOR_AFTER_PAREN | binary non-MINUS op after LPAREN |
| `√`, `√ + 1` | SQRT_NEEDS_ARG | prev = SQRT and (cur is a binary non-unary op, RPAREN or end of input). Checked first. |
| `)(` | UNMATCHED_CLOSE | RPAREN at depth 0 |
| `()`, `(2 +)` | INCOMPLETE_PARENS | RPAREN after LPAREN, an op or unary MINUS |
| `5 +` | END_OPERATOR | end of input after an op or unary MINUS |
| `(8 + 2` | MISSING_CLOSE | end of input with depth > 0 |
| `48 ÷ 0` | DIV_ZERO | evaluation |
| `√(4 − 13)` | SQRT_NEGATIVE | evaluation |
| `0 ^ −1` | ZERO_NEG_POWER | base == 0 and exp < 0 |
| `(−8) ^ 0.5` | NOT_REAL | pow returns NaN |
| `10 ^ 1000` | TOO_LARGE | ±Inf after any step, or an overflowing literal |

End-of-input order: SQRT, then op, then depth. `ERRORS` copy must match §9 **byte for byte**: `’` (U+2019) in Can’t/can’t/isn’t, and `“(”` / `“)”` (U+201C/U+201D). Copy it from DESIGN.md.

### 3.4 Grammar
```
expr    := term (('+' | '−') term)*
term    := unary (('×' | '÷') unary)*
unary   := ('−' | '√') unary | power
power   := postfix ('^' unary)?      // right-assoc: 2^3^2 = 512; −2^2 = −4; 2^−1 = 0.5
postfix := primary ('%')*            // ÷100: 50%^2 = 0.25
primary := NUMBER | '(' expr ')'
```

### 3.5 Rounding and formatting
- `round10(x)`: if `|x| >= 1e15`, return x unchanged. Otherwise return `sign(x) * round(|x| * 1e10) / 1e10`. Rounding the absolute value gives Go and TS the same result for negatives.
- `formatResult(n)`: `Intl.NumberFormat('en-US', {maximumFractionDigits: 10})`, with a leading `-` replaced by `−` (U+2212).
- `preview(expr)`: `formatResult(evaluate(expr))`, or `null` on any error or empty input.
- `liveError(expr)`: only the length check and the tokenizer. It has two exemptions:
  - a trailing bare `.`
  - a trailing proper prefix of `sqrt` (`s`, `sq`, `sqr`), found using `pos`
- `CalcError extends Error { code: ErrorCode; pos?: number; name = 'CalcError' }`.
- `KEYPAD` has 23 keys in §6 order. `KeyDef = {id, label, kind: 'num'|'op'|'fn'|'util'|'clear'|'equals', insert?, ariaLabel, span?: 1|2}`.
  - Inserts: digits, `.`, `(`, `)`, `√` and `%` bare; `' ÷ '`, `' × '`, `' − '`, `' + '` and `' ^ '` spaced.
  - `=` spans 2.
  - ariaLabels: Clear, Open parenthesis, Close parenthesis, Backspace, Square root, Power, Percent, Divide, Multiply, Minus, Plus, Decimal point, Equals, and the digit itself for digits.

### 3.6 Fixture shape
```json
{ "messages": { "EMPTY": "Enter an expression to calculate", "TOO_LONG": "Expression is too long" },
  "cases": [ { "expr": "(12 + 8) × 3", "result": 60 }, { "expr": "12 + × 4", "error": "Two operators in a row" } ] }
```
Cases to include:
- Every §9 example (all rows, including both inputs where a row has two).
- Every §12 example: `-2 ^ 2` (ASCII hyphen), `√144 + 2 ^ 3 × 50%`, `1250 × 15%`, `80 × 15%`, `200 + 10%`.
- ASCII variants: `(12 + 8) * 3`, `48 / 0`, `5 * -3`, `sqrt(9 + 7)`.
- Edge cases:
  - Invalid input: `"   "`, `1,000`, `1e5`.
  - Decimals and rounding: `.5 + 1.` = 1.5, `0.1 + 0.2` = 0.3, `1 ÷ 3`.
  - Powers and signs: `2 ^ −1`, `−8 ^ 0.5` = −2.8284271247, `0 × −1` = 0, `5 − − 3` = 8.
  - Percent: `(5)%` = 0.05, `50%^2`, `2^50%`, `5%%`.
  - Other errors: `2 ^ ^ 3`, `√−4`, `10 ^ 308 × 10`.
  - Error priority: `1 ÷ 0 + √−1` (DIV_ZERO wins), `12 + × 4 + a` (INVALID_CHAR wins).

## 4. useCalculator

State: `{expr, result: number|null, submittedError: string|null, lastPreview: string|null, loading, serverErrorOpen, history}`. History comes from a lazy `loadHistory()` and is saved in a `useEffect`.

Derived values (pure, exported):
- `fieldError = submittedError ?? liveError(expr)?.message ?? null`
- `display`, the first rule that matches:
  - result → {Result, formatResult, primary}
  - submittedError → {Result, `—`, disabled}
  - empty → {Result, `0`, disabled}
  - `preview(expr) ?? lastPreview` → {Preview, value, disabled}
  - otherwise → {Result, `0`, disabled}

| Action | Effect |
|---|---|
| EDIT(expr) | Set expr; clear result and submittedError; update lastPreview |
| CLEAR (C/Esc) | Reset expr, result, error and lastPreview |
| CALC_INVALID(msg) | Set submittedError and clear result. **Never touch expr.** |
| REQUEST_START/END | Set loading |
| REQUEST_SUCCESS({expr, result}) | `addEntry` (cap 8). Set result **only if state.expr === requestExpr**. Close the snackbar. |
| REQUEST_FAILED | `serverErrorOpen = true`; expr unchanged |
| DISMISS_SERVER_ERROR, REUSE(entry) (expr = entry.expr, clears result and error), CLEAR_HISTORY | As named |

`nextExpression(expr, key, hasResult)`:
- `clear` → `''`.
- `backspace` → trim trailing whitespace, drop the last code point, trim trailing whitespace again.
- If `hasResult` and the key is a num, `.`, `√` or `(`, start from `''`.
- **USER DECISION: an operator after a result continues from the result.** If `hasResult` and the key is an op, xʸ or `%`, the base is the result as a plain number string:
  - Use `String(result)` with a leading `-` replaced by `−`, e.g. 2 + 3 = 5, then × gives `5 × `.
  - If that string contains `e` (an exponent, which the tokenizer rejects), the base is `(${expr})` instead.
  - The signature becomes `nextExpression(expr, key, result: number | null)`.
- Otherwise append `key.insert` to `expr`.
- Then collapse `/ {2,}/g` to one space and `trimStart()`.
- Add hook and App tests: `2 + 3` = 5, then × 2 = gives 10, and the input reads `5 × 2`.

`calculate()`:
```
if (loadingRef.current) return
try { evaluate(expr) } catch (e) { if (e instanceof CalcError) { CALC_INVALID(e.message); return } throw e }
loadingRef.current = true; REQUEST_START; controllerRef.current = new AbortController()
try { r = await calculateRemote(expr, {signal}); REQUEST_SUCCESS({expr, result: r}) }
catch (e) { ApiValidationError → CALC_INVALID; ServerUnavailableError → REQUEST_FAILED; abort on unmount → ignore }
finally { loadingRef.current = false; REQUEST_END }
```
- `retry` dismisses the snackbar and calls `calculate()` on the current expr.
- On unmount, abort any in-flight request.
- Returns `{expr, setExpr, press, calculate, clear, reuse, clearHistory, retry, dismissServerError, loading, fieldError, display, history, serverErrorOpen}`.

`calculateRemote`:
- Uses its own AbortController, with `setTimeout(abort, 10_000)` cleared in `finally` and the external signal linked through an `abort` listener. Don't use `AbortSignal.any/timeout`.
- Sends `POST /api/calculate` with a JSON body.
- 200 with a numeric `result` → return it.
- 400 with a string `error` → `ApiValidationError`.
- Anything else → `ServerUnavailableError(kind)`.

## 5. UI, responsive and a11y

**theme.ts**
- Palette:
  - primary `#1976d2` (dark `#1565c0`)
  - error `#d32f2f`
  - background.default `#f5f5f5`
  - text rgba(0,0,0,.87 / .6 / .38)
- radius 4; Roboto.
- `MONO_FONT = '"Roboto Mono", ui-monospace, monospace'`.
- `tokens = {primaryTint: '#e3f2fd', keypadBg: '#fafafa', alertBg: '#fdeded', alertText: '#5f2120'}`.
- `keyColors`:

| kind | bg | text | border | hover |
|---|---|---|---|---|
| num | #fff | .87 | rgba(0,0,0,.23) | #f5f5f5 |
| op | #e3f2fd | #0d47a1 | none | #bbdefb |
| fn | #f3e5f5 | #6a1b9a | none | #e1bee7 |
| util | #f5f5f5 | .87 | none | #eeeeee |
| clear | #fff | #d32f2f | rgba(211,47,47,.5) | rgba(211,47,47,.04) |
| equals | primary contained | | | |

- `MuiButtonBase` root `&.Mui-focusVisible`: `{outline: '2px solid #1976d2', outlineOffset: 2}`.

**App.tsx**
- AppBar `position="static"` with a Toolbar (56/64px by default) containing `Typography component="h1" variant="h6"` "Calculator".
- On mobile only: `IconButton size="large" aria-label="Open history"` with the History icon.
- `Container component="main" maxWidth={false} sx={{maxWidth: 1040, py: {xs: 2, md: 5}}}`.
- `Stack direction={{xs: 'column', md: 'row'}} gap={3} alignItems={{xs: 'stretch', md: 'flex-start'}}`.
- Calculator Paper: `elevation={2}`, flex `{md: '1 1 420px'}`, maxWidth `{md: 560}`, minWidth 0.
- `isMobile = useMediaQuery(theme.breakpoints.down('md'), {noSsr: true})`.
  - Desktop: history in `Paper elevation={2} sx={{flex: '1 1 300px', minWidth: 0}}`.
  - Mobile: `Drawer anchor="bottom"` (paper maxHeight 70dvh, top radius 4).
  - Render only one of the two. `reuse` closes the drawer and focuses the input.
- Phones (`down('sm')`):
  - The Container is a flex column with `minHeight: calc(100dvh - 56px)`.
  - The Paper is `flex: 1` and a flex column.
  - The top Box is `flex: 1`, a flex column, with `justifyContent: flex-end`, so the keypad sits at the bottom.

**CalculatorPanel**
- TextField:
  - `id="expression"`, `label="Expression"`, `placeholder="e.g. (12 + 8) × 3"`, `fullWidth`.
  - `error={!!fieldError}` and `helperText={fieldError ?? DEFAULT_HELPER}`. DEFAULT_HELPER is the exact §4 text, with `·` (U+00B7).
  - `slotProps.htmlInput = {inputMode: 'decimal', autoComplete: 'off', spellCheck: false}`.
  - Input font: mono 20px.
  - `onKeyDown`: Enter → preventDefault and `calculate()`; Escape → `clear()`.
- While loading, show `<LinearProgress aria-label="Calculating" sx={{height: 4}}/>`. Otherwise show a 4px placeholder Box.
- ResultDisplay is a `Box component="output" htmlFor="expression" aria-live="polite"`:
  - right-aligned, minHeight 76, minWidth 0
  - overline 12px, uppercase, letterSpacing 0.4px, secondary colour
  - value `variant="h3"` in mono, 48px / 1.167, nowrap, overflowX auto, coloured by tone

**Keypad**
- Container: bg #fafafa, `p: {xs: '16px', sm: '20px 24px 24px'}`, grid with **`repeat(4, minmax(0, 1fr))`**, gap `{xs: '10px', sm: '12px'}`.
- Keys:
  - height `{xs: 64, sm: 56}`, minWidth 0, 20px / 500, `textTransform: none`, `aria-label`.
  - `disableElevation` on every key except `=`.
  - `=` is contained, `gridColumn: span 2`, disabled while loading, with text "Calculating…" while loading.
  - num and clear are outlined; op, fn and util are contained with keyColors overrides.

**HistoryPanel**
- `section aria-labelledby="history-heading"`.
- Header: "History" (16px / 500) and a text Button "Clear" (disabled when empty, minHeight 44), then a Divider.
- `ListItemButton` items: right-aligned, minHeight 44, `aria-label={`Reuse ${expr} = ${formatResult(result)}`}`.
  - Line 1: `{expr} =`, mono 14px, secondary.
  - Line 2: result, mono 20px / 500.
- Empty state: AccessTime icon (40px, disabled colour, `aria-hidden`) and "No calculations yet. Results you calculate will show up here.", centred, 40px padding.

**ErrorSnackbar**
- No autoHide.
- Anchored at the top on phones and the bottom otherwise, centred.
- Message: "Couldn't reach the server. Your input is kept."
- Actions: a Retry button and `IconButton aria-label="Dismiss"`.

**Contrast:** the key pairs pass AA. The disabled 0.38 preview text (about 2.6:1) fails AA, but the spec requires it; flag it in the PR.

## 6. Tooling

Dependencies:
- `@mui/material@^6.5.0`, `@mui/icons-material@^6.5.0`
- `@emotion/react@^11.14.0`, `@emotion/styled@^11.14.1`
- `@fontsource/roboto@^5.3.0`, `@fontsource/roboto-mono@^5.3.0`

Dev dependencies:
- `vitest@^5.1.2`, `jsdom@^31.0.1`
- `@testing-library/react@^16.3.3`, `@testing-library/dom@^10.4.2`, `@testing-library/user-event@^14.6.13`, `@testing-library/jest-dom@^8.0.0`
- `eslint@^10.15.0`, `@eslint/js@^10.0.1`, `typescript-eslint@^8.74.0`, `eslint-plugin-react-hooks@^7.1.1`, `eslint-plugin-react-refresh@^0.5.8`, `globals@^17.14.0`, `eslint-config-prettier@^10.1.8`
- `prettier@^3.10.1`
- Keep `@vitejs/plugin-react@^5`.

Install inside the container:
```
docker compose run --rm --no-deps frontend npm install <deps>
docker compose run --rm --no-deps frontend npm install -D <devDeps>
docker compose build frontend
```

Scripts:
- `test`: `vitest run`
- `test:watch`: `vitest`
- `lint`: `eslint .`
- `format`: `prettier --write .`
- `format:check`: `prettier --check .`
- `typecheck`: `tsc`
- keep `build`

`eslint.config.js`:
- ignores `dist`
- `js.configs.recommended`, `tseslint.configs.recommended`, react-hooks recommended flat, `reactRefresh.configs.vite()` on `**/*.tsx`, eslint-config-prettier last
- `globals.browser`
- Check the react-hooks config key in the container first: `node -e "console.log(Object.keys(require('eslint-plugin-react-hooks').configs))"`.

Go checks: `gofmt -l .` must print nothing, plus `go vet ./...` and `go test ./...`, all through `docker compose run --rm backend`.

## 7. Tests

### 7.1 Engine
**Both languages:**
- Catalog parity: `toEqual` in TS, `reflect.DeepEqual` in Go.
- Every fixture case: exact result, or a CalcError whose message matches.

**TS only:**
- `liveError`:
  - null for `12 +`, `(8 + 2`, `√`, `.`, `5 + .`, `2 s`, `2 sq`
  - a message for `1.2.3`, `2 + a`, `. + 1`, and 201 chars
- `preview`: null for `12 +` and `""`; "16" for the §12 expression.
- `formatResult`: `1,000`, `187.5`, `−4`, `0.3333333333`.
- `KEYPAD`: 23 keys in order, every key has an ariaLabel, only `=` spans 2, and kinds match §6.

### 7.2 Frontend
**`calculate.test.ts`:** all error mappings, plus the 10 s timeout with fake timers. Use fake timers only in this file.

**`useCalculator.test.tsx`** (`vi.stubGlobal('fetch')`):
- `12 + × 4` → no fetch, fieldError "Two operators in a row", display `—`.
- `48 ÷ 0` → no fetch.
- Live vs submitted error timing.
- `nextExpression` cases.
- Success adds a history entry.
- 9 successes → 8 entries, newest first, saved to localStorage and restored on remount; corrupt JSON → `[]`.
- Server 400 → fieldError.
- Network failure → snackbar open and expr unchanged; retry succeeds.
- A double calculate while loading sends one fetch.
- Editing during a request: history updates, but no result is shown.

**`App.test.tsx`:**
- §12 expressions typed and entered through the keypad (by aria-label).
- Field error with `aria-invalid` and no fetch.
- Fetch reject → `role=alert` snackbar, input kept, Retry works.
- 500 → snackbar.
- Escape and C clear.
- `=` disabled and progress shown while loading.
- Reusing a history item.
- Empty state, with Clear disabled.
- At 390px: no history Paper, and "Open history" opens a drawer.
- On desktop: no "Open history" button.

### 7.3 Go handler
- 200 with the expression echoed back and `Content-Type: application/json`.
- 400 for: two operators, divide by zero, missing field (EMPTY), 201 runes (too long).
- Body over 8 KiB (`MaxBytesReader`) → 400 "Expression is too long".
- Malformed JSON → 400 "Invalid request body".
- Stub evaluator error → 500 "Internal server error"; panic → 500 via recover.
- `GET /api/calculate` → 405.
- Health endpoint still returns ok.

## 8. Traceability

| Check | Implemented | Tested |
|---|---|---|
| §1 operations | engine grammar | fixture (TS + Go) |
| §1 type or keypad, live preview | CalculatorPanel, Keypad, nextExpression, display | hook and App tests |
| §1 inline, math and network errors | fieldError, CALC_INVALID, ErrorSnackbar | hook and App tests |
| §1/§2 responsive, drawer | App useMediaQuery, Keypad sizes | App matchMedia tests and a manual check |
| §9 all rows and length cap | validator and evaluator | cases.json through vitest and go test, catalog parity |
| §12 `(12 + 8) × 3` → 60 | engine and backend | fixture, handler, App |
| §12 `√144 + 2 ^ 3 × 50%` → 16 | engine | fixture, handler, App keypad |
| §12 `2 ^ 3 ^ 2` → 512 | right-assoc power | fixture |
| §12 `-2 ^ 2` → −4 | unary below ^, formatResult `−` | fixture, formatResult |
| §12 `1250 × 15%` → 187.5 | postfix % | fixture, App |
| §12 `12 + × 4` → field error, no request | local evaluate gate | hook and App (fetch not called) |
| §12 `48 ÷ 0` → message | evaluator, handler 400 | fixture, hook, handler |
| §12 server down → Snackbar + Retry, input kept | calculateRemote, REQUEST_FAILED, retry | api, hook, App |
| §12 at 390px | Stack column/stretch, Drawer, 64px keys, `minmax(0,1fr)` | App drawer test; **manual** DevTools check at 390×844 for key height and horizontal scroll |
| §4–§8, §11 | as above | as above |

**Left out:**
- Optional mobile error icon (§4).
- `<Alert>` for math errors (§8 "may").
- `GET /api/history` (user chose localStorage).
- Playwright end-to-end tests.
- CI workflow.

## 9. README

Add:
- The API contract and a curl example.
- A summary of the math rules, linking to DESIGN.md.
- Test, lint and format commands for Go and the frontend (in Docker).
- A note that host Node must be ≥ 22.12 to run the tools locally.
- The shared fixture's location and purpose.
- A list of endpoints.

## 10. Order of work (one commit per step)

1. Tooling, configs, scripts and the compose mount. Check that lint, format:check and `test --passWithNoTests` run.
2. `cases.json`, the TS engine and its tests.
3. The Go engine and its tests.
4. Handler, main.go and handler tests; then gofmt, vet and test.
5. theme, history, api and the hook, with tests.
6. Components, App, main.tsx and App tests.
7. README. Then run every check, `docker compose up -d --build`, curl the endpoint, do the manual 390px check, and do the manual server-down check (`docker compose stop backend`).

## Open notes
- Q1 (decided by user): an operator after a result continues from the **result**. Tooling runs in Docker (user approved).
- Q2: `(` after a result starts a new expression (goes slightly beyond §6).
- Q3: the snackbar copy keeps the straight apostrophe exactly as written in §8.
- Q4: the disabled preview colour fails AA contrast. It's in the spec, so flag it in the PR.
