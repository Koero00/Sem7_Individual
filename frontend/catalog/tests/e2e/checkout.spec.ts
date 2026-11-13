import { expect, test } from "@playwright/test";

test("places a real order from the catalog and shows its confirmation", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto(process.env.E2E_FRONTEND_URL ?? "http://localhost:3000");

  await page.getByRole("button", { name: "Add one Nova Phone", exact: true }).click();
  await page.getByRole("button", { name: "Review order" }).click();

  const checkout = page.getByRole("dialog", { name: "Review order" });
  await checkout.getByLabel("Customer ID").fill("ci-browser-checkout");
  const submission = page.waitForResponse(response =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/orders",
  );
  await checkout.getByRole("button", { name: /^Place order/ }).click();
  expect((await submission).status()).toBe(202);

  const status = page.getByRole("dialog", { name: "Order status" });
  await expect(status.getByRole("heading", { name: "Your order is confirmed." }))
    .toBeVisible({ timeout: 60_000 });
  await expect(status.getByText("ci-browser-checkout")).toBeVisible();
});
