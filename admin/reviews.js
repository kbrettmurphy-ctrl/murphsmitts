/* =========================
   REVIEWS — bulk Google-copy import + public placement curation
========================= */
const reviewsPanel = document.getElementById("reviewsPanel");
const reviewsCount = document.getElementById("reviewsCount");
const reviewsImportToggleBtn = document.getElementById("reviewsImportToggleBtn");
let customerReviews = [];
let reviewImportOpen = false;
let parsedReviewDrafts = [];
let reviewFilter = "active";

function reviewStars(rating) {
  const count = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  return "★".repeat(count) + "☆".repeat(5 - count);
}

function parseGoogleReviewPaste(raw) {
  const lines = String(raw || "").replace(/\r/g, "").split("\n").map(line => line.trim());
  const starts = [];
  const metadataPattern = /(?:local guide|\b\d+\s+reviews?\b|\b\d+\s+photos?\b)/i;
  const starsPattern = /(?:★{1,5}|(?:star\s*){1,5}|\b[1-5](?:\.0)?\s*(?:out of 5|stars?)\b)/i;

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const next = lines.slice(i + 1, i + 4);
    if (next.some(line => metadataPattern.test(line)) && next.some(line => starsPattern.test(line))) {
      starts.push(i);
    }
  }

  let groups = [];
  if (starts.length) {
    groups = starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length));
  } else {
    groups = String(raw || "").replace(/\r/g, "").split(/\n\s*(?:---+|={3,})\s*\n|\n{3,}/).map(block => block.split("\n"));
  }

  return groups.map(group => {
    const clean = group.map(line => line.trim()).filter(Boolean);
    const starIndex = clean.findIndex(line => starsPattern.test(line));
    if (!clean.length || starIndex < 0) return null;
    const markdownName = clean[0].match(/^\[(?:\*\*)?(.+?)(?:\*\*)?\]\([^)]+\)(?:open_in_new)?$/i);
    const reviewerName = (markdownName?.[1] || clean[0])
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/open_in_new$/i, "")
      .trim();
    const starMatch = clean[starIndex].match(/★{1,5}/);
    const wordStars = clean[starIndex].match(/star/gi);
    const numberMatch = clean[starIndex].match(/\b([1-5])(?:\.0)?\b/);
    const rating = starMatch ? starMatch[0].length : (wordStars?.length || Number(numberMatch?.[1] || 5));
    const datePattern = /(?:edited\s+)?(?:a|an|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago|[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}/i;
    const dateLabel = clean.slice(starIndex, starIndex + 3).map(line => line.match(datePattern)?.[0] || "").find(Boolean) || "";
    const ignored = /^(?:like|share|read more|new|helpful)$/i;
    const reviewLines = clean.slice(starIndex + 1).filter(line => line !== dateLabel && !ignored.test(line));
    const ownerResponse = reviewLines.findIndex(line => /^(?:owner response|response from the owner)/i.test(line));
    const reviewText = reviewLines.slice(0, ownerResponse >= 0 ? ownerResponse : reviewLines.length).join(" ").trim();
    if (!reviewerName || !reviewText) return null;
    const firstSentence = reviewText.match(/^.*?[.!?](?=\s|$)/)?.[0] || reviewText;
    const homepageExcerpt = firstSentence.length > 220
      ? `${firstSentence.slice(0, 217).replace(/\s+\S*$/, "").trim()}…`
      : firstSentence;
    return { reviewerName, reviewerLocation: "", rating, reviewText, homepageExcerpt, dateLabel, reviewDate: "" };
  }).filter(Boolean);
}

