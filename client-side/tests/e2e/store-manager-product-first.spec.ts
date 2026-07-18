import { expect, test } from "@playwright/test";

const managerEmail = process.env.E2E_MANAGER_EMAIL;
const managerPassword = process.env.E2E_MANAGER_PASSWORD;

test.describe("product-first store manager", () => {
  test.skip(
    !managerEmail || !managerPassword,
    "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD for authenticated coverage.",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("College email").fill(managerEmail ?? "");
    await page.getByLabel("Password").fill(managerPassword ?? "");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/store-manager\/products/);
  });

  test("opens products first and keeps maintenance secondary", async ({
    page,
  }) => {
    await page.goto("/store-manager");
    await expect(page).toHaveURL(/\/store-manager\/products/);
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Catalog settings" }),
    ).toBeVisible();
  });

  test("starts detailed product-family entry without a wizard", async ({
    page,
  }) => {
    await page.goto("/store-manager/products/new");
    await expect(page.getByLabel("Product name")).toBeVisible();
    await expect(page.getByLabel("Brand (optional)")).toBeVisible();
    await expect(page.getByLabel("Parent category")).toBeVisible();
    await expect(page.getByLabel("Subcategory")).toBeVisible();
    await expect(page.getByLabel("Price (₹)")).toBeVisible();
    await expect(page.getByLabel("Opening stock")).toBeVisible();
    await expect(page.getByLabel("Barcode (optional)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate SKU" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Product options" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add product option" }).click();
    await expect(
      page.getByRole("heading", { name: "Add product option" }),
    ).toBeVisible();
    await expect(page.getByLabel("Option name")).toBeVisible();
    await expect(page.getByLabel("Allowed values")).toBeVisible();
  });

  test("creates categories inline without losing the product draft", async ({
    page,
  }) => {
    await page.goto("/store-manager/products/new");
    await page.getByLabel("Product name").fill("Preserved product draft");
    await page
      .getByLabel("Parent category")
      .selectOption("__new_parent__");
    await expect(
      page.getByRole("heading", { name: "Add new parent category" }),
    ).toBeVisible();
    await expect(page.getByText("Parameters", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Close category panel" })
      .first()
      .click();
    await expect(page.getByLabel("Product name")).toHaveValue(
      "Preserved product draft",
    );
  });

  test("keeps add and reduce stock as distinct tasks", async ({ page }) => {
    await page.goto("/store-manager/inventory");
    const firstVariant = page.locator(".product-table-row").first();
    test.skip((await firstVariant.count()) === 0, "Inventory has no variants.");
    await firstVariant.click();
    await expect(page.getByText("Add stock", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Record stock reduction", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("complementary")).toContainText(
      "Other variants",
    );
  });
});
