import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/apiClient";
import type {
  Address,
  Contact,
  ContactInput,
  ContactPage,
} from "@/lib/contacts/types";

/** Prefix a path with the configured API base so handlers match apiClient URLs. */
export function api(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 1,
    type: "home",
    street: "1 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: null,
    country: "USA",
    ...overrides,
  };
}

export function makeContact(overrides: Partial<Contact> = {}): Contact {
  const first_name = overrides.first_name ?? "Ada";
  const last_name = overrides.last_name ?? "Lovelace";

  return {
    id: 1,
    first_name,
    last_name,
    email: "ada@example.com",
    phone: "+1-415-555-0101",
    company: "Analytical Engines",
    job_title: "Mathematician",
    addresses: [
      makeAddress(),
      makeAddress({ id: 2, type: "work", street: "600 Guerrero St", postal_code: "94110" }),
    ],
    notes: null,
    photo: null,
    created_at: "2026-08-19T17:04:53.743932Z",
    updated_at: "2026-08-19T17:04:53.743936Z",
    full_name: `${first_name} ${last_name}`,
    ...overrides,
  };
}

/** Echo submitted addresses back the way the API would: with ids assigned. */
function withIds(addresses: ContactInput["addresses"] | undefined): Address[] {
  return (addresses ?? []).map((address, index) => ({
    id: index + 1,
    ...address,
  }));
}

export function makePage(items: Contact[], total = items.length): ContactPage {
  return { items, total, limit: 25, offset: 0 };
}

export const CONTACTS: Contact[] = [
  makeContact(),
  makeContact({
    id: 2,
    first_name: "Grace",
    last_name: "Hopper",
    email: "grace@example.com",
    company: "US Navy",
    job_title: "Rear Admiral",
    full_name: "Grace Hopper",
    addresses: [],
  }),
];

export const handlers = [
  http.get(api("/health"), () =>
    HttpResponse.json({ status: "ok", database: "sqlite", contacts: 2 }),
  ),

  http.get(api("/api/v1/contacts"), ({ request }) => {
    const search = new URL(request.url).searchParams.get("search")?.toLowerCase();
    const items = search
      ? CONTACTS.filter((contact) =>
          `${contact.full_name} ${contact.email} ${contact.company ?? ""}`
            .toLowerCase()
            .includes(search),
        )
      : CONTACTS;

    return HttpResponse.json(makePage(items));
  }),

  http.get(api("/api/v1/contacts/:id"), ({ params }) => {
    const contact = CONTACTS.find((c) => c.id === Number(params.id));
    return contact
      ? HttpResponse.json(contact)
      : HttpResponse.json(
          { detail: `Contact ${params.id} not found` },
          { status: 404 },
        );
  }),

  http.post(api("/api/v1/contacts"), async ({ request }) => {
    const body = (await request.json()) as Partial<ContactInput>;
    return HttpResponse.json(
      makeContact({ ...body, addresses: withIds(body.addresses), id: 99 }),
      { status: 201 },
    );
  }),

  http.put(api("/api/v1/contacts/:id"), async ({ request, params }) => {
    const body = (await request.json()) as Partial<ContactInput>;
    return HttpResponse.json(
      makeContact({
        ...body,
        addresses: withIds(body.addresses),
        id: Number(params.id),
      }),
    );
  }),

  http.delete(api("/api/v1/contacts/:id"), () => new HttpResponse(null, { status: 204 })),
];