function renderReviewImport() {
  if (!reviewImportOpen) return "";
  const preview = parsedReviewDrafts.length
    ? `<div class="review-import-preview">
        ${parsedReviewDrafts.map((review, index) => `
          <div class="review-import-row" data-review-draft="${index}">
            <div class="review-import-fields">
              <input data-review-draft-field="reviewerName" value="${escapeAttr(review.reviewerName)}" aria-label="Reviewer name">
              <input data-review-draft-field="reviewerLocation" value="${escapeAttr(review.reviewerLocation)}" placeholder="Location (optional)" aria-label="Reviewer location">
              <select data-review-draft-field="rating" aria-label="Rating">${[5,4,3,2,1].map(n => `<option value="${n}" ${n === review.rating ? "selected" : ""}>${n} stars</option>`).join("")}</select>
              <input data-review-draft-field="dateLabel" value="${escapeAttr(review.dateLabel)}" placeholder="Date label (optional)" aria-label="Review date label">
            </div>
            <textarea data-review-draft-field="reviewText" rows="3" aria-label="Review text">${escapeHtml(review.reviewText)}</textarea>
            <label class="review-import-excerpt"><span>Homepage excerpt <small>Editable suggestion used only if this review is featured on the homepage.</small></span><textarea data-review-draft-field="homepageExcerpt" rows="2" aria-label="Homepage excerpt">${escapeHtml(review.homepageExcerpt || "")}</textarea></label>
            <div class="review-import-row-actions"><button class="secondary review-remove-draft" type="button" data-review-remove-draft="${index}">Remove</button>${index === parsedReviewDrafts.length - 1 ? `<button class="secondary review-import-save" type="button" data-review-import-save>Import</button><span id="reviewImportStatus" class="status" aria-live="polite"></span>` : ""}</div>
          </div>`).join("")}
      </div>`
    : "";
  return `<div class="dashboard-card review-import-card">
    <div class="review-card-heading"><div><h2>Paste Google Reviews</h2><p class="muted">In Google Maps, copy one or more complete review blocks. MurphOS will separate them for confirmation.</p></div><button class="secondary topbar-icon-action" type="button" data-review-import-close aria-label="Close importer">×</button></div>
    <textarea id="reviewPasteInput" rows="8" placeholder="Paste copied Google review blocks here…"></textarea>
    <div class="review-import-actions"><button class="secondary" type="button" data-review-parse>Preview</button><span class="muted">Duplicate names + review text are skipped automatically.</span></div>
    ${preview}
  </div>`;
}

