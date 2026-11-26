package calc

import (
	"errors"
	"math"
	"testing"
)

func TestBinaryOperations(t *testing.T) {
	tests := []struct {
		name string
		op   func(a, b float64) (float64, error)
		a, b float64
		want float64
	}{
		{"add", Add, 2, 3, 5},
		{"add float noise", Add, 0.1, 0.2, 0.3},
		{"subtract", Subtract, 2, 5, -3},
		{"multiply", Multiply, 80, 0.15, 12},
		{"divide", Divide, 1, 4, 0.25},
		{"divide repeating", Divide, 1, 3, 0.3333333333},
		{"power", Power, 2, 10, 1024},
		{"power fractional", Power, 9, 0.5, 3},
		{"zero to zero", Power, 0, 0, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op(tt.a, tt.b)
			if err != nil || got != tt.want {
				t.Errorf("got %v, %v; want %v", got, err, tt.want)
			}
		})
	}
}

func TestUnaryOperations(t *testing.T) {
	tests := []struct {
		name string
		op   func(a float64) (float64, error)
		a    float64
		want float64
	}{
		{"sqrt", Sqrt, 9, 3},
		{"sqrt irrational", Sqrt, 2, 1.4142135624},
		{"sqrt zero", Sqrt, 0, 0},
		{"percent", Percent, 15, 0.15},
		{"percent of negative", Percent, -50, -0.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op(tt.a)
			if err != nil || got != tt.want {
				t.Errorf("got %v, %v; want %v", got, err, tt.want)
			}
		})
	}
}

func TestErrors(t *testing.T) {
	tests := []struct {
		name    string
		call    func() (float64, error)
		code    Code
		message string
	}{
		{"divide by zero", func() (float64, error) { return Divide(1, 0) }, DivZero, "Can’t divide by zero"},
		{"sqrt of negative", func() (float64, error) { return Sqrt(-4) }, SqrtNegative, "Can’t take the square root of a negative number"},
		{"zero to negative power", func() (float64, error) { return Power(0, -1) }, ZeroNegPower, "Can’t raise 0 to a negative power"},
		{"negative base fractional power", func() (float64, error) { return Power(-8, 0.5) }, NotReal, "Result isn’t a real number"},
		{"power overflow", func() (float64, error) { return Power(10, 1000) }, TooLarge, "Result is too large to display"},
		{"multiply overflow", func() (float64, error) { return Multiply(1e308, 10) }, TooLarge, "Result is too large to display"},
		{"add overflow", func() (float64, error) { return Add(math.MaxFloat64, math.MaxFloat64) }, TooLarge, "Result is too large to display"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tt.call()
			var ce *Error
			if !errors.As(err, &ce) {
				t.Fatalf("want *Error, got %v", err)
			}
			if ce.Code != tt.code || ce.Message != tt.message {
				t.Errorf("got %q %q, want %q %q", ce.Code, ce.Message, tt.code, tt.message)
			}
		})
	}
}

func TestResultIsNeverNegativeZero(t *testing.T) {
	results := map[string]func() (float64, error){
		"multiply": func() (float64, error) { return Multiply(0, -1) },
		"divide":   func() (float64, error) { return Divide(-0.0, 5) },
		"percent":  func() (float64, error) { return Percent(-1e-11) },
		"subtract": func() (float64, error) { return Subtract(-0.00000000001, 0) },
	}
	for name, call := range results {
		t.Run(name, func(t *testing.T) {
			got, err := call()
			if err != nil {
				t.Fatal(err)
			}
			if got != 0 || math.Signbit(got) {
				t.Errorf("got %v (signbit %v), want +0", got, math.Signbit(got))
			}
		})
	}
}

func TestEveryEndpointNameIsRegisteredOnce(t *testing.T) {
	for name := range Binary {
		if _, dup := Unary[name]; dup {
			t.Errorf("%q is both binary and unary", name)
		}
	}
	if len(Binary) != 5 || len(Unary) != 2 {
		t.Errorf("want 5 binary and 2 unary operations, got %d and %d", len(Binary), len(Unary))
	}
}

func TestRound10(t *testing.T) {
	tests := []struct {
		in, want float64
	}{
		{0.1 + 0.2, 0.3},
		{1.0 / 3, 0.3333333333},
		{2.5e-10, 3e-10},                        // the double sits slightly above the tie
		{2.5e-11, 0},                            // below the 10th place
		{4.9e-11, 0},                            // keep == 0, first digit < 5
		{5e-11, 1e-10},                          // keep == 0, first digit >= 5
		{0.99999999996, 1},                      // carry through all nines bumps the exponent
		{1e15 + 0.5, 1e15},                      // 15 significant digits
		{1000000000000005, 1.00000000000001e15}, // tie goes up, not half-even
		{9.999999999999995e14, 1e15},
		{-5e-11, -1e-10}, // negative, keep == 0, first digit >= 5
		{1e300, 1e300},
	}
	for _, tt := range tests {
		if got := round10(tt.in); got != tt.want {
			t.Errorf("round10(%v) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestRound10IsSymmetricForNegatives(t *testing.T) {
	for _, x := range []float64{0.12345678905, 2.5e-11, 1234.56789012345, 0.99999999995, 1000000000000005, 2.2539340290692256e25} {
		if got, want := round10(-x), -round10(x); got != want {
			t.Errorf("round10(-%v) = %v, want %v", x, got, want)
		}
	}
}

func TestRound10ReturnsZeroAndNonFiniteAsIs(t *testing.T) {
	if got := round10(0); got != 0 {
		t.Errorf("round10(0) = %v", got)
	}
	if got := round10(math.Inf(1)); !math.IsInf(got, 1) {
		t.Errorf("round10(+Inf) = %v", got)
	}
}
