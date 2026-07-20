import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("authentication route composition", () => {
  it("uses the shared role destination after password login", () => {
    const contents = source("./actions.ts");
    expect(contents).toContain("destinationForRoles");
    expect(contents).not.toContain('redirect("/store-manager")');
  });

  it("uses the shared role destination after email confirmation", () => {
    const contents = source("../../app/auth/confirm/route.ts");
    expect(contents).toContain("destinationForRoles");
    expect(contents).not.toContain('new URL("/store-manager"');
  });

  it("resolves authenticated users from the public root", () => {
    const contents = source("../../app/page.tsx");
    expect(contents).toContain("requireRoleDestination");
  });

  it("prefers a validated payment return path after login", () => {
    const contents = source("./actions.ts");
    expect(contents).toContain("safeAuthReturnPath");
    expect(contents).toContain("redirect(next ?? destinationForRoles(roles))");
  });

  it("validates the return path before rendering the auth surface", () => {
    const contents = source("../../app/auth/page.tsx");
    expect(contents).toContain("safeAuthReturnPath");
  });
});
