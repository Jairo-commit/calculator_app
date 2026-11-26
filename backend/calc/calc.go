// Package calc evaluates arithmetic expressions without eval: tokenize,
// validate, then parse and evaluate in one recursive descent.
//
// It mirrors frontend/src/lib/calculator.ts. Both are checked against the same
// fixture, backend/calc/testdata/cases.json, so messages and results must stay
// identical in the two languages.
package calc

import (
	"math"
	"strconv"
	"strings"
	"unicode/utf8"
)

// MaxExpressionLength is the longest accepted expression, counted in code points.
const MaxExpressionLength = 200

// Messages maps an error code to its user-facing copy (DESIGN.md section 9).
var Messages = map[string]string{
	"EMPTY":                   "Enter an expression to calculate",
	"INVALID_CHAR":            "Only numbers, + − × ÷ ^ √ % and ( ) are allowed",
	"MULTI_DECIMAL":           "A number can only have one decimal point",
	"BARE_DECIMAL":            "A decimal point needs at least one digit",
	"MISSING_OPERATOR":        "Missing operator between values",
	"MISSING_OP_BEFORE_SQRT":  "Missing operator before √",
	"MISSING_OP_BEFORE_PAREN": "Missing operator before “(”",
	"PERCENT_PLACEMENT":       "% must follow a number or “)”",
	"START_OPERATOR":          "Expression can’t start with that operator",
	"TWO_OPERATORS":           "Two operators in a row",
	"OPERATOR_AFTER_PAREN":    "Operator right after “(”",
	"SQRT_NEEDS_ARG":          "√ needs a number after it",
	"UNMATCHED_CLOSE":         "Unmatched closing parenthesis",
	"INCOMPLETE_PARENS":       "Incomplete expression inside ( )",
	"END_OPERATOR":            "Expression can’t end with an operator",
	"MISSING_CLOSE":           "Missing closing parenthesis",
	"DIV_ZERO":                "Can’t divide by zero",
	"SQRT_NEGATIVE":           "Can’t take the square root of a negative number",
	"ZERO_NEG_POWER":          "Can’t raise 0 to a negative power",
	"NOT_REAL":                "Result isn’t a real number (e.g. negative base with a fractional power)",
	"TOO_LARGE":               "Result is too large to display",
	"TOO_LONG":                "Expression is too long",
}

// Error is a problem the user can fix in the expression.
type Error struct {
	Code    string
	Message string
	// Pos is the rune index of the offending token, or -1 when there is none.
	Pos int
}

func (e *Error) Error() string { return e.Message }

func newError(code string, pos int) *Error {
	return &Error{Code: code, Message: Messages[code], Pos: pos}
}

type tokenKind int

const (
	tNum tokenKind = iota
	tPlus
	tMinus
	tMul
	tDiv
	tPow
	tSqrt
	tPct
	tLParen
	tRParen
)

type token struct {
	kind  tokenKind
	pos   int
	value float64 // only meaningful for tNum
}

// isBlank reports whether r is whitespace. The set is explicit (not
// unicode.IsSpace) so that it matches the TypeScript engine exactly.
func isBlank(r rune) bool {
	return r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == ' '
}

func isDigit(r rune) bool { return r >= '0' && r <= '9' }

// isSqrtAt matches "sqrt" ASCII-only and case-insensitively on purpose, to
// keep parity with the TypeScript engine.
func isSqrtAt(runes []rune, i int) bool {
	const word = "sqrt"
	if i+len(word) > len(runes) {
		return false
	}
	for k := 0; k < len(word); k++ {
		r := runes[i+k]
		if r >= 'A' && r <= 'Z' {
			r += 'a' - 'A'
		}
		if r != rune(word[k]) {
			return false
		}
	}
	return true
}

var symbolKinds = map[rune]tokenKind{
	'×': tMul, '*': tMul,
	'÷': tDiv, '/': tDiv,
	'−': tMinus, '-': tMinus,
	'+': tPlus,
	'^': tPow,
	'√': tSqrt,
	'%': tPct,
	'(': tLParen,
	')': tRParen,
}

