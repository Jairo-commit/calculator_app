// Package calc holds the calculator's operations: one small function per
// operation, each returning a rounded result or a *Error the user can act on.
package calc

import (
	"math"
	"strconv"
	"strings"
)

// Code identifies a problem the user can fix.
type Code string

const (
	DivZero      Code = "DIV_ZERO"
	SqrtNegative Code = "SQRT_NEGATIVE"
	ZeroNegPower Code = "ZERO_NEG_POWER"
	NotReal      Code = "NOT_REAL"
	TooLarge     Code = "TOO_LARGE"
)

// messages maps each code to its user-facing copy (DESIGN.md section 9).
var messages = map[Code]string{
	DivZero:      "Can’t divide by zero",
	SqrtNegative: "Can’t take the square root of a negative number",
	ZeroNegPower: "Can’t raise 0 to a negative power",
	NotReal:      "Result isn’t a real number",
	TooLarge:     "Result is too large to display",
}

// Error is a problem the user can fix; any other error is an internal fault.
type Error struct {
	Code    Code
	Message string
}

func (e *Error) Error() string { return e.Message }

func newError(code Code) *Error {
	return &Error{Code: code, Message: messages[code]}
}

// finish turns a raw float result into the value to show: non-finite values
// become errors, the rest is rounded and -0 becomes 0.
func finish(x float64) (float64, error) {
	switch {
	case math.IsNaN(x):
		return 0, newError(NotReal)
	case math.IsInf(x, 0):
		return 0, newError(TooLarge)
	}
	r := round10(x)
	if r == 0 {
		return 0, nil // also turns -0 into 0
	}
	return r, nil
}

func Add(a, b float64) (float64, error)      { return finish(a + b) }
func Subtract(a, b float64) (float64, error) { return finish(a - b) }
func Multiply(a, b float64) (float64, error) { return finish(a * b) }

func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, newError(DivZero)
	}
	return finish(a / b)
}

func Power(a, b float64) (float64, error) {
	if a == 0 && b < 0 {
		return 0, newError(ZeroNegPower)
	}
	return finish(math.Pow(a, b))
}

func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, newError(SqrtNegative)
	}
	return finish(math.Sqrt(a))
}

// Percent is a/100.
func Percent(a float64) (float64, error) { return finish(a / 100) }

// Binary and Unary are the operations by endpoint name (POST /api/<name>).
var (
	Binary = map[string]func(a, b float64) (float64, error){
		"add":      Add,
		"subtract": Subtract,
		"multiply": Multiply,
		"divide":   Divide,
		"power":    Power,
	}
	Unary = map[string]func(a float64) (float64, error){
		"sqrt":    Sqrt,
		"percent": Percent,
	}
)

// round10 rounds to at most 10 decimal places and 15 significant digits, half
// away from zero, working on the 21-significant-digit expansion of the double so no
// floating-point arithmetic is involved. This hides float noise such as 0.1 + 0.2.
func round10(x float64) float64 {
	if x == 0 || math.IsInf(x, 0) || math.IsNaN(x) {
		return x
	}
	parts := strings.Split(strconv.FormatFloat(math.Abs(x), 'e', 20, 64), "e")
	digits := []byte(strings.Replace(parts[0], ".", "", 1)) // 21 digits
	for i := range digits {
		digits[i] -= '0'
	}
	exp, _ := strconv.Atoi(parts[1])
	keep := min(15, exp+1+10)
	sign := 1.0
	if x < 0 {
		sign = -1.0
	}
	if keep < 0 || (keep == 0 && digits[0] < 5) {
		return 0
	}
	if keep == 0 {
		r, _ := strconv.ParseFloat("1e"+strconv.Itoa(exp+1), 64)
		return sign * r
	}

	kept := digits[:keep]
	if digits[keep] >= 5 {
		i := keep - 1
		for i >= 0 && kept[i] == 9 {
			kept[i] = 0
			i--
		}
		if i >= 0 {
			kept[i]++
		} else {
			kept[0] = 1 // all nines carried: 99.9 -> 100
			exp++
		}
	}
	var sb strings.Builder
	sb.WriteByte('0' + kept[0])
	sb.WriteByte('.')
	for _, d := range kept[1:] {
		sb.WriteByte('0' + d)
	}
	sb.WriteString("e" + strconv.Itoa(exp))
	rounded, _ := strconv.ParseFloat(sb.String(), 64)
	if math.IsInf(rounded, 0) {
		return x
	}
	return sign * rounded
}
