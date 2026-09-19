import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
let tests = 0;
let assertions = 0;

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

async function test(name, fn) {
  tests += 1;
  await fn();
  console.log(`  ok  ${name}`);
}

function viewBranch(view, nextView) {
  const start = admin.indexOf(`if (resolvedView === "${view}")`);
  const end = admin.indexOf(`if (resolvedView === "${nextView}")`, start + 1);
  assert.notEqual(start, -1, `${view} branch should exist`);
  assert.notEqual(end, -1, `${nextView} branch should follow ${view}`);
  return admin.slice(start, end);
}

await test("Messages persists its admin URL before rendering", () => {
  const branch = viewBranch("messages", "money");
  ok(branch.includes("syncAdminViewUrl(resolvedView);"));
  ok(branch.indexOf("syncAdminViewUrl(resolvedView);") < branch.indexOf("showView(messagesView);"));
});

await test("Users persists its admin URL after the role guard", () => {
  const branch = viewBranch("users", "calendar");
  ok(branch.includes("syncAdminViewUrl(resolvedView);"));
  ok(branch.indexOf("syncAdminViewUrl(resolvedView);") > branch.indexOf('getCurrentRole() !== "admin"'));
  ok(branch.indexOf("syncAdminViewUrl(resolvedView);") < branch.indexOf("showView(usersView);"));
});

await test("admin filter popovers compensate for the topbar containing block", () => {
  const start = admin.indexOf("function positionAdminFilterPopover");
  const end = admin.indexOf("function isDesktopHoverMenu", start);
  assert.notEqual(start, -1, "filter popover positioning function should exist");
  assert.notEqual(end, -1, "filter popover positioning function should have a boundary");
  const positioning = admin.slice(start, end);
  ok(positioning.includes("const containingBlockLeft = popoverRect.left;"));
  ok(positioning.includes("const containingBlockTop = popoverRect.top;"));
  ok(positioning.includes("left - containingBlockLeft"));
  ok(positioning.includes("top - containingBlockTop"));
});

await test("order search treats HoH as Heart of the Hide while typing", () => {
  const start = admin.indexOf("function normalizeText");
  const end = admin.indexOf("function val", start);
  assert.notEqual(start, -1, "search normalization helpers should exist");
  assert.notEqual(end, -1, "search helper boundary should exist");
  const searchHelpers = admin.slice(start, end);
  const orderMatchesSearch = new Function(
    "looksLocalDropOff",
    `${searchHelpers}\nreturn orderMatchesSearch;`
  )(() => false);
  const order = { brandModel: "Rawlings HoH PRO205" };

  for (const query of ["heart", "heart of", "heart of the", "heart of the hide"]) {
    ok(orderMatchesSearch(order, query), `HoH order should match ${query}`);
  }
  ok(orderMatchesSearch({ brandModel: "Rawlings Heart of the Hide" }, "hoh"));
});

console.log(`\nAdmin navigation self-test: ${tests} tests, ${assertions} assertions passed.`);
