"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { languages, type Language, type Localized } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: Localized | undefined;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  invalid?: boolean;
  placeholder?: string;
};

export function LocalizedInput({ id, value, onChange, multiline, invalid, placeholder }: Props) {
  const [language, setLanguage] = useState<Language>("ro");
  const current = value?.[language] ?? "";
  const Control = multiline ? Textarea : Input;

  return (
    <div className="flex flex-col gap-1.5">
      <div role="tablist" aria-label="Language" className="flex gap-1">
        {languages.map((lang) => {
          const filled = (value?.[lang] ?? "").trim().length > 0;
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={language === lang}
              aria-controls={`${id}-${lang}`}
              onClick={() => setLanguage(lang)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium uppercase transition-colors",
                language === lang ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {lang}
              {lang === "ro" && <span aria-hidden> *</span>}
              {!filled && lang !== "ro" && <span className="sr-only"> (empty)</span>}
            </button>
          );
        })}
      </div>
      <Control
        id={id}
        key={language}
        aria-label={`${id} ${language.toUpperCase()}`}
        aria-invalid={invalid && language === "ro"}
        placeholder={placeholder}
        value={current}
        onChange={(event) => onChange({ ...(value ?? {}), [language]: event.target.value })}
      />
    </div>
  );
}
