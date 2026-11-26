package calc

import (
	"math"
	"strconv"
)

type Error struct{ Message string }

func (calcError *Error) Error() string { return calcError.Message }

var (
	errDivZero      = &Error{"Can’t divide by zero"}
	errSqrtNegative = &Error{"Can’t take the square root of a negative number"}
	errZeroNegPower = &Error{"Can’t raise 0 to a negative power"}
	errNotReal      = &Error{"Result isn’t a real number"}
	errTooLarge     = &Error{"Result is too large to display"}
)

func finish(value float64) (float64, error) {
	switch {
	case math.IsNaN(value):
		return 0, errNotReal
	case math.IsInf(value, 0):
		return 0, errTooLarge
	}
	value, _ = strconv.ParseFloat(strconv.FormatFloat(value, 'f', 10, 64), 64)
	if value == 0 {
		return 0, nil
	}
	return value, nil
}

func Add(firstOperand, secondOperand float64) (float64, error) {
	return finish(firstOperand + secondOperand)
}
func Subtract(firstOperand, secondOperand float64) (float64, error) {
	return finish(firstOperand - secondOperand)
}
func Multiply(firstOperand, secondOperand float64) (float64, error) {
	return finish(firstOperand * secondOperand)
}

func Divide(dividend, divisor float64) (float64, error) {
	if divisor == 0 {
		return 0, errDivZero
	}
	return finish(dividend / divisor)
}

func Power(base, exponent float64) (float64, error) {
	if base == 0 && exponent < 0 {
		return 0, errZeroNegPower
	}
	return finish(math.Pow(base, exponent))
}

func Sqrt(value float64) (float64, error) {
	if value < 0 {
		return 0, errSqrtNegative
	}
	return finish(math.Sqrt(value))
}

func Percent(value float64) (float64, error) { return finish(value / 100) }
