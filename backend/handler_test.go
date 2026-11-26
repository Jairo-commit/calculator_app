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
	boom := map[string]binaryOp{"boom": func(a, b float64) (float64, error) { return 0, errors.New("db down") }}
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
	h := newHandler(calc.Binary, calc.Unary)
	hBoom := newHandler(boom, nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler := h
			if tt.name == "internal error" {
				handler = hBoom
			}
			handler.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
			if w.Code != tt.status {
				t.Fatalf("status %d, want %d", w.Code, tt.status)
			}
			if tt.status == http.StatusMethodNotAllowed {
				return
			}
			if got := strings.TrimSpace(w.Body.String()); got != tt.want {
				t.Errorf("body %s, want %s", got, tt.want)
			}
			if ct := w.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type %q", ct)
			}
		})
	}
}
