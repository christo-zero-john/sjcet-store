import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManagerShell } from "./manager-shell";

describe("store manager shell", () => {
  it("exposes the catalog, products, orders, and stock work areas", () => {
    const markup = renderToStaticMarkup(
      <ManagerShell userEmail="manager@store.sjcetpalai.ac.in">
        <p>Dashboard</p>
      </ManagerShell>,
    );

    expect(markup).toContain("Categories");
    expect(markup).toContain("Products");
    expect(markup).toContain("Counter sale");
    expect(markup).toContain("Orders");
    expect(markup).toContain("manager@store.sjcetpalai.ac.in");
  });
});
