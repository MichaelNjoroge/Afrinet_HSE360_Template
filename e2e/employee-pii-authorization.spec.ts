import { expect, test, type Page, type Response } from "@playwright/test";

const email = process.env.E2E_UNAUTHORIZED_EMAIL;
const password = process.env.E2E_UNAUTHORIZED_PASSWORD;
const piiSentinel = process.env.E2E_EMPLOYEE_PII_SENTINEL;

type CapturedResponse = { url: string; status: number; body: string };

function requireSecurityFixture() {
  if (process.env.CI && (!email || !password || !piiSentinel)) {
    throw new Error(
      "CI requires E2E_UNAUTHORIZED_EMAIL, E2E_UNAUTHORIZED_PASSWORD, and E2E_EMPLOYEE_PII_SENTINEL.",
    );
  }
  test.skip(
    !email || !password || !piiSentinel,
    "Set E2E_UNAUTHORIZED_EMAIL, E2E_UNAUTHORIZED_PASSWORD, and E2E_EMPLOYEE_PII_SENTINEL.",
  );
}

function captureServerFunctionResponses(page: Page) {
  const captured: CapturedResponse[] = [];
  const pending: Promise<void>[] = [];
  const listener = (response: Response) => {
    if (response.request().resourceType() !== "fetch") return;
    const task = response
      .text()
      .then((body) => captured.push({ url: response.url(), status: response.status(), body }))
      .catch(() => undefined);
    pending.push(task);
  };
  page.on("response", listener);
  return {
    captured,
    async stop() {
      page.off("response", listener);
      await Promise.all(pending);
    },
  };
}

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Work email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "HSE Control Centre" })).toBeVisible();
}

async function getBrowserSession(page: Page) {
  return page.evaluate(() => {
    for (const value of Object.values(localStorage)) {
      try {
        const parsed = JSON.parse(value) as { access_token?: unknown; user?: { id?: unknown } };
        if (typeof parsed.access_token === "string" && typeof parsed.user?.id === "string") {
          return { accessToken: parsed.access_token, userId: parsed.user.id };
        }
      } catch {
        // Ignore unrelated local-storage values.
      }
    }
    return null;
  });
}

async function assertNoPii(captured: CapturedResponse[], endpointName: string) {
  await expect
    .poll(() => captured.length, { message: `${endpointName} did not return a fetch response` })
    .toBeGreaterThan(0);
  expect(captured.every((response) => response.status < 500)).toBe(true);
  expect(captured.map((response) => response.body).join("\n")).not.toContain(piiSentinel);
}

test.describe("employee PII authorization", () => {
  test.beforeEach(() => requireSecurityFixture());

  test("database policy denies the employee directory to the unauthorized fixture", async ({
    page,
  }) => {
    await signIn(page);
    const session = await getBrowserSession(page);
    expect(session, "The signed-in browser session was not found").not.toBeNull();
    if (!session) return;

    const result = await page.evaluate(async ({ accessToken, userId }) => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };
      const permission = await fetch(`${url}/rest/v1/rpc/has_module_permission`, {
        method: "POST",
        headers,
        body: JSON.stringify({ _user_id: userId, _module: "employees", _action: "view" }),
      });
      const employees = await fetch(
        `${url}/rest/v1/employees?select=id,full_name,email,phone,department,job_title`,
        { headers },
      );
      return {
        permissionStatus: permission.status,
        permission: await permission.json(),
        employeeStatus: employees.status,
        employees: await employees.json(),
      };
    }, session);

    expect(result.permissionStatus).toBe(200);
    expect(result.permission).toBe(false);
    expect(result.employeeStatus).toBe(200);
    expect(result.employees).toEqual([]);
  });

  test("all bulk reads and global search omit employee PII", async ({ page }) => {
    const traffic = captureServerFunctionResponses(page);
    await signIn(page);
    await expect(page.getByText(piiSentinel ?? "", { exact: false })).toHaveCount(0);
    await assertNoPii(traffic.captured, "Module Pack 1 bulk read");

    traffic.captured.length = 0;
    await page.getByRole("button", { name: "Inspection management" }).click();
    await expect(page.getByRole("heading", { name: "Inspection management" })).toBeVisible();
    await assertNoPii(traffic.captured, "Module Pack 2 bulk read");

    traffic.captured.length = 0;
    await page.getByRole("button", { name: "Contractor management" }).click();
    await expect(page.getByRole("heading", { name: "Contractor management" })).toBeVisible();
    await assertNoPii(traffic.captured, "Module Packs 3 and 4 bulk read");

    traffic.captured.length = 0;
    await page.getByRole("button", { name: "Global search" }).click();
    await page
      .getByPlaceholder("Search references, people, contractors and departments…")
      .fill(piiSentinel ?? "");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await assertNoPii(traffic.captured, "Global search");
    await expect(page.getByText(piiSentinel ?? "", { exact: false })).toHaveCount(0);
    await traffic.stop();
  });
});
