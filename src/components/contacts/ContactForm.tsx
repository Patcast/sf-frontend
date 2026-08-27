"use client";

import { Fragment, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import Field from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import AddressesInput from "@/components/contacts/AddressesInput";
import PhotoInput from "@/components/contacts/PhotoInput";
import { CONTACT_FIELD_GROUPS } from "@/lib/contacts/schema";
import {
  EMPTY_FORM_STATE,
  type Contact,
  type ContactInput,
  type FormState,
  type RawAddressValues,
} from "@/lib/contacts/types";

export type ContactFormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Create/edit form. The field list comes from `CONTACT_FIELD_GROUPS`, and the
 * action is a bound server action — so a submit is a plain POST that works
 * before hydration and reports errors through `useActionState`.
 */
export default function ContactForm({
  action,
  contact,
  submitLabel,
  cancelHref,
}: {
  action: ContactFormAction;
  contact?: Contact;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  function valueFor(name: Exclude<keyof ContactInput, "addresses">): string {
    return state.values?.[name] ?? contact?.[name] ?? "";
  }

  // A failed submit echoes the rows the user sent; otherwise seed from the
  // contact so a full-replace PUT carries existing addresses through.
  const addressDefaults: RawAddressValues[] =
    state.values?.addresses ??
    (contact?.addresses ?? []).map((address) => ({
      type: address.type,
      street: address.street,
      city: address.city ?? "",
      state: address.state ?? "",
      postal_code: address.postal_code ?? "",
      country: address.country ?? "",
    }));

  return (
    <form action={formAction} noValidate className="space-y-8">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{state.message}</span>
        </div>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="sr-only">Photo</legend>

        <div className="border-b border-hairline pb-2">
          <h2 className="font-display text-sm font-semibold text-foreground">
            Photo
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Optional profile picture. Without one, their initials are shown.
          </p>
        </div>

        <PhotoInput
          defaultValue={valueFor("photo")}
          error={state.fieldErrors?.photo}
        />
      </fieldset>

      {CONTACT_FIELD_GROUPS.map((group) => (
        <Fragment key={group.title}>
          {/* Structured data before free text: addresses slot in above Notes. */}
          {group.title === "Notes" ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Addresses</legend>

              <div className="border-b border-hairline pb-2">
                <h2 className="font-display text-sm font-semibold text-foreground">
                  Addresses
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  A contact can have several addresses, each marked Home, Work,
                  or Other.
                </p>
              </div>

              <AddressesInput
                defaultValue={addressDefaults}
                listError={state.fieldErrors?.addresses}
                rowErrors={state.addressErrors}
              />
            </fieldset>
          ) : null}

          <fieldset className="space-y-4">
            <legend className="sr-only">{group.title}</legend>

            <div className="border-b border-hairline pb-2">
              <h2 className="font-display text-sm font-semibold text-foreground">
                {group.title}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {group.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  defaultValue={valueFor(field.name)}
                  error={state.fieldErrors?.[field.name]}
                />
              ))}
            </div>
          </fieldset>
        </Fragment>
      ))}

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <SubmitButton label={submitLabel} />
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
