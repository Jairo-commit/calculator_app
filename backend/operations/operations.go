package operations

import (
	"math"
	"strconv"

	"calculator_app/backend/models"
)

var (
	errDivZero      = &models.CalculationError{Message: "Can’t divide by zero"}
	errSqrtNegative = &models.CalculationError{Message: "Can’t take the square root of a negative number"}
	errZeroNegPower = &models.CalculationError{Message: "Can’t raise 0 to a negative power"}
	errNotReal      = &models.CalculationError{Message: "Result isn’t a real number"}
	errTooLarge     = &models.CalculationError{Message: "Result is too large to display"}
	errTooSmall     = &models.CalculationError{Message: "Result is too small to display"}
)

const (
	maxDecimals          = 10
	maxSignificantDigits = 15
	largestResult        = 999_999_999_999_999
)

func finish(value float64) (float64, error) {
	switch {
	case math.IsNaN(value):
		return 0, errNotReal
	case math.IsInf(value, 0):
		return 0, errTooLarge
	}
	rounded := round(value)
	switch {
	case math.Abs(rounded) > largestResult:
		return 0, errTooLarge
	case rounded == 0 && value != 0:
		return 0, errTooSmall
	case rounded == 0:
		return 0, nil
	}
	return rounded, nil
}

func round(value float64) float64 {
	toDecimals, _ := strconv.ParseFloat(strconv.FormatFloat(value, 'f', maxDecimals, 64), 64)
	toSignificantDigits, _ := strconv.ParseFloat(strconv.FormatFloat(toDecimals, 'g', maxSignificantDigits, 64), 64)
	return toSignificantDigits
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
