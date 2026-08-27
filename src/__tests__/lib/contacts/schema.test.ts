import {
  CONTACT_FIELDS,
  MAX_ADDRESSES,
  addressInputName,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { RawAddressValues } from "@/lib/contacts/types";

function address(overrides: Partial<RawAddressValues> = {}): RawAddressValues {
  return {
    type: "home",
    street: "1 Market St",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    ...overrides,
  };
}

function values(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    addresses: [],
    notes: "",
    photo: "",
    ...overrides,
  };
}

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).fieldErrors).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).fieldErrors.email).toBe(
      "Enter a valid email address",
    );
  });

  it("accepts an image data URL as the photo", () => {
    expect(contactInputSchema.parse(values({ photo: PHOTO })).photo).toBe(PHOTO);
  });

  it("rejects a photo that is not an image data URL", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "https://example.com/ada.png" }),
    );
    expect(zodFieldErrors(result.error!).fieldErrors.photo).toBe(
      "Photo must be a PNG, JPEG, WebP, or GIF image",
    );
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101) }),
    );

    expect(zodFieldErrors(result.error!).fieldErrors).toEqual({
      first_name: "First name must be 100 characters or fewer",
    });
  });

  it("parses an address row, nulling the blanks", () => {
    const parsed = contactInputSchema.parse(
      values({ addresses: [address({ type: "work", city: " London " })] }),
    );

    expect(parsed.addresses).toEqual([
      {
        type: "work",
        street: "1 Market St",
        city: "London",
        state: null,
        postal_code: null,
        country: null,
      },
    ]);
  });

  it("requires a street and a known type on each address, keyed by row", () => {
    const result = contactInputSchema.safeParse(
      values({
        addresses: [address(), address({ type: "castle", street: " " })],
      }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      fieldErrors: {},
      addressErrors: {
        1: {
          type: "Choose Home, Work, or Other",
          street: "Street is required",
        },
      },
    });
  });

  it("caps the list at the API's maximum", () => {
    const result = contactInputSchema.safeParse(
      values({ addresses: Array.from({ length: MAX_ADDRESSES + 1 }, address) }),
    );

    expect(zodFieldErrors(result.error!).fieldErrors.addresses).toBe(
      `A contact can have at most ${MAX_ADDRESSES} addresses`,
    );
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "addresses", "photo"].sort(),
    );
  });

  it("rebuilds address rows from indexed inputs, skipping removed indexes", () => {
    const formData = new FormData();
    // Row 1 was removed in the browser, leaving a gap in the indexes.
    for (const [index, street] of [
      [0, "1 Market St"],
      [2, "221B Baker St"],
    ] as const) {
      formData.set(addressInputName(index, "type"), index === 0 ? "home" : "work");
      formData.set(addressInputName(index, "street"), street);
    }

    expect(formDataToValues(formData).addresses).toEqual([
      address({ type: "home", street: "1 Market St" }),
      address({ type: "work", street: "221B Baker St" }),
    ]);
  });
});
