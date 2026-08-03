/* Dependency-free characterization for weighted lace economics, immutable
   snapshots, special-order colors, and transactional order deletion. */
import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260803170000_order_economics_snapshots_delete_cascade.sql", import.meta.url), "utf8");
let tests = 0;
let assertions = 0;
const ok = (value, message) => { assertions++; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions++; assert.equal(actual, expected, message); };
async function test(name, fn) { tests++; await fn(); console.log(`  ok  ${name}`); }

function weighted(expenses) {
  let amount = 0;
  let quantity = 0;
  for (const expense of expenses) {
    const rowAmount = Number(expense?.amount);
    const rowQuantity = Number(expense?.quantity);
    if (expense?.unitKind !== "lace_piece" || !Number.isFinite(rowAmount) || rowAmount <= 0 || !Number.isFinite(rowQuantity) || rowQuantity <= 0) continue;
    amount += rowAmount;
    quantity += rowQuantity;
  }
  return quantity > 0 ? amount / quantity : null;
}

await test("lace cost uses a cumulative weighted average", () => {
  const expenses = [
    { unitKind: "lace_piece", amount: 90, quantity: 30 },
    { unitKind: "lace_piece", amount: 44, quantity: 10 },
    { unitKind: "lace_piece", amount: 999, quantity: 0 },
    { unitKind: "sticker", amount: 50, quantity: 100 }
  ];
  equal(weighted(expenses), 134 / 40);
  equal(3 * weighted(expenses), 10.05);
  ok(admin.includes('getWeightedAverageUnitCost(expensesCache, "lace_piece")'));
  ok(admin.includes("amount += rowAmount;\n    quantity += rowQuantity"));
});

await test("invalid purchases are ignored and fallback waits for a loaded expense list", () => {
  equal(weighted([{ unitKind: "lace_piece", amount: -5, quantity: 2 }, { unitKind: "lace_piece", amount: 10, quantity: null }]), null);
  ok(admin.includes("if (!Array.isArray(expensesCache)) return null;"));
  ok(admin.includes("?? SHOP_ECONOMICS.laceCostPerPiece"));
  ok(admin.includes('expensesCacheStatus = "error"'));
});

await test("special-order lace values are actual text rather than sentinels", () => {
  ok(admin.includes("Special-order color…"));
  ok(admin.includes('data-special-order-lace-color="true"'));
  ok(admin.includes("replaceLaceSelectWithSpecialOrderInput"));
  equal(admin.includes(">Custom color…</option>"), false);
  ok(api.includes("newPrimaryColor: cleanText(updated.primary_lace_color)"));
});

await test("completed economics are immutable, canonical, and backfilled once", () => {
  ok(migration.includes("economics_snapshot jsonb"));
  ok(migration.includes("economics_locked_at timestamptz"));
  ok(migration.includes("build_order_economics_snapshot"));
  ok(migration.includes("orders_lock_economics_on_completion"));
  ok(migration.includes("old.economics_snapshot is not null"));
  ok(/source.*backfill/.test(migration));
  ok(/economics_snapshot is null/.test(migration));
  ok(admin.includes("getOrderEconomicsSnapshot(order)"));
  ok(admin.includes("materialsFromEconomicsSnapshot(snapshot)"));
  ok(admin.includes("getHistoricalOrderBasis(order)"));
  ok(admin.includes("snapshot.phase_minutes?.[PALM_PAD_PHASE]"));
  ok(admin.includes("snapshot.phase_minutes?.[LABOR_CUSTOM_PHASE]"));
  ok(admin.includes("Number(snapshot.labor_minutes) || 0"));
  ok(api.includes("economicsSnapshot: row.economics_snapshot || null"));
});

await test("delete RPC restores stock then deletes/unlinks in dependency order", () => {
  const restore = migration.indexOf("update public.lace_inventory");
  const labor = migration.indexOf("delete from public.order_labor_sessions where order_number = v_order.order_number");
  const bench = migration.indexOf("delete from public.bench_work_sessions where order_number = v_order.order_number");
  const activity = migration.indexOf("delete from public.order_activity where order_number = v_order.order_number");
  const order = migration.indexOf("delete from public.orders where order_number = v_order.order_number");
  ok(restore >= 0 && restore < labor && labor < bench && bench < activity && activity < order);
  ok(migration.includes("li.color = x.color"));
  ok(migration.includes("update public.sms_messages set order_number = null"));
  ok(migration.includes("update public.gallery_photo_links set order_number = null"));
  ok(migration.includes("for update"));
  ok(api.includes('/rest/v1/rpc/delete_order_completely'));
});

await test("orphan cleanup preserves shared records and removes order-owned ghosts", () => {
  ok(migration.includes("delete from public.order_labor_sessions l"));
  ok(migration.includes("delete from public.bench_work_sessions b"));
  ok(migration.includes("delete from public.order_activity a"));
  ok(migration.includes("update public.sms_messages m set order_number = null"));
  ok(migration.includes("update public.gallery_photo_links g set order_number = null"));
  equal(/delete from public\.sms_messages m/.test(migration), false);
  equal(/delete from public\.gallery_photo_links g/.test(migration), false);
});

console.log(`\n${tests} tests, ${assertions} assertions passed`);
