import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as sectorsApi from "../api/sectors";
import { SectorChips } from "../components/SectorChips";
import type { SignupSectorInput } from "../api/types";
import { testSectors } from "./test-utils";

vi.mock("../api/sectors", () => ({
  listSectors: vi.fn(),
}));

describe("SectorChips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sectorsApi.listSectors).mockResolvedValue(testSectors);
  });

  it("loads sectors and toggles one selection", async () => {
    const onChange = vi.fn<(sectors: SignupSectorInput[]) => void>();
    render(<SectorChips value={[]} onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Product" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Product" }));

    expect(onChange).toHaveBeenCalledWith([{ key: "product", label: "Product" }]);
  });

  it("supports selecting multiple sectors and removing one", async () => {
    const onChange = vi.fn<(sectors: SignupSectorInput[]) => void>();
    const { rerender } = render(<SectorChips value={[]} onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Company" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    rerender(
      <SectorChips value={[{ key: "product", label: "Product" }]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Company" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { key: "product", label: "Product" },
      { key: "company", label: "Company" },
    ]);

    rerender(
      <SectorChips
        value={[{ key: "product", label: "Product" }, { key: "company", label: "Company" }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: "company", label: "Company" }]);
  });

  it("captures custom Other text in the signup payload shape", async () => {
    const onChange = vi.fn<(sectors: SignupSectorInput[]) => void>();
    render(<SectorChips value={[]} onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Other" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    const input = screen.getByPlaceholderText("Specify sector...");
    fireEvent.change(input, { target: { value: "People Operations" } });

    expect(onChange).toHaveBeenLastCalledWith([
      { key: "__other__", label: "People Operations" },
    ]);
  });

  it("removes the custom sector when Other is toggled off", async () => {
    const onChange = vi.fn<(sectors: SignupSectorInput[]) => void>();
    render(<SectorChips value={[]} onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Other" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: "Other" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
