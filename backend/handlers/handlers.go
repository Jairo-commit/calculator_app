// Package handlers holds one HTTP handler per calculator endpoint.
package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"calculator_app/backend/calc"
)

// Two-number operations: the body is {"a": 6, "b": 3}.

func Add(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, calc.Add)
}

func Subtract(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, calc.Subtract)
}

func Multiply(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, calc.Multiply)
}

func Divide(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, calc.Divide)
}

func Power(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, calc.Power)
}

// One-number operations: the body is {"a": 9}.

func Sqrt(writer http.ResponseWriter, request *http.Request) {
	handleOneOperand(writer, request, calc.Sqrt)
}

func Percent(writer http.ResponseWriter, request *http.Request) {
	handleOneOperand(writer, request, calc.Percent)
}

// operands is the request body; nil means the operand was missing or null.
type operands struct {
	FirstOperand  *float64 `json:"a"`
	SecondOperand *float64 `json:"b"`
}

func handleTwoOperands(writer http.ResponseWriter, request *http.Request, operation func(firstOperand, secondOperand float64) (float64, error)) {
	requestBody, decoded := readOperands(writer, request)
	if !decoded {
		return
	}
	if requestBody.SecondOperand == nil {
		writeError(writer, http.StatusBadRequest, "Enter a number")
		return
	}
	result, err := operation(*requestBody.FirstOperand, *requestBody.SecondOperand)
	writeResult(writer, result, err)
}

func handleOneOperand(writer http.ResponseWriter, request *http.Request, operation func(value float64) (float64, error)) {
	requestBody, decoded := readOperands(writer, request)
	if !decoded {
		return
	}
	result, err := operation(*requestBody.FirstOperand)
	writeResult(writer, result, err)
}

// readOperands decodes the body (at most 1 KiB, no unknown fields, nothing
// after the object). On failure it writes the 400 itself and returns false.
func readOperands(writer http.ResponseWriter, request *http.Request) (operands, bool) {
	var requestBody operands
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&requestBody); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		writeError(writer, http.StatusBadRequest, "Invalid request body")
		return requestBody, false
	}
	if requestBody.FirstOperand == nil {
		writeError(writer, http.StatusBadRequest, "Enter a number")
		return requestBody, false
	}
	return requestBody, true
}

// writeResult sends the result, a 400 for a calc.Error the user can fix, or a 500.
func writeResult(writer http.ResponseWriter, result float64, err error) {
	var calcError *calc.Error
	switch {
	case errors.As(err, &calcError):
		writeError(writer, http.StatusBadRequest, calcError.Message)
	case err != nil:
		writeError(writer, http.StatusInternalServerError, "Internal server error")
	default:
		writeJSON(writer, http.StatusOK, map[string]float64{"result": result})
	}
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"error": message})
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}
