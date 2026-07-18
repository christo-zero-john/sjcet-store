import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseInlineOptionValues } from "./catalog-input";

const actionSource = readFileSync(
  resolve(process.cwd(), "features/catalog/actions.ts"),
  "utf8",
);

describe("inline catalog edit actions", () => {
  it("exposes guarded load, update, and detach boundaries", () => {
    expect(actionSource).toContain(
      "export async function updateCategoryInline",
    );
    expect(actionSource).toContain(
      "export async function loadProductOptionInlineEditor",
    );
    expect(actionSource).toContain(
      "export async function updateProductOptionInline",
    );
    expect(actionSource).toContain(
      "export async function detachProductOptionInline",
    );
    expect(actionSource).toMatch(/rpc\(\s*"update_category_inline"/);
    expect(actionSource).toMatch(/rpc\(\s*"update_catalog_option_inline"/);
    expect(actionSource).toMatch(/rpc\(\s*"get_category_option_usage"/);
    expect(actionSource).toMatch(/rpc\(\s*"get_catalog_option_usage"/);
    expect(actionSource).toMatch(/rpc\(\s*"remove_category_attribute"/);
  });

  it("normalizes valid option rows", () => {
    expect(
      parseInlineOptionValues(
        JSON.stringify([
          { id: "blue", value: " Blue ", sort_order: 0 },
          { id: null, value: "Red", sort_order: 1 },
        ]),
      ),
    ).toEqual([
      { id: "blue", value: "Blue", sort_order: 0 },
      { id: null, value: "Red", sort_order: 1 },
    ]);
  });

  it.each([
    ["not-json", "Option values could not be read."],
    ["[]", "Add at least one option value."],
    [
      JSON.stringify([{ id: null, value: " ", sort_order: 0 }]),
      "Every option value needs a label.",
    ],
    [
      JSON.stringify([
        { id: null, value: "Blue", sort_order: 0 },
        { id: null, value: " blue ", sort_order: 1 },
      ]),
      "Option values must be unique.",
    ],
  ])("rejects invalid option rows", (input, message) => {
    expect(() => parseInlineOptionValues(input)).toThrow(message);
  });
});
