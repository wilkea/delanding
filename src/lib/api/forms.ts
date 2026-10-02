import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./client";

export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  let applied = false;
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const field = fields.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length > 0) {
      setError(field, { type: "server", message: messages.join(" ") });
      applied = true;
    }
  }

  return applied;
}
