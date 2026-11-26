package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"calculator_app/backend/calc"
)

type (
	binaryOp = func(a, b float64) (float64, error)
	unaryOp  = func(a float64) (float64, error)
)

// operands is the request body; nil means the operand was missing or null.
type operands struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// newHandler serves POST /api/<name> for each operation and GET /api/health.
func newHandler(binary map[string]binaryOp, unary map[string]unaryOp) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	for name, op := range binary {
		mux.HandleFunc("POST /api/"+name, serve(true, op))
	}
	for name, op := range unary {
		mux.HandleFunc("POST /api/"+name, serve(false, func(a, _ float64) (float64, error) { return op(a) }))
	}
	return mux
}

// serve decodes the operands (b only when needsB), runs op and writes the result.
func serve(needsB bool, op binaryOp) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in operands
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&in); err != nil || dec.Decode(&struct{}{}) != io.EOF {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
			return
		}
		if in.A == nil || (needsB && in.B == nil) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Enter a number"})
			return
		}
		var b float64
		if needsB {
			b = *in.B
		}
		result, err := op(*in.A, b)
		var calcErr *calc.Error
		switch {
		case errors.As(err, &calcErr):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": calcErr.Message})
		case err != nil:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		default:
			writeJSON(w, http.StatusOK, map[string]float64{"result": result})
		}
	}
}
