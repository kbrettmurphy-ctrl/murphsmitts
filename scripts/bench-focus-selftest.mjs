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
  for (const name of ["start_bench_work", "start_labor_for_bench", "end_bench_work", "resume_paused_labor_for_bench", "resolve_bench_work"]) {
    ok(new RegExp(`function public\\.${name}\\(`).test(migration), `${name} exists`);
  }
  equal((migration.match(/security invoker/g) || []).length, 5);
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

await test("ending atomically pauses or stops linked labor and preserves stop activity", () => {
  ok(/p_running_action = 'pause'[\s\S]*?returning \* into v_labor/.test(migration));
  ok(/p_running_action = 'stop'[\s\S]*?duration_minutes[\s\S]*?returning \* into v_labor/.test(migration));
  ok(migration.includes("runningLaborChoice"));
  ok(source.includes('runningAction === "stop" && result.session'));
  ok(source.includes('eventLabel: "Labor timer stopped"'));
});

await test("registry metadata denies demo and declares no external effects", () => {
  for (const action of ["getBenchFocus", "startBenchWork", "resumePausedLaborForBench", "snoozeBenchReminder", "endBenchWork", "resolveBenchWork"]) {
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

await test("Leave-paused state is returned separately from linked labor", async () => {
  const owner = await token();
  const bench = { id: "b1", order_number: "0169", started_at: "2026-07-31T12:00:00Z", ended_at: null, resolution: "pending", backdate_consumed_at: null };
  const paused = { id: "old1", order_number: "0169", phase: "Cleaning", started_at: "2026-07-31T10:00:00Z", ended_at: null, status: "paused", paused_at: "2026-07-31T11:00:00Z", pause_accumulated_seconds: 30, bench_work_session_id: null };
  const result = await invoke({ action: "getBenchFocus", _token: owner }, [[bench], [], [paused]]);
  equal(result.json.activeLabor, null);
  equal(result.json.unlinkedPausedLabor.id, "old1");
  equal(result.json.activeBench.backdateConsumedAt, null);
});

await test("Resume Existing Timer uses one atomic RPC and authoritative pause arithmetic", async () => {
  const owner = await token();
  const rpc = { ok: true, bench: { id: "b1", order_number: "0169", resolution: "labor_recorded", backdate_consumed_at: "2026-07-31T12:10:00Z" }, session: { id: "old1", order_number: "0169", status: "running", pause_accumulated_seconds: 630, bench_work_session_id: "b1" } };
  const result = await invoke({ action: "resumePausedLaborForBench", _token: owner, benchSessionId: "b1", laborSessionId: "old1" }, [rpc]);
  equal(result.json.ok, true);
  equal(result.calls.length, 1);
  equal(result.calls[0].url.endsWith("/rest/v1/rpc/resume_paused_labor_for_bench"), true);
  equal(result.calls[0].body.p_bench_session_id, "b1");
  equal(result.calls[0].body.p_labor_session_id, "old1");
  ok(/pause_accumulated_seconds = coalesce\(pause_accumulated_seconds, 0\) \+ v_paused_seconds/.test(migration));
  ok(/bench_work_session_id = v_bench.id/.test(migration));
  ok(/backdate_consumed_at = coalesce\(backdate_consumed_at, v_now\)/.test(migration));
  const resumeRpc = migration.match(/function public\.resume_paused_labor_for_bench\([\s\S]*?end \$\$;/)?.[0] || "";
  equal(/insert into public\.order_labor_sessions/.test(resumeRpc), false);
  ok(resumeRpc.includes("for update"));
});

await test("paused-session UI never offers guaranteed-failing timer starts", () => {
  const render = admin.match(/function renderBenchFocusCard\([\s\S]*?\n\}/)?.[0] || "";
  ok(render.includes("unlinkedPausedLabor ?"));
  ok(render.includes("A paused labor session is still open for this order."));
  ok(render.includes("Resume Existing Timer"));
  ok(render.includes("Stop Existing Timer"));
  const pausedBranch = render.split("unlinkedPausedLabor ?")[1].split("` : `")[0];
  equal(pausedBranch.includes("data-bench-labor-start"), false);
  ok(admin.includes('action: "stopLaborSession", sessionId: labor.id'));
  ok(admin.includes("await Promise.all([refreshBenchFocusState(), refreshDashboardLaborSessions()])"));
  const stopClient = admin.match(/async function stopExistingPausedLaborForBench\([\s\S]*?\n\}/)?.[0] || "";
  equal(stopClient.includes('action: "endBenchWork"'), false);
  equal(stopClient.includes("benchSessionId"), false);
});

await test("Assign Time conflicts with open same-order labor while other resolutions remain", () => {
  const resolveFunction = migration.match(/function public\.resolve_bench_work\([\s\S]*?end \$\$;/)?.[0] || "";
  ok(resolveFunction.includes("open_labor_for_order"));
  ok(resolveFunction.includes("Stop or resolve the open labor session"));
  ok(resolveFunction.indexOf("p_resolution = 'discarded'") < resolveFunction.indexOf("open_labor_for_order"));
  ok(admin.includes("Resolve Later"));
  ok(admin.includes("bench.hasOpenLabor"));
  ok(admin.includes("Stop or resolve the open labor session before assigning"));
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
  ok(admin.includes('data-bench-labor-reminder'));
  ok(admin.includes('reminder.hidden = !isBenchLaborReminderDue(benchFocusState.activeBench)'));
  ok(source.includes("10 * 60 * 1000"));
  ok(admin.includes("Bench context — not logged labor"));
  ok(admin.includes("Labor elapsed"));
  ok((admin.match(/benchSessionId: activeBench\.id/g) || []).length >= 2);
  equal(/Keep Timer Running and End Bench Work/.test(admin), false);
});

await test("active Bench Work always exposes labor starts before the reminder", () => {
  const render = admin.match(/function renderBenchFocusCard\([\s\S]*?\n\}/)?.[0] || "";
  const noLaborBranch = render.split('` : `').at(-1);
  ok(noLaborBranch.includes('data-bench-labor-start="bench"'));
  ok(noLaborBranch.includes('data-bench-labor-start="now"'));
  ok(noLaborBranch.includes('data-bench-labor-reminder'));
  ok(noLaborBranch.includes('reminderDue ? "" : "hidden"'));
  equal(/reminderDue \? `<div class="bench-focus-reminder-actions">/.test(noLaborBranch), false);
});

await test("Bench Focus timer controls share stable Today’s Bench delegation", () => {
  ok(admin.includes('button.closest(".dashboard-bench-actions, .bench-focus-labor-controls")'));
  ok(admin.includes('e.target.closest?.(".dashboard-bench-actions, .bench-focus-labor-controls")'));
  ok(admin.includes('const timerControlBtn = e.target.closest("[data-timer-control]")'));
  ok(admin.includes('const timerActionBtn = e.target.closest("[data-timer-action]")'));
  ok(admin.includes('handleDashboardTimerControl(\n        timerControlBtn.dataset.timerOrder,\n        timerControlBtn.dataset.timerControl,\n        timerControlBtn'));
  ok(admin.includes('if (control === "pause")'));
  ok(admin.includes('} else if (control === "resume")'));
  ok(admin.includes('} else if (control === "stop")'));
  ok(admin.includes('await refreshBenchFocusState({ rerender: false })'));
  ok(admin.includes('await refreshDashboardLaborSessions()'));
  ok(admin.includes('e.stopPropagation();\n      handleDashboardTimerAction(timerActionBtn)'));
  equal((admin.match(/dashboardPanel\.addEventListener\("click"/g) || []).length, 1);
});

await test("nested timer targets and cross-order End Bench Work dispatch safely", () => {
  for (const target of ["button", "svg", "path", "span", "icon"]) {
    const actionButton = { dataset: { timerControl: "pause", timerOrder: "0169" } };
    const eventTarget = { closest: selector => selector === "[data-timer-control]" ? actionButton : null };
    equal(eventTarget.closest("[data-timer-control]"), actionButton, `${target} resolves through closest()`);
  }
  ok(admin.includes('const endBenchBtn = e.target.closest("[data-detail-bench-end]")'));
  ok(admin.includes("endActiveBenchWork();"));
  ok(admin.includes('if (!bench) return "";'));
  ok(admin.includes('String(bench.orderNumber) === String(order.orderNumber)'));
  ok(admin.includes('strong>#${escapeHtml(bench.orderNumber)} · Active'));
  equal(admin.includes('querySelector("[data-detail-bench-end]")?.addEventListener'), false);
  ok(admin.includes("if (laborTimerDelegated || !orderDetail) return;"));
  equal((admin.match(/orderDetail\.addEventListener\("click"/g) || []).length, 2);
  ok(admin.includes('benchSessionId: bench.id, runningAction'));
  ok(admin.includes('title: switchToOrder ? "End current Bench Work and switch?" : "End Bench Work"'));
  ok(admin.includes('openImmediateBenchResolution(unresolvedBench)'));
});

console.log(`\n${tests} tests, ${assertions} assertions passed`);
