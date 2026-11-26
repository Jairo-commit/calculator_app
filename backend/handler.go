package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"

	"calculator_app/backend/calc"
)

// maxBodyBytes caps the request body; a valid request is a few dozen bytes.
const maxBodyBytes = 1 << 10

// Aliases, not new types, so calc.Binary and calc.Unary can be passed as is.
type (
	binaryOp = func(a, b float64) (float64, error)
	unaryOp  = func(a float64) (float64, error)
)

// binaryInput and unaryInput document and validate the request body. Both
// operands are required: Huma marks a field required unless it is omitempty.
type binaryInput struct {
	Body struct {
		A float64 `json:"a" doc:"First operand" example:"2"`
		B float64 `json:"b" doc:"Second operand" example:"3"`
	}
}

type unaryInput struct {
	Body struct {
		A float64 `json:"a" doc:"The operand" example:"9"`
	}
}

type resultOutput struct {
	Body struct {
		Result float64 `json:"result" doc:"The result, rounded to at most 10 decimal places and 15 significant digits" example:"5"`
	}
}

type healthOutput struct {
	Body struct {
		Status string `json:"status" doc:"Always ok while the server is up" example:"ok"`
	}
}

// operation describes one calculator endpoint in the OpenAPI spec.
type operation struct {
	summary     string
	description string
}

// operations is the documentation for each endpoint, by name. An operation
// that is injected without an entry here is documented by its name alone.
var operations = map[string]operation{
	"add":      {summary: "Add", description: "Returns a + b."},
	"subtract": {summary: "Subtract", description: "Returns a − b."},
	"multiply": {summary: "Multiply", description: "Returns a × b."},
	"divide":   {summary: "Divide", description: "Returns a ÷ b. Fails when b is 0."},
	"power":    {summary: "Power", description: "Returns a to the power b. Fails for 0 to a negative power, for a result that is not a real number, or for one too large to display."},
	"sqrt":     {summary: "Square root", description: "Returns the square root of a. Fails when a is negative."},
	"percent":  {summary: "Percent", description: "Returns a ÷ 100."},
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
	writeJSON(w, status, errorResponse{status: status, Message: message})
}

// eventFrom returns the request's log event. Every route is registered behind
// observe, so a missing event is a wiring bug: panic, and observe answers 500.
func eventFrom(ctx context.Context) *requestEvent {
	return ctx.Value(eventKey{}).(*requestEvent)
}

// outcome turns the result of an operation into a response: a *calc.Error
// means the user's input is at fault (400); any other error is a server fault
// (500). The log event is enriched either way.
func outcome(ctx context.Context, result float64, err error) (*resultOutput, error) {
	ev := eventFrom(ctx)

	var calcErr *calc.Error
	switch {
	case errors.As(err, &calcErr):
		ev.errorCode = string(calcErr.Code)
		return nil, badRequest(calcErr.Message)
	case err != nil:
		ev.errorCode = "INTERNAL"
		ev.err = err.Error()
		return nil, &errorResponse{status: http.StatusInternalServerError, Message: "Internal server error"}
	}
	out := &resultOutput{}
	out.Body.Result = result
	return out, nil
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

// newOperation fills in what every calculator endpoint has in common.
func newOperation(name string) huma.Operation {
	doc := operations[name]
	return huma.Operation{
		OperationID:   name,
		Method:        http.MethodPost,
		Path:          "/api/" + name,
		Summary:       doc.summary,
		Description:   doc.description,
		Tags:          []string{"operations"},
		MaxBodyBytes:  maxBodyBytes,
		DefaultStatus: http.StatusOK,
		// Documents the 400; huma adds 422 and 500, and 422 is dropped below
		// because every client error is reported as a 400.
		Errors: []int{http.StatusBadRequest},
		// Runs before validation, so even a rejected body is logged with its op.
		Middlewares: huma.Middlewares{func(ctx huma.Context, next func(huma.Context)) {
			eventFrom(ctx.Context()).op = name
			next(ctx)
		}},
	}
}

// dropValidationStatus removes the 422 response Huma documents for operations
// with a body: validation failures are reported as 400 instead.
func dropValidationStatus(api huma.API, op huma.Operation) {
	delete(api.OpenAPI().Paths[op.Path].Post.Responses, "422")
}

func newConfig() huma.Config {
	config := huma.DefaultConfig("Calculator API", "1.0.0")
	config.Info.Description = "Every operation is its own endpoint and the backend does all the math. Errors are always `{\"error\": \"message\"}`."
	config.OpenAPIPath = "/api/openapi"
	config.DocsPath = "/api/docs"
	config.DocsRenderer = huma.DocsRendererSwaggerUI
	// The default hook adds a $schema property to every response body, which
	// would break the {"result": n} contract.
	config.CreateHooks = nil
	return config
}

// newHandler wires one POST /api/<name> route per operation. The operations
// are injected so tests can fake them.
func newHandler(binary map[string]binaryOp, unary map[string]unaryOp) http.Handler {
	mux := http.NewServeMux()
	api := humago.New(mux, newConfig())

	huma.Register(api, huma.Operation{
		OperationID: "health",
		Method:      http.MethodGet,
		Path:        "/api/health",
		Summary:     "Health check",
		Tags:        []string{"health"},
	}, func(context.Context, *struct{}) (*healthOutput, error) {
		out := &healthOutput{}
		out.Body.Status = "ok"
		return out, nil
	})

	for name, op := range binary {
		spec := newOperation(name)
		huma.Register(api, spec, func(ctx context.Context, in *binaryInput) (*resultOutput, error) {
			result, err := op(in.Body.A, in.Body.B)
			return outcome(ctx, result, err)
		})
		dropValidationStatus(api, spec)
	}
	for name, op := range unary {
		spec := newOperation(name)
		huma.Register(api, spec, func(ctx context.Context, in *unaryInput) (*resultOutput, error) {
			result, err := op(in.Body.A)
			return outcome(ctx, result, err)
		})
		dropValidationStatus(api, spec)
	}
	return observe(mux)
}