function renderReviewCard(review) {
  return `<article class="dashboard-card review-admin-card ${review.hidden ? "is-hidden" : ""}" data-review-id="${escapeAttr(review.id)}">
    <div class="review-card-heading">
      <div><h3>${escapeHtml(review.reviewerName)}</h3><p class="review-admin-stars" aria-label="${review.rating} out of 5 stars">${reviewStars(review.rating)}</p></div>
      <button class="secondary review-edit-toggle" type="button" data-review-edit>Edit</button>
    </div>
    <p class="review-admin-text">“${escapeHtml(review.reviewText)}”</p>
    <p class="muted review-admin-meta">${escapeHtml([review.reviewerLocation, review.dateLabel || review.reviewDate, "Google Review"].filter(Boolean).join(" · "))}</p>
    <div class="review-placement-controls">
      <label><input type="checkbox" data-review-quick="homepageFeatured" ${review.homepageFeatured ? "checked" : ""} ${review.hidden ? "disabled" : ""}> Homepage</label>
      <label><input type="checkbox" data-review-quick="servicesFeatured" ${review.servicesFeatured ? "checked" : ""} ${review.hidden ? "disabled" : ""}> Services</label>
      ${review.hidden ? '<span class="review-hidden-badge">Hidden</span>' : ""}
    </div>
    <form class="review-edit-form" hidden>
      <div class="review-edit-grid">
        <label>Name<input name="reviewerName" value="${escapeAttr(review.reviewerName)}" required></label>
        <label>Location<input name="reviewerLocation" value="${escapeAttr(review.reviewerLocation)}"></label>
        <label>Rating<select name="rating">${[5,4,3,2,1].map(n => `<option value="${n}" ${n === review.rating ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Review date<input name="reviewDate" type="date" value="${escapeAttr(review.reviewDate)}"></label>
        <label>Date label<input name="dateLabel" value="${escapeAttr(review.dateLabel)}" placeholder="e.g. 2 months ago"></label>
        <label>Homepage order<input name="homepageSortOrder" type="number" step="10" value="${review.homepageSortOrder}"></label>
        <label>Services order<input name="servicesSortOrder" type="number" step="10" value="${review.servicesSortOrder}"></label>
      </div>
      <label>Full review<textarea name="reviewText" rows="5" required>${escapeHtml(review.reviewText)}</textarea></label>
      <label>Homepage excerpt<textarea name="homepageExcerpt" rows="2" placeholder="Leave blank to use the full review">${escapeHtml(review.homepageExcerpt)}</textarea></label>
      <label class="review-hidden-control"><input name="hidden" type="checkbox" ${review.hidden ? "checked" : ""}> Hide from review library</label>
      <div class="review-edit-actions"><button class="secondary" type="submit">Save</button><button class="secondary" type="button" data-review-delete>Delete</button><span class="status" data-review-status></span></div>
    </form>
  </article>`;
}

function renderReviewsPanel() {
  if (!reviewsPanel) return;
  const active = customerReviews.filter(review => !review.hidden);
  const homeCount = active.filter(review => review.homepageFeatured).length;
  const servicesCount = active.filter(review => review.servicesFeatured).length;
  const visible = customerReviews.filter(review => reviewFilter === "hidden" ? review.hidden : !review.hidden);
  reviewsCount.textContent = `${active.length} reviews · ${homeCount}/3 home · ${servicesCount}/6 services`;
  reviewsPanel.innerHTML = `${renderReviewImport()}
    <div class="dashboard-grid money-stat-grid review-summary-grid">
      <div class="dashboard-card dashboard-metric review-summary"><span class="dashboard-metric-label">Homepage</span><strong class="dashboard-metric-value">${homeCount}/3</strong><small class="dashboard-metric-sub">Lowest order displays first</small></div>
      <div class="dashboard-card dashboard-metric review-summary"><span class="dashboard-metric-label">Services</span><strong class="dashboard-metric-value">${servicesCount}/6</strong><small class="dashboard-metric-sub">Lowest order displays first</small></div>
    </div>
    <div class="review-library-heading"><div><h2 class="dashboard-section-title">Review Library</h2><p class="muted">Choose the strongest reviews for each public page.</p></div><select id="reviewLibraryFilter" aria-label="Review library filter"><option value="active" ${reviewFilter === "active" ? "selected" : ""}>Active</option><option value="hidden" ${reviewFilter === "hidden" ? "selected" : ""}>Hidden</option></select></div>
    <div class="review-admin-list">${visible.length ? visible.map(renderReviewCard).join("") : '<div class="dashboard-card"><p class="muted">No reviews in this view.</p></div>'}</div>`;
  reviewsImportToggleBtn?.setAttribute("aria-expanded", String(reviewImportOpen));
}

async function renderReviewsView() {
  if (!reviewsPanel) return;
  reviewsPanel.innerHTML = '<div class="dashboard-card"><p class="muted">Loading reviews…</p></div>';
  try {
    const data = await postJson({ action: "listCustomerReviews" }, true);
    customerReviews = Array.isArray(data.reviews) ? data.reviews : [];
    renderReviewsPanel();
  } catch (error) {
    reviewsPanel.innerHTML = `<div class="dashboard-card"><p class="status">${escapeHtml(error.message)}</p></div>`;
  }
}

function collectReviewDraftEdits() {
  reviewsPanel.querySelectorAll("[data-review-draft]").forEach(row => {
    const index = Number(row.dataset.reviewDraft);
    const draft = parsedReviewDrafts[index];
    if (!draft) return;
    row.querySelectorAll("[data-review-draft-field]").forEach(field => {
      draft[field.dataset.reviewDraftField] = field.dataset.reviewDraftField === "rating" ? Number(field.value) : field.value;
    });
  });
}

reviewsImportToggleBtn?.addEventListener("click", () => {
  reviewImportOpen = !reviewImportOpen;
  renderReviewsPanel();
});
reviewsPanel?.addEventListener("change", async event => {
  if (event.target.id === "reviewLibraryFilter") {
    reviewFilter = event.target.value;
    renderReviewsPanel();
    return;
  }
  const quick = event.target.closest("[data-review-quick]");
  if (!quick) return;
  if (quick.checked) {
    const limit = quick.dataset.reviewQuick === "homepageFeatured" ? 3 : 6;
    const selected = customerReviews.filter(review => !review.hidden && review[quick.dataset.reviewQuick]).length;
    if (selected >= limit) {
      quick.checked = false;
      alert(`That page already has ${limit} featured reviews. Uncheck one before adding another.`);
      return;
    }
  }
  const card = quick.closest("[data-review-id]");
  quick.disabled = true;
  try {
    await postJson({ action: "updateCustomerReview", id: card.dataset.reviewId, updates: { [quick.dataset.reviewQuick]: quick.checked } }, true);
    await renderReviewsView();
  } catch (error) {
    quick.checked = !quick.checked;
    quick.disabled = false;
    alert(error.message);
  }
});

reviewsPanel?.addEventListener("click", async event => {
  if (event.target.closest("[data-review-import-close]")) {
    reviewImportOpen = false; parsedReviewDrafts = []; renderReviewsPanel(); return;
  }
  if (event.target.closest("[data-review-parse]")) {
    parsedReviewDrafts = parseGoogleReviewPaste(document.getElementById("reviewPasteInput")?.value || "");
    if (!parsedReviewDrafts.length) alert("MurphOS could not separate that paste. Copy complete review blocks including the reviewer name, star rating, and review text.");
    renderReviewsPanel(); return;
  }
  const remove = event.target.closest("[data-review-remove-draft]");
  if (remove) { collectReviewDraftEdits(); parsedReviewDrafts.splice(Number(remove.dataset.reviewRemoveDraft), 1); renderReviewsPanel(); return; }
  if (event.target.closest("[data-review-import-save]")) {
    collectReviewDraftEdits();
    const status = document.getElementById("reviewImportStatus");
    try {
      status.textContent = "Importing…";
      const data = await postJson({ action: "importCustomerReviews", reviews: parsedReviewDrafts }, true);
      parsedReviewDrafts = []; reviewImportOpen = false;
      await renderReviewsView();
      alert(`Imported ${data.imported}. Skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}.`);
    } catch (error) { status.textContent = error.message; }
    return;
  }
  const card = event.target.closest("[data-review-id]");
  if (!card) return;
  if (event.target.closest("[data-review-edit]")) {
    const form = card.querySelector(".review-edit-form");
    form.hidden = !form.hidden;
    event.target.textContent = form.hidden ? "Edit" : "Close";
  }
  if (event.target.closest("[data-review-delete]")) {
    const review = customerReviews.find(item => item.id === card.dataset.reviewId);
    if (!confirm(`Permanently delete ${review?.reviewerName || "this review"}?`)) return;
    await postJson({ action: "deleteCustomerReview", id: card.dataset.reviewId }, true);
    await renderReviewsView();
  }
});

reviewsPanel?.addEventListener("submit", async event => {
  const form = event.target.closest(".review-edit-form");
  if (!form) return;
  event.preventDefault();
  const card = form.closest("[data-review-id]");
  const values = new FormData(form);
  const status = form.querySelector("[data-review-status]");
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = "Saving…";
  try {
    await postJson({ action: "updateCustomerReview", id: card.dataset.reviewId, updates: {
      reviewerName: values.get("reviewerName"), reviewerLocation: values.get("reviewerLocation"), rating: Number(values.get("rating")),
      reviewDate: values.get("reviewDate"), dateLabel: values.get("dateLabel"), reviewText: values.get("reviewText"),
      homepageExcerpt: values.get("homepageExcerpt"), homepageSortOrder: Number(values.get("homepageSortOrder")),
      servicesSortOrder: Number(values.get("servicesSortOrder")), hidden: values.get("hidden") === "on"
    } }, true);
    await renderReviewsView();
  } catch (error) { status.textContent = error.message; submit.disabled = false; }
});
