# Calculator — Frontend Design Spec (React + TypeScript + MUI)

Source design: https://claude.ai/artifact/UCKfrcHVnSXWDwx2aCoBhY (canvas with 3 boards: Desktop, Mobile, States & feedback). The calculator behaves like an old pocket calculator; where the canvas shows an expression field, this spec replaces it.

Files that come with this spec:

| File | What it is |
|---|---|
| `lib/calculator.ts` | Operation names, op symbols, the keypad definition, `formatResult` and the physical-keyboard map. It does no math. |
| `lib/calculatorState.ts` | The state machine: reducer, request-for-key and display derivation. |

Stack: React, TypeScript, `@mui/material`, Axios (one instance, `baseURL: /api`, 10 s `timeout`) and TanStack Query (`useMutation`, no retries). The frontend never calculates: every result comes from the backend (one endpoint per operation, see §8).

---

## 1. Requirements covered

- Operations: `+ − × ÷` and `xʸ` (power) take two numbers; `√` and `%` act on the one number on screen.
- Old-calculator input: enter a number, an operator, then another number. A second operator or `=` computes the pending operation and waits for the next number. Two operators in a row just swap the pending operation.
- Intuitive UI: an on-screen keypad plus the physical keyboard; a small line above the display shows the pending operation.
- Input validation and error handling: math errors shown on the display, network errors in a snackbar.
- Responsive: two-column on desktop, single column on phones, history in a drawer on mobile.

---

## 2. Screen structure

```
<ThemeProvider theme={theme}><CssBaseline/>
 AppBar (position="static")                    – "Calculator", 64px (56px on mobile)
   [mobile only] IconButton "Open history"     – right side, opens Drawer
 Container maxWidth=1040, py 40px (16px mobile)
   Stack direction={{ xs:'column', md:'row' }} gap 24px, alignItems flex-start
     Paper  <CalculatorPanel> (tabIndex 0)     – flex 1 1 420px, maxWidth 560; takes the physical keyboard
       output p=24px                           – pending line + value, see §5
       LinearProgress (only while loading)     – 4px, full width, flush between sections
       Box Keypad  bg #fafafa, p 20px 24px 24px – see §6
     Paper  <HistoryPanel>  (md and up)        – flex 1 1 300px – see §7
   Drawer anchor="bottom" <HistoryPanel> (xs/sm)
 Snackbar (server errors)                       – see §8
```

Breakpoint: below `md` (900px) → single column, History moves into a bottom `Drawer` opened from the AppBar icon. On phones (≤ 600px) the keypad keys grow to 64px tall with a 10px gap.

---

## 3. Visual tokens

| Token | Value |
|---|---|
| Primary | `#1976d2` (hover `#1565c0`, tint `#e3f2fd`) |
| Function keys (√ xʸ %) | bg `#f3e5f5`, text `#6a1b9a` |
| Operator keys (÷ × − +) | bg `#e3f2fd`, text `#0d47a1` |
| Error | `#d32f2f` |
| Page background | `#f5f5f5`; keypad area `#fafafa` |
| Text | primary `rgba(0,0,0,0.87)`, secondary `rgba(0,0,0,0.6)`, disabled `rgba(0,0,0,0.38)` |
| Fonts | Roboto (UI), **Roboto Mono** (display, history) |
| Radius | 4px everywhere |
| Elevation | Paper `elevation={2}`, AppBar default (4) |

Page background is in `theme.ts`; key colours are in `Keypad.tsx`.

---

## 4. Physical keyboard

There is no text field. The calculator `Paper` has `tabIndex={0}`, is focused on mount, after a request ends, and after Retry, Dismiss, history Clear or a history entry is used. It handles `onKeyDown` itself, not a global listener.

| Key | Action |
|---|---|
| `0-9`, `.` | digit / decimal point |
| `+ - * / ^` | add, subtract, multiply, divide, power |
| `Enter` or `=` | equals |
| `Backspace` | ⌫ |
| `Delete` | CE (clear entry) |
| `Escape` | C (clear all) |
| `r` | √ |
| `%` | % |

- Keys pressed with Ctrl, Meta or Alt are left to the browser.
- `Enter` always means `=`, even when a key button has focus: `preventDefault` stops the browser from clicking that button too.

---

## 5. Display

Right-aligned block, `aria-live="polite"`, rendered as `<output>`.

