package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"calculator_app/backend/calc"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	server := &http.Server{
		Addr:              ":8080",
		Handler:           newHandler(calc.Binary, calc.Unary),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
	}

	slog.Info("backend listening", "addr", server.Addr)
	if err := server.ListenAndServe(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
