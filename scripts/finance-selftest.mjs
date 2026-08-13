import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260813183000_add_order_date_paid.sql", import.meta.url), "utf8");
const correction = fs.readFileSync(new URL("../supabase/migrations/20260813190000_correct_order_date_paid_backfill.sql", import.meta.url), "utf8");

assert.match(migration, /add column if not exists date_paid timestamptz/);
assert.match(migration, /event_type = 'paid_changed'/);
assert.match(migration, /o\.date_completed::timestamp at time zone 'America\/New_York'/);
assert.match(migration, /where lower\(trim\(coalesce\(o\.paid, ''\)\)\) = 'paid'/);
assert.match(correction, /max\(created_at\) as latest_paid_at/);
assert.match(correction, /o\.date_paid is distinct from paid_activity\.latest_paid_at/);

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

console.log("Finance self-test: 16 assertions passed.");
