import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./client";

export type FieldErrorResult = { applied: number; unmatched: string[] };

export function toFormPath(key: string): string {
  const dotted = key.replace(/\[(\d+)\]/g, ".$1");
  return dotted.charAt(0).toLowerCase() + dotted.slice(1);
}

export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): boolean {
  return mapFieldErrors(error, setError, fields).applied > 0;
}

export function mapFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): FieldErrorResult {
  const result: FieldErrorResult = { applied: 0, unmatched: [] };
  if (!(error instanceof ApiError)) {
    return result;
  }

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const path = toFormPath(key);
    const root = path.split(".")[0];
    const known = fields.find((f) => f.toLowerCase() === root.toLowerCase());
    if (known && messages.length > 0) {
      setError((known + path.slice(root.length)) as Path<T>, { type: "server", message: messages.join(" ") });
      result.applied++;
    } else {
      result.unmatched.push(...messages.map((m) => `${key}: ${m}`));
    }
  }

  return result;
}
