const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");

const pinInput = document.getElementById("pinInput");
const loginStatus = document.getElementById("loginStatus");

const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const ordersList = document.getElementById("ordersList");
const orderCount = document.getElementById("orderCount");
const viewTitle = document.getElementById("viewTitle");

const backBtn = document.getElementById("backBtn");
const orderDetail = document.getElementById("orderDetail");
const saveOrderBtn = document.getElementById("saveOrderBtn");
const saveStatusEl = document.getElementById("saveStatus");

const sideMenu = document.getElementById("sideMenu");
const menuBackdrop = document.getElementById("menuBackdrop");
const menuBtn = document.getElementById("menuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));

let allOrders = [];
let activeView = "current";
let currentOrder = null;
let loginInProgress = false;

/* =========================
   VIEW / MENU
========================= */
function showView(view) {
  [loginView, dashboardView, detailView].forEach(v => v.classList.remove("active"));
  view.classList.add("active");
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function openMenu() {
  sideMenu.classList.add("open");
  menuBackdrop.classList.add("show");
}

function closeMenu() {
  sideMenu.classList.remove("open");
  menuBackdrop.classList.remove("show");
}

function clearSaveStatus() {
  if (saveStatusEl) saveStatusEl.textContent = "";
}

/* =========================
   API
========================= */
async function postJson(body, useAuth = false) {
  if (useAuth) body._token = getToken();

  const res = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const raw = await res.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Non-JSON response: ${raw.slice(0, 300) || "[empty response]"}`);
  }

  if (!data.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/* =========================
   FORMAT / HELPERS
========================= */
function formatDate(value) {
  if (!value) return "";
  const s = String(value).trim();

  // Handle plain YYYY-MM-DD without timezone shifting
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${Number(m)}/${Number(d)}/${y}`;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString();
}

function formatDateForInput(value) {
  if (!value) return "";
  const s = String(value).trim();

  // Preserve plain YYYY-MM-DD exactly as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMoneyForInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(num)) return "";
  return `$${num.toFixed(2)}`;
}

function parseMoneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(num) ? "" : num.toFixed(2);
}

function todayForInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function val(id) {
  return document.getElementById(id)?.value || "";
}

function isCompletedOrder(order) {
  const status = normalizeStatus(order.status);
  return status === "completed" || status === "picked up";
}

function getViewTitle(viewName) {
  switch (viewName) {
    case "waiting": return "Waiting on Parts";
    case "estimate": return "Estimate Sent";
    case "progress": return "In Progress";
    case "ready": return "Ready to Go";
    case "completed": return "Completed";
    default: return "Current Orders";
  }
}

function getViewOrders() {
  switch (activeView) {
    case "completed":
      return allOrders.filter(isCompletedOrder);
    case "waiting":
      return allOrders.filter(order => normalizeStatus(order.status) === "waiting on parts");
    case "estimate":
      return allOrders.filter(order => normalizeStatus(order.status) === "estimate sent");
    case "progress":
      return allOrders.filter(order => normalizeStatus(order.status) === "in progress");
    case "ready":
      return allOrders.filter(order => normalizeStatus(order.status) === "ready to go");
    default:
      return allOrders.filter(order => !isCompletedOrder(order));
  }
}

function looksLocalDropOff(order) {
  const text = [
    order.dropOffMethod,
    order.deliveryMethod,
    order.shippingMethod,
    order.dropoffMethod
  ].map(normalizeText).join(" ");

  return (
    text.includes("local") ||
    text.includes("drop off") ||
    text.includes("drop-off") ||
    text.includes("pickup") ||
    text.includes("pick up") ||
    text.includes("meet up") ||
    text.includes("meet-up")
  ) && !text.includes("ship");
}

function hasMeaningfulValue(value) {
  return String(value || "").trim() !== "";
}

function shouldShowPrimaryLace(order) {
  return hasMeaningfulValue(order.primaryLaceColor) || hasMeaningfulValue(order.lacePrimary);
}

function shouldShowSecondaryLace(order) {
  return hasMeaningfulValue(order.secondaryLaceColor) || hasMeaningfulValue(order.laceAccent);
}

function shouldShowCustomLaceNotes(order) {
  return hasMeaningfulValue(order.customLaceNotes);
}

function renderSectionHeading(title) {
  return `<div class="detail-section-title full">${escapeHtml(title)}</div>`;
}

function renderFieldLike(label, value) {
  return `
    <div class="detail-block">
      <div class="label">${escapeHtml(label)}</div>
      <div class="field-like readonly">${escapeHtml(value || "")}</div>
    </div>
  `;
}

const GLOVE_TYPE_OPTIONS = [
  "Fielders Glove",
  "Catchers Mitt",
  "First Base Mitt"
];

const WEB_TYPE_OPTIONS = [
  "Basket (Fully Closed) Web",
  "I-Web",
  "H-Web",
  "Modified Trapeze Web",
  "Trapeze Web",
  "Single Post Web",
  "Other / Not Sure"
];

const DROP_OFF_METHOD_OPTIONS = [
  "Local Drop-Off",
  "Shipped to Murph’s Mitt Maintenance"
];

const SERVICE_OPTIONS = [
  "Relacing",
  "Cleaning + Conditioning",
  "Cleaning + Conditioning + Relacing",
  "ShockTec Air2Gel Palm Pad"
];

const LACE_COLOR_OPTIONS = [
  "Black",
  "Gray",
  "Tan – Camel",
  "Tan – Indian",
  "Brown – Chestnut",
  "Brown – Chocolate",
  "Blue – Royal",
  "Blue – Navy",
  "Blue – Carolina",
  "Red",
  "Red - Dark",
  "Orange",
  "Other (Special Order)"
];

const STATE_OPTIONS = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" }
];

