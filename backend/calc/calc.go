// Package calc holds the calculator's operations. Each returns a rounded
// result or an *Error whose message the user can act on.
package calc

import (
	"math"
	"strconv"
)

// Error is a problem the user can fix; any other error is an internal fault.
type Error struct{ Message string }

func (e *Error) Error() string { return e.Message }

var (
	errDivZero      = &Error{"Can’t divide by zero"}
	errSqrtNegative = &Error{"Can’t take the square root of a negative number"}
	errZeroNegPower = &Error{"Can’t raise 0 to a negative power"}
	errNotReal      = &Error{"Result isn’t a real number"}
	errTooLarge     = &Error{"Result is too large to display"}
)

// finish rejects non-finite results, rounds away float noise (0.1+0.2 -> 0.3)
// and turns -0 into 0.
func finish(x float64) (float64, error) {
	switch {
	case math.IsNaN(x):
		return 0, errNotReal
	case math.IsInf(x, 0):
		return 0, errTooLarge
	}
	// Round via the decimal text: x*1e10 loses precision above ~1e9.
	x, _ = strconv.ParseFloat(strconv.FormatFloat(x, 'f', 10, 64), 64)
	if x == 0 {
		return 0, nil
	}
	return x, nil
}

func Add(a, b float64) (float64, error)      { return finish(a + b) }
func Subtract(a, b float64) (float64, error) { return finish(a - b) }
func Multiply(a, b float64) (float64, error) { return finish(a * b) }

func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errDivZero
	}
	return finish(a / b)
}

func Power(a, b float64) (float64, error) {
	if a == 0 && b < 0 {
		return 0, errZeroNegPower
	}
	return finish(math.Pow(a, b))
}

func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, errSqrtNegative
	}
	return finish(math.Sqrt(a))
}

func Percent(a float64) (float64, error) { return finish(a / 100) }

// Binary and Unary are the operations by endpoint name (POST /api/<name>).
var (
	Binary = map[string]func(a, b float64) (float64, error){
		"add": Add, "subtract": Subtract, "multiply": Multiply,
		"divide": Divide, "power": Power,
	}
	Unary = map[string]func(a float64) (float64, error){
		"sqrt": Sqrt, "percent": Percent,
	}
)
