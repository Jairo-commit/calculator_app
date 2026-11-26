/**
 * Expression engine: tokenize -> validate -> parse/evaluate (no eval).
 *
 * Mirrors backend/calc/calc.go. Both are checked against the shared fixture
 * backend/calc/testdata/cases.json, so messages and results must stay identical.
 */

export const MAX_EXPRESSION_LENGTH = 200;

/** User-facing copy, copied byte for byte from DESIGN.md section 9. */
export const ERRORS = {
  EMPTY: "Enter an expression to calculate",
  INVALID_CHAR: "Only numbers, + − × ÷ ^ √ % and ( ) are allowed",
  MULTI_DECIMAL: "A number can only have one decimal point",
  BARE_DECIMAL: "A decimal point needs at least one digit",
  MISSING_OPERATOR: "Missing operator between values",
  MISSING_OP_BEFORE_SQRT: "Missing operator before √",
  MISSING_OP_BEFORE_PAREN: "Missing operator before “(”",
  PERCENT_PLACEMENT: "% must follow a number or “)”",
  START_OPERATOR: "Expression can’t start with that operator",
  TWO_OPERATORS: "Two operators in a row",
  OPERATOR_AFTER_PAREN: "Operator right after “(”",
  SQRT_NEEDS_ARG: "√ needs a number after it",
  UNMATCHED_CLOSE: "Unmatched closing parenthesis",
  INCOMPLETE_PARENS: "Incomplete expression inside ( )",
  END_OPERATOR: "Expression can’t end with an operator",
  MISSING_CLOSE: "Missing closing parenthesis",
  DIV_ZERO: "Can’t divide by zero",
  SQRT_NEGATIVE: "Can’t take the square root of a negative number",
  ZERO_NEG_POWER: "Can’t raise 0 to a negative power",
  NOT_REAL:
    "Result isn’t a real number (e.g. negative base with a fractional power)",
  TOO_LARGE: "Result is too large to display",
  TOO_LONG: "Expression is too long",
} as const;

export type ErrorCode = keyof typeof ERRORS;

/** A problem the user can fix in the expression. */
export class CalcError extends Error {
  override name = "CalcError";

