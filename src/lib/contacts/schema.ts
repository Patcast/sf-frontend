import { z } from "zod";
import {
  ADDRESS_TYPES,
  type AddressFieldErrors,
  type AddressInput,
  type ContactInput,
  type RawAddressValues,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

/** Mirrors the API's photo rules: an image data URL, capped at 1 MB decoded. */
export const PHOTO_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,/;
export const PHOTO_MAX_LENGTH = 1_400_000; // ~1 MB of image, base64-encoded

/** Mirrors the API's cap on addresses per contact. */
export const MAX_ADDRESSES = 20;

/** One address row, matching the API's `AddressCreate`. */
export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES, "Choose Home, Work, or Other"),
  street: requiredText(300, "Street"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z
    .array(addressInputSchema)
    .max(MAX_ADDRESSES, `A contact can have at most ${MAX_ADDRESSES} addresses`)
    .default([]),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  photo: z
    .string()
    .trim()
    .max(PHOTO_MAX_LENGTH, "Photo must be 1 MB or smaller")
    .transform((value) => value || null)
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || PHOTO_DATA_URL.test(value),
      "Photo must be a PNG, JPEG, WebP, or GIF image",
    ),
}) satisfies z.ZodType<ContactInput, unknown>;

export interface ParsedFieldErrors {
  fieldErrors: Partial<Record<keyof ContactInput, string>>;
  addressErrors: Record<number, AddressFieldErrors>;
}

/**
 * Collapse a ZodError into one message per field. Scalar issues key by input
 * name; issues inside `addresses[i]` key by row index and address field, and a
 * list-level issue (too many rows) lands on `fieldErrors.addresses`.
 */
export function zodFieldErrors(error: z.ZodError): ParsedFieldErrors {
  const fieldErrors: ParsedFieldErrors["fieldErrors"] = {};
  const addressErrors: ParsedFieldErrors["addressErrors"] = {};

  for (const issue of error.issues) {
    const [root, index, field] = issue.path;
    if (root === "addresses" && typeof index === "number") {
      const row = (addressErrors[index] ??= {});
      if (typeof field === "string" && !(field in row)) {
        row[field as keyof AddressFieldErrors] = issue.message;
      }
    } else if (typeof root === "string" && !(root in fieldErrors)) {
      fieldErrors[root as keyof ContactInput] = issue.message;
    }
  }
  return { fieldErrors, addressErrors };
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: keyof ContactInput;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The text inputs of one address row, in display order. */
export const ADDRESS_FIELDS: {
  name: Exclude<keyof AddressInput, "type">;
  label: string;
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete: string;
  wide?: boolean;
}[] = [
  {
    name: "street",
    label: "Street",
    required: true,
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    autoComplete: "street-address",
    wide: true,
  },
  {
    name: "city",
    label: "City",
    maxLength: 120,
    placeholder: "San Francisco",
    autoComplete: "address-level2",
  },
  {
    name: "state",
    label: "State / region",
    maxLength: 120,
    placeholder: "CA",
    autoComplete: "address-level1",
  },
  {
    name: "postal_code",
    label: "Postal code",
    maxLength: 20,
    placeholder: "94105",
    autoComplete: "postal-code",
  },
  {
    name: "country",
    label: "Country",
    maxLength: 120,
    placeholder: "USA",
    autoComplete: "country-name",
  },
];

/** `addresses[3].street` → the input name for one field of one address row. */
export function addressInputName(
  index: number,
  field: keyof AddressInput,
): string {
  return `addresses[${index}].${field}`;
}

const ADDRESS_INPUT_NAME = /^addresses\[(\d+)\]\.(type|street|city|state|postal_code|country)$/;

/**
 * Pull the contact fields out of a submitted form, as raw strings. Address rows
 * arrive as `addresses[i].field` inputs; rows are rebuilt in index order (gaps
 * from removed rows are simply skipped).
 */
export function formDataToValues(formData: FormData): {
  addresses: RawAddressValues[];
} & Record<Exclude<keyof ContactInput, "addresses">, string> {
  const rows = new Map<number, Partial<RawAddressValues>>();
  for (const key of formData.keys()) {
    const match = ADDRESS_INPUT_NAME.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    const field = match[2] as keyof RawAddressValues;
    const row = rows.get(index) ?? {};
    row[field] = String(formData.get(key) ?? "");
    rows.set(index, row);
  }

  const addresses = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => ({
      type: "",
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
      ...row,
    }));

  return {
    ...(Object.fromEntries(
      CONTACT_FIELDS.map((field) => [
        field.name,
        String(formData.get(field.name) ?? ""),
      ]),
    ) as Record<Exclude<keyof ContactInput, "addresses">, string>),
    // The photo is a hidden input managed by PhotoInput, not a CONTACT_FIELDS entry.
    photo: String(formData.get("photo") ?? ""),
    addresses,
  };
}
