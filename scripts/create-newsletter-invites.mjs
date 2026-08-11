/* Creates one-time confirmation links for completed, paid customers and writes
   a Resend-ready CSV. Run only after the newsletter_invites migration is applied. */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

loadEnvFile(path.resolve("supabase.env"));

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const siteUrl = String(process.env.NEWSLETTER_INVITE_BASE_URL || "https://murphsmitts.com").replace(/\/$/, "");
const outputArg = process.argv.find(value => value.startsWith("--output="));
const outputPath = path.resolve(outputArg ? outputArg.slice(9) : "/private/tmp/murphs-mitts-newsletter-invitation.csv");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const [orders, consents] = await Promise.all([
  fetchAll("/rest/v1/orders?select=customer_name,email_address,status,paid&status=eq.Completed&paid=eq.Paid"),
  fetchAll("/rest/v1/newsletter_consents?select=email")
]);

const subscribed = new Set(consents.map(row => normalizeEmail(row.email)).filter(Boolean));
const customers = new Map();
for (const order of orders) {
  const email = normalizeEmail(order.email_address);
  if (!isValidEmail(email) || subscribed.has(email) || customers.has(email)) continue;
  customers.set(email, { email, firstName: firstName(order.customer_name) });
}

const expiresAt = new Date(Date.now() + (30 * 86_400_000)).toISOString();
const invites = Array.from(customers.values(), customer => {
  const token = randomBytes(32).toString("hex");
  return {
    ...customer,
    token,
    tokenHash: createHash("sha256").update(token).digest("hex")
  };
});

if (invites.length) {
  const insert = await api("/rest/v1/newsletter_invites", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(invites.map(invite => ({
      token_hash: invite.tokenHash,
      email: invite.email,
      first_name: invite.firstName || null,
      source: "past_customer",
      expires_at: expiresAt
    })))
  });
  if (!insert.ok) throw new Error(`Could not create newsletter invitations (${insert.status}).`);
}

const rows = [["email", "first_name", "signup_url"]];
for (const invite of invites) {
  rows.push([
    invite.email,
    invite.firstName,
    `${siteUrl}/newsletter/confirm/?token=${invite.token}`
  ]);
}
fs.writeFileSync(outputPath, `${rows.map(row => row.map(csvCell).join(",")).join("\n")}\n`, { mode: 0o600 });
fs.chmodSync(outputPath, 0o600);
console.log(`Created ${invites.length} invitations. CSV written to ${outputPath}.`);
console.log(`Links expire ${expiresAt}. Treat the CSV as sensitive and delete it after the Resend import.`);

async function fetchAll(resource) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = resource.includes("?") ? "&" : "?";
    const response = await api(`${resource}${joiner}limit=${pageSize}&offset=${offset}`);
    if (!response.ok) throw new Error(`Supabase read failed (${response.status}).`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function api(resource, options = {}) {
  return fetch(`${supabaseUrl}${resource}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firstName(value) {
  return String(value || "").trim().split(/\s+/)[0].slice(0, 80);
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}
