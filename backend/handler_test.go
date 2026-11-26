package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"calculator_app/backend/calc"
)

func TestHandler(t *testing.T) {
	failingOperations := map[string]binaryOperation{"boom": func(_, _ float64) (float64, error) { return 0, errors.New("db down") }}
	tests := []struct {
		name, method, path, body string
		status                   int
		want                     string
	}{
		{"add", "POST", "/api/add", `{"a":2,"b":3}`, 200, `{"result":5}`},
		{"subtract", "POST", "/api/subtract", `{"a":2,"b":3}`, 200, `{"result":-1}`},
		{"multiply", "POST", "/api/multiply", `{"a":2,"b":3}`, 200, `{"result":6}`},
		{"divide", "POST", "/api/divide", `{"a":6,"b":3}`, 200, `{"result":2}`},
		{"power", "POST", "/api/power", `{"a":2,"b":10}`, 200, `{"result":1024}`},
		{"sqrt", "POST", "/api/sqrt", `{"a":9}`, 200, `{"result":3}`},
		{"percent", "POST", "/api/percent", `{"a":15}`, 200, `{"result":0.15}`},
		{"divide by zero", "POST", "/api/divide", `{"a":1,"b":0}`, 400, `{"error":"Can’t divide by zero"}`},
		{"missing b", "POST", "/api/add", `{"a":2}`, 400, `{"error":"Enter a number"}`},
		{"null a", "POST", "/api/sqrt", `{"a":null}`, 400, `{"error":"Enter a number"}`},
		{"bad json", "POST", "/api/add", `{`, 400, `{"error":"Invalid request body"}`},
		{"unknown field", "POST", "/api/sqrt", `{"a":9,"c":1}`, 400, `{"error":"Invalid request body"}`},
		{"oversize body", "POST", "/api/sqrt", `{"a":9` + strings.Repeat(" ", 2000) + `}`, 400, `{"error":"Invalid request body"}`},
		{"trailing garbage", "POST", "/api/sqrt", `{"a":9}{"zzz`, 400, `{"error":"Invalid request body"}`},
		{"trailing brace", "POST", "/api/sqrt", `{"a":9}}`, 400, `{"error":"Invalid request body"}`},
		{"internal error", "POST", "/api/boom", `{"a":1,"b":1}`, 500, `{"error":"Internal server error"}`},
		{"wrong method", "GET", "/api/add", ``, 405, ``},
		{"health", "GET", "/api/health", ``, 200, `{"status":"ok"}`},
	}
	handler := newHandler(calc.BinaryOperations, calc.UnaryOperations)
	failingHandler := newHandler(failingOperations, nil)
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			selectedHandler := handler
			if testCase.name == "internal error" {
				selectedHandler = failingHandler
			}
			selectedHandler.ServeHTTP(recorder, httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(testCase.body)))
			if recorder.Code != testCase.status {
				t.Fatalf("status %d, want %d", recorder.Code, testCase.status)
			}
			if testCase.status == http.StatusMethodNotAllowed {
				return
			}
			if got := strings.TrimSpace(recorder.Body.String()); got != testCase.want {
				t.Errorf("body %s, want %s", got, testCase.want)
			}
			if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
				t.Errorf("Content-Type %q", contentType)
			}
		})
	}
}
