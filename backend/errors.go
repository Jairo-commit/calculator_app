package main

import (
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

// errorResponse is the only error body clients ever see, documented in the
// OpenAPI spec as the schema of every error response.
type errorResponse struct {
	status  int
	Message string `json:"error" doc:"What went wrong, in words fit to show the user" example:"Can’t divide by zero"`
}

func (e *errorResponse) Error() string  { return e.Message }
func (e *errorResponse) GetStatus() int { return e.status }

func badRequest(message string) *errorResponse {
	return &errorResponse{status: http.StatusBadRequest, Message: message}
}

func init() {
	// Replace Huma's RFC 9457 problem+json so every error is {"error": "..."}.
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		return classify(nil, status, errs)
	}
	huma.NewErrorWithContext = func(ctx huma.Context, status int, msg string, errs ...error) huma.StatusError {
		return classify(ctx, status, errs)
	}
}

// classify turns an error raised by Huma (a 4xx for a bad request or a 5xx for
// a server fault) into the API's error body, and records it on the request's
// log event when ctx is known. Every client error becomes a 400.
func classify(ctx huma.Context, status int, errs []error) *errorResponse {
	var ev *requestEvent
	if ctx != nil {
		ev, _ = ctx.Context().Value(eventKey{}).(*requestEvent)
	}
	if ev == nil {
		ev = &requestEvent{} // no request to enrich, e.g. building the spec
	}

	switch {
	case status >= http.StatusInternalServerError:
		ev.errorCode = "INTERNAL"
		ev.err = errors.Join(errs...).Error()
		return &errorResponse{status: http.StatusInternalServerError, Message: "Internal server error"}
	case onlyMissingOperands(errs):
		ev.errorCode = "MISSING_OPERAND"
		return badRequest("Enter a number")
	default:
		ev.errorCode = "BAD_BODY"
		return badRequest("Invalid request body")
	}
}

// onlyMissingOperands reports whether every validation error is a required
// operand that is absent or null, as opposed to a malformed or unexpected one.
func onlyMissingOperands(errs []error) bool {
	if len(errs) == 0 {
		return false
	}
	for _, err := range errs {
		detail, ok := err.(*huma.ErrorDetail)
		if !ok {
			return false
		}
		absent := strings.HasPrefix(detail.Message, "expected required property")
		null := detail.Value == nil && detail.Message == "expected number"
		if !absent && !null {
			return false
		}
	}
	return true
}
