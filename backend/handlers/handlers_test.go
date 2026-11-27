package handlers

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUnexpectedErrorsBecome500(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeResult(recorder, 0, errors.New("db down"))
	if recorder.Code != 500 {
		t.Fatalf("status %d, want 500", recorder.Code)
	}
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"error":"Internal server error"}` {
		t.Errorf("body %s", body)
	}
}
