/* Dependency-free structural and transport checks for MurphOS Bench Focus.
   No database or external service is contacted. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/orders.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const env = { SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test", ADMIN_PIN: "123456", ADMIN_SESSION_SECRET: "bench-secret" };
let tests = 0;
let assertions = 0;
const ok = (value, message) => { assertions++; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions++; assert.equal(actual, expected, message); };
async function test(name, fn) { tests++; await fn(); console.log(`  ok  ${name}`); }
function base64Url(value) { return Buffer.from(value).toString("base64url"); }
async function token(role = "admin") {
  const payload = base64Url(JSON.stringify({ sub: "owner", role, exp: Date.now() + 60000 }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}
async function invoke(body, responses = []) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init, body: init.body ? JSON.parse(init.body) : null });
    const value = responses[calls.length - 1];
    if (value === undefined) throw new Error(`Unexpected fetch ${String(input)}`);
    return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const request = new Request("https://murphsmitts.com/api/orders", { method: "POST", body: JSON.stringify(body) });
    const response = await onRequest({ request, env });
    return { response, json: await response.json(), calls };
  } finally { globalThis.fetch = previous; }
}

const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260731120000_bench_focus.sql", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");

await test("schema is additive and enforces the Bench Focus invariants", () => {
  ok(/create table if not exists public\.bench_work_sessions/.test(migration));
  ok(/where ended_at is null/.test(migration));
  ok(/resolution in \('pending', 'labor_recorded', 'discarded'\)/.test(migration));
  ok(/ended_at is null or ended_at >= started_at/.test(migration));
  ok(/add column if not exists bench_work_session_id uuid/.test(migration));
  ok(/add column if not exists started_from_bench boolean not null default false/.test(migration));
  ok(/foreign key \(bench_work_session_id\)/.test(migration));
  ok(/where started_from_bench = true/.test(migration));
  ok(/enable row level security/.test(migration));
  equal(/drop table|drop column|truncate/i.test(migration), false);
});

await test("all cross-table transitions are SECURITY INVOKER RPCs", () => {
  for (const name of ["start_bench_work", "start_labor_for_bench", "end_bench_work", "resolve_bench_work"]) {
    ok(new RegExp(`function public\\.${name}\\(`).test(migration), `${name} exists`);
  }
  equal((migration.match(/security invoker/g) || []).length, 4);
  ok(/clock_timestamp\(\)/.test(migration));
  ok(/for update/g.test(migration));
  equal(/p_started_at|p_ended_at|client_timestamp/i.test(migration), false);
});

await test("eligibility and paused-session decisions are database enforced", () => {
  for (const status of ["in progress", "customer approved", "in transit to me", "received", "waiting on lace/parts", "waiting on parts"]) ok(migration.includes(`'${status}'`) || status === "in progress");
  ok(migration.includes("requiresConfirmation"));
  ok(migration.includes("receivedPhysicalPresence"));
  ok(migration.includes("pausedLaborChoice"));
  ok(migration.includes("resume_attach"));
  ok(source.includes('"leave"'));
  ok(migration.includes("other_running_labor"));
});

await test("backdating and reconciliation use authoritative Bench timestamps once", () => {
  ok(/v_start := case when p_mode = 'bench' then v_bench\.started_at else v_now end/.test(migration));
  ok(/backdate_consumed_at is not null/.test(migration));
  ok(/started_from_bench/.test(migration));
  ok(/v_bench\.started_at, v_bench\.ended_at, v_minutes, 'stopped'/.test(migration));
  ok(/extract\(epoch from \(v_bench\.ended_at - v_bench\.started_at\)\)/.test(migration));
});

await test("registry metadata denies demo and declares no external effects", () => {
  for (const action of ["getBenchFocus", "startBenchWork", "snoozeBenchReminder", "endBenchWork", "resolveBenchWork"]) {
    const entry = source.match(new RegExp(`${action}: \\{[\\s\\S]*?bindings: \\{ required: \\["CORE"\\], optional: \\[\\] \\}`));
    ok(entry, `${action} registry entry`);
    ok(/auth: "session"/.test(entry[0]));
    ok(/demo: "deny"/.test(entry[0]));
    equal(/email|sms|push|storage|geocod/i.test(entry[0]), false);
  }
});

await test("demo tokens are denied before Bench Focus I/O", async () => {
  const demo = await token("demo");
  const result = await invoke({ action: "getBenchFocus", _token: demo });
  equal(result.json.demo, true);
  equal(result.calls.length, 0);
});

await test("Bench Focus read returns active, unresolved, labor, and server time", async () => {
  const owner = await token();
  const bench = { id: "b1", order_number: "0169", started_at: "2026-07-31T12:00:00Z", ended_at: null, resolution: "pending" };
  const labor = { id: "l1", order_number: "0169", phase: "Relacing", started_at: bench.started_at, ended_at: null, status: "running", bench_work_session_id: "b1", started_from_bench: true };
  const result = await invoke({ action: "getBenchFocus", _token: owner }, [[bench], [], [labor]]);
  equal(result.json.ok, true);
  equal(result.json.activeBench.id, "b1");
  equal(result.json.activeLabor.benchWorkSessionId, "b1");
  equal(result.json.activeLabor.startedFromBench, true);
  ok(Number.isFinite(Date.parse(result.json.serverNow)));
  equal(result.calls.length, 3);
});

await test("Bench-aware labor sends no client timestamp and logs source metadata", async () => {
  const owner = await token();
  const rpc = { ok: true, session: { id: "l1", order_number: "0169", phase: "Relacing", started_at: "2026-07-31T12:00:00Z", status: "running", bench_work_session_id: "b1", started_from_bench: true } };
  const result = await invoke({ action: "startLaborSession", _token: owner, orderNumber: "0169", phase: "Relacing", benchSessionId: "b1", benchStartMode: "bench", startedAt: "1900-01-01" }, [rpc, null]);
  equal(result.json.ok, true);
  equal(result.calls[0].url.endsWith("/rest/v1/rpc/start_labor_for_bench"), true);
  equal("startedAt" in result.calls[0].body, false);
  equal(result.calls[0].body.p_mode, "bench");
  const activity = result.calls[1].body;
  equal(activity.metadata.backdated, true);
  equal(activity.metadata.benchWorkSessionId, "b1");
});

await test("client implements recovery, reminder, and separate Bench/Labor presentation", () => {
  ok(admin.includes("setInterval(() => refreshBenchFocusState(), 15000)"));
  ok(admin.includes("BroadcastChannel(\"murphos-bench-focus\")"));
  ok(admin.includes("window.addEventListener(\"storage\""));
  ok(admin.includes("window.addEventListener(\"focus\""));
  ok(admin.includes("Date.parse(bench.startedAt) + 90000"));
  ok(source.includes("10 * 60 * 1000"));
  ok(admin.includes("Bench context — not logged labor"));
  ok(admin.includes("Labor elapsed"));
  equal(/Keep Timer Running and End Bench Work/.test(admin), false);
});

console.log(`\n${tests} tests, ${assertions} assertions passed`);
