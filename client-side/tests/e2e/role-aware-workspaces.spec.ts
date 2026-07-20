import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel("College email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("renders auth and redirects anonymous manager access", async ({ page }) => {
  await page.goto("/store-manager");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("College email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("routes a super admin to the administration workspace", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_SUPER_ADMIN_EMAIL ||
      !process.env.E2E_SUPER_ADMIN_PASSWORD,
    "Set super-admin E2E credentials for authenticated coverage.",
  );
  await login(
    page,
    process.env.E2E_SUPER_ADMIN_EMAIL ?? "",
    process.env.E2E_SUPER_ADMIN_PASSWORD ?? "",
  );
  await expect(page).toHaveURL(/\/super-admin/);
  await expect(
    page.getByRole("heading", { name: "Store manager access" }),
  ).toBeVisible();
});

test("routes a student/customer to the minimal dashboard", async ({ page }) => {
  test.skip(
    !process.env.E2E_STUDENT_EMAIL || !process.env.E2E_STUDENT_PASSWORD,
    "Set student E2E credentials for authenticated coverage.",
  );
  await login(
    page,
    process.env.E2E_STUDENT_EMAIL ?? "",
    process.env.E2E_STUDENT_PASSWORD ?? "",
  );
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Student / customer account" }),
  ).toBeVisible();
  await page.goto("/store-manager");
  await expect(page).toHaveURL(/\/dashboard/);
});