- **Pending line** (small, Roboto Mono 14px, secondary text, always reserves its height): `5 +` while an operator is pending, `2 + 3 =` after equals, empty otherwise.
- **Value**: Roboto Mono 48px, wrapping with `overflowWrap: anywhere`. A typed number is shown exactly as typed; a result is formatted with `formatResult()` (`en-US` grouping, up to 10 decimals, true minus sign).
- **Error**: the server's message replaces the value, in the error colour (`#d32f2f`), 24px, wrapping.

---

## 6. Keypad

CSS grid, **4 equal columns**, gap 12px (10px mobile), keys 56px tall (64px mobile). Order and kinds come from `KEYPAD` in `lib/calculator.ts`:

```
 C    CE   ⌫    ÷
 √    xʸ   %    ×
 7    8    9    −
 4    5    6    +
 1    2    3    [ = ]   ← "=" spans 2 rows
 [ 0 ]     .    [ = ]   ← "0" spans 2 columns
```

Each key is a real `<Button>` (`disableElevation` except "="), 20px Roboto 500, `textTransform: none`, `minWidth: 0`, `aria-label` from `KeyDef.aria`. Styling by `kind` (`COLORS` in `Keypad.tsx`):

| kind | Keys | Look (MUI equivalent) |
|---|---|---|
| `num` | digits, `.` | outlined, white bg, grey border |
| `op` | `÷ × − +` | contained-tonal: light-blue bg, dark-blue text |
| `fn` | `√ xʸ %` | contained-tonal: light-purple bg, dark-purple text |
| `util` | `CE ⌫` | grey-100 bg, no border |
| `clear` | `C` | outlined error (red text, light red border) |
| `equals` | `=` | `variant="contained" color="primary"`, elevation 2 |

Key behaviour (the state machine in `lib/calculatorState.ts`):

- **Digit or `.`**: if a result is showing (or an error), start a new number; otherwise append. One `.` per number, at most 15 digits, no leading zeros.
- **`+ − × ÷ xʸ`**:
  - with an operator pending and a second number entered, compute it, show the result, and make the new key the pending operator;
  - with an operator pending but no second number (two signs in a row), only replace the pending operator;
  - otherwise store the number on screen and set the pending operator.
- **`=`**: with a pending operator and a second number, compute and show the result, nothing stays pending. Otherwise nothing happens. After `=`, a digit starts fresh and an operator continues from the result.
- **`√` / `%`**: act at once on the number on screen. `%` divides by 100, so `80 × 15 %` shows 0.15 and `=` gives 12. A second number counts as entered, so `2 + 9 √ =` gives 5.
- **CE**: sets the display to 0 and clears an error; the pending operator stays.
- **⌫**: only while typing; removes the last character, falling back to 0.
- **C**: resets everything. A request in flight is not cancelled (the HTTP call finishes), but its answer is discarded.
- **After a server error** (see §8) only a digit, C and CE work.
- **While loading** every key except C is ignored and `=` is disabled ("Calculating…").
- The calculator panel shows a 2px primary `:focus-visible` ring.

---

## 7. History panel

- Header row: "History" (16px/500) + text Button "Clear" (disabled when empty), divider below.
- List: `List` of `ListItemButton`, right-aligned, each showing
  - line 1: `{expr} =` — mono 14px, secondary text (`2 + 3`, `√9`, `15%`)
  - line 2: `{result}` — mono 20px/500
  - `aria-label="Reuse {expr} = {result}"`, disabled while a request is in flight; click loads the **result** into the display as a fresh number (when an operator is pending it is the second number).
- Newest first, keep the last **8**. Every successful call adds an entry, including the ones that only chain to the next operator.
- Empty state: "No calculations yet. Results you calculate will show up here." centred, 40px padding.
- Persisted in `localStorage`.

---

## 8. Calculation flow & error handling

```
press(key):
  if loading and key is not C: ignore
  if the key needs a calculation (second operator, "=", √, %):
    setLoading(true)                → LinearProgress visible, "=" disabled ("Calculating…")
    POST /api/<operation>
      200 { result: number }        → show formatResult(result), add a history entry
      400 { error: string }         → show the message on the display in the error colour;
                                      the pending operator is dropped
      network / 5xx / timeout (10s) → Snackbar: "Couldn't reach the server. Your input is kept." + action "Retry";
                                      the calculator state is left unchanged
      (any other error is treated the same way)
    setLoading(false)
```

