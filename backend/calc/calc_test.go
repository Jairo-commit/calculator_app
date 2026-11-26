package calc

import (
	"errors"
	"math"
	"testing"
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
		{"big values are not rounded", func() (float64, error) { return Add(1e15, 0.5) }, 1e15 + 0.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.got()
			if err != nil || got != tt.want || math.Signbit(got) {
				t.Errorf("got %v, %v; want %v", got, err, tt.want)
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
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tt.got()
			var calcErr *Error
			if !errors.As(err, &calcErr) || calcErr.Message != tt.want {
				t.Errorf("got %v; want %q", err, tt.want)
			}
		})
	}
}
