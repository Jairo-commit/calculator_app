# Calculator — Design

A calculator that works like an old pocket calculator. The React frontend only handles input and display; the Go backend does every calculation.

## How it works

- Type a number, press an operator, type another number.
- Pressing another operator or `=` calculates the result and waits for the next number: `2 + 3 +` shows `5`.
- Pressing two operators in a row just changes the operator.
- `√` and `%` act right away on the number on screen (`%` divides by 100).
- `⌫` deletes the last digit, `C` clears everything.
- A small line above the display shows what is pending, e.g. `5 +`.
- The last 8 results are kept in a history panel (saved in the browser). Clicking one reuses its result.
- The physical keyboard works too: digits, `+ - * / ^`, `Enter` for `=`, `Backspace`, `Esc` for C.

## Keypad

```
 [  C  ]   ⌫    ÷
 √    xʸ   %    ×
 7    8    9    −
 4    5    6    +
 1    2    3   [=]
 [  0  ]   .   [=]
```

## Errors

- A math error (e.g. dividing by zero) shows its message on the display. A digit or `C` continues.
- If the server can't be reached, a message offers **Retry** and nothing typed is lost.

## API

One endpoint per operation, all `POST`, all JSON.

| Path | Body |
|---|---|
| `/api/add`, `/api/subtract`, `/api/multiply`, `/api/divide`, `/api/power` | `{ "firstOperand": 2, "secondOperand": 3 }` |
| `/api/sqrt`, `/api/percent` | `{ "firstOperand": 9 }` |

- Success: `200 { "result": 5 }`
- Error: `400 { "error": "Can’t divide by zero" }`

Error messages: Can’t divide by zero · Can’t take the square root of a negative number · Can’t raise 0 to a negative power · Result isn’t a real number · Result is too large to display · Enter a number · Invalid request body.

Results are rounded to at most 10 decimals, so `0.1 + 0.2` gives `0.3`.

## Code layout

```
backend/
  main.go          routes, one line per endpoint
  handlers/        one handler per operation
  models/          request and response types
  operations/      the math

frontend/src/
  App.tsx          page layout
  components/      calculator panel, keypad, history
  hooks/           useCalculator: state + API calls
  lib/             keypad, state machine, history
  api/             the HTTP client
```

## Stack

- **Frontend:** React, TypeScript, MUI, Axios, TanStack Query
- **Backend:** Go, standard library only
