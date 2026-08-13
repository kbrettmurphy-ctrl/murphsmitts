import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const adminSource = fs.readFileSync(new URL("admin/reviews.js", root), "utf8");
const apiSource = fs.readFileSync(new URL("functions/api/orders.js", root), "utf8");
const publicApiSource = fs.readFileSync(new URL("functions/api/public/reviews.js", root), "utf8");
const publicJs = fs.readFileSync(new URL("assets/js/main.js", root), "utf8");
const adminCss = fs.readFileSync(new URL("admin/admin.css", root), "utf8");
const adminHtml = fs.readFileSync(new URL("admin/index.html", root), "utf8");
const migration = fs.readFileSync(new URL("supabase/migrations/20260813120000_customer_reviews.sql", root), "utf8");

let tests = 0;
function test(name, fn) {
  fn();
  tests += 1;
  console.log(`  ok  ${name}`);
}

function loadParser() {
  const match = adminSource.match(/function parseGoogleReviewPaste\(raw\) \{[\s\S]*?\n\}/);
  assert.ok(match, "parser function is present");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${match[0]}; this.parse = parseGoogleReviewPaste;`, context);
  return context.parse;
}

console.log("Customer reviews");

test("migration is additive, RLS-protected, and service-role only", () => {
  assert.match(migration, /create table if not exists public\.customer_reviews/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.customer_reviews from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.customer_reviews to service_role/);
  assert.doesNotMatch(migration, /drop table|drop column/i);
});

test("Google copy parser separates complete review blocks", () => {
  const parse = loadParser();
  const parsed = parse(`Jamie Carter\nLocal Guide · 18 reviews\n★★★★★\n2 months ago\nAmazing work on my son's glove.\n\nChris Morgan\n7 reviews\n★★★★\nJan 3, 2026\nFast turnaround and great communication.`);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].reviewerName, "Jamie Carter");
  assert.equal(parsed[0].rating, 5);
  assert.equal(parsed[0].dateLabel, "2 months ago");
  assert.equal(parsed[1].rating, 4);
  assert.match(parsed[1].reviewText, /Fast turnaround/);
});

test("Google Business clipboard markup parses without manual cleanup", () => {
  const parse = loadParser();
  const parsed = parse(`[**sherwood ransom**](https://www.google.com/maps/contrib/109374945789708526922/reviews?hl=en)open_in_new
2 reviews • 0 photos
starstarstarstarstar 19 hours ago **NEW**
My experience with Murph's Mitt Maixtenance was top notch! I was very impressed to find someone who was equally as passionate about the restoration, preservation, and the collecting of baseball gloves.`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].reviewerName, "sherwood ransom");
  assert.equal(parsed[0].rating, 5);
  assert.equal(parsed[0].dateLabel, "19 hours ago");
  assert.match(parsed[0].reviewText, /^My experience with Murph's Mitt Maixtenance/);
  assert.equal(parsed[0].homepageExcerpt, "My experience with Murph's Mitt Maixtenance was top notch!");
  assert.doesNotMatch(parsed[0].reviewText, /NEW|open_in_new|2 reviews/);
});

test("admin API actions are authenticated and duplicate-aware", () => {
  for (const action of ["listCustomerReviews", "importCustomerReviews", "updateCustomerReview", "deleteCustomerReview"]) {
    assert.match(apiSource, new RegExp(`${action}: \\{[\\s\\S]*?auth: "session"`));
  }
  assert.match(apiSource, /customerReviewFingerprint\(row\.reviewer_name, row\.review_text\)/);
  assert.match(apiSource, /resolution=ignore-duplicates/);
  assert.match(apiSource, /homepage_excerpt: cleanText\(item\?\.homepageExcerpt\)/);
});

test("public endpoint exposes selected projections with fixed caps", () => {
  assert.match(publicApiSource, /homepage_featured=eq\.true[\s\S]*?limit=3/);
  assert.match(publicApiSource, /services_featured=eq\.true[\s\S]*?limit=6/);
  assert.doesNotMatch(publicApiSource, /source_review_key/);
});

test("public pages use MurphOS as the only review content source", () => {
  const homeHtml = fs.readFileSync(new URL("index.html", root), "utf8");
  const servicesHtml = fs.readFileSync(new URL("services/index.html", root), "utf8");
  assert.match(publicJs, /MurphOS reviews unavailable/);
  assert.match(publicJs, /if \(!grid \|\| !Array\.isArray\(reviews\) \|\| !reviews\.length/);
  assert.match(publicJs, /grid\.replaceChildren\(fragment\)/);
  assert.doesNotMatch(homeHtml, /<article class="review-card">/);
  assert.doesNotMatch(servicesHtml, /<article class="review-card">/);
  assert.doesNotMatch(migration, /site-(?:sergio|beau|joshua|robert|jason|corey)/);
});

test("MurphOS header subtitles use the shared class instead of page ID allowlists", () => {
  assert.ok((adminCss.match(/\.topbar \.topbar-subtitle/g) || []).length >= 1);
  assert.doesNotMatch(adminCss, /#[a-z][A-Za-z]*Count\s*[,\{]/);
});

test("Reviews reuses the Pricing and Money layout and card primitives", () => {
  assert.match(adminHtml, /class="money-view">\s*<div id="reviewsPanel" class="money-panel reviews-admin-panel"/);
  assert.match(adminSource, /dashboard-grid money-stat-grid review-summary-grid/);
  assert.match(adminSource, /dashboard-card dashboard-metric review-summary/);
  assert.match(adminCss, /\.review-admin-card\{display:grid;gap:8px;padding:11px 12px/);
  assert.match(adminCss, /#reviewLibraryFilter\{min-height:32px/);
});

test("Import action stays beside Remove without a redundant found header", () => {
  assert.doesNotMatch(adminSource, /review(?:s)? found/);
  assert.match(adminSource, /class="review-import-row-actions"/);
  assert.match(adminSource, /review-remove-draft[\s\S]*?data-review-import-save/);
});

test("Every Reviews button uses the standardized secondary button class", () => {
  const buttons = adminSource.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length > 0);
  buttons.forEach(button => assert.match(button, /class="[^"]*\bsecondary\b/));
  assert.doesNotMatch(adminSource, /class="pricing-publish review-import-save"/);
});

test("Reviews mobile action rows stay compact and single-line", () => {
  assert.match(adminCss, /\.reviews-admin-panel\{[^}]*min-width:0/);
  assert.match(adminCss, /\.reviews-admin-panel>\*\{min-width:0\}/);
  assert.match(adminCss, /\.review-import-card>\*,\.review-import-row>\*\{min-width:0\}/);
  assert.match(adminCss, /\.review-import-fields>\*,\.review-edit-grid>\*\{min-width:0;width:100%;box-sizing:border-box\}/);
  assert.match(adminCss, /\.review-import-actions,\.review-edit-actions\{[^}]*flex-wrap:nowrap/);
  assert.match(adminCss, /\.review-import-row-actions\{[^}]*flex-wrap:nowrap/);
  assert.match(adminCss, /\.review-import-row-actions \.review-remove-draft\{margin-top:0\}/);
  assert.match(adminCss, /\.review-placement-controls\{[^}]*flex-wrap:nowrap/);
  assert.match(adminCss, /\.review-import-actions \.muted\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
  assert.doesNotMatch(adminCss, /@media\(max-width:420px\)\{\.review-summary-grid\{grid-template-columns:1fr/);
});

console.log(`\nReviews self-test: ${tests} tests passed.`);
