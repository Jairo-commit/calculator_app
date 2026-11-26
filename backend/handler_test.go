package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"calculator_app/backend/calc"
)

func post(t *testing.T, h http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/calculate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func jsonBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("response is not JSON: %v (%q)", err, rec.Body.String())
	}
	return out
}

func TestCalculateReturnsResultAndEchoesExpression(t *testing.T) {
	rec := post(t, newHandler(calc.Evaluate), `{"expression":"√144 + 2 ^ 3 × 50%"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q", ct)
	}
	body := jsonBody(t, rec)
	if body["result"] != float64(16) || body["expression"] != "√144 + 2 ^ 3 × 50%" {
		t.Errorf("body = %v", body)
	}
}

func TestCalculateRejectsInvalidExpressionsWith400(t *testing.T) {
	cases := []struct{ name, body, want string }{
		{"two operators", `{"expression":"12 + × 4"}`, "Two operators in a row"},
		{"divide by zero", `{"expression":"48 ÷ 0"}`, "Can’t divide by zero"},
		{"missing field", `{}`, "Enter an expression to calculate"},
		{"too long", `{"expression":"` + strings.Repeat("1", 201) + `"}`, "Expression is too long"},
		{"body too large", `{"expression":"` + strings.Repeat("1", 9000) + `"}`, "Expression is too long"},
		{"malformed json", `{"expression":`, "Invalid request body"},
	}
	h := newHandler(calc.Evaluate)
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := post(t, h, c.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if got := jsonBody(t, rec)["error"]; got != c.want {
				t.Errorf("error = %q, want %q", got, c.want)
			}
		})
	}
}

func TestCalculateMapsUnexpectedErrorsTo500(t *testing.T) {
	h := newHandler(func(string) (float64, error) { return 0, errors.New("boom") })
	rec := post(t, h, `{"expression":"1"}`)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if got := jsonBody(t, rec)["error"]; got != "Internal server error" {
		t.Errorf("error = %q", got)
	}
}

func TestPanicIsRecoveredAs500(t *testing.T) {
	h := newHandler(func(string) (float64, error) { panic("kaboom") })
	rec := post(t, h, `{"expression":"1"}`)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if got := jsonBody(t, rec)["error"]; got != "Internal server error" {
		t.Errorf("error = %q", got)
	}
}

func TestGetCalculateIsMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/calculate", nil)
	rec := httptest.NewRecorder()
	newHandler(calc.Evaluate).ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHealthStillReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	newHandler(calc.Evaluate).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || jsonBody(t, rec)["status"] != "ok" {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
}

func TestEachRequestLogsOneEventWithoutTheExpression(t *testing.T) {
	var buf bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	post(t, newHandler(calc.Evaluate), `{"expression":"48 ÷ 0"}`)

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("want 1 log line, got %d: %q", len(lines), buf.String())
	}
	var event map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &event); err != nil {
		t.Fatal(err)
	}
	if event["status"] != float64(400) || event["expr_len"] != float64(6) || event["error_code"] != "DIV_ZERO" {
		t.Errorf("event = %v", event)
	}
	if strings.Contains(lines[0], "48") {
		t.Errorf("log leaks the expression: %s", lines[0])
	}
}