func tokenize(runes []rune) ([]token, error) {
	var tokens []token
	for i := 0; i < len(runes); {
		r := runes[i]
		switch {
		case isBlank(r):
			i++
		case isDigit(r) || r == '.':
			start := i
			dots := 0
			digits := 0
			for i < len(runes) && (isDigit(runes[i]) || runes[i] == '.') {
				if runes[i] == '.' {
					dots++
				} else {
					digits++
				}
				i++
			}
			if dots > 1 {
				return nil, newError("MULTI_DECIMAL", start)
			}
			if digits == 0 {
				return nil, newError("BARE_DECIMAL", start)
			}
			// An overflowing literal yields +Inf and is reported as TOO_LARGE
			// at evaluation time, so syntax errors win.
			value, _ := strconv.ParseFloat(string(runes[start:i]), 64)
			tokens = append(tokens, token{kind: tNum, pos: start, value: value})
		case isSqrtAt(runes, i):
			tokens = append(tokens, token{kind: tSqrt, pos: i})
			i += 4
		default:
			kind, ok := symbolKinds[r]
			if !ok {
				return nil, newError("INVALID_CHAR", i)
			}
			tokens = append(tokens, token{kind: kind, pos: i})
			i++
		}
	}
	return tokens, nil
}

// prevState classifies the previous token for the validator.
type prevState int

const (
	pStart      prevState = iota
	pValue                // number, ")" or "%"
	pLParen               // "("
	pBinary               // + × ÷ ^ or a binary −
	pUnaryMinus           // a − that does not follow a value
	pSqrt                 // √
)

func isBinaryNonMinus(k tokenKind) bool {
	return k == tPlus || k == tMul || k == tDiv || k == tPow
}

func validate(tokens []token) error {
	prev := pStart
	prevKind := tokenKind(-1) // -1: no previous token
	depth := 0
	for _, t := range tokens {
		if prev == pSqrt && (isBinaryNonMinus(t.kind) || t.kind == tRParen) {
			return newError("SQRT_NEEDS_ARG", t.pos)
		}
		var next prevState
		switch {
		case t.kind == tNum:
			if prev == pValue {
				return newError("MISSING_OPERATOR", t.pos)
			}
			next = pValue
		case t.kind == tSqrt:
			if prev == pValue {
				return newError("MISSING_OP_BEFORE_SQRT", t.pos)
			}
			next = pSqrt
		case t.kind == tLParen:
			if prev == pValue {
				return newError("MISSING_OP_BEFORE_PAREN", t.pos)
			}
			depth++
			next = pLParen
		case t.kind == tPct:
			if prevKind != tNum && prevKind != tRParen {
				return newError("PERCENT_PLACEMENT", t.pos)
			}
			next = pValue
		case isBinaryNonMinus(t.kind):
			switch prev {
			case pStart:
				return newError("START_OPERATOR", t.pos)
			case pLParen:
				return newError("OPERATOR_AFTER_PAREN", t.pos)
			case pBinary, pUnaryMinus:
				return newError("TWO_OPERATORS", t.pos)
			}
			next = pBinary
		case t.kind == tMinus:
			if prev == pValue {
				next = pBinary
			} else {
				next = pUnaryMinus
			}
		case t.kind == tRParen:
			if depth == 0 {
				return newError("UNMATCHED_CLOSE", t.pos)
			}
			if prev == pLParen || prev == pBinary || prev == pUnaryMinus {
				return newError("INCOMPLETE_PARENS", t.pos)
			}
			depth--
			next = pValue
		}
		prev, prevKind = next, t.kind
	}
	switch {
	case prev == pSqrt:
		return newError("SQRT_NEEDS_ARG", -1)
	case prev == pBinary || prev == pUnaryMinus:
		return newError("END_OPERATOR", -1)
	case depth > 0:
		return newError("MISSING_CLOSE", -1)
	}
	return nil
}

// evaluator is a recursive-descent parser that computes values as it goes.
// validate has already rejected malformed input, so unexpected tokens here are
// programming errors and surface as plain (non-*Error) errors.
type evaluator struct {
	tokens []token
	i      int
}

func (e *evaluator) peek() (tokenKind, bool) {
	if e.i >= len(e.tokens) {
		return 0, false
	}
	return e.tokens[e.i].kind, true
}

func (e *evaluator) accept(kinds ...tokenKind) (tokenKind, bool) {
	k, ok := e.peek()
	if !ok {
		return 0, false
	}
	for _, want := range kinds {
		if k == want {
			e.i++
			return k, true
		}
	}
	return 0, false
}

