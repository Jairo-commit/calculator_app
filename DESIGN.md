# Calculator — Frontend Design Spec (React + TypeScript + MUI)

Source design: https://claude.ai/artifact/UCKfrcHVnSXWDwx2aCoBhY (canvas with 3 boards: Desktop, Mobile, States & feedback).

Files that come with this spec:

| File | What it is |
|---|---|
| `calculator.ts` | Expression engine (tokenize → validate → evaluate, no `eval`), all error messages, keypad definition. Use it on the frontend for preview/validation **and** on the backend for the real calculation. |
| `theme.ts` | MUI theme + keypad colour tokens. |

Stack: React 18+, TypeScript, `@mui/material` v5/v6, `@emotion/react`, `@emotion/styled`.

---

## 1. Requirements covered

- Operations: + − × ÷, plus optional ^ (power), √ (square root), % (percent).
- Intuitive UI for input and results: type in a field **or** use an on-screen keypad; live preview of the result.
- Input validation and error handling: inline field errors, math errors, network errors.
- Responsive: two-column on desktop, single column on phones, history in a drawer on mobile.

---

## 2. Screen structure

```
<ThemeProvider theme={theme}><CssBaseline/>
 AppBar (position="static")                    – "Calculator", 64px (56px on mobile)
   [mobile only] IconButton "Open history"     – right side, opens Drawer
 Container maxWidth=1040, py 40px (16px mobile)
   Stack direction={{ xs:'column', md:'row' }} gap 24px, alignItems flex-start
     Paper  <CalculatorPanel>                  – flex 1 1 420px, maxWidth 560
       Box p=24px
         TextField  "Expression"               – see §4
         ResultDisplay                         – see §5
       LinearProgress (only while loading)     – 4px, full width, flush between sections
       Box Keypad  bg #fafafa, p 20px 24px 24px – see §6
     Paper  <HistoryPanel>  (md and up)        – flex 1 1 300px – see §7
   Drawer anchor="bottom" <HistoryPanel> (xs/sm)
 Snackbar (network errors)                     – see §8
```

Breakpoint: below `md` (900px) → single column, History moves into a bottom `Drawer` opened from the AppBar icon. On phones (≤ 600px) the keypad keys grow to 64px tall with a 10px gap and the keypad sits at the bottom of the screen (result area above it fills the remaining space, content aligned to the bottom).

---

## 3. Visual tokens

| Token | Value |
|---|---|
| Primary | `#1976d2` (hover `#1565c0`, tint `#e3f2fd`) |
| Function keys (√ xʸ %) | bg `#f3e5f5`, text `#6a1b9a` |
| Operator keys (÷ × − +) | bg `#e3f2fd`, text `#0d47a1` |
| Error | `#d32f2f` (alert bg `#fdeded`, alert text `#5f2120`) |
| Page background | `#f5f5f5`; keypad area `#fafafa` |
| Text | primary `rgba(0,0,0,0.87)`, secondary `rgba(0,0,0,0.6)`, disabled `rgba(0,0,0,0.38)` |
| Fonts | Roboto (UI), **Roboto Mono** (expression, result, history) |
| Radius | 4px everywhere |
| Elevation | Paper `elevation={2}`, AppBar default (4) |

All in `theme.ts`.

---

## 4. Expression field

`<TextField label="Expression" placeholder="e.g. (12 + 8) × 3" />`

