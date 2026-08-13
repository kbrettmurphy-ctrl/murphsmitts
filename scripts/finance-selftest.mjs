import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260813183000_add_order_date_paid.sql", import.meta.url), "utf8");

assert.match(migration, /add column if not exists date_paid timestamptz/);
assert.match(migration, /event_type = 'paid_changed'/);
assert.match(migration, /o\.date_completed::timestamp at time zone 'America\/New_York'/);
assert.match(migration, /where lower\(trim\(coalesce\(o\.paid, ''\)\)\) = 'paid'/);

assert.match(api, /newPaid === "paid" && oldPaid !== "paid"/);
assert.match(api, /dbUpdates\.date_paid = new Date\(\)\.toISOString\(\)/);
assert.match(api, /newPaid !== "paid" && oldPaid === "paid"/);
assert.match(api, /dbUpdates\.date_paid = null/);
assert.match(api, /datePaid: row\.date_paid/);

assert.match(admin, /function getOrderFinancePaidDate\(order\)/);
assert.match(admin, /parseOrderDate\(order\?\.datePaid\)/);
assert.match(admin, /if \(!isPaid\(order\)\) return false/);
assert.doesNotMatch(admin, /if \(!isCompletedOrder\(order\) \|\| !isPaid\(order\)\) return false/);
assert.match(admin, /isDateInFinanceRange\(getOrderFinancePaidDate\(order\), range\)/);

console.log("Finance self-test: 14 assertions passed.");
