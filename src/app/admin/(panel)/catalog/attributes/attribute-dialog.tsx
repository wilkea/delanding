"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { LocalizedInput } from "@/components/admin/localized-input";
import { ServerErrors, submitWith, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Swatch } from "@/components/admin/swatch";
import { useNotify } from "@/components/admin/use-notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, call } from "@/lib/api/client";
import { cleanLocalized, type Localized, type Schemas } from "@/lib/api/types";
import { toCode } from "@/lib/text";

type Attribute = Schemas["AttributeResponse"];
type DataType = Schemas["AttributeDataType"];

const dataTypes: DataType[] = ["Option", "MultiOption", "Number", "Boolean", "Text", "LocalizedText"];
const withOptions = (type: DataType) => type === "Option" || type === "MultiOption";

type Values = {
  code: string;
  name: Localized;
  dataType: DataType;
  unit: string;
  isFilterable: boolean;
  showAsSwatches: boolean;
  options: { code: string; label: Localized; swatch: string[] }[];
};

const defaultColor = "#984AFE";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attribute?: Attribute | null;
  onSaved?: (attribute: Attribute) => void;
};

function defaults(attribute?: Attribute | null): Values {
  return attribute
    ? {
        code: attribute.code,
        name: attribute.name,
        dataType: attribute.dataType,
        unit: attribute.unit ?? "",
        isFilterable: attribute.isFilterable,
        showAsSwatches: attribute.showAsSwatches,
        options: attribute.options.map((o) => ({ code: o.code, label: o.label, swatch: o.swatch ?? [] })),
      }
    : { code: "", name: {}, dataType: "Option", unit: "", isFilterable: true, showAsSwatches: false, options: [] };
}

