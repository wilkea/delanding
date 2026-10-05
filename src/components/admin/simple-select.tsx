"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function SimpleSelect({ id, value, options, onChange, placeholder, invalid, disabled, className, ...rest }: Props) {
  const t = useTranslations("admin.common");
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      disabled={disabled}
      itemToStringLabel={(item: SelectOption) => item.label}
      isItemEqualToValue={(item: SelectOption, current: SelectOption) => item.value === current.value}
      onValueChange={(item: SelectOption | null) => {
        if (item) {
          onChange(item.value);
        }
      }}
    >
      <ComboboxPrimitive.Trigger
        id={id}
        aria-label={rest["aria-label"]}
        aria-invalid={invalid}
        data-placeholder={selected ? undefined : ""}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent className="min-w-56">
        <ComboboxInput showTrigger={false} placeholder={t("search")} aria-label={t("search")} />
        <ComboboxEmpty>{t("noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(item: SelectOption) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="[overflow-wrap:anywhere]">{item.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
