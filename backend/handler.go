package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"calculator_app/backend/calc"
)

// maxBodyBytes caps the request body; a valid request is a few dozen bytes.
const maxBodyBytes = 1 << 10

// Aliases, not new types, so calc.Binary and calc.Unary can be passed as is.
type (
	binaryOp = func(a, b float64) (float64, error)
	unaryOp  = func(a float64) (float64, error)
)

// binaryRequest and unaryRequest use pointers so a missing operand can be told
// apart from a 0.
type binaryRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type unaryRequest struct {
	A *float64 `json:"a"`
}

type resultResponse struct {
	Result float64 `json:"result"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// requestEvent is the single wide log event emitted for each request. Handlers
// enrich it; the middleware emits it once the request is finished.
type requestEvent struct {
	op        string
	errorCode string
	err       string // internal error or panic detail, set only on a 500
}

type eventKey struct{}

// statusRecorder remembers the status code written by a handler.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write response", "error", err)
	}
}

func writeError(w http.ResponseWriter, ev *requestEvent, status int, code, message string) {
	ev.errorCode = code
	writeJSON(w, status, errorResponse{Error: message})
}

// decodeBody reads one JSON object into dst. It reports false after writing a
// 400 when the body is malformed, has unknown fields or is too large.
func decodeBody(w http.ResponseWriter, r *http.Request, ev *requestEvent, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeError(w, ev, http.StatusBadRequest, "BAD_BODY", "Invalid request body")
		return false
	}
	return true
}

// respond writes the outcome of an operation: a *calc.Error means the user's
// input is at fault (400); any other error is a server fault (500).
func respond(w http.ResponseWriter, ev *requestEvent, result float64, err error) {
	var calcErr *calc.Error
	switch {
	case errors.As(err, &calcErr):
		writeError(w, ev, http.StatusBadRequest, string(calcErr.Code), calcErr.Message)
	case err != nil:
		ev.err = err.Error()
		writeError(w, ev, http.StatusInternalServerError, "INTERNAL", "Internal server error")
	default:
		writeJSON(w, http.StatusOK, resultResponse{Result: result})
	}
}

func writeMissingOperand(w http.ResponseWriter, ev *requestEvent) {
	writeError(w, ev, http.StatusBadRequest, "MISSING_OPERAND", "Enter a number")
}

func binaryHandler(name string, op binaryOp) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Always registered behind observe; panics (recovered as a 500) if not.
		ev := r.Context().Value(eventKey{}).(*requestEvent)
		ev.op = name

		var req binaryRequest
		if !decodeBody(w, r, ev, &req) {
			return
		}
		if req.A == nil || req.B == nil {
			writeMissingOperand(w, ev)
			return
		}
		result, err := op(*req.A, *req.B)
		respond(w, ev, result, err)
	}
}

func unaryHandler(name string, op unaryOp) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Always registered behind observe; panics (recovered as a 500) if not.
		ev := r.Context().Value(eventKey{}).(*requestEvent)
		ev.op = name

		var req unaryRequest
		if !decodeBody(w, r, ev, &req) {
			return
		}
		if req.A == nil {
			writeMissingOperand(w, ev)
			return
		}
		result, err := op(*req.A)
		respond(w, ev, result, err)
	}
}

// observe recovers from panics and emits one structured log line per request.
// The operands are never logged, only the operation name.
func observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ev := &requestEvent{}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		r = r.WithContext(context.WithValue(r.Context(), eventKey{}, ev))

		defer func() {
			if p := recover(); p != nil {
				ev.err = fmt.Sprint("panic: ", p)
				rec.status = http.StatusInternalServerError
				writeError(w, ev, http.StatusInternalServerError, "PANIC", "Internal server error")
			}
			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"op", ev.op,
				"error_code", ev.errorCode,
			}
			level := slog.LevelInfo
			if ev.err != "" {
				attrs = append(attrs, "error", ev.err)
				level = slog.LevelError
			}
			slog.Log(r.Context(), level, "request", attrs...)
		}()
		next.ServeHTTP(rec, r)
	})
}

// newHandler wires one POST /api/<name> route per operation. The operations
// are injected so tests can fake them.
func newHandler(binary map[string]binaryOp, unary map[string]unaryOp) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	for name, op := range binary {
		mux.HandleFunc("POST /api/"+name, binaryHandler(name, op))
	}
	for name, op := range unary {
		mux.HandleFunc("POST /api/"+name, unaryHandler(name, op))
	}
	return observe(mux)
}
