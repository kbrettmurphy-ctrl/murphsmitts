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

console.log(`\nAdmin navigation self-test: ${tests} tests, ${assertions} assertions passed.`);
