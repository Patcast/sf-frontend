"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { CONTROL } from "@/components/ui/Field";
import { ADDRESS_TYPE_LABELS } from "@/lib/contacts/format";
import {
  ADDRESS_FIELDS,
  MAX_ADDRESSES,
  addressInputName,
} from "@/lib/contacts/schema";
import {
  ADDRESS_TYPES,
  type AddressFieldErrors,
  type RawAddressValues,
} from "@/lib/contacts/types";

const EMPTY_ROW: RawAddressValues = {
  type: "home",
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

function borderClass(error?: string): string {
  return error
    ? "border-destructive focus:border-destructive"
    : "border-border focus:border-primary";
}

/**
 * One address row: a type select plus the postal text inputs, named
 * `addresses[i].field` so the surrounding form submits the whole list as a
 * plain POST. Inputs are uncontrolled, like every other field in the form.
 */
function AddressRow({
  index,
  initial,
  errors,
  onRemove,
}: {
  index: number;
  initial: RawAddressValues;
  errors?: AddressFieldErrors;
  onRemove: () => void;
}) {
  const typeId = `address-${index}-type`;

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label
            htmlFor={typeId}
            className="mb-1.5 block text-[13px] font-medium text-foreground"
          >
            Type
          </label>
          <select
            id={typeId}
            name={addressInputName(index, "type")}
            defaultValue={
              (ADDRESS_TYPES as readonly string[]).includes(initial.type)
                ? initial.type
                : "home"
            }
            className={`${CONTROL} ${borderClass(errors?.type)} w-auto pr-8`}
          >
            {ADDRESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {ADDRESS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Remove
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ADDRESS_FIELDS.map((field) => {
          const id = `address-${index}-${field.name}`;
          const error = errors?.[field.name];
          const errorId = `${id}-error`;

          return (
            <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
              <label
                htmlFor={id}
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                {field.label}
                {field.required ? (
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                ) : (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                    optional
                  </span>
                )}
              </label>
              <input
                id={id}
                type="text"
                name={addressInputName(index, field.name)}
                defaultValue={initial[field.name]}
                maxLength={field.maxLength}
                required={field.required}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={`${CONTROL} ${borderClass(error)}`}
              />
              {error ? (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-1.5 text-[13px] text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The contact's address list as add/removable rows. Existing addresses seed
 * the rows on edit, so a full-replace PUT carries them through untouched —
 * the same trap the photo field guards against.
 */
export default function AddressesInput({
  defaultValue,
  listError,
  rowErrors,
}: {
  defaultValue?: RawAddressValues[];
  /** List-level message, e.g. the max-addresses cap. */
  listError?: string;
  /** Per-row messages keyed by the row's submitted index. */
  rowErrors?: Record<number, AddressFieldErrors>;
}) {
  // Stable keys so removing a row doesn't re-mount (and wipe) the ones below it.
  const [rows, setRows] = useState<{ key: number; initial: RawAddressValues }[]>(
    () => (defaultValue ?? []).map((initial, key) => ({ key, initial })),
  );

  function addRow() {
    setRows((current) => {
      if (current.length >= MAX_ADDRESSES) return current;
      const key = current.reduce((max, row) => Math.max(max, row.key), -1) + 1;
      return [...current, { key, initial: EMPTY_ROW }];
    });
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <MapPin className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          No addresses yet. Add a home, work, or other address.
        </div>
      ) : (
        rows.map((row, index) => (
          <AddressRow
            key={row.key}
            index={index}
            initial={row.initial}
            errors={rowErrors?.[index]}
            onRemove={() => removeRow(row.key)}
          />
        ))
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={addRow}
        disabled={rows.length >= MAX_ADDRESSES}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </Button>

      {listError ? (
        <p role="alert" className="text-[13px] text-destructive">
          {listError}
        </p>
      ) : null}
    </div>
  );
}