function SwatchEditor({ index, value, onChange }: { index: number; value: string[]; onChange: (value: string[]) => void }) {
  const t = useTranslations("admin.attributes");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Swatch colors={value} className="size-6" />
      {value.map((color, i) => (
        <span key={i} className="flex items-center gap-1 rounded-md border px-1.5 py-1">
          <input
            type="color"
            aria-label={`${t("color")} ${i + 1} option-${index}`}
            className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            value={color.toLowerCase()}
            onChange={(e) => onChange(value.map((c, j) => (j === i ? e.target.value.toUpperCase() : c)))}
          />
          <span className="font-mono text-xs text-muted-foreground">{color.toUpperCase()}</span>
          <button
            type="button"
            aria-label={`${t("removeColor")} ${i + 1} option-${index}`}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {value.length < 2 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${t("addColorFor")} option-${index}`}
          onClick={() => onChange([...value, value[0] ?? defaultColor])}
        >
          <Plus className="size-3" />
          {t("addColor")}
        </Button>
      )}
    </div>
  );
}

export function AttributeDialog({ open, onOpenChange, attribute, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <AttributeForm attribute={attribute} onSaved={onSaved} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AttributeForm({ attribute, onSaved, onClose }: { attribute?: Attribute | null; onSaved?: (attribute: Attribute) => void; onClose: () => void }) {
  const t = useTranslations("admin.attributes");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isNew = !attribute;
  const [codeTouched, setCodeTouched] = useState(!isNew);
  const form = useForm<Values>({ defaultValues: defaults(attribute) });
  const server = useServerErrors(form.setError, {
    code: t("code"),
    name: t("name"),
    dataType: t("type"),
    unit: t("unit"),
    options: t("options"),
    showAsSwatches: t("swatches"),
  });
  const options = useFieldArray({ control: form.control, name: "options" });
  const dataType = useWatch({ control: form.control, name: "dataType" });
  const showAsSwatches = useWatch({ control: form.control, name: "showAsSwatches" }) && withOptions(dataType);
  const nameRo = useWatch({ control: form.control, name: "name.ro" });

  useEffect(() => {
    if (isNew && !codeTouched) {
      form.setValue("code", toCode(nameRo ?? ""));
    }
  }, [nameRo, isNew, codeTouched, form]);

  async function onSubmit(values: Values) {
    server.clear();
    const payload = {
      name: cleanLocalized(values.name),
      unit: values.unit.trim() || null,
      isFilterable: values.isFilterable,
      showAsSwatches: withOptions(values.dataType) && values.showAsSwatches,
      options: withOptions(values.dataType)
        ? values.options.map((o, index) => ({
            code: o.code.trim() || toCode(o.label.ro ?? ""),
            label: cleanLocalized(o.label),
            sortOrder: index,
            swatch: values.showAsSwatches ? o.swatch : null,
          }))
        : null,
    };

    try {
      const saved = isNew
        ? await call(api.POST("/api/admin/attributes", { body: { ...payload, code: values.code, dataType: values.dataType } }))
        : await call(api.PUT("/api/admin/attributes/{id}", { params: { path: { id: attribute.id } }, body: payload }));

      await queryClient.invalidateQueries({ queryKey: ["attributes"] });
      notify.saved();
      onSaved?.(saved);
      onClose();
    } catch (error) {
      server.show(error);
    }
  }

  const errors = form.formState.errors;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? t("new") : t("edit")}</DialogTitle>
        <DialogDescription>{t("dialogHint")}</DialogDescription>
      </DialogHeader>
      <form id="attribute-form" onSubmit={submitWith(form, onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="attribute-name">{t("name")}</FieldLabel>
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <LocalizedInput id="attribute-name" value={field.value} onChange={field.onChange} invalid={!!errors.name} />
              )}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="attribute-code">{t("code")}</FieldLabel>
              <Input
                id="attribute-code"
                disabled={!isNew}
                aria-invalid={!!errors.code}
                {...form.register("code", { onChange: () => setCodeTouched(true) })}
              />
              <FieldError errors={[errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="attribute-type">{t("type")}</FieldLabel>
              <Controller
                control={form.control}
                name="dataType"
                render={({ field }) => (
                  <SimpleSelect
                    id="attribute-type"
                    value={field.value}
                    disabled={!isNew}
                    onChange={(value) => field.onChange(value as DataType)}
                    options={dataTypes.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            {dataType === "Number" ? (
              <Field data-invalid={!!errors.unit}>
                <FieldLabel htmlFor="attribute-unit">{t("unit")}</FieldLabel>
                <Input id="attribute-unit" placeholder="mm" {...form.register("unit")} />
                <FieldError errors={[errors.unit]} />
              </Field>
            ) : (
              <div />
            )}
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="isFilterable"
                render={({ field }) => (
                  <Switch id="attribute-filterable" checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} />
                )}
              />
              <FieldLabel htmlFor="attribute-filterable">{t("filterable")}</FieldLabel>
            </Field>
          </div>

          {withOptions(dataType) && (
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="showAsSwatches"
                render={({ field }) => (
                  <Switch
                    id="attribute-swatches"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked) {
                        form.getValues("options").forEach((o, i) => {
                          if (o.swatch.length === 0) {
                            form.setValue(`options.${i}.swatch`, [defaultColor]);
                          }
                        });
                      }
                    }}
                  />
                )}
              />
              <FieldLabel htmlFor="attribute-swatches">{t("swatches")}</FieldLabel>
            </Field>
          )}

          {withOptions(dataType) && (
            <Field>
              <FieldLabel>{t("options")}</FieldLabel>
              <ul className="flex flex-col gap-2">
                {options.fields.map((option, index) => (
                  <li key={option.id} className="rounded-lg border p-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Controller
                          control={form.control}
                          name={`options.${index}.label`}
                          render={({ field }) => (
                            <LocalizedInput
                              id={`option-${index}`}
                              value={field.value}
                              onChange={(label) => {
                                const current = form.getValues(`options.${index}.code`);
                                if (!option.code && (!current || current === toCode(field.value?.ro ?? ""))) {
                                  form.setValue(`options.${index}.code`, toCode(label.ro ?? ""));
                                }
                                field.onChange(label);
                              }}
                              placeholder={t("optionLabel")}
                              invalid={!!errors.options?.[index]?.label}
                            />
                          )}
                        />
                      </div>
                      <Input
                        aria-label={t("optionCode")}
                        className="mt-7 w-28 read-only:bg-muted read-only:text-muted-foreground"
                        placeholder={t("optionCode")}
                        readOnly={!!option.code}
                        title={option.code ? t("optionCodeLocked") : undefined}
                        {...form.register(`options.${index}.code`)}
                      />
                      <div className="mt-7 flex">
                        <Button type="button" variant="ghost" size="icon" aria-label={tc("moveUp")} disabled={index === 0} onClick={() => options.move(index, index - 1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={tc("moveDown")}
                          disabled={index === options.fields.length - 1}
                          onClick={() => options.move(index, index + 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={tc("remove")} onClick={() => options.remove(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {showAsSwatches && (
                      <Controller
                        control={form.control}
                        name={`options.${index}.swatch`}
                        render={({ field }) => <SwatchEditor index={index} value={field.value} onChange={field.onChange} />}
                      />
                    )}
                    <FieldError errors={[errors.options?.[index]?.code, errors.options?.[index]?.label, errors.options?.[index]?.swatch]} />
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => options.append({ code: "", label: {}, swatch: showAsSwatches ? [defaultColor] : [] })}
              >
                <Plus className="size-4" />
                {t("addOption")}
              </Button>
            </Field>
          )}

          <ServerErrors messages={server.messages} />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button type="submit" form="attribute-form" disabled={form.formState.isSubmitting}>
          {tc("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
