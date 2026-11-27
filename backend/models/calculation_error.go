package models

type CalculationError struct{ Message string }

func (calculationError *CalculationError) Error() string { return calculationError.Message }
