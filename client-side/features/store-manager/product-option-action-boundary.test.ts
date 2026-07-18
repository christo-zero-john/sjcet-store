import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("inline product option boundary", () => {
  it("uses one guarded database operation and refreshes the product form", () => {
    const actionSource = readFileSync(
      resolve(process.cwd(), "features/catalog/actions.ts"),
      "utf8",
    );
    const schemaSource = readFileSync(
      resolve(process.cwd(), "../docs/supabase/main_schema.sql"),
      "utf8",
    );

    expect(actionSource).toContain("export async function addProductOptionInline");
    expect(actionSource).toMatch(
      /rpc\(\s*"add_product_option_to_category"/,
    );
    expect(schemaSource).toContain(
      "create function public.add_product_option_to_category(",
    );
    expect(schemaSource).toContain(
      "'catalog.product_option_added_to_category'",
    );
    expect(schemaSource).toMatch(
      /revoke execute on function public\.add_product_option_to_category\([\s\S]*?from public, anon;/,
    );
  });

  it("keeps the applied inventory migration immutable and upgrades separately", () => {
    const migrationsDirectory = resolve(
      process.cwd(),
      "../docs/supabase/migrations",
    );
    const appliedMigration = readFileSync(
      resolve(
        migrationsDirectory,
        "20260718090000_product_first_inventory.sql",
      ),
      "utf8",
    );
    const upgradeMigration = readdirSync(migrationsDirectory).find((file) =>
      file.endsWith("_inline_product_options.sql"),
    );
    const editingMigration = readdirSync(migrationsDirectory).find((file) =>
      file.endsWith("_inline_catalog_editing.sql"),
    );

    expect(appliedMigration).not.toContain(
      "add_product_option_to_category",
    );
    expect(upgradeMigration).toBeDefined();
    expect(
      readFileSync(resolve(migrationsDirectory, upgradeMigration!), "utf8"),
    ).toContain("create function public.add_product_option_to_category(");
    expect(appliedMigration).not.toContain("update_catalog_option_inline");
    expect(
      readFileSync(resolve(migrationsDirectory, upgradeMigration!), "utf8"),
    ).not.toContain("update_catalog_option_inline");
    expect(editingMigration).toBeDefined();
    const editingSource = readFileSync(
      resolve(migrationsDirectory, editingMigration!),
      "utf8",
    );
    expect(editingSource).toContain(
      "create function public.update_category_inline(",
    );
    expect(editingSource).toContain(
      "create function public.update_catalog_option_inline(",
    );
    expect(editingSource).toContain(
      "create function public.get_category_option_usage(",
    );
  });
});
