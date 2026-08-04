import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../admin/admin.css", import.meta.url), "utf8");
let tests = 0;
let assertions = 0;

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

async function test(name, fn) {
  tests += 1;
  await fn();
  console.log(`  ok  ${name}`);
}

function gallerySectionForGloveType(gloveType) {
  const normalized = String(gloveType || "").trim().toLowerCase();
  if (normalized === "catchers mitt") return "catchers-mitts";
  if (normalized === "first base mitt") return "first-base-mitts";
  return "fielding-gloves";
}

await test("Add Photo offers private and gallery destinations", () => {
  ok(admin.includes('title: "Add Photo"'));
  ok(admin.includes('{ label: "Customer / Order Photo", value: "order" }'));
  ok(admin.includes('{ label: "Gallery Photo", value: "gallery" }'));
  ok(admin.includes('destination === "order"'));
  ok(admin.includes('destination !== "gallery"'));
});

await test("gallery section defaults from glove type", () => {
  equal(gallerySectionForGloveType("Fielders Glove"), "fielding-gloves");
  equal(gallerySectionForGloveType("Catchers Mitt"), "catchers-mitts");
  equal(gallerySectionForGloveType("First Base Mitt"), "first-base-mitts");
  equal(gallerySectionForGloveType(""), "fielding-gloves");
  ok(admin.includes('document.getElementById("editGloveType")?.value || order.gloveType'));
  ok(admin.includes("Object.entries(GALLERY_SECTION_LABELS)"));
  ok(admin.includes('sectionSelect?.addEventListener("change"'));
});

await test("gallery uploads are linked to the current order", () => {
  const uploader = admin.slice(
    admin.indexOf("async function uploadOrderGalleryPhotos"),
    admin.indexOf("function mergeUpdatedOrder")
  );
  ok(uploader.includes('action: "uploadGalleryPhoto"'));
  ok(uploader.includes('action: "setGalleryPhotoOrder"'));
  ok(uploader.includes("orderNumber"));
  ok(uploader.indexOf('action: "uploadGalleryPhoto"') < uploader.indexOf('action: "setGalleryPhotoOrder"'));
  ok(uploader.includes("added to Gallery and linked to #"));
});

await test("upload menus use the anchored body-level portal", () => {
  ok(admin.includes("getBenchChoiceRoot"));
  ok(admin.includes("document.body.appendChild(benchChoiceRoot)"));
  ok(admin.includes("anchor,"));
  ok(css.includes(".bench-choice-sheet.is-anchored"));
  ok(css.includes("position:fixed"));
  equal(admin.includes('className = "order-gallery-bottom-sheet"'), false);
});

await test("gallery toolbar controls share one compact footprint", () => {
  ok(/\.gallery-refresh-btn\{[\s\S]*?width:180px;[\s\S]*?height:34px;/.test(css));
  ok(/\.gallery-manager-filter\{[\s\S]*?width:180px;[\s\S]*?height:34px;/.test(css));
  ok(/\.gallery-manager-search\{[\s\S]*?padding:0 10px;[\s\S]*?line-height:34px;/.test(css));
  ok(/\.gallery-refresh-btn\{[\s\S]*?flex:1 1 0;[\s\S]*?width:auto;/.test(css));
});

console.log(`\nOrder photo self-test: ${tests} tests, ${assertions} assertions passed.`);
