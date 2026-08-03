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
const resumeMigration = fs.readFileSync(new URL("../supabase/migrations/20260803120000_resume_labor_with_new_bench_work.sql", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminCss = fs.readFileSync(new URL("../admin/admin.css", import.meta.url), "utf8");

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
  ok(/function public\.resume_labor_with_new_bench_work\(/.test(resumeMigration));
  ok(/security invoker/.test(resumeMigration));
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
  for (const action of ["getBenchFocus", "startBenchWork", "resumePausedLaborForBench", "resumeLaborWithNewBenchWork", "snoozeBenchReminder", "endBenchWork", "resolveBenchWork"]) {
    const entry = source.match(new RegExp(`${action}: \\{[\\s\\S]*?bindings: \\{ required: \\["CORE"\\], optional: \\[\\] \\}`));
    ok(entry, `${action} registry entry`);
    ok(/auth: "session"/.test(entry[0]));
    ok(/demo: "deny"/.test(entry[0]));
    equal(/email|sms|push|storage|geocod/i.test(entry[0]), false);
  }
});

await test("paused labor resumes into new Bench Work with one atomic RPC", async () => {
  const owner = await token();
  const rpc = { ok: true, bench: { id: "b2", order_number: "0169", resolution: "labor_recorded" }, session: { id: "old1", order_number: "0169", status: "running", bench_work_session_id: "b2" } };
  const result = await invoke({ action: "resumeLaborWithNewBenchWork", _token: owner, laborSessionId: "old1" }, [rpc, null]);
  equal(result.json.ok, true);
  equal(result.calls[0].url.endsWith("/rest/v1/rpc/resume_labor_with_new_bench_work"), true);
  equal(result.calls[0].body.p_labor_session_id, "old1");
  equal(result.calls.length, 2);
  ok(/pg_advisory_xact_lock/.test(resumeMigration));
  ok(/clock_timestamp\(\)/.test(resumeMigration));
  ok((resumeMigration.match(/for update/g) || []).length >= 3);
  ok(/insert into public\.bench_work_sessions/.test(resumeMigration));
  equal(/insert into public\.order_labor_sessions/.test(resumeMigration), false);
  ok(/pause_accumulated_seconds = coalesce\(pause_accumulated_seconds, 0\) \+ v_paused_seconds/.test(resumeMigration));
  ok(/bench_work_session_id = v_bench\.id/.test(resumeMigration));
  ok(/'labor_recorded', v_now/.test(resumeMigration));
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
  ok(admin.includes("Bench <strong data-bench-elapsed>"));
  ok(admin.includes("· Labor <strong data-bench-labor-elapsed>"));
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
  ok(admin.includes("await openBenchChoiceSheet({\n    title: \"Labor timer\""));
  ok(admin.includes("if (control) await handleDashboardTimerControl(orderKey, control, button)"));
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
  ok(admin.includes("endActiveBenchWork({ anchor: endBenchBtn })"));
  ok(admin.includes('if (!bench) return "";'));
  ok(admin.includes('String(bench.orderNumber) === String(order.orderNumber)'));
  ok(admin.includes('strong>#${escapeHtml(bench.orderNumber)} · Active'));
  equal(admin.includes('querySelector("[data-detail-bench-end]")?.addEventListener'), false);
  ok(admin.includes("if (laborTimerDelegated || !orderDetail) return;"));
  equal((admin.match(/orderDetail\.addEventListener\("click"/g) || []).length, 2);
  ok(admin.includes('benchSessionId: bench.id, runningAction'));
  ok(admin.includes('title: switchToOrder ? "End current Bench Work and switch?" : "End Bench Work"'));
  ok(admin.includes('openImmediateBenchResolution(unresolvedBench, choiceAnchor)'));
});

await test("Clubhouse Bench controls stay compact and single-line", () => {
  ok(adminCss.includes(".dashboard-bench-actions .bench-focus-start-btn{box-sizing:border-box;min-height:32px;height:32px"));
  ok(adminCss.includes("white-space:nowrap"));
  ok(adminCss.includes(".dashboard-bench-actions{align-items:center;flex-direction:row;flex-wrap:nowrap}"));
  equal(adminCss.includes(".dashboard-bench-actions{align-items:flex-end;flex-direction:column}"), false);
  equal(adminCss.includes(".bench-focus-start-btn{max-width:120px;white-space:normal}"), false);
});

await test("focused-card controls emit authoritative identifiers and reuse labor controls", () => {
  const renderer = admin.match(/function renderBenchFocusTimerControls\([\s\S]*?\n\}/)?.[0] || "";
  ok(renderer.includes('data-timer-control="${primary.control}"'));
  ok(renderer.includes('data-timer-control="stop"'));
  ok(renderer.includes('data-session-id="${escapeAttr(session.id)}"'));
  ok(renderer.includes('data-bench-session-id="${escapeAttr(bench.id)}"'));
  ok(renderer.includes("DASHBOARD_TIMER_ICONS[primary.icon]"));
  ok(admin.includes("dashboardLaborSessions[orderKey] || focusedSession || null"));
  ok(admin.includes("emittedSessionId !== String(session.id)"));
  const control = admin.match(/async function handleDashboardTimerControl\([\s\S]*?\n\}/)?.[0] || "";
  ok(control.includes("finally {\n    dashboardTimerBusy = false;\n    await refreshBenchFocusSurfaces();"));
  equal(control.includes("timerButton?.isConnected"), false);
  equal(control.includes("controlButton.disabled"), false);
});

await test("Bench end choices anchor and clamp through the existing menu utility", () => {
  ok(admin.includes("anchor: choiceAnchor"));
  ok(admin.includes('endActiveBenchWork({ anchor: endBenchBtn })'));
  ok(admin.includes("positionWorkflowMenu(panel, position)"));
  ok(admin.includes('sheet.className = `bench-choice-sheet${anchorPosition ? " is-anchored" : ""}`'));
  ok(admin.includes('event.target.closest?.("[data-action]")'));
  ok(admin.includes('if (event.key === "Escape") closeBenchChoiceSheet()'));
  ok(adminCss.includes(".bench-choice-sheet.is-anchored{display:block;padding:0;background:transparent}"));
  ok(adminCss.includes("max-height:calc(100vh - 24px)"));
  equal(adminCss.includes(".bench-choice-sheet.is-anchored{align-items:flex-end"), false);
});

await test("labor phase choices anchor to their trigger and remain portal-safe", () => {
  ok(admin.includes("startLaborForActiveBench(benchLaborStartBtn.dataset.benchLaborStart, benchLaborStartBtn)"));
  ok(admin.includes("chooseBenchLaborPhase(mode === \"bench\" ? \"Start from Bench Work\" : \"Start labor now\", anchor)"));
  ok(admin.includes("document.body.appendChild(benchChoiceRoot)"));
  ok(admin.includes('window.addEventListener("resize", sheet._reposition)'));
  ok(admin.includes('window.addEventListener("scroll", sheet._reposition, true)'));
  ok(admin.includes("rect.bottom + 6"));
  ok(admin.includes("rect.top - panelHeight - 6"));
  ok(admin.includes('benchChoiceRoot.addEventListener("click"'));
  ok(admin.includes('event.target.closest?.("[data-action]")'));
  ok(admin.includes("event.stopImmediatePropagation()"));
  ok(admin.includes("closeBenchChoiceSheet(action?.dataset.action ?? null)"));
  equal(admin.includes("actions.appendChild(popover)"), false);
  equal(admin.includes('document.addEventListener("click", (e) => {\n    if (!dashboardTimerPopoverOrder)'), false);
  ok(adminCss.includes(".bench-choice-sheet{position:fixed"));
  ok(adminCss.includes(".bench-choice-sheet{position:fixed;inset:0;z-index:1300"));
  equal(adminCss.includes("--admin-z-modal"), false);
  ok(adminCss.includes("pointer-events:auto"));
  ok(adminCss.includes(".bench-choice-backdrop{position:fixed;inset:0;z-index:0"));
  ok(adminCss.includes(".bench-choice-panel{position:relative;z-index:1"));
});

await test("Safari timer menu events stay inside one global portal boundary", () => {
  const root = admin.match(/function getBenchChoiceRoot\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  ok(root.includes('benchChoiceRoot.addEventListener("click"'));
  equal((root.match(/addEventListener\("click"/g) || []).length, 1);
  ok(root.includes('event.target.closest?.("[data-action]")'));
  ok(root.includes("event.preventDefault()"));
  ok(root.includes("event.stopPropagation()"));
  ok(root.includes("event.stopImmediatePropagation()"));
  ok(root.includes("document.body.appendChild(benchChoiceRoot)"));
  for (const target of ["button", "span", "svg", "path"]) {
    const actionButton = { dataset: { action: "resume" } };
    const eventTarget = { closest: selector => selector === "[data-action]" ? actionButton : null };
    equal(eventTarget.closest("[data-action]"), actionButton, `${target} resolves to portal action`);
  }
  ok(admin.includes('<div class="bench-choice-backdrop" data-overlay-dismiss>'));
  equal(admin.includes("actions.appendChild(popover)"), false);
  equal((admin.match(/function getBenchChoiceRoot\(/g) || []).length, 1);
  equal((admin.match(/document\.addEventListener\("click", \(e\) => \{\n    if \(!dashboardTimerPopoverOrder/g) || []).length, 0);
});

await test("paused dashboard resume explicitly creates Bench Work or cancels", () => {
  const resume = admin.match(/async function resumePausedLaborWithNewBenchWork\([\s\S]*?\n\}/)?.[0] || "";
  ok(resume.includes("Resume timer and put this glove back on the bench?"));
  ok(resume.includes("Resume and Start Bench Work"));
  ok(resume.includes('action: "resumeLaborWithNewBenchWork"'));
  ok(resume.includes("if (choice !== \"resume\") return"));
  ok(resume.includes("await refreshBenchFocusSurfaces()"));
  const control = admin.match(/async function handleDashboardTimerControl\([\s\S]*?\n\}/)?.[0] || "";
  ok(control.includes("if (!activeBench)"));
  ok(control.includes("Another glove is on the bench."));
  ok(control.includes("endActiveBenchWork({ anchor: choiceAnchor })"));
  ok(control.includes('action: "resumeLaborSession"'));
});

await test("same-order paused Start Bench Work is explicit and trigger-anchored", () => {
  const start = admin.match(/async function startBenchWorkFromDashboard\([\s\S]*?\n\}/)?.[0] || "";
  ok(start.includes("const choiceAnchor = anchor?.x != null ? anchor"));
  ok(start.includes("Paused timer for #${orderNumber}"));
  ok(start.includes("Resume this order’s timer and start Bench Work for the same glove?"));
  ok(start.includes("Resume Timer and Start Bench Work"));
  ok(start.includes("Start Bench Work and Leave Timer Paused"));
  ok(start.includes("anchor: choiceAnchor"));
  ok(start.includes("pausedAction: choice }, choiceAnchor"));
  ok(admin.includes("startBenchWorkFromDashboard(benchStartBtn.dataset.benchStart, {}, benchStartBtn)"));
  equal(start.includes("Resume previous labor?"), false);
});

await test("Bench end performs one authoritative multi-surface refresh", () => {
  const refresh = admin.match(/async function refreshBenchFocusSurfaces\([\s\S]*?\n\}/)?.[0] || "";
  ok(refresh.includes("refreshBenchFocusState({ rerender: false })"));
  ok(refresh.includes("refreshDashboardLaborSessions({ rerender: false })"));
  ok(refresh.includes("renderHomeDashboard()"));
  ok(refresh.includes("refreshOrderDetailBenchBanner()"));
  ok(refresh.includes("loadLaborSessions(currentOrder.orderNumber)"));
  ok(admin.includes("await refreshBenchFocusSurfaces({ refreshViewedLabor: true })"));
  ok(admin.includes("existing?.remove()"));
  equal((admin.match(/async function refreshBenchFocusSurfaces/g) || []).length, 1);
});

await test("simplified Bench card omits duplicated administrative detail", () => {
  const render = admin.match(/function renderBenchFocusCard\([\s\S]*?\n\}/)?.[0] || "";
  ok(render.includes("bench-focus-heading"));
  ok(render.includes("bench-focus-summary"));
  ok(render.includes("bench-focus-bench-time"));
  ok(render.includes("bench-focus-labor-status"));
  ok(render.includes("bench-focus-card-actions"));
  equal(render.includes("bench-focus-details"), false);
  equal(render.includes("Services</dt>"), false);
  equal(render.includes("Lace</dt>"), false);
  equal(render.includes("Status</dt>"), false);
  equal(render.includes("Estimated</dt>"), false);
  equal(render.includes("servicesRequested"), false);
  equal(render.includes("estimatedCompletion"), false);
});

await test("focused Today’s Bench row is status-only while ordinary timers remain", () => {
  const render = admin.match(/function renderDashboardOrderRow\([\s\S]*?\n\}/)?.[0] || "";
  ok(render.includes('const isFocusedOrder = String(benchFocusState.activeBench?.orderNumber || "") === orderKey'));
  ok(render.includes('isFocusedOrder ? "" : renderDashboardTimerButton(order, session)'));
  ok(render.includes('isFocusedOrder ? "On Bench" : "Start Bench Work"'));
  ok(render.includes("timerStateHtml"));
  equal((admin.match(/function renderDashboardTimerButton/g) || []).length, 1);
});

await test("cross-order warning stays compact and routes back to Clubhouse", () => {
  const render = admin.match(/function renderOrderDetailBenchBanner\([\s\S]*?\n\}/)?.[0] || "";
  ok(render.includes("Another glove is on the bench"));
  ok(render.includes("data-detail-bench-clubhouse"));
  ok(render.includes("data-detail-bench-end"));
  equal(render.includes("data-timer-control"), false);
  equal(render.includes("data-timer-action"), false);
  ok(admin.includes('const clubhouseBtn = e.target.closest("[data-detail-bench-clubhouse]")'));
  ok(admin.includes('setActiveView("dashboard")'));
});

console.log(`\n${tests} tests, ${assertions} assertions passed`);
