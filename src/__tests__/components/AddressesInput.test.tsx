import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressesInput from "@/components/contacts/AddressesInput";
import type { RawAddressValues } from "@/lib/contacts/types";

function makeRow(overrides: Partial<RawAddressValues> = {}): RawAddressValues {
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

describe("AddressesInput", () => {
  it("keeps an error on its row after an earlier row is removed", async () => {
    render(
      <AddressesInput
        defaultValue={[makeRow(), makeRow({ type: "work", street: "" })]}
        rowErrors={{ 1: { street: "Street is required" } }}
      />,
    );

    // The error belongs to the second row (submitted index 1).
    const streets = screen.getAllByLabelText(/street/i);
    expect(streets[0]).not.toHaveAttribute("aria-invalid");
    expect(streets[1]).toHaveAttribute("aria-invalid", "true");

    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    // The invalid row is now first, but its error must not shift off it.
    const remaining = screen.getByLabelText(/street/i);
    expect(remaining).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Street is required")).toBeInTheDocument();
  });

  it("renders the type error as an accessible message", () => {
    render(
      <AddressesInput
        defaultValue={[makeRow()]}
        rowErrors={{ 0: { type: "Pick home, work, or other" } }}
      />,
    );

    const select = screen.getByLabelText(/type/i);
    const message = screen.getByText("Pick home, work, or other");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", message.id);
  });
});
