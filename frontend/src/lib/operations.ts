import type { BinaryOperation } from "../models/operation";

export const OPERATION_SYMBOLS: Record<BinaryOperation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
};

export const isBinaryOperation = (id: string): id is BinaryOperation =>
  Object.hasOwn(OPERATION_SYMBOLS, id);

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 10,
});

export const formatResult = (value: number): string =>
  numberFormat.format(value).replace(/^-/, "−");
