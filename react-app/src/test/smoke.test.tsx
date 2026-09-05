import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function SmokeComponent() {
  return <h1>Frontend test harness ready</h1>;
}

describe("frontend test harness", () => {
  it("renders a component in jsdom", () => {
    render(<SmokeComponent />);

    expect(screen.getByRole("heading", { name: "Frontend test harness ready" })).toBeTruthy();
  });
});