// check turns a non-finite intermediate result into the matching error.
func check(x float64) (float64, error) {
	switch {
	case math.IsNaN(x):
		return 0, newError("NOT_REAL", -1)
	case math.IsInf(x, 0):
		return 0, newError("TOO_LARGE", -1)
	}
	return x, nil
}

func (e *evaluator) expr() (float64, error) {
	left, err := e.term()
	if err != nil {
		return 0, err
	}
	for {
		op, ok := e.accept(tPlus, tMinus)
		if !ok {
			return left, nil
		}
		right, err := e.term()
		if err != nil {
			return 0, err
		}
		if op == tPlus {
			left, err = check(left + right)
		} else {
			left, err = check(left - right)
		}
		if err != nil {
			return 0, err
		}
	}
}

func (e *evaluator) term() (float64, error) {
	left, err := e.unary()
	if err != nil {
		return 0, err
	}
	for {
		op, ok := e.accept(tMul, tDiv)
		if !ok {
			return left, nil
		}
		right, err := e.unary()
		if err != nil {
			return 0, err
		}
		if op == tDiv {
			if right == 0 {
				return 0, newError("DIV_ZERO", -1)
			}
			left, err = check(left / right)
		} else {
			left, err = check(left * right)
		}
		if err != nil {
			return 0, err
		}
	}
}

func (e *evaluator) unary() (float64, error) {
	op, ok := e.accept(tMinus, tSqrt)
	if !ok {
		return e.power()
	}
	v, err := e.unary()
	if err != nil {
		return 0, err
	}
	if op == tMinus {
		return -v, nil
	}
	if v < 0 {
		return 0, newError("SQRT_NEGATIVE", -1)
	}
	return check(math.Sqrt(v))
}

func (e *evaluator) power() (float64, error) {
	base, err := e.postfix()
	if err != nil {
		return 0, err
	}
	if _, ok := e.accept(tPow); !ok {
		return base, nil
	}
	exp, err := e.unary()
	if err != nil {
		return 0, err
	}
	if base == 0 && exp < 0 {
		return 0, newError("ZERO_NEG_POWER", -1)
	}
	return check(math.Pow(base, exp))
}

func (e *evaluator) postfix() (float64, error) {
	v, err := e.primary()
	if err != nil {
		return 0, err
	}
	// The validator rejects "5%%", so a single optional % is all there is.
	if _, ok := e.accept(tPct); !ok {
		return v, nil
	}
	return check(v / 100)
}

func (e *evaluator) primary() (float64, error) {
	if e.i >= len(e.tokens) {
		return 0, errUnexpected
	}
	t := e.tokens[e.i]
	switch t.kind {
	case tNum:
		e.i++
		return check(t.value)
	case tLParen:
		e.i++
		v, err := e.expr()
		if err != nil {
			return 0, err
		}
		if _, ok := e.accept(tRParen); !ok {
			return 0, errUnexpected
		}
		return v, nil
	}
	return 0, errUnexpected
}

type internalError string

func (e internalError) Error() string { return string(e) }

const errUnexpected = internalError("calc: unexpected token after validation")

// round10 rounds to 10 decimal places, symmetrically for negatives. Magnitudes
// of 1e15 and above keep 15 significant digits instead, so math.Pow in Go and
// Math.pow in V8 (which can differ in the last digits) give the same result.
func round10(x float64) float64 {
	if math.Abs(x) >= 1e15 {
		r, err := strconv.ParseFloat(strconv.FormatFloat(x, 'g', 15, 64), 64)
		if err != nil {
			return x
		}
		return r
	}
	return math.Copysign(math.Round(math.Abs(x)*1e10)/1e10, x)
}

// Evaluate computes expr. A *Error means the user can fix the expression; any
// other error is an internal fault.
func Evaluate(expr string) (float64, error) {
	if utf8.RuneCountInString(expr) > MaxExpressionLength {
		return 0, newError("TOO_LONG", -1)
	}
	if strings.TrimFunc(expr, isBlank) == "" {
		return 0, newError("EMPTY", -1)
	}
	tokens, err := tokenize([]rune(expr))
	if err != nil {
		return 0, err
	}
	if err := validate(tokens); err != nil {
		return 0, err
	}
	ev := &evaluator{tokens: tokens}
	v, err := ev.expr()
	if err != nil {
		return 0, err
	}
	if ev.i != len(tokens) {
		return 0, errUnexpected
	}
	r := round10(v)
	if r == 0 {
		return 0, nil // also turns -0 into 0
	}
	return r, nil
}
