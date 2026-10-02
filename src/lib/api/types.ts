import type { components } from "./schema";

export type Schemas = components["schemas"];
export type Localized = Record<string, string>;

export const languages = ["ro", "ru"] as const;
export type Language = (typeof languages)[number];

export function textOf(value: Localized | null | undefined, language: Language = "ro"): string {
  return value?.[language] || value?.ro || "";
}

export function cleanLocalized(value: Localized | undefined): Localized {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, text]) => text.trim().length > 0));
}
