package main

import (
	"log"
	"net/http"
	"time"

	"calculator_app/backend/calc"
)

func main() {
	server := &http.Server{
		Addr:              ":8080",
		Handler:           newHandler(calc.BinaryOperations, calc.UnaryOperations),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}
