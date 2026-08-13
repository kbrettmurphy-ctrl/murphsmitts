import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const adminSource = fs.readFileSync(new URL("admin/reviews.js", root), "utf8");
const apiSource = fs.readFileSync(new URL("functions/api/orders.js", root), "utf8");
const publicApiSource = fs.readFileSync(new URL("functions/api/public/reviews.js", root), "utf8");
const publicJs = fs.readFileSync(new URL("assets/js/main.js", root), "utf8");
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

test("admin API actions are authenticated and duplicate-aware", () => {
  for (const action of ["listCustomerReviews", "importCustomerReviews", "updateCustomerReview", "deleteCustomerReview"]) {
    assert.match(apiSource, new RegExp(`${action}: \\{[\\s\\S]*?auth: "session"`));
  }
  assert.match(apiSource, /customerReviewFingerprint\(row\.reviewer_name, row\.review_text\)/);
  assert.match(apiSource, /resolution=ignore-duplicates/);
});

test("public endpoint exposes selected projections with fixed caps", () => {
  assert.match(publicApiSource, /homepage_featured=eq\.true[\s\S]*?limit=3/);
  assert.match(publicApiSource, /services_featured=eq\.true[\s\S]*?limit=6/);
  assert.doesNotMatch(publicApiSource, /source_review_key/);
});

test("public pages preserve static reviews as the failure fallback", () => {
  assert.match(publicJs, /Curated reviews unavailable; using static review fallback/);
  assert.match(publicJs, /if \(!grid \|\| !Array\.isArray\(reviews\) \|\| !reviews\.length/);
  assert.match(publicJs, /grid\.replaceChildren\(fragment\)/);
});

console.log(`\nReviews self-test: ${tests} tests passed.`);
