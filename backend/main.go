package main

import (
	"fmt"
	"log"
	"net/http"

	"calculator_app/backend/handlers"
)

// newRouter lists every route. Each pattern is "METHOD /path".
func newRouter() *http.ServeMux {
	router := http.NewServeMux()

	// Two-number operations: {"a": 6, "b": 3}
	router.HandleFunc("POST /api/add", handlers.Add)
	router.HandleFunc("POST /api/subtract", handlers.Subtract)
	router.HandleFunc("POST /api/multiply", handlers.Multiply)
	router.HandleFunc("POST /api/divide", handlers.Divide)
	router.HandleFunc("POST /api/power", handlers.Power)

	// One-number operations: {"a": 9}
	router.HandleFunc("POST /api/sqrt", handlers.Sqrt)
	router.HandleFunc("POST /api/percent", handlers.Percent)

	return router
}

func main() {
	fmt.Println("Server started on port", 8080)
	log.Fatal(http.ListenAndServe(":8080", newRouter()))
}
