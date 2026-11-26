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

func realHandler() http.Handler { return newHandler(calc.Binary, calc.Unary) }

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func post(t *testing.T, h http.Handler, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	return do(t, h, http.MethodPost, path, body)
}

func jsonBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("response is not JSON: %v (%q)", err, rec.Body.String())
	}
	return out
}

// captureLogs routes slog to a buffer and returns it; the log lines are decoded
// by logEvents.
func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &buf
}

func logEvents(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var events []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		var event map[string]any
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			t.Fatalf("log line is not JSON: %v (%q)", err, line)
		}
		events = append(events, event)
	}
	return events
}

func TestEveryOperationReturnsItsResult(t *testing.T) {
	cases := []struct {
		path, body string
		want       float64
	}{
		{"/api/add", `{"a":2,"b":3}`, 5},
		{"/api/add", `{"a":0.1,"b":0.2}`, 0.3},
		{"/api/subtract", `{"a":2,"b":5}`, -3},
		{"/api/multiply", `{"a":80,"b":0.15}`, 12},
		{"/api/divide", `{"a":1,"b":4}`, 0.25},
		{"/api/power", `{"a":2,"b":10}`, 1024},
		{"/api/sqrt", `{"a":9}`, 3},
		{"/api/percent", `{"a":15}`, 0.15},
	}
	h := realHandler()
	for _, c := range cases {
		t.Run(c.path+" "+c.body, func(t *testing.T) {
			rec := post(t, h, c.path, c.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q", ct)
			}
			if got := jsonBody(t, rec)["result"]; got != c.want {
				t.Errorf("result = %v, want %v", got, c.want)
			}
		})
	}
}

func TestZeroIsAValidOperand(t *testing.T) {
	rec := post(t, realHandler(), "/api/add", `{"a":0,"b":0}`)

	if rec.Code != http.StatusOK || jsonBody(t, rec)["result"] != float64(0) {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
}

func TestBadRequestsReturn400WithAMessage(t *testing.T) {
	cases := []struct{ name, path, body, want string }{
		{"divide by zero", "/api/divide", `{"a":1,"b":0}`, "Can’t divide by zero"},
		{"sqrt of negative", "/api/sqrt", `{"a":-4}`, "Can’t take the square root of a negative number"},
		{"zero to negative power", "/api/power", `{"a":0,"b":-1}`, "Can’t raise 0 to a negative power"},
		{"not real", "/api/power", `{"a":-8,"b":0.5}`, "Result isn’t a real number"},
		{"too large", "/api/power", `{"a":10,"b":1000}`, "Result is too large to display"},
		{"missing b", "/api/add", `{"a":1}`, "Enter a number"},
		{"missing a", "/api/add", `{"b":1}`, "Enter a number"},
		{"null operand", "/api/add", `{"a":1,"b":null}`, "Enter a number"},
		{"missing unary operand", "/api/sqrt", `{}`, "Enter a number"},
		{"unknown field", "/api/add", `{"a":1,"b":2,"c":3}`, "Invalid request body"},
		{"extra operand on unary", "/api/sqrt", `{"a":9,"b":1}`, "Invalid request body"},
		{"malformed json", "/api/add", `{"a":`, "Invalid request body"},
		{"string operand", "/api/add", `{"a":"1","b":2}`, "Invalid request body"},
		{"operand out of range", "/api/add", `{"a":1e999,"b":2}`, "Invalid request body"},
		{"empty body", "/api/add", ``, "Invalid request body"},
		{"body over 1 KiB", "/api/add", `{"a":1,"b":2,"pad":"` + strings.Repeat("x", 1100) + `"}`, "Invalid request body"},
	}
	h := realHandler()
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := post(t, h, c.path, c.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if got := jsonBody(t, rec)["error"]; got != c.want {
				t.Errorf("error = %q, want %q", got, c.want)
			}
		})
	}
}

func TestUnknownOperationIs404(t *testing.T) {
	rec := post(t, realHandler(), "/api/modulo", `{"a":1,"b":2}`)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestGetOnAnOperationIsMethodNotAllowed(t *testing.T) {
	for _, path := range []string{"/api/add", "/api/sqrt"} {
		rec := do(t, realHandler(), http.MethodGet, path, "")
		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("GET %s: status = %d, want 405", path, rec.Code)
		}
	}
}

func TestHealthStillReturnsOK(t *testing.T) {
	rec := do(t, realHandler(), http.MethodGet, "/api/health", "")

	if rec.Code != http.StatusOK || jsonBody(t, rec)["status"] != "ok" {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
}

func TestEachRequestLogsOneEventWithTheOpAndNoOperands(t *testing.T) {
	buf := captureLogs(t)

	post(t, realHandler(), "/api/divide", `{"a":1234567,"b":0}`)

	events := logEvents(t, buf)
	if len(events) != 1 {
		t.Fatalf("want 1 log line, got %d: %q", len(events), buf.String())
	}
	event := events[0]
	if event["status"] != float64(400) || event["op"] != "divide" || event["error_code"] != "DIV_ZERO" {
		t.Errorf("event = %v", event)
	}
	if strings.Contains(buf.String(), "1234567") {
		t.Errorf("log leaks an operand: %s", buf.String())
	}
}

func TestSuccessfulUnaryRequestLogsItsOp(t *testing.T) {
	buf := captureLogs(t)

	post(t, realHandler(), "/api/sqrt", `{"a":9}`)

	events := logEvents(t, buf)
	if len(events) != 1 || events[0]["op"] != "sqrt" || events[0]["status"] != float64(200) {
		t.Fatalf("events = %v", events)
	}
}

func TestServerErrorsReturn500(t *testing.T) {
	cases := map[string]binaryOp{
		"error": func(a, b float64) (float64, error) { return 0, errors.New("boom") },
		"panic": func(a, b float64) (float64, error) { panic("kaboom") },
	}
	for name, op := range cases {
		t.Run(name, func(t *testing.T) {
			captureLogs(t)
			h := newHandler(map[string]binaryOp{"add": op}, nil)

			rec := post(t, h, "/api/add", `{"a":1,"b":1}`)

			if rec.Code != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", rec.Code)
			}
			if got := jsonBody(t, rec)["error"]; got != "Internal server error" {
				t.Errorf("error = %q", got)
			}
		})
	}
}

func TestServerErrorsLogOneEventCarryingTheError(t *testing.T) {
	binary := map[string]binaryOp{
		"add": func(a, b float64) (float64, error) { return 0, errors.New("boom") },
	}
	unary := map[string]unaryOp{
		"sqrt": func(a float64) (float64, error) { panic("kaboom") },
	}
	cases := map[string]struct{ path, body, op string }{
		"error": {"/api/add", `{"a":1,"b":1}`, "add"},
		"panic": {"/api/sqrt", `{"a":1}`, "sqrt"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			buf := captureLogs(t)

			post(t, newHandler(binary, unary), c.path, c.body)

			events := logEvents(t, buf)
			if len(events) != 1 {
				t.Fatalf("want 1 log line, got %d: %q", len(events), buf.String())
			}
			event := events[0]
			if event["msg"] != "request" || event["level"] != "ERROR" || event["status"] != float64(500) || event["op"] != c.op {
				t.Errorf("event = %v", event)
			}
			if event["error"] == nil || event["error"] == "" {
				t.Errorf("event carries no error: %v", event)
			}
		})
	}
}
