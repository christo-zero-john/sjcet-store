import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "features/store-manager/category-inline-panel.tsx",
  ),
  "utf8",
);

describe("inline category Server Action boundary", () => {
  it("passes the imported Server Action directly to both action states", () => {
    const directBindings =
      source.match(/useActionState\(\s*createCategoryInline/g) ?? [];

    expect(directBindings).toHaveLength(2);
    expect(source).not.toContain("await createCategoryInline");
  });

  it("supports the guarded inline category update action", () => {
    const actionSource = readFileSync(
      resolve(process.cwd(), "features/catalog/actions.ts"),
      "utf8",
    );

    expect(actionSource).toContain(
      "export async function updateCategoryInline",
    );
    expect(actionSource).toMatch(/rpc\(\s*"update_category_inline"/);
  });
});
