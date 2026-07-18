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
  it("passes imported Server Actions directly to action state", () => {
    const directBindings =
      source.match(/useActionState\(\s*createCategoryInline/g) ?? [];

    expect(directBindings).toHaveLength(1);
    expect(source).toContain(
      "editing ? updateCategoryInline : createCategoryInline",
    );
    expect(source).toMatch(/useActionState\(\s*mainAction/);
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
