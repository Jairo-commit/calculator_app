package calc

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"reflect"
	"strings"
	"testing"
)

type fixtureCase struct {
	Expr   string   `json:"expr"`
	Result *float64 `json:"result"`
	Error  *string  `json:"error"`
}

type fixture struct {
	Messages map[string]string `json:"messages"`
	Cases    []fixtureCase     `json:"cases"`
}

func loadFixture(t *testing.T) fixture {
	t.Helper()
	raw, err := os.ReadFile("testdata/cases.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f fixture
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return f
}

func TestMessagesMatchFixtureCatalog(t *testing.T) {
	f := loadFixture(t)
	if !reflect.DeepEqual(Messages, f.Messages) {
		t.Fatalf("Messages differ from fixture catalog:\ngot  %v\nwant %v", Messages, f.Messages)
	}
}

func TestFixtureCases(t *testing.T) {
	f := loadFixture(t)
	if len(f.Cases) == 0 {
		t.Fatal("fixture has no cases")
	}
	for _, c := range f.Cases {
		name := c.Expr
		if len(name) > 40 {
			name = name[:40]
		}
		t.Run(name, func(t *testing.T) {
			got, err := Evaluate(c.Expr)
			switch {
			case c.Error != nil:
				var ce *Error
				if !errors.As(err, &ce) {
					t.Fatalf("want *Error %q, got value %v err %v", *c.Error, got, err)
				}
				if ce.Message != *c.Error {
					t.Fatalf("message = %q, want %q", ce.Message, *c.Error)
				}
			case c.Result != nil:
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got != *c.Result {
					t.Fatalf("got %v, want %v", got, *c.Result)
				}
			default:
				t.Fatal("fixture case has neither result nor error")
			}
		})
	}
}

func TestRound10(t *testing.T) {
	tests := []struct {
		in, want float64
	}{
		{0.1 + 0.2, 0.3},
		{1.0 / 3, 0.3333333333},
		{2.5e-10, 3e-10},                        // the double sits slightly above the tie; the exact tie is the 1000000000000005 fixture
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

func TestEvaluateNeverReturnsNegativeZero(t *testing.T) {
	for _, expr := range []string{"0 × −1", "−0", "−0.00000000001"} {
		got, err := Evaluate(expr)
		if err != nil {
			t.Fatalf("%q: %v", expr, err)
		}
		if got != 0 || math.Signbit(got) {
			t.Errorf("%q = %v (signbit %v), want +0", expr, got, math.Signbit(got))
		}
	}
}

func TestLengthIsCountedInRunes(t *testing.T) {
	var ce *Error
	if _, err := Evaluate(strings.Repeat("1", 201)); !errors.As(err, &ce) || ce.Code != "TOO_LONG" {
		t.Errorf("201 digits: want TOO_LONG, got %v", err)
	}
	// "1×" repeated 99 times plus "11" is exactly 200 runes but more than 200
	// bytes (× takes two), so this fails if bytes were counted.
	expr := strings.Repeat("1×", 99) + "11"
	if n := len([]rune(expr)); n != 200 {
		t.Fatalf("test setup: %d runes", n)
	}
	got, err := Evaluate(expr)
	if err != nil || got != 11 {
		t.Errorf("200 runes: got %v, %v; want 11, nil", got, err)
	}
}

func TestErrorPositions(t *testing.T) {
	var ce *Error
	_, err := Evaluate("2 + a")
	if !errors.As(err, &ce) || ce.Code != "INVALID_CHAR" || ce.Pos != 4 {
		t.Errorf("got %+v", err)
	}
}
