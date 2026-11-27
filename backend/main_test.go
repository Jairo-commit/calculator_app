package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRoutes(t *testing.T) {
	tests := []struct {
		name, method, path, body string
		status                   int
		want                     string
	}{
		{"add", "POST", "/api/add", `{"firstOperand":2,"secondOperand":3}`, 200, `{"result":5}`},
		{"subtract", "POST", "/api/subtract", `{"firstOperand":2,"secondOperand":3}`, 200, `{"result":-1}`},
		{"multiply", "POST", "/api/multiply", `{"firstOperand":2,"secondOperand":3}`, 200, `{"result":6}`},
		{"divide", "POST", "/api/divide", `{"firstOperand":6,"secondOperand":3}`, 200, `{"result":2}`},
		{"power", "POST", "/api/power", `{"firstOperand":2,"secondOperand":10}`, 200, `{"result":1024}`},
		{"sqrt", "POST", "/api/sqrt", `{"firstOperand":9}`, 200, `{"result":3}`},
		{"percent", "POST", "/api/percent", `{"firstOperand":15}`, 200, `{"result":0.15}`},
		{"divide by zero", "POST", "/api/divide", `{"firstOperand":1,"secondOperand":0}`, 400, `{"error":"Can’t divide by zero"}`},
		{"missing secondOperand", "POST", "/api/add", `{"firstOperand":2}`, 400, `{"error":"Enter a number"}`},
		{"null firstOperand", "POST", "/api/sqrt", `{"firstOperand":null}`, 400, `{"error":"Enter a number"}`},
		{"bad json", "POST", "/api/add", `{`, 400, `{"error":"Invalid request body"}`},
		{"unknown field", "POST", "/api/sqrt", `{"firstOperand":9,"c":1}`, 400, `{"error":"Invalid request body"}`},
		{"oversize body", "POST", "/api/sqrt", `{"firstOperand":9` + strings.Repeat(" ", 2000) + `}`, 400, `{"error":"Invalid request body"}`},
		{"trailing garbage", "POST", "/api/sqrt", `{"firstOperand":9}{"zzz`, 400, `{"error":"Invalid request body"}`},
		{"trailing brace", "POST", "/api/sqrt", `{"firstOperand":9}}`, 400, `{"error":"Invalid request body"}`},
		{"wrong method", "GET", "/api/add", ``, 405, ``},
	}
	router := newRouter()
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(testCase.body)))
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
