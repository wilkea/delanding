"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api/client";
import { mapFieldErrors, toFormPath } from "@/lib/api/forms";

export type FieldLabels = Record<string, string>;

function labelFor(key: string, labels: FieldLabels): string {
  const [root, ...rest] = toFormPath(key).split(".");
  const label = Object.entries(labels).find(([field]) => field.toLowerCase() === root.toLowerCase())?.[1] ?? root;
  return [label, ...rest.map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))].join(" ");
}

export function useServerErrors<T extends FieldValues>(setError: UseFormSetError<T>, labels: FieldLabels) {
  const t = useTranslations("admin");
  const [messages, setMessages] = useState<string[]>([]);

  function show(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      setMessages([]);
      return;
    }

    if (!(error instanceof ApiError)) {
      setMessages([t("errors.unexpected")]);
      return;
    }

    if (error.status === 0) {
      setMessages([t("errors.unreachable")]);
      return;
    }

    mapFieldErrors(error, setError, Object.keys(labels));
    const fieldMessages = Object.entries(error.fieldErrors).flatMap(([key, list]) => list.map((m) => `${labelFor(key, labels)}: ${m}`));
    setMessages(fieldMessages.length > 0 ? fieldMessages : [error.message || t("errors.unexpected")]);
  }

  return { messages, show, clear: () => setMessages([]) };
}

export function ServerErrors({ messages }: { messages: string[] }) {
  const t = useTranslations("admin");
  if (messages.length === 0) {
    return null;
  }

  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{t("notSaved", { count: messages.length })}</p>
        <ul className="mt-1 list-disc pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
