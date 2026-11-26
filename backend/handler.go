package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
	"unicode/utf8"

	"calculator_app/backend/calc"
)

// maxBodyBytes caps the request body; a valid request is far smaller than the
// 200-character expression limit.
const maxBodyBytes = 8 << 10

// evaluator computes an expression. A *calc.Error means the user's input is at
// fault (400); any other error is a server fault (500).
type evaluator func(expression string) (float64, error)

type calculateRequest struct {
	Expression string `json:"expression"`
}

type calculateResponse struct {
	Expression string  `json:"expression"`
	Result     float64 `json:"result"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// requestEvent is the single wide log event emitted for each request. Handlers
// enrich it; the middleware emits it once the request is finished.
type requestEvent struct {
	exprLen   int
	errorCode string
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

func calculateHandler(eval evaluator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ev, _ := r.Context().Value(eventKey{}).(*requestEvent)
		if ev == nil {
			ev = &requestEvent{}
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		var req calculateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				writeError(w, ev, http.StatusBadRequest, "TOO_LONG", calc.Messages["TOO_LONG"])
				return
			}
			writeError(w, ev, http.StatusBadRequest, "BAD_BODY", "Invalid request body")
			return
		}
		ev.exprLen = utf8.RuneCountInString(req.Expression)

		result, err := eval(req.Expression)
		var calcErr *calc.Error
		switch {
		case errors.As(err, &calcErr):
			writeError(w, ev, http.StatusBadRequest, calcErr.Code, calcErr.Message)
		case err != nil:
			slog.Error("evaluate", "error", err)
			writeError(w, ev, http.StatusInternalServerError, "INTERNAL", "Internal server error")
		default:
			writeJSON(w, http.StatusOK, calculateResponse{Expression: req.Expression, Result: result})
		}
	}
}

// observe recovers from panics and emits one structured log line per request.
// The expression itself is never logged, only its length.
func observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ev := &requestEvent{}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		r = r.WithContext(context.WithValue(r.Context(), eventKey{}, ev))

		defer func() {
			if p := recover(); p != nil {
				slog.Error("panic", "panic", p)
				rec.status = http.StatusInternalServerError
				writeError(w, ev, http.StatusInternalServerError, "PANIC", "Internal server error")
			}
			slog.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"expr_len", ev.exprLen,
				"error_code", ev.errorCode,
			)
		}()
		next.ServeHTTP(rec, r)
	})
}

// newHandler wires the routes. The evaluator is injected so tests can fake it.
func newHandler(eval evaluator) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/calculate", calculateHandler(eval))
	return observe(mux)
}