Retry re-sends the same operands and applies the answer as if it had just succeeded. Any key that changes state, Retry and Dismiss close the snackbar.

Error placement rule: **anything the user can fix → on the display. Anything about the server → Snackbar.**

### API contract

One endpoint per operation, `POST /api/<operation>` with `Content-Type: application/json`:

| Operation | Path | Body |
|---|---|---|
| add, subtract, multiply, divide, power | `/api/add`, `/api/subtract`, `/api/multiply`, `/api/divide`, `/api/power` | `{ "a": 2, "b": 3 }` |
| square root, percent (a ÷ 100) | `/api/sqrt`, `/api/percent` | `{ "a": 9 }` |

```
200 OK            { "result": 5 }
400 Bad Request   { "error": "Can’t divide by zero" }
```

A missing operand answers 400 "Enter a number"; a malformed body, an unknown field or a body over 1 KiB answers 400 "Invalid request body". Anything else is a 500.

---

## 9. Math rules (implemented in the Go backend, `backend/calc/calc.go`)

| Operation | Example |
|---|---|
| Add / subtract / multiply / divide | `12 + 8` = 20, `1 ÷ 4` = 0.25 |
| Power | `2 xʸ 10` = 1024 |
| Square root | `9 √` = 3 |
| Percent | `15 %` = 0.15; `80 × 15 % =` = 12 |

Results are rounded to at most 10 decimal places, half away from zero, to remove float noise (`0.1 + 0.2` = `0.3`); `−0` becomes `0`.

### Error messages (exact copy)

| Situation | Message |
|---|---|
| `48 ÷ 0` | Can’t divide by zero |
| `4 − 13 √` (negative root) | Can’t take the square root of a negative number |
| `0 xʸ −1` | Can’t raise 0 to a negative power |
| `−8 xʸ 0.5` | Result isn’t a real number |
| `10 xʸ 1000` | Result is too large to display |
| missing operand (API only) | Enter a number |
| bad request body (API only) | Invalid request body |

---

## 10. File layout

```
src/
  theme.ts
  lib/calculator.ts              ← operations, KEYPAD, formatResult, keyboard map
  lib/calculatorState.ts         ← reducer, requestFor(state, key), displayOf(state)
  lib/history.ts                 ← history entries, localStorage
  api/calculate.ts               ← the axios instance (10 s `timeout`, no AbortController) and callOperation(op, operands)
  hooks/useCalculator.ts         ← reducer + useMutation; press(key), retry, reuse, clearHistory
  components/
    CalculatorPanel.tsx          ← focusable Paper: display, LinearProgress, Keypad, keyboard handler
    Keypad.tsx                   ← KEYPAD → Buttons, coloured by kind
    HistoryPanel.tsx
  App.tsx                        ← AppBar, layout, history Drawer on mobile, Snackbar, focus
```

## 11. Accessibility checklist

- Every key is a `<Button>` with an `aria-label` for symbols (√, xʸ, ⌫, ÷ …).
- The calculator is a focusable `role="group"` labelled "Calculator"; the display is `aria-live="polite"`.
- LinearProgress has `aria-label="Calculating"`.
- Touch targets ≥ 44px (keys are 56/64px). The calculator panel has an explicit focus ring; MUI controls use their default focus styling.
- Colour contrast: all key text/background pairs above pass WCAG AA.

## 12. Acceptance checks

- `2 + 3 =` → 5, with one request to `/api/add`; `2 + 3 +` → shows 5, pending `5 +`.
- `2 + ×` → no request; the pending line reads `2 ×`.
- `9 √` → 3 · `80 × 15 % =` → 12 · `2 + 9 √ =` → 5.
- After `=`, a digit starts a new number and an operator continues from the result.
- `1 ÷ 0 =` → the display shows “Can’t divide by zero” in the error colour; a digit, C or CE recovers.
- CE keeps the pending operator; ⌫ edits the number being typed; C resets.
- Server down → Snackbar with Retry; the state is kept and Retry applies the result.
- Physical keyboard: `12+30{Enter}` → 42; Esc clears, Delete clears the entry.
- At 390px width: single column, history in drawer, keypad 64px keys, nothing scrolls horizontally.
