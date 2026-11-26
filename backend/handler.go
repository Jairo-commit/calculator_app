package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"calculator_app/backend/calc"
)

type (
	binaryOperation = func(firstOperand, secondOperand float64) (float64, error)
	unaryOperation  = func(firstOperand float64) (float64, error)
)

// operands is the request body; nil means the operand was missing or null.
type operands struct {
	FirstOperand  *float64 `json:"a"`
	SecondOperand *float64 `json:"b"`
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}

// newHandler serves POST /api/<name> for each operation and GET /api/health.
func newHandler(binaryOperations map[string]binaryOperation, unaryOperations map[string]unaryOperation) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	for name, operation := range binaryOperations {
		mux.HandleFunc("POST /api/"+name, serve(true, operation))
	}
	for name, operation := range unaryOperations {
		mux.HandleFunc("POST /api/"+name, serve(false, func(firstOperand, _ float64) (float64, error) { return operation(firstOperand) }))
	}
	return mux
}

// serve decodes the operands (second operand only when needsSecondOperand), runs operation and writes the result.
func serve(needsSecondOperand bool, operation binaryOperation) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var requestBody operands
		decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1<<10))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&requestBody); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
			return
		}
		if requestBody.FirstOperand == nil || (needsSecondOperand && requestBody.SecondOperand == nil) {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Enter a number"})
			return
		}
		var secondOperand float64
		if needsSecondOperand {
			secondOperand = *requestBody.SecondOperand
		}
		result, err := operation(*requestBody.FirstOperand, secondOperand)
		var calcErr *calc.Error
		switch {
		case errors.As(err, &calcErr):
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": calcErr.Message})
		case err != nil:
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		default:
			writeJSON(writer, http.StatusOK, map[string]float64{"result": result})
		}
	}
}