function renderSelectOptions(current, options, placeholder = "") {
  const values = placeholder ? ["", ...options] : options;
  return values.map(v => {
    const label = v || placeholder;
    return `<option value="${escapeAttr(v)}" ${String(v) === String(current || "") ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function renderSelectInput(label, id, current, options, placeholder = "") {
  return `
    <div class="detail-block">
      <div class="label">${escapeHtml(label)}</div>
      <select id="${escapeAttr(id)}">
        ${renderSelectOptions(current, options, placeholder)}
      </select>
    </div>
  `;
}

function renderPhoneInput(label, id, value) {
  return `
    <div class="detail-block">
      <div class="label">${escapeHtml(label)}</div>
      <input
        id="${escapeAttr(id)}"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        maxlength="14"
        placeholder="(555) 555-5555"
        value="${escapeAttr(formatPhoneForInput(value || ""))}"
      />
    </div>
  `;
}

function renderLaceInput(label, id, value, placeholder = "Choose") {
  return renderSelectInput(label, id, value, LACE_COLOR_OPTIONS, placeholder);
}

function gloveTypeOptions(current) {
  return renderSelectOptions(current, GLOVE_TYPE_OPTIONS, "Select glove type");
}

function webTypeOptions(current) {
  return renderSelectOptions(current, WEB_TYPE_OPTIONS, "Choose");
}

function dropOffMethodOptions(current) {
  return renderSelectOptions(current, DROP_OFF_METHOD_OPTIONS, "Select drop-off method");
}

function carrierOptions(current) {
  return renderSelectOptions(
    current,
    ["USPS", "UPS", "FedEx"],
    "Select carrier"
  );
}

function stateOptions(current) {
  const raw = String(current || "").trim();
  const upper = raw.toUpperCase();

  return [
    `<option value="">Select state</option>`,
    ...STATE_OPTIONS.map(opt => {
      const selected =
        upper === opt.value ||
        raw.toLowerCase() === opt.label.toLowerCase();

      return `<option value="${escapeAttr(opt.value)}" ${selected ? "selected" : ""}>${escapeHtml(opt.label)}</option>`;
    })
  ].join("");
}

function parseServicesValue(value) {
  const parts = String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  const selected = SERVICE_OPTIONS.filter(opt => parts.includes(opt));

  const otherParts = parts
    .filter(v => !SERVICE_OPTIONS.includes(v))
    .map(v => v.replace(/^Other:\s*/i, "").trim())
    .filter(Boolean);

  const otherChecked = parts.some(v => /^other$/i.test(v)) || otherParts.length > 0;

  return {
    selected,
    otherChecked,
    otherText: otherParts.join(", ")
  };
}

function renderServicesEditor(currentValue) {
  const parsed = parseServicesValue(currentValue);

  return `
    <div class="detail-block full">
      <div class="label">Services Requested</div>
      <div class="checkbox-group" id="editServicesRequestedWrap">
        ${SERVICE_OPTIONS.map(opt => `
          <label class="checkbox-item">
            <input
              type="checkbox"
              name="editServicesRequested"
              value="${escapeAttr(opt)}"
              ${parsed.selected.includes(opt) ? "checked" : ""}
            />
            <span>${escapeHtml(opt)}</span>
          </label>
        `).join("")}

        <div class="checkbox-other">
          <label class="checkbox-item">
            <input
              id="editServiceOtherCheck"
              type="checkbox"
              ${parsed.otherChecked ? "checked" : ""}
            />
            <span>Other:</span>
          </label>
          <input
            id="editServiceOtherText"
            type="text"
            placeholder="Describe other requested work"
            value="${escapeAttr(parsed.otherText)}"
          />
        </div>
      </div>
    </div>
  `;
}

function getSelectedServices() {
  const checked = Array.from(
    document.querySelectorAll('input[name="editServicesRequested"]:checked')
  ).map(el => el.value);

  const otherChecked = document.getElementById("editServiceOtherCheck")?.checked;
  const otherText = val("editServiceOtherText").trim();

  if (otherChecked && otherText) {
    checked.push(`Other: ${otherText}`);
  } else if (otherChecked) {
    checked.push("Other");
  }

  return checked.join(", ");
}

function formatPhoneForInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/* =========================
   FILTER / LIST
========================= */
function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  let list = getViewOrders();

  if (q) {
    list = list.filter(order => {
      return [
        order.orderNumber,
        order.customerName,
        order.emailAddress,
        order.phoneNumber,
        order.status
      ].some(v => String(v || "").toLowerCase().includes(q));
    });
  }

  list.sort((a, b) => {
    const aNum = Number(String(a.orderNumber || "").replace(/[^\d]/g, "")) || 0;
    const bNum = Number(String(b.orderNumber || "").replace(/[^\d]/g, "")) || 0;

    if (activeView === "progress") {
      const aDate = Date.parse(String(a.dateReceived || "").trim());
      const bDate = Date.parse(String(b.dateReceived || "").trim());

      const aHasDate = !Number.isNaN(aDate);
      const bHasDate = !Number.isNaN(bDate);

      if (aHasDate && bHasDate) {
        if (aDate !== bDate) return aDate - bDate; // oldest received first
        return aNum - bNum; // tie-breaker
      }

      if (aHasDate && !bHasDate) return -1;
      if (!aHasDate && bHasDate) return 1;

      return aNum - bNum; // fallback if both dates missing
    }

    return bNum - aNum; // newest first for everything else
  });

  renderOrders(list);
}

function setActiveView(viewName) {
  activeView = viewName;
  viewTitle.textContent = getViewTitle(viewName);

  navLinks.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  closeMenu();
  clearSaveStatus();
  applyFilters();

  if (detailView.classList.contains("active")) {
    showView(dashboardView);
    orderDetail.scrollTop = 0;
    detailView.scrollTop = 0;
    window.scrollTo(0, 0);
  }
}

function renderOrders(list) {
  orderCount.textContent = `${list.length} order${list.length === 1 ? "" : "s"}`;
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = `<div class="no-results">No matching orders.</div>`;
    return;
  }

  list.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card clickable-card";
    card.tabIndex = 0;

    const paidClass = normalizeText(order.paid) === "paid" ? "paid" : "unpaid";

    card.innerHTML = `
      <div class="order-top">
        <div class="order-main">
          <div class="order-name">${escapeHtml(order.customerName || "")}</div>
          <div class="order-number ${paidClass}">${escapeHtml(order.orderNumber || "")}</div>
        </div>
        <div class="order-status">${escapeHtml(order.status || "")}</div>
      </div>

      <div class="action-row">
        <button class="action-btn action-edit" type="button" aria-label="Edit">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="action-btn action-email" type="button" aria-label="Email">
          <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/></svg>
        </button>
        <button class="action-btn action-phone" type="button" aria-label="Call">
          <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.15a2 2 0 0 1 2.11-.45c.83.3 1.71.51 2.61.63A2 2 0 0 1 22 16.92z"/></svg>
        </button>
        <button class="action-btn action-text" type="button" aria-label="Text">
          <svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
        </button>
      </div>
    `;

    card.addEventListener("click", () => openOrder(order.orderNumber));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOrder(order.orderNumber);
      }
    });

    card.querySelector(".action-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openOrder(order.orderNumber);
    });

    card.querySelector(".action-email").addEventListener("click", (e) => {
      e.stopPropagation();
      const email = String(order.emailAddress || "").trim();
      if (email) window.location.href = `mailto:${email}`;
    });

    card.querySelector(".action-phone").addEventListener("click", (e) => {
      e.stopPropagation();
      const phone = String(order.phoneNumber || "").trim();
      if (phone) window.location.href = `tel:${phone}`;
    });

    card.querySelector(".action-text").addEventListener("click", (e) => {
      e.stopPropagation();
      const phone = String(order.phoneNumber || "").replace(/[^\d+]/g, "").trim();
      if (phone) window.location.href = `sms:${phone}`;
    });

    ordersList.appendChild(card);
  });
}

/* =========================
   DETAIL
========================= */
function renderOrderDetail(order) {
  currentOrder = order;
  clearSaveStatus();

  const isLocal = looksLocalDropOff(order);

  const primaryLaceColor = order.primaryLaceColor || order.lacePrimary || "";
  const secondaryLaceColor = order.secondaryLaceColor || order.laceAccent || "";
  const customLaceNotes = order.customLaceNotes || "";

  const shippingSection = isLocal ? "" : `
    ${renderSectionHeading("Shipping")}

    <div class="detail-block">
      <div class="label">Allow Ship Without Payment</div>
      <select id="editAllowShipWithoutPayment">
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    </div>

    <div class="detail-block">
      <div class="label">Tracking Number</div>
      <input id="editTrackingNumber" type="text" />
    </div>

    <div class="detail-block">
      <div class="label">Carrier</div>
      <select id="editCarrier">${carrierOptions(order.carrier)}</select>
    </div>

    <div class="detail-block full">
      <div class="label">Street Address</div>
      <input id="editStreetAddress" type="text" />
    </div>

    <div class="detail-block">
      <div class="label">City</div>
      <input id="editCity" type="text" />
    </div>

    <div class="detail-block">
      <div class="label">State</div>
      <input id="editState" type="text" />
    </div>

    <div class="detail-block">
      <div class="label">Zip Code</div>
      <input id="editZipCode" type="text" />
    </div>
  `;

  orderDetail.innerHTML = `
    <div class="detail-grid">
      ${renderSectionHeading("Order Summary")}

      ${renderFieldLike("Order #", order.orderNumber || "")}
      ${renderFieldLike("Customer", order.customerName || "")}
      ${renderFieldLike("Phone", order.phoneNumber || "")}
      ${renderFieldLike("Email", order.emailAddress || "")}

      ${renderSectionHeading("Order Status")}

      <div class="detail-block">
        <div class="label">Status</div>
        <select id="editStatus">
          <option value="Received">Received</option>
          <option value="Estimate Sent">Estimate Sent</option>
          <option value="In Progress">In Progress</option>
          <option value="Waiting on Parts">Waiting on Parts</option>
          <option value="Ready to Go">Ready to Go</option>
          <option value="Completed">Completed</option>
          <option value="Picked Up">Picked Up</option>
        </select>
      </div>

      <div class="detail-block">
        <div class="label">Paid?</div>
        <select id="editPaid">
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
        </select>
      </div>

      <div class="detail-block">
        <div class="label">Price Quoted</div>
        <input id="editPriceQuoted" type="text" inputmode="decimal" placeholder="$0.00" />
      </div>

      <div class="detail-block">
        <div class="label">Estimated Completion</div>
        <input id="editEstimatedCompletion" type="date" />
      </div>

      ${renderFieldLike("Date Received", formatDate(order.dateReceived))}

      <div class="detail-block">
        <div class="label">Date Completed</div>
        <input id="editDateCompleted" type="date" />
      </div>

      <div class="detail-block full">
        <div class="label">Internal Notes</div>
        <textarea id="editInternalNotes" rows="4"></textarea>
      </div>

      ${renderSectionHeading("Glove Details")}

      <div class="detail-block">
        <div class="label">Brand / Model</div>
        <input id="editBrandModel" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Glove Type</div>
        <select id="editGloveType">${gloveTypeOptions(order.gloveType)}</select>
      </div>

      <div class="detail-block">
        <div class="label">Web Type</div>
        <select id="editWebType">${webTypeOptions(order.webType)}</select>
      </div>

      <div class="detail-block">
        <div class="label">Drop-Off Method</div>
        <input id="editDropOffMethod" type="text" />
      </div>

      <div class="detail-block full">
        <div class="label">Services Requested</div>
        <textarea id="editServicesRequested" rows="4"></textarea>
      </div>

      ${shouldShowPrimaryLace(order) ? renderLaceInput("Primary Lace Color", "editPrimaryLaceColor", primaryLaceColor) : ""}
      ${shouldShowSecondaryLace(order) ? renderLaceInput("Secondary Lace Color", "editSecondaryLaceColor", secondaryLaceColor) : ""}
      ${shouldShowCustomLaceNotes(order) ? renderLaceInput("Custom Lace Notes", "editCustomLaceNotes", customLaceNotes) : ""}

      <div class="detail-block full">
        <div class="label">Customer Notes</div>
        <textarea id="editGloveNotes" rows="5"></textarea>
      </div>

      ${shippingSection}
    </div>
  `;

  document.getElementById("editStatus").value = order.status || "Received";
  document.getElementById("editPaid").value = normalizeText(order.paid) === "paid" ? "Paid" : "Unpaid";
  document.getElementById("editPriceQuoted").value = formatMoneyForInput(order.priceQuoted);
  document.getElementById("editEstimatedCompletion").value = formatDateForInput(order.estimatedCompletion);
  document.getElementById("editDateCompleted").value = formatDateForInput(order.dateCompleted);
  document.getElementById("editInternalNotes").value = order.internalNotes || "";

  document.getElementById("editBrandModel").value = order.brandModel || "";
  document.getElementById("editGloveType").value = order.gloveType || "";
  document.getElementById("editWebType").value = order.webType || "";
  document.getElementById("editServicesRequested").value = order.servicesRequested || "";
  document.getElementById("editDropOffMethod").value = order.dropOffMethod || "";
  document.getElementById("editGloveNotes").value = order.gloveNotes || order.customerNotes || "";

  const primaryEl = document.getElementById("editPrimaryLaceColor");
  const secondaryEl = document.getElementById("editSecondaryLaceColor");
  const customLaceEl = document.getElementById("editCustomLaceNotes");

  if (primaryEl) primaryEl.value = primaryLaceColor;
  if (secondaryEl) secondaryEl.value = secondaryLaceColor;
  if (customLaceEl) customLaceEl.value = customLaceNotes;

  if (!isLocal) {
    document.getElementById("editTrackingNumber").value = order.trackingNumber || order.tracking || "";
    document.getElementById("editCarrier").value = order.carrier || "";
    document.getElementById("editAllowShipWithoutPayment").value = order.allowShipWithoutPayment ? "true" : "false";
    document.getElementById("editStreetAddress").value = order.streetAddress || order.address || "";
    document.getElementById("editCity").value = order.city || "";
    document.getElementById("editState").value = order.state || "";
    document.getElementById("editZipCode").value = order.zipCode || order.zip || "";
  }
}

async function saveCurrentOrderFromForm() {
  if (!currentOrder) return;
  if (!saveStatusEl) return;

  saveStatusEl.textContent = "Saving...";

  const isLocal = looksLocalDropOff(currentOrder);

  const streetAddress = isLocal ? "" : val("editStreetAddress");
  const city = isLocal ? "" : val("editCity");
  const state = isLocal ? "" : val("editState");
  const zipCode = isLocal ? "" : val("editZipCode");
  const trackingNumber = isLocal ? "" : val("editTrackingNumber");
  const carrier = isLocal ? "" : val("editCarrier");
  const allowShipWithoutPayment = isLocal ? false : (val("editAllowShipWithoutPayment") === "true");

  const primaryLaceColor = val("editPrimaryLaceColor");
  const secondaryLaceColor = val("editSecondaryLaceColor");
  const customLaceNotes = val("editCustomLaceNotes");

  let dateCompleted = val("editDateCompleted");
  const newStatus = val("editStatus");

  if (newStatus === "Ready to Go" && !dateCompleted) {
    dateCompleted = todayForInput();
  }

  const updates = {
    status: newStatus,
    paid: val("editPaid"),
    priceQuoted: parseMoneyInput(val("editPriceQuoted")),
    estimatedCompletion: val("editEstimatedCompletion"),
    dateCompleted,
    internalNotes: val("editInternalNotes"),
    brandModel: val("editBrandModel"),
    gloveType: val("editGloveType"),
    webType: val("editWebType"),
    servicesRequested: val("editServicesRequested"),
    dropOffMethod: val("editDropOffMethod"),
    gloveNotes: val("editGloveNotes"),
    customerNotes: val("editGloveNotes")
  };

  if (!isLocal) {
    updates.streetAddress = streetAddress;
    updates.address = streetAddress;
    updates.city = city;
    updates.state = state;
    updates.zipCode = zipCode;
    updates.zip = zipCode;
    updates.tracking = trackingNumber;
    updates.trackingNumber = trackingNumber;
    updates.carrier = carrier;
    updates.allowShipWithoutPayment = allowShipWithoutPayment;
  } else {
    updates.tracking = "";
    updates.trackingNumber = "";
    updates.carrier = "";
    updates.allowShipWithoutPayment = false;
  }

  if (document.getElementById("editPrimaryLaceColor")) {
    updates.primaryLaceColor = primaryLaceColor;
    updates.lacePrimary = primaryLaceColor;
  }

  if (document.getElementById("editSecondaryLaceColor")) {
    updates.secondaryLaceColor = secondaryLaceColor;
    updates.laceAccent = secondaryLaceColor;
  }

  if (document.getElementById("editCustomLaceNotes")) {
    updates.customLaceNotes = customLaceNotes;
  }

  const updated = await saveOrderUpdate(currentOrder.orderNumber, updates, true);
  currentOrder = updated;
  renderOrderDetail(updated);
  saveStatusEl.textContent = "Saved.";
  orderDetail.scrollTop = 0;
  detailView.scrollTop = 0;
  window.scrollTo(0, 0);
}

async function saveOrderUpdate(orderNumber, updates, stayOnDetail = false) {
  const data = await postJson({
    action: "updateOrder",
    orderNumber,
    updates
  }, true);

  const updatedOrder = data.order;
  const idx = allOrders.findIndex(o => String(o.orderNumber) === String(updatedOrder.orderNumber));

  if (idx !== -1) {
    allOrders[idx] = updatedOrder;
  } else {
    allOrders.push(updatedOrder);
  }

  if (currentOrder && String(currentOrder.orderNumber) === String(updatedOrder.orderNumber)) {
    currentOrder = updatedOrder;
  }

  applyFilters();
  return updatedOrder;
}

/* =========================
   AUTH / LOAD
========================= */
async function login(pinValue) {
  if (loginInProgress) return;
  loginInProgress = true;
  loginStatus.textContent = "Logging in...";

  try {
    const data = await postJson({
      action: "login",
      pin: pinValue
    });

    setToken(data.token);
    pinInput.value = "";
    loginStatus.textContent = "";
    showView(dashboardView);
    await loadOrders();
  } catch (err) {
    loginStatus.textContent = err.message;
    pinInput.value = "";
    pinInput.focus();
  } finally {
    loginInProgress = false;
  }
}

async function loadOrders() {
  try {
    const data = await postJson({ action: "listOrders" }, true);
    allOrders = data.orders || [];
    localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
  } catch (err) {
    const cached = localStorage.getItem("mm_orders_cache");
    if (cached) {
      allOrders = JSON.parse(cached);
    }
  }

  applyFilters();
}

function openOrder(orderNumber) {
  const order = allOrders.find(o => String(o.orderNumber) === String(orderNumber));
  if (!order) {
    alert("Order not found.");
    return;
  }

  renderOrderDetail(order);
  clearSaveStatus();
  showView(detailView);
  orderDetail.scrollTop = 0;
  detailView.scrollTop = 0;
  window.scrollTo(0, 0);

  requestAnimationFrame(() => {
    const topbar = detailView.querySelector(".detail-topbar");
    if (topbar) topbar.scrollIntoView({ block: "start" });
  });
}

/* =========================
   EVENTS
========================= */
pinInput.addEventListener("input", () => {
  const digits = pinInput.value.replace(/\D/g, "").slice(0, 6);
  pinInput.value = digits;

  if (digits.length === 6) {
    login(digits);
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  currentOrder = null;
  clearSaveStatus();
  showView(loginView);
});

searchInput.addEventListener("input", applyFilters);

backBtn.addEventListener("click", () => {
  clearSaveStatus();
  showView(dashboardView);
  orderDetail.scrollTop = 0;
  detailView.scrollTop = 0;
  window.scrollTo(0, 0);
});

if (saveOrderBtn) {
  saveOrderBtn.addEventListener("click", async () => {
    try {
      await saveCurrentOrderFromForm();
    } catch (err) {
      if (saveStatusEl) saveStatusEl.textContent = err.message;
    }
  });
}

menuBtn.addEventListener("click", openMenu);
closeMenuBtn.addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);

navLinks.forEach(btn => {
  btn.addEventListener("click", () => {
    setActiveView(btn.dataset.view);
  });
});

/* =========================
   INIT
========================= */
(async function init() {
  if (!getToken()) {
    showView(loginView);
    return;
  }

  try {
    await loadOrders();
    setActiveView(activeView);
    showView(dashboardView);
  } catch (err) {
    clearToken();
    showView(loginView);
  }
})();
