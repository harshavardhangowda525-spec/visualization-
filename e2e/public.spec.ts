import { test, expect } from "@playwright/test";
test("discover a studio, read availability and reach secure sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "CREATE. CAPTURE. EXPERIENCE." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore studios", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Room for your vision." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View studio & availability" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Book your session." }),
  ).toBeVisible();
  const date = new Date();
  date.setDate(date.getDate() + 2);
  await page
    .getByLabel("Date", { exact: true })
    .fill(date.toISOString().slice(0, 10));
  await expect(page.getByRole("radio").first()).toBeAttached();
  await page.getByText("9:00 am", { exact: true }).click();
  await page.getByRole("button", { name: "Reserve & continue" }).click();
  await expect(
    page.getByText("Sign in to reserve your session."),
  ).toBeVisible();
});
test("filters respond, FAQ expands and mobile navigation is keyboard accessible", async ({
  page,
  isMobile,
}) => {
  await page.goto("/studios");
  await page.getByLabel("People", { exact: true }).fill("500");
  await expect(page.getByText("No studios match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("link", { name: "View studio & availability" }).first(),
  ).toBeVisible();
  await page.goto("/");
  await page.getByText("How do I book a studio?", { exact: false }).click();
  await expect(
    page.getByText("Explore the spaces, select an available date"),
  ).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Our studios" }),
    ).toBeVisible();
  }
});
test("protected workspace does not reveal customer or financial data", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByText("Authentication required", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("9999999991");
  await expect(
    page.getByRole("button", { name: "Send verification code" }),
  ).toBeEnabled();
});