- `inputProps`: `inputMode="decimal"`, `autoComplete="off"`, `spellCheck={false}`, `aria-describedby` → helper text.
- Font: Roboto Mono 20px.
- Keeps the **display symbols** (× ÷ −) as typed by the keypad; the engine normalises them. Users may also type `* / - ^ sqrt`.
- Keyboard: **Enter** = calculate, **Escape** = clear. (Handle on the input's `onKeyDown`, not a global listener.)
- `helperText`:
  - Default: `Enter to calculate · Esc to clear · % divides by 100 (80 × 15% = 12)`
  - Error: the `CalcError.message` (with `error` prop set → red border, red label, red helper text).
- When the error shows:
  - **While typing**, show only `liveError(expr)` (invalid characters, bad decimals). Don't nag about incomplete expressions mid-typing.
  - **After Calculate** (Enter / "="), show the full `evaluate()` error.
  - Clear the error on the next edit.
- Optional on mobile: a small error icon before the helper text (see Mobile board).

---

## 5. Result display

Right-aligned block under the field, min-height 76px, `aria-live="polite"`, rendered as `<output>`.

| State | Overline label | Value | Value colour |
|---|---|---|---|
| Empty | RESULT | `0` | disabled (0.38) |
| Typing a valid expression | PREVIEW | `preview(expr)` | disabled (0.38) |
| After Calculate | RESULT | formatted result | primary text (0.87) |
| Invalid after Calculate | RESULT | `—` | disabled |

- Overline: 12px, uppercase, letter-spacing 0.4px, secondary text.
- Value: Roboto Mono 48px / line-height 1.167 (≈ `Typography variant="h3"` with mono font), `whiteSpace: nowrap`, `overflowX: auto` for long numbers.
- Format with `formatResult()` → `en-US` grouping, up to 10 decimals (`1,000`, `187.5`).

---

## 6. Keypad

CSS grid, **4 equal columns**, gap 12px (10px mobile), keys 56px tall (64px mobile). Order and kinds come from `KEYPAD` in `calculator.ts`:

```
 C    (    )    ⌫
 √    xʸ   %    ÷
 7    8    9    ×
 4    5    6    −
 1    2    3    +
 0    .    [   =   ]   ← "=" spans 2 columns
```

Each key is a real `<Button>` (`disableElevation` except "="), 20px Roboto 500, `textTransform: none`, `minWidth: 0`, `aria-label` from `KeyDef.ariaLabel`. Styling by `kind` (`keyColors` in `theme.ts`):

| kind | Look (MUI equivalent) |
|---|---|
| `num` | outlined, white bg, grey border |
| `op` | contained-tonal: light-blue bg, dark-blue text |
| `fn` | contained-tonal: light-purple bg, dark-purple text |
| `util` | grey-100 bg, no border |
| `clear` | outlined error (red text, light red border) |
| `equals` | `variant="contained" color="primary"`, elevation 2 |

Key behaviour:

- **Digit/operator/fn keys** append `KeyDef.insert` to the expression. Operators insert with spaces (`' × '`), digits/`.`/`(`/`)`/`√`/`%` without. Collapse double spaces.
- If a result is showing and the user presses a **digit, `.` or `√`**, start a new expression; pressing an **operator** continues from the current expression.
- **C** clears expression, result and error.
- **⌫** removes the last non-space character.
- **=** calculates (same as Enter). Disabled while a request is in flight.
- Keep focus behaviour default; `focus-visible` ring 2px primary.

---

## 7. History panel

- Header row: "History" (16px/500) + text Button "Clear" (disabled when empty), divider below.
- List: `List` of `ListItemButton`, right-aligned, each showing
  - line 1: `{expr} =` — mono 14px, secondary text
  - line 2: `{result}` — mono 20px/500
  - `aria-label="Reuse {expr} = {result}"`; click loads `expr` back into the field (clears result).
- Newest first, keep the last **8** (or whatever the backend returns).
- Empty state: clock icon (40px, disabled colour), "No calculations yet. Results you calculate will show up here." centred, 40px padding.
- Persist in `localStorage` or fetch from the backend (`GET /api/history`) if you add one.

---

## 8. Calculation flow & error handling

```
onCalculate():
  if loading: return
  try evaluate(expr) locally        → CalcError? show it in the TextField, stop (no request)
  setLoading(true)                  → LinearProgress visible, "=" disabled ("Calculating…")
  POST /api/calculate { expression: expr }
    200 { result: number }          → show formatResult(result), prepend to history
    400 { error: string }           → show error in TextField helper text
                                      (math errors like divide-by-zero may instead use
                                       <Alert severity="error"> above the keypad — see States board)
    network / 5xx / timeout (10s)   → Snackbar: "Couldn't reach the server. Your input is kept." + action "Retry"
  finally setLoading(false)
```

Error placement rule: **anything the user can fix in the expression → on the field. Anything about the server → Snackbar.** Never clear the user's input on an error.

### API contract (suggested)

```
POST /api/calculate
Content-Type: application/json
{ "expression": "√144 + 2 ^ 3 × 50%" }

200 OK
{ "expression": "√144 + 2 ^ 3 × 50%", "result": 16 }

400 Bad Request
{ "error": "Can’t divide by zero" }
```

Backend: import `evaluate` + `CalcError` from the same `calculator.ts` (shared package or copied file). Map `CalcError` → 400 with its message, anything else → 500. Also cap input length (e.g. 200 chars → 400 "Expression is too long").

---

## 9. Math rules (implemented in `calculator.ts`)

| Feature | Input | Example |
|---|---|---|
| Add / subtract / multiply / divide | `+ − × ÷` or `+ - * /` | `(12 + 8) × 3` = 60 |
| Power | `^` (key xʸ) | `2 ^ 3` = 8; right-assoc: `2 ^ 3 ^ 2` = 512 |
| Square root | `√` or `sqrt` | `√9 + 1` = 4; `√(9 + 7)` = 4 |
| Percent | `%` postfix, = ÷100 | `80 × 15%` = 12; `200 + 10%` = 200.1 |
| Negative numbers | unary `−` | `5 × −3` = −15; `−2 ^ 2` = −4 |

Precedence high→low: `%` → `^` → unary `−` / `√` → `× ÷` → `+ −`. Results are rounded to 10 decimal places to remove float noise (`0.1 + 0.2` = `0.3`).

### Validation messages (exact copy, from `ERRORS`)

| Situation | Message |
|---|---|
| Empty | Enter an expression to calculate |
| Letters / symbols | Only numbers, + − × ÷ ^ √ % and ( ) are allowed |
| `1.2.3` | A number can only have one decimal point |
| `.` alone | A decimal point needs at least one digit |
| `2 3`, `(1)2` | Missing operator between values |
| `2√9` | Missing operator before √ |
| `2(3)` | Missing operator before “(” |
| `%5` | % must follow a number or “)” |
| `× 5` | Expression can’t start with that operator |
| `12 + × 4` | Two operators in a row |
| `(× 2)` | Operator right after “(” |
| `√` , `√ + 1` | √ needs a number after it |
| `)(` | Unmatched closing parenthesis |
| `()` , `(2 +)` | Incomplete expression inside ( ) |
| `5 +` | Expression can’t end with an operator |
| `(8 + 2` | Missing closing parenthesis |
| `48 ÷ 0` | Can’t divide by zero |
| `√(4 − 13)` | Can’t take the square root of a negative number |
| `0 ^ −1` | Can’t raise 0 to a negative power |
| `(−8) ^ 0.5` | Result isn’t a real number (e.g. negative base with a fractional power) |
| `10 ^ 1000` | Result is too large to display |

---

## 10. Suggested component / file layout

```
src/
  theme.ts
  lib/calculator.ts              ← provided
  api/calculate.ts               ← fetch wrapper, 10s AbortController timeout
  hooks/useCalculator.ts         ← state: expr, result, error, loading, history; actions: press(key), setExpr, calculate, clear, reuse
  components/
    CalculatorPanel.tsx          ← TextField + ResultDisplay + LinearProgress + Keypad
    ResultDisplay.tsx
    Keypad.tsx                   ← maps KEYPAD → KeypadButton
    KeypadButton.tsx             ← styled(Button) by kind using keyColors
    HistoryPanel.tsx
    ErrorSnackbar.tsx
  App.tsx                        ← AppBar, layout, Drawer on mobile
```

## 11. Accessibility checklist

- Every key is a `<Button>` with an `aria-label` for symbols (√, xʸ, ⌫, ÷ …).
- TextField `error` sets `aria-invalid`; helper text linked via `aria-describedby` (MUI does this when `id` is set).
- Result region `aria-live="polite"`; LinearProgress has `aria-label="Calculating"`.
- Touch targets ≥ 44px (keys are 56/64px). Visible focus ring on all controls.
- Colour contrast: all key text/background pairs above pass WCAG AA.

## 12. Acceptance checks

- `(12 + 8) × 3` → 60 · `√144 + 2 ^ 3 × 50%` → 16 · `2 ^ 3 ^ 2` → 512 · `-2 ^ 2` → −4 · `1250 × 15%` → 187.5
- `12 + × 4` → field error "Two operators in a row", no request sent.
- `48 ÷ 0` → "Can’t divide by zero".
- Server down → Snackbar with Retry; input kept.
- At 390px width: single column, history in drawer, keypad 64px keys, nothing scrolls horizontally.
