package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"calculator_app/backend/models"
	"calculator_app/backend/operations"
)

func Add(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, operations.Add)
}

func Subtract(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, operations.Subtract)
}

func Multiply(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, operations.Multiply)
}

func Divide(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, operations.Divide)
}

func Power(writer http.ResponseWriter, request *http.Request) {
	handleTwoOperands(writer, request, operations.Power)
}

func Sqrt(writer http.ResponseWriter, request *http.Request) {
	handleOneOperand(writer, request, operations.Sqrt)
}

func Percent(writer http.ResponseWriter, request *http.Request) {
	handleOneOperand(writer, request, operations.Percent)
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

func readOperands(writer http.ResponseWriter, request *http.Request) (models.Operands, bool) {
	var requestBody models.Operands
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

func writeResult(writer http.ResponseWriter, result float64, err error) {
	var calculationError *models.CalculationError
	switch {
	case errors.As(err, &calculationError):
		writeError(writer, http.StatusBadRequest, calculationError.Message)
	case err != nil:
		writeError(writer, http.StatusInternalServerError, "Internal server error")
	default:
		writeJSON(writer, http.StatusOK, models.ResultResponse{Result: result})
	}
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, models.ErrorResponse{Error: message})
}

func writeJSON[Body models.ResultResponse | models.ErrorResponse](writer http.ResponseWriter, status int, body Body) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}
