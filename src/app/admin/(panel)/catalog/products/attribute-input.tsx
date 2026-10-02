"use client";

import { useTranslations } from "next-intl";
import { LocalizedInput } from "@/components/admin/localized-input";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Swatch } from "@/components/admin/swatch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { textOf, type Localized } from "@/lib/api/types";
import type { Attribute, AttributeValue } from "./product-values";

const NONE = "__none";

type Props = { id: string; attribute: Attribute; value: AttributeValue | undefined; onChange: (value: AttributeValue) => void; invalid?: boolean };

export function AttributeInput({ id, attribute, value, onChange, invalid }: Props) {
  const t = useTranslations("admin.products");

  switch (attribute.dataType) {
    case "Option": {
      const selected = attribute.options.find((o) => o.code === value);
      return (
        <div className="flex items-center gap-2">
          {attribute.showAsSwatches && <Swatch colors={selected?.swatch} className="size-6" />}
          <SimpleSelect
            id={id}
            invalid={invalid}
            value={typeof value === "string" && value ? value : NONE}
            onChange={(next) => onChange(next === NONE ? "" : next)}
            options={[{ value: NONE, label: t("notSet") }, ...attribute.options.map((o) => ({ value: o.code, label: textOf(o.label) }))]}
          />
        </div>
      );
    }
    case "MultiOption": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div id={id} role="group" aria-label={textOf(attribute.name)} className="flex flex-wrap gap-x-4 gap-y-2 py-1">
          {attribute.options.map((o) => (
            <label key={o.code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={list.includes(o.code)}
                aria-invalid={invalid}
                onCheckedChange={(checked) => onChange(checked ? [...list, o.code] : list.filter((c) => c !== o.code))}
              />
              {attribute.showAsSwatches && <Swatch colors={o.swatch} />}
              {textOf(o.label)}
            </label>
          ))}
        </div>
      );
    }
    case "Number":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            inputMode="decimal"
            aria-invalid={invalid}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {attribute.unit && <span className="text-sm text-muted-foreground">{attribute.unit}</span>}
        </div>
      );
    case "Boolean":
      return (
        <SimpleSelect
          id={id}
          invalid={invalid}
          value={typeof value === "string" && value ? value : NONE}
          onChange={(next) => onChange(next === NONE ? "" : next)}
          options={[
            { value: NONE, label: t("notSet") },
            { value: "true", label: t("yes") },
            { value: "false", label: t("no") },
          ]}
        />
      );
    case "LocalizedText":
      return <LocalizedInput id={id} value={value as Localized | undefined} onChange={onChange} invalid={invalid} />;
    default:
      return <Input id={id} aria-invalid={invalid} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
  }
}