  constructor(
    readonly code: ErrorCode,
    /** Index of the offending token in the input, when there is one. */
    readonly pos?: number,
  ) {
    super(ERRORS[code]);
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type SymbolKind =
  | "PLUS"
  | "MINUS"
  | "MUL"
  | "DIV"
  | "POW"
  | "SQRT"
  | "PCT"
  | "LPAREN"
  | "RPAREN";

type Token =
  | { kind: "NUM"; pos: number; value: number }
  | { kind: SymbolKind; pos: number };

const SYMBOLS: Record<string, SymbolKind> = {
  "×": "MUL",
  "*": "MUL",
  "÷": "DIV",
  "/": "DIV",
  "−": "MINUS",
  "-": "MINUS",
  "+": "PLUS",
  "^": "POW",
  "√": "SQRT",
  "%": "PCT",
  "(": "LPAREN",
  ")": "RPAREN",
};

// Explicit set (not /\s/) so it matches the Go engine exactly.
const isBlank = (ch: string): boolean =>
  ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === " ";

const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";

const isBlankString = (s: string): boolean => Array.from(s).every(isBlank);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (isBlank(ch)) {
      i++;
    } else if (isDigit(ch) || ch === ".") {
      const start = i;
      let dots = 0;
      let digits = 0;
      while (i < input.length && (isDigit(input[i]) || input[i] === ".")) {
        if (input[i] === ".") dots++;
        else digits++;
        i++;
      }
      if (dots > 1) throw new CalcError("MULTI_DECIMAL", start);
      if (digits === 0) throw new CalcError("BARE_DECIMAL", start);
      // An overflowing literal becomes Infinity and is reported as TOO_LARGE
      // at evaluation time, so syntax errors win.
      tokens.push({
        kind: "NUM",
        pos: start,
        value: parseFloat(input.slice(start, i)),
      });
    } else if (/^sqrt/i.test(input.slice(i, i + 4))) {
      // ASCII-only and case-insensitive on purpose, to keep parity with Go.
      tokens.push({ kind: "SQRT", pos: i });
      i += 4;
    } else {
      const kind = SYMBOLS[ch];
      if (kind === undefined) throw new CalcError("INVALID_CHAR", i);
      tokens.push({ kind, pos: i });
      i++;
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/** What the previous token means for the next one. */
type Prev =
  | "start"
  | "value" // number, ")" or "%"
  | "lparen"
  | "binary" // + × ÷ ^ or a binary −
  | "unaryMinus" // a − that does not follow a value
  | "sqrt";

const isBinaryNonMinus = (kind: Token["kind"]): boolean =>
  kind === "PLUS" || kind === "MUL" || kind === "DIV" || kind === "POW";

function validate(tokens: Token[]): void {
  let prev: Prev = "start";
  let prevKind: Token["kind"] | null = null;
  let depth = 0;

  for (const t of tokens) {
    if (prev === "sqrt" && (isBinaryNonMinus(t.kind) || t.kind === "RPAREN")) {
      throw new CalcError("SQRT_NEEDS_ARG", t.pos);
    }

    let next: Prev;
    switch (t.kind) {
      case "NUM":
        if (prev === "value") throw new CalcError("MISSING_OPERATOR", t.pos);
        next = "value";
        break;
      case "SQRT":
        if (prev === "value")
          throw new CalcError("MISSING_OP_BEFORE_SQRT", t.pos);
        next = "sqrt";
        break;
      case "LPAREN":
        if (prev === "value")
          throw new CalcError("MISSING_OP_BEFORE_PAREN", t.pos);
        depth++;
        next = "lparen";
        break;
      case "PCT":
        if (prevKind !== "NUM" && prevKind !== "RPAREN") {
          throw new CalcError("PERCENT_PLACEMENT", t.pos);
        }
        next = "value";
        break;
      case "MINUS":
        next = prev === "value" ? "binary" : "unaryMinus";
        break;
      case "RPAREN":
        if (depth === 0) throw new CalcError("UNMATCHED_CLOSE", t.pos);
        if (prev === "lparen" || prev === "binary" || prev === "unaryMinus") {
          throw new CalcError("INCOMPLETE_PARENS", t.pos);
        }
        depth--;
        next = "value";
        break;
      default: // PLUS, MUL, DIV, POW
        if (prev === "start") throw new CalcError("START_OPERATOR", t.pos);
        if (prev === "lparen")
          throw new CalcError("OPERATOR_AFTER_PAREN", t.pos);
        if (prev === "binary" || prev === "unaryMinus") {
          throw new CalcError("TWO_OPERATORS", t.pos);
        }
        next = "binary";
    }
    prev = next;
    prevKind = t.kind;
  }

  if (prev === "sqrt") throw new CalcError("SQRT_NEEDS_ARG");
  if (prev === "binary" || prev === "unaryMinus") {
    throw new CalcError("END_OPERATOR");
  }
  if (depth > 0) throw new CalcError("MISSING_CLOSE");
}

// ---------------------------------------------------------------------------
// Evaluator (recursive descent, computes while parsing)
// ---------------------------------------------------------------------------

/** Turns a non-finite intermediate result into the matching error. */
function check(x: number): number {
  if (Number.isNaN(x)) throw new CalcError("NOT_REAL");
  if (!Number.isFinite(x)) throw new CalcError("TOO_LARGE");
  return x;
}

class Evaluator {
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  get done(): boolean {
    return this.i >= this.tokens.length;
  }

  private accept(...kinds: Token["kind"][]): Token["kind"] | null {
    const t = this.tokens[this.i];
    if (t !== undefined && kinds.includes(t.kind)) {
      this.i++;
      return t.kind;
    }
    return null;
  }

  // expr := term (('+' | '−') term)*
  expr(): number {
    let left = this.term();
    for (let op = this.accept("PLUS", "MINUS"); op;) {
      const right = this.term();
      left = check(op === "PLUS" ? left + right : left - right);
      op = this.accept("PLUS", "MINUS");
    }
    return left;
  }

  // term := unary (('×' | '÷') unary)*
  private term(): number {
    let left = this.unary();
    for (let op = this.accept("MUL", "DIV"); op;) {
      const right = this.unary();
      if (op === "DIV") {
        if (right === 0) throw new CalcError("DIV_ZERO");
        left = check(left / right);
      } else {
        left = check(left * right);
      }
      op = this.accept("MUL", "DIV");
    }
    return left;
  }

  // unary := ('−' | '√') unary | power
  private unary(): number {
    const op = this.accept("MINUS", "SQRT");
    if (op === null) return this.power();
    const v = this.unary();
    if (op === "MINUS") return -v;
    if (v < 0) throw new CalcError("SQRT_NEGATIVE");
    return check(Math.sqrt(v));
  }

  // power := postfix ('^' unary)?   (right-associative: 2^3^2 = 512)
  private power(): number {
    const base = this.postfix();
    if (this.accept("POW") === null) return base;
    const exp = this.unary();
    if (base === 0 && exp < 0) throw new CalcError("ZERO_NEG_POWER");
    return check(Math.pow(base, exp));
  }

  // postfix := primary '%'?   (the validator rejects "5%%")
  private postfix(): number {
    const v = this.primary();
    return this.accept("PCT") === null ? v : check(v / 100);
  }

  // primary := NUMBER | '(' expr ')'
  private primary(): number {
    const t = this.tokens[this.i];
    if (t?.kind === "NUM") {
      this.i++;
      return check(t.value);
    }
    if (t?.kind === "LPAREN") {
      this.i++;
      const v = this.expr();
      if (this.accept("RPAREN") === null) throw unexpectedToken();
      return v;
    }
    throw unexpectedToken();
  }
}

/** validate() rejects malformed input, so reaching this is a bug. */
const unexpectedToken = (): Error =>
  new Error("calculator: unexpected token after validation");

/**
 * Rounds to 10 decimal places. Rounds the absolute value so negatives behave
 * like positives (and like the Go engine). |x| >= 1e15 keeps 15 significant
 * digits so Math.pow and Go's math.Pow agree despite last-digit differences.
 */
function round10(x: number): number {
  if (Math.abs(x) >= 1e15) return Number(x.toPrecision(15));
  return Math.sign(x) * (Math.round(Math.abs(x) * 1e10) / 1e10);
}

/** Evaluates an expression; throws CalcError for anything the user can fix. */
export function evaluate(input: string): number {
  if (Array.from(input).length > MAX_EXPRESSION_LENGTH) {
    throw new CalcError("TOO_LONG");
  }
  if (isBlankString(input)) throw new CalcError("EMPTY");

  const tokens = tokenize(input);
  validate(tokens);

  const evaluator = new Evaluator(tokens);
  const value = evaluator.expr();
  if (!evaluator.done) throw unexpectedToken();

  const rounded = round10(value);
  return rounded === 0 ? 0 : rounded; // turns -0 into 0
}

// ---------------------------------------------------------------------------
// Live feedback and formatting
// ---------------------------------------------------------------------------

/**
 * The error to show while typing: only the length cap and lexical problems.
 * Incomplete expressions are not reported mid-typing, and neither are a
 * trailing "." or a trailing prefix of "sqrt" (s, sq, sqr).
 */
export function liveError(input: string): CalcError | null {
  if (Array.from(input).length > MAX_EXPRESSION_LENGTH) {
    return new CalcError("TOO_LONG");
  }
  try {
    tokenize(input);
    return null;
  } catch (e) {
    if (!(e instanceof CalcError)) throw e;
    const rest = input.trimEnd().slice(e.pos);
    const isTrailingDot = e.code === "BARE_DECIMAL" && rest === ".";
    const isSqrtPrefix =
      e.code === "INVALID_CHAR" && /^(s|sq|sqr)$/i.test(rest);
    return isTrailingDot || isSqrtPrefix ? null : e;
  }
}

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 10,
});

/** Formats with en-US grouping, up to 10 decimals, and a true minus sign. */
export function formatResult(n: number): string {
  return numberFormat.format(n).replace(/^-/, "−");
}

/** The formatted value of a valid expression, or null for anything else. */
export function preview(input: string): string | null {
  try {
    return formatResult(evaluate(input));
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Keypad
// ---------------------------------------------------------------------------

export type KeyKind = "num" | "op" | "fn" | "util" | "clear" | "equals";

export interface KeyDef {
  id: string;
  label: string;
  kind: KeyKind;
  /** Text appended to the expression; absent for clear, backspace and equals. */
  insert?: string;
  ariaLabel: string;
  span?: 1 | 2;
}

const digit = (d: string): KeyDef => ({
  id: d,
  label: d,
  kind: "num",
  insert: d,
  ariaLabel: d,
});

/** The 23 keys in grid order (4 columns). */
export const KEYPAD: readonly KeyDef[] = [
  { id: "clear", label: "C", kind: "clear", ariaLabel: "Clear" },
  {
    id: "lparen",
    label: "(",
    kind: "util",
    insert: "(",
    ariaLabel: "Open parenthesis",
  },
  {
    id: "rparen",
    label: ")",
    kind: "util",
    insert: ")",
    ariaLabel: "Close parenthesis",
  },
  { id: "backspace", label: "⌫", kind: "util", ariaLabel: "Backspace" },
  { id: "sqrt", label: "√", kind: "fn", insert: "√", ariaLabel: "Square root" },
  { id: "pow", label: "xʸ", kind: "fn", insert: " ^ ", ariaLabel: "Power" },
  { id: "percent", label: "%", kind: "fn", insert: "%", ariaLabel: "Percent" },
  { id: "divide", label: "÷", kind: "op", insert: " ÷ ", ariaLabel: "Divide" },
  digit("7"),
  digit("8"),
  digit("9"),
  {
    id: "multiply",
    label: "×",
    kind: "op",
    insert: " × ",
    ariaLabel: "Multiply",
  },
  digit("4"),
  digit("5"),
  digit("6"),
  { id: "minus", label: "−", kind: "op", insert: " − ", ariaLabel: "Minus" },
  digit("1"),
  digit("2"),
  digit("3"),
  { id: "plus", label: "+", kind: "op", insert: " + ", ariaLabel: "Plus" },
  digit("0"),
  {
    id: "decimal",
    label: ".",
    kind: "num",
    insert: ".",
    ariaLabel: "Decimal point",
  },
  { id: "equals", label: "=", kind: "equals", ariaLabel: "Equals", span: 2 },
];
