package calc

import (
	"errors"
	"math"
	"testing"

	"calculator_app/backend/models"
)

func TestResults(t *testing.T) {
	tests := []struct {
		name string
		got  func() (float64, error)
		want float64
	}{
		{"float noise", func() (float64, error) { return Add(0.1, 0.2) }, 0.3},
		{"negative zero", func() (float64, error) { return Multiply(-1, 0) }, 0},
		{"power", func() (float64, error) { return Power(2, 10) }, 1024},
		{"sqrt", func() (float64, error) { return Sqrt(9) }, 3},
		{"percent", func() (float64, error) { return Percent(15) }, 0.15},
		{"values above 1e15 keep their fraction", func() (float64, error) { return Add(1e15, 0.5) }, 1e15 + 0.5},
		{"integers above 1e9 stay exact", func() (float64, error) { return Multiply(7439835882, 1) }, 7439835882},
		{"rounds to 10 decimals", func() (float64, error) { return Divide(1, 3) }, 0.3333333333},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := testCase.got()
			if err != nil || got != testCase.want || math.Signbit(got) {
				t.Errorf("got %v, %v; want %v", got, err, testCase.want)
			}
		})
	}
}

func TestErrors(t *testing.T) {
	tests := []struct {
		name string
		got  func() (float64, error)
		want string
	}{
		{"divide by zero", func() (float64, error) { return Divide(1, 0) }, "Can’t divide by zero"},
		{"sqrt negative", func() (float64, error) { return Sqrt(-1) }, "Can’t take the square root of a negative number"},
		{"zero to negative power", func() (float64, error) { return Power(0, -1) }, "Can’t raise 0 to a negative power"},
		{"not real", func() (float64, error) { return Power(-8, 0.5) }, "Result isn’t a real number"},
		{"too large", func() (float64, error) { return Multiply(1e200, 1e200) }, "Result is too large to display"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := testCase.got()
			var calculationError *models.CalculationError
			if !errors.As(err, &calculationError) || calculationError.Message != testCase.want {
				t.Errorf("got %v; want %q", err, testCase.want)
			}
		})
	}
}
