const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");
const uploadView = document.getElementById("uploadView");
const mapView = document.getElementById("mapView");
const detailTitle = document.getElementById("detailTitle");
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

const saleGlovesView = document.getElementById("saleGlovesView");
const saleGlovesList = document.getElementById("saleGlovesList");
const saleGlovesCount = document.getElementById("saleGlovesCount");

const saleGlovesMenuBtn = document.getElementById("saleGlovesMenuBtn");
const saleGlovesRefreshBtn = document.getElementById("saleGlovesRefreshBtn");
const saleGlovesLogoutBtn = document.getElementById("saleGlovesLogoutBtn");
const addSaleGloveBtn = document.getElementById("addSaleGloveBtn");
const mapMenuBtn = document.getElementById("mapMenuBtn");
const mapRefreshBtn = document.getElementById("mapRefreshBtn");
const mapLogoutBtn = document.getElementById("mapLogoutBtn");
const mapCount = document.getElementById("mapCount");
const mapStatus = document.getElementById("mapStatus");
const orderMapEl = document.getElementById("orderMap");
const mapUnmappedList = document.getElementById("mapUnmappedList");

let laceInventory = [];
let reorderBannerDismissed = false;
let allOrders = [];
let activeView = "current";
let currentOrder = null;
let workflowSheetEl = null;
let workflowPressTimer = null;
let workflowSuppressOpeningTouch = false;
let workflowSuppressOpeningTouchTimer = null;
let suppressOrderCardClickUntil = 0;
let loginInProgress = false;
let listScrollY = 0;
let orderMap = null;
let orderMapMarkers = null;
let mapRenderToken = 0;

window.inventoryNeedsOrderOnly = false;

/* =========================
   VIEW / MENU
========================= */
function showView(view) {
  [loginView, dashboardView, detailView, uploadView, mapView, saleGlovesView]
    .filter(Boolean)
    .forEach(v => v.classList.remove("active"));

  if (view) {
    view.classList.add("active");
  }

  syncAuthUI();
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
  if (!isAuthenticated()) return;
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

function isAuthenticated() {
  return !!getToken();
}

function syncAuthUI() {
  const authed = isAuthenticated();

  if (sideMenu) {
    sideMenu.style.display = authed ? "" : "none";
    sideMenu.classList.remove("open");
  }

  if (menuBackdrop) {
    menuBackdrop.classList.remove("show");
    menuBackdrop.style.display = authed ? "" : "none";
  }
}

/* =========================
   API
========================= */
async function postJson(body, useAuth = false, endpoint = API_BASE_URL) {
  if (useAuth) body._token = getToken();

  const res = await fetch(endpoint, {
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
    let message = "Request failed";

    if (typeof data.error === "string") {
      message = data.error;
    } else if (Array.isArray(data.error)) {
      message = data.error.map(item => {
        if (typeof item === "string") return item;
        if (item?.message) return item.message;
        if (item?.details) return item.details;
        return JSON.stringify(item);
      }).join(" | ");
    } else if (data.error && typeof data.error === "object") {
      message =
        data.error.message ||
        data.error.details ||
        data.error.hint ||
        JSON.stringify(data.error);

      if (data.details) {
         message += ` | Details: ${
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details)
         }`;
      }
    }

    throw new Error(message);
  }

  return data;
}

/* =========================
   FORMAT / HELPERS
========================= */
function formatDate(value) {
  if (!value) return "";
  const s = String(value).trim();

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

function moneyNumber(value) {
  const n = Number(
    String(value ?? "").replace(/[^\d.-]/g, "")
  );

  return Number.isNaN(n) ? 0 : n;
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

function isWaitingForCustomerResponse(order) {
  return normalizeStatus(order.status) === "pending response";
}

function isOnHold(order) {
  return normalizeStatus(order.status) === "on hold";
}

function isInTransitToMe(order) {
  return normalizeStatus(order.status) === "in transit to me";
}

function getViewTitle(viewName) {
  switch (viewName) {
    case "map": return "Map";
    case "upload": return "Upload";
    case "inventory": return "Lace Inventory";
    case "waiting": return "Waiting on Lace/Parts";
    case "estimate": return "Estimate Sent";
    case "approved": return "Customer Approved";
    case "customer-response": return "Pending Response";
    case "transit": return "In Transit to Me";
    case "progress": return "In Progress";
    case "ready": return "Ready to Go";
    case "hold": return "On Hold";
    case "completed": return "Completed";
    case "all": return "All Orders";
    case "gloves-sale": return "Gloves For Sale";
    default: return "Current Orders";
  }
}

function getViewOrders() {
  switch (activeView) {
    case "all":
      return allOrders;
      
    case "completed":
      return allOrders.filter(isCompletedOrder);

    case "waiting":
      return allOrders.filter(order => normalizeStatus(order.status) === "waiting on lace/parts");

    case "estimate":
      return allOrders.filter(order => normalizeStatus(order.status) === "estimate sent");
      
    case "approved":
      return allOrders.filter(order => normalizeStatus(order.status) === "customer approved");

    case "customer-response":
      return allOrders.filter(isWaitingForCustomerResponse);

    case "transit":
      return allOrders.filter(isInTransitToMe);

    case "progress":
      return allOrders.filter(order => normalizeStatus(order.status) === "in progress");

    case "ready":
      return allOrders.filter(order => normalizeStatus(order.status) === "ready to go");

    case "hold":
      return allOrders.filter(isOnHold);

    default:
      return allOrders.filter(order => {
        const status = normalizeStatus(order.status);
        return (
          status !== "completed" &&
          status !== "picked up" &&
          status !== "on hold"
        );
      });
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

function buildPirateShipClipboardText(order) {
  return [
    order.customerName,
    order.streetAddress || order.address,
    order.address2 || order.aptUnit || order.apartment || "",
    `${order.city || ""}, ${order.state || ""} ${order.zipCode || order.zip || ""}`,
    "United States",
    order.emailAddress
  ]
    .map(v => String(v || "").trim())
    .filter(Boolean)
    .join("\n");
}

async function copyPirateShipInfo(order) {
  if (looksLocalDropOff(order)) {
    alert("This is a local order. No shipping info to copy.");
    return;
  }

  const missing = [];
  if (!order.customerName) missing.push("customer name");
  if (!(order.streetAddress || order.address)) missing.push("street address");
  if (!order.city) missing.push("city");
  if (!order.state) missing.push("state");
  if (!(order.zipCode || order.zip)) missing.push("zip");

  if (missing.length) {
    alert(`Missing shipping info: ${missing.join(", ")}.`);
    return;
  }

  const text = buildPirateShipClipboardText(order);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = prompt("Copy this shipping info:", text);
    if (box === null) return;
  }

  window.open("https://ship.pirateship.com/", "_blank");
}

function textOrderCustomer(order) {
  const phone = String(order.phoneNumber || "").replace(/[^\d+]/g, "").trim();
  if (phone) window.location.href = `sms:${phone}`;
}

function emailOrderCustomer(order) {
  const email = String(order.emailAddress || "").trim();
  if (email) window.location.href = `mailto:${email}`;
}

const SWIPE_ICONS = {
  text: `
    <svg class="swipe-action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.2 9.1 9.1 0 0 1-3.5-.7L3 21l1.9-4.7A7.9 7.9 0 0 1 4 11.5a8.4 8.4 0 0 1 8.5-8.2 8.4 8.4 0 0 1 8.5 8.2Z" />
    </svg>
  `,
  email: `
    <svg class="swipe-action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m5 7 7 5.8L19 7" />
    </svg>
  `,
  ship: `
    <svg class="swipe-action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 8.5 12 4l7.5 4.5v7L12 20l-7.5-4.5v-7Z" />
      <path d="M4.8 8.8 12 13l7.2-4.2" />
      <path d="M12 13v6.6" />
      <path d="m8.2 6.3 7.5 4.4" />
    </svg>
  `,
  delete: `
    <svg class="swipe-action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.6c0-.9.7-1.6 1.6-1.6h1.8c.9 0 1.6.7 1.6 1.6V7" />
      <path d="M17.5 7 16.6 19c-.1.8-.8 1.4-1.6 1.4H9c-.8 0-1.5-.6-1.6-1.4L6.5 7" />
      <path d="M10 11v5.5" />
      <path d="M14 11v5.5" />
    </svg>
  `
};

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

function renderPhotoGallery(order) {
  const photos = Array.isArray(order.glovePhotos) ? order.glovePhotos : [];

  if (!photos.length) return "";

  return `
    ${renderSectionHeading("Photos")}

    <div class="detail-block full">
      <div class="photo-grid">
        ${photos.map((url, index) => `
          <img
            class="photo-thumb-img"
            src="${escapeAttr(url)}"
            data-index="${index}"
            alt="Glove photo ${index + 1}"
            loading="lazy"
          >
        `).join("")}
      </div>
    </div>

    <div id="photoLightbox" class="photo-lightbox">
      <img id="lightboxImage" src="">
    </div>
  `;
}

function emptyToNull(value) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
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
  "Vintage Chestnut",
  "Blue – Royal",
  "Blue – Navy",
  "Blue – Carolina",
  "Red",
  "Red - Dark",
  "Orange",
  "Yellow",
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

const REFERRAL_SOURCE_OPTIONS = [
  "TikTok",
  "Insta",
  "Facebook",
  "Referral",
  "The Craftsman",
  "Google",
  "Other"
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

function renderReferralSourceEditor(currentValue) {
  const raw = String(currentValue || "").trim();
  const isPreset = !raw || REFERRAL_SOURCE_OPTIONS.includes(raw);

  const customOption = !isPreset
    ? `<option value="${escapeAttr(raw)}" selected>${escapeHtml(raw)}</option>`
    : "";

  return `
    <div class="detail-block">
      <div class="label">Referral Source</div>
      <select id="editReferralSource">
        ${renderSelectOptions(isPreset ? raw : "", REFERRAL_SOURCE_OPTIONS, "Select source")}
        ${customOption}
      </select>
    </div>
  `;
}

function getReferralSourceValue() {
  return emptyToNull(val("editReferralSource"));
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

function installSwipeDeleteStyles() {
  if (document.getElementById("mm-swipe-delete-styles")) return;

  const style = document.createElement("style");
  style.id = "mm-swipe-delete-styles";
  style.textContent = `
    .swipe-row{
      position:relative;
      overflow:hidden;
      border-radius:0;
      margin-bottom:0;
      --deleteSwipeWidth:70px;
      --quickSwipeWidth:0px;
    }

    .swipe-action-panel{
      position:absolute;
      inset:0;
      display:flex;
      align-items:center;
      background:transparent;
      border-radius:0;
      pointer-events:none;
      z-index:0;
    }

    .swipe-actions-start{
      justify-content:flex-start;
      background:transparent;
    }

    .swipe-actions-end{
      justify-content:flex-end;
      background:transparent;
    }

    .swipe-row.revealing-right .swipe-actions-start,
    .swipe-row.swiped-right .swipe-actions-start{
      background:transparent;
      z-index:1;
    }

    .swipe-row.revealing-left .swipe-actions-end,
    .swipe-row.swiped-left .swipe-actions-end{
      background:transparent;
      z-index:1;
    }

    .swipe-row.swiped-right .swipe-actions-start,
    .swipe-row.swiped-left .swipe-actions-end{
      pointer-events:auto;
    }

    .swipe-quick-actions{
      display:flex;
      align-items:center;
      gap:9px;
      padding:0 10px;
      min-width:var(--quickSwipeWidth);
    }

    .swipe-circle-action{
      width:50px;
      height:50px;
      border:0;
      border-radius:999px;
      color:#fffaf3;
      font:inherit;
      padding:0;
      cursor:pointer;
      opacity:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 50px;
      box-shadow:
        0 8px 16px rgba(0,0,0,.24),
        inset 0 1px 0 rgba(255,255,255,.16);
      -webkit-tap-highlight-color:transparent;
    }

    .swipe-circle-text{
      background:linear-gradient(180deg, rgba(45,98,140,.98), rgba(23,63,96,.98));
    }

    .swipe-circle-email{
      background:linear-gradient(180deg, rgba(218,202,177,.28), rgba(218,202,177,.18));
      border:1px solid rgba(218,202,177,.26);
    }

    .swipe-circle-ship{
      background:linear-gradient(180deg, rgba(151,105,54,.98), rgba(110,77,40,.98));
    }

    .swipe-action-svg{
      width:23px;
      height:23px;
      display:block;
      stroke:currentColor;
      fill:none;
      stroke-width:1.9;
      stroke-linecap:round;
      stroke-linejoin:round;
    }

    .swipe-delete-btn{
      width:50px;
      height:50px;
      align-self:center;
      margin-right:10px;
      border:0;
      border-radius:999px;
      background:#921a24;
      color:#fffaf3;
      font:inherit;
      padding:0;
      cursor:pointer;
      opacity:0;
      transition:
        opacity 120ms ease,
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 50px;
      transform:scale(.94);
      box-shadow:
        0 8px 16px rgba(0,0,0,.24),
        inset 0 1px 0 rgba(255,255,255,.14);
      -webkit-tap-highlight-color:transparent;
    }

    .swipe-row.revealing-left .swipe-delete-btn,
    .swipe-row.swiped-left .swipe-delete-btn{
      opacity:1;
      transform:scale(1);
    }

    .swipe-row.swiped-left .swipe-delete-btn{
      background:#921a24;
    }

    .swipe-row .order-card{
      position:relative;
      z-index:2;
      margin-bottom:0;
      transition:transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
      will-change:transform;
      touch-action:pan-y;
      -webkit-touch-callout:none;
      -webkit-user-select:none;
      user-select:none;
    }

    .swipe-row.swiped-right .order-card{
      transform:translateX(var(--quickSwipeWidth));
    }

    .swipe-row.swiped-left .order-card{
      transform:translateX(calc(var(--deleteSwipeWidth) * -1));
    }

    .photo-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(96px,1fr));
      gap:10px;
    }

    .photo-thumb{
      display:block;
      border:1px solid rgba(9,47,77,.18);
      border-radius:12px;
      overflow:hidden;
      background:#fff;
    }

    .photo-thumb img{
      display:block;
      width:100%;
      aspect-ratio:1 / 1;
      object-fit:cover;
    }

    .photo-thumb-img{
      display:block;
      width:100%;
      aspect-ratio:1 / 1;
      object-fit:cover;
      cursor:pointer;
      border-radius:12px;
    }

    .photo-lightbox{
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.92);
      z-index:9999;
      justify-content:center;
      align-items:center;
    }

    .photo-lightbox.show{
      display:flex;
    }

    .photo-lightbox img{
      max-width:95vw;
      max-height:95vh;
      object-fit:contain;
    }

    .reorder-banner{
        margin:0;
        padding:12px 14px;
        background:#fff3cd;
        color:#5a4100;
        border-bottom:1px solid rgba(90,65,0,.25);
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
    }

    .reorder-banner-text{
       display:grid;
       gap:4px;
       line-height:1.3;
    }
 
    .reorder-banner-text span{
       font-size:.92rem;
    }

    .reorder-banner-actions{
       display:flex;
       gap:8px;
       align-items:center;
       flex:0 0 auto;
    }

    .reorder-banner-actions button{
       border:0;
       border-radius:10px;
       padding:8px 10px;
       background:#092f4d;
       color:#dacab1;
       font-weight:700;
    }

    #reorderDismissBtn{
       width:34px;
       height:34px;
       padding:0;
       font-size:22px;
       line-height:1;
    }

    @media (max-width:700px){
       .reorder-banner{
         padding:10px 14px;
         display:grid;
         gap:10px;
       }

       .reorder-banner-text{
          display:block;
          font-size:.92rem;
          line-height:1.35;
       }

       .reorder-banner-text strong{
         display:block;
         margin-bottom:4px;
       }

       .reorder-banner-text span{
         display:-webkit-box;
         -webkit-line-clamp:2;
         -webkit-box-orient:vertical;
         overflow:hidden;
         font-size:.86rem;
       }

       .reorder-banner-actions{
         display:flex;
         flex-direction:row;
         justify-content:space-between;
         gap:8px;
       }

       #reorderViewBtn{
         flex:1;
         padding:9px 10px;
         font-size:.9rem;
       }

       #reorderDismissBtn{
         width:42px;
         height:38px;
         font-size:22px;
       }
    }

 /* Inventory filter */
    .inventory-filter-bar{
      display:flex;
      gap:10px;
      padding:14px 16px;
      border-bottom:1px solid var(--line);
    }

    .inventory-filter-bar button{
      border:1px solid rgba(218,202,177,.28);
      border-radius:999px;
      padding:9px 14px;
      background:rgba(255,255,255,.08);
      color:var(--muted);
      font-weight:700;
    }

    .inventory-filter-bar button.active{
      background:#dacab1;
      color:#092f4d;
      border-color:#dacab1;
    }
  `;
  document.head.appendChild(style);
}

function suppressNextOrderCardClick(duration = 450) {
  suppressOrderCardClickUntil = Math.max(
    suppressOrderCardClickUntil,
    performance.now() + duration
  );
}

function suppressRowClick(row, duration = 450) {
  row._suppressClickUntil = Math.max(
    row._suppressClickUntil || 0,
    performance.now() + duration
  );
}

function shouldSuppressOrderCardClick(row) {
  const now = performance.now();
  return now < suppressOrderCardClickUntil || now < (row._suppressClickUntil || 0);
}

function enableOrderSwipeActions(row, order) {
  const card = row.querySelector(".order-card");
  if (!card) return;

  const ACTION_SIZE = 50;
  const ACTION_GAP = 9;
  const ACTION_PAD = 10;
  const DELETE_WIDTH = ACTION_SIZE + (ACTION_PAD * 2);
  const quickActions = row.querySelectorAll(".swipe-action-btn").length;
  const QUICK_WIDTH = quickActions
    ? (quickActions * ACTION_SIZE) + ((quickActions - 1) * ACTION_GAP) + (ACTION_PAD * 2)
    : 0;
  const HORIZONTAL_THRESHOLD = 12;
  const VERTICAL_THRESHOLD = 10;
  const DIRECTION_RATIO = 1.2;

  row.style.setProperty("--deleteSwipeWidth", `${DELETE_WIDTH}px`);
  row.style.setProperty("--quickSwipeWidth", `${QUICK_WIDTH}px`);

  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let tracking = false;
  let dragging = false;
  let lockedVertical = false;
  let currentOffset = 0;

  function setOffset(x, withTransition = false) {
    const min = -DELETE_WIDTH;
    const max = QUICK_WIDTH;
    let next = x;

    if (next > max) {
      next = max + (next - max) * 0.25;
    }

    if (next < min) {
      next = min + (next - min) * 0.25;
    }

    currentOffset = Math.max(min, Math.min(max, next));
    card.style.transition = withTransition
      ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    card.style.transform = `translateX(${currentOffset}px)`;
    row.classList.toggle("revealing-right", currentOffset > 8);
    row.classList.toggle("revealing-left", currentOffset < -8);
    row.classList.toggle("swiped-right", currentOffset >= QUICK_WIDTH - 2 && QUICK_WIDTH > 0);
    row.classList.toggle("swiped-left", currentOffset <= -DELETE_WIDTH + 2);
    row.classList.toggle("is-swiping", Math.abs(currentOffset) > 1);
  }

  function closeSwipe(withTransition = true) {
    setOffset(0, withTransition);
  }

  function openDelete(withTransition = true) {
    closeOtherSwipes(row);
    setOffset(-DELETE_WIDTH, withTransition);
  }

  function openQuickActions(withTransition = true) {
    if (!QUICK_WIDTH) {
      closeSwipe(withTransition);
      return;
    }

    closeOtherSwipes(row);
    setOffset(QUICK_WIDTH, withTransition);
  }

  card.addEventListener("touchstart", (e) => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (e.touches.length !== 1) return;
    if (e.target.closest(".swipe-action-btn") || e.target.closest(".swipe-delete-btn")) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startOffset = currentOffset;
    tracking = true;
    dragging = true;
    lockedVertical = false;
    row._swipeDirection = "";
    card.style.transition = "none";
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    if (!tracking || !dragging || !window.matchMedia("(pointer: coarse)").matches) return;

    if (e.touches.length !== 1) {
      tracking = false;
      dragging = false;
      lockedVertical = false;
      closeSwipe(true);
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!lockedVertical && !row._swipeDirection) {
      if (absY > VERTICAL_THRESHOLD && absY > absX * DIRECTION_RATIO) {
        lockedVertical = true;
        tracking = false;
        dragging = false;
        closeSwipe(true);
        return;
      }

      if (absX < HORIZONTAL_THRESHOLD || absX < absY * DIRECTION_RATIO) {
        return;
      }

      row._swipeDirection = "horizontal";
      closeOtherSwipes(row);
      cancelWorkflowPress();
    }

    if (row._swipeDirection === "horizontal") {
      e.preventDefault();
      cancelWorkflowPress();
      setOffset(startOffset + dx, false);
    }
  }, { passive: false });

  function finishSwipe() {
    if (!tracking && !dragging && !row._swipeDirection) {
      row._swipeDirection = "";
      return;
    }

    const movedHorizontally = row._swipeDirection === "horizontal";
    tracking = false;
    dragging = false;
    lockedVertical = false;
    row._swipeDirection = "";

    if (!movedHorizontally) return;

    if (currentOffset <= -DELETE_WIDTH / 2) {
      openDelete(true);
    } else if (currentOffset >= QUICK_WIDTH / 2 && QUICK_WIDTH > 0) {
      openQuickActions(true);
    } else {
      closeSwipe(true);
    }

    suppressRowClick(row, 550);
  }

  card.addEventListener("touchend", finishSwipe);
  card.addEventListener("touchcancel", finishSwipe);

  document.addEventListener("touchstart", (e) => {
    if (!row.contains(e.target)) {
      closeSwipe(true);
    }
  }, { passive: true });

  row._closeSwipe = closeSwipe;
  row._isSwipeOpen = () => Math.abs(currentOffset) > 1;
}

function closeOtherSwipes(activeRow) {
  document.querySelectorAll(".swipe-row").forEach(row => {
    if (row !== activeRow && typeof row._closeSwipe === "function") {
      row._closeSwipe(true);
    }
  });
}

function setActiveView(viewName) {
  if (!isAuthenticated()) {
    activeView = "current";
    showView(loginView);
    closeMenu();
    syncAuthUI();
    return;
  }

  activeView = viewName;
  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

  viewTitle.textContent = getViewTitle(viewName);

  if (viewName === "upload") {
    showView(uploadView);
    closeMenu();
    return;
  }

  if (viewName === "gloves-sale") {
     loadSaleGloves();
     showView(saleGlovesView);
     closeMenu();
     return;
  }

  if (viewName === "map") {
     showView(mapView);
     closeMenu();
     renderMapView();
     return;
  }

  if (viewName === "inventory") {
     searchInput.value = "";
     loadInventory().catch(err => {
       ordersList.innerHTML = `<div class="no-results">${escapeHtml(err.message || "Failed to load inventory.")}</div>`;
     });
   } else {
     applyFilters();
   }

   showView(dashboardView);
   closeMenu();
}

function sortOrders(list) {
  list.sort((a, b) => {
    const aNum = Number(String(a.orderNumber || "").replace(/[^\d]/g, "")) || 0;
    const bNum = Number(String(b.orderNumber || "").replace(/[^\d]/g, "")) || 0;

    if (activeView === "progress") {
      const aDate = Date.parse(String(a.dateReceived || "").trim());
      const bDate = Date.parse(String(b.dateReceived || "").trim());

      const aHasDate = !Number.isNaN(aDate);
      const bHasDate = !Number.isNaN(bDate);

      if (aHasDate && bHasDate) {
        if (aDate !== bDate) return aDate - bDate;
        return aNum - bNum;
      }

      if (aHasDate && !bHasDate) return -1;
      if (!aHasDate && bHasDate) return 1;

      return aNum - bNum;
    }

    return bNum - aNum;
  });

  return list;
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();

  let list;

  if (q) {
    // Search ALL orders when typing
    list = allOrders.filter(order => {
      return [
        order.orderNumber,
        order.customerName,
        order.emailAddress,
        order.phoneNumber,
        order.status
      ].some(v => String(v || "").toLowerCase().includes(q));
    });
  } else {
    // No search = normal filtered view
    list = getViewOrders();
  }

  sortOrders(list);
  renderOrders(list);
}

async function deleteOrder(orderNumber) {
  const data = await postJson({
    action: "deleteOrder",
    orderNumber
  }, true);

  allOrders = allOrders.filter(o => String(o.orderNumber) !== String(orderNumber));

  if (currentOrder && String(currentOrder.orderNumber) === String(orderNumber)) {
    currentOrder = null;
  }

  localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
  applyFilters();
  showView(dashboardView);

  return data;
}

async function confirmAndDeleteOrder(orderNumber) {
  const ok = confirm(`Delete order #${orderNumber}? This cannot be undone.`);
  if (!ok) return;

  try {
    await deleteOrder(orderNumber);
  } catch (err) {
    alert(err.message || "Delete failed.");
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
    const row = document.createElement("div");
    row.className = "swipe-row";

    const paidClass = normalizeText(order.paid) === "paid" ? "paid" : "unpaid";

    row.innerHTML = `
      <div class="swipe-action-panel swipe-rail-left swipe-actions-start">
        <div class="swipe-quick-actions">
          <button class="swipe-action-btn swipe-circle-action swipe-circle-text swipe-action-text" type="button" aria-label="Text customer">
            ${SWIPE_ICONS.text}
          </button>
          <button class="swipe-action-btn swipe-circle-action swipe-circle-email swipe-action-email" type="button" aria-label="Email customer">
            ${SWIPE_ICONS.email}
          </button>
          ${!looksLocalDropOff(order) ? `
            <button class="swipe-action-btn swipe-circle-action swipe-circle-ship swipe-action-ship" type="button" aria-label="Open Pirate Ship">
              ${SWIPE_ICONS.ship}
            </button>
          ` : ""}
        </div>
      </div>

      <div class="swipe-action-panel swipe-rail-right swipe-actions-end">
        <button class="swipe-delete-btn swipe-circle-action swipe-circle-delete" type="button" aria-label="Delete order">
          ${SWIPE_ICONS.delete}
        </button>
      </div>

      <div class="order-card clickable-card" tabindex="0">
        <div class="order-top">
          <div class="order-main">
            <div class="order-name">${escapeHtml(order.customerName || "")}</div>
          </div>
          <div class="order-status">${escapeHtml(order.status || "")}</div>
        </div>

        <div class="order-subrow">
          <div class="order-meta-left">
            <div class="order-number ${paidClass}">${escapeHtml(order.orderNumber || "")}</div>
            ${renderLaceChips(order)}
          </div>
          ${renderWorkflowProgress(order)}
        </div>
      </div>
    `;

    const card = row.querySelector(".order-card");

    card.addEventListener("selectstart", (e) => {
      e.preventDefault();
    });

    card.addEventListener("click", (e) => {
      if (shouldSuppressOrderCardClick(row)) {
        e.preventDefault();
        return;
      }

      if (typeof row._isSwipeOpen === "function" && row._isSwipeOpen()) {
        e.preventDefault();
        row._closeSwipe?.(true);
        suppressRowClick(row, 250);
        return;
      }

      openOrder(order.orderNumber);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOrder(order.orderNumber);
      }
    });

    card.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".swipe-action-btn") || e.target.closest(".swipe-delete-btn")) return;
      e.preventDefault();
      openWorkflowSheet(order, e);
    });

    card.addEventListener("touchstart", (e) => {
      if (e.target.closest(".swipe-action-btn") || e.target.closest(".swipe-delete-btn")) return;
      startWorkflowPress(e, order);
    }, { passive: true });

    card.addEventListener("touchmove", cancelWorkflowPress, { passive: true });
    card.addEventListener("touchend", cancelWorkflowPress);
    card.addEventListener("touchcancel", cancelWorkflowPress);

    row.querySelector(".swipe-action-email").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      suppressRowClick(row);
      row._closeSwipe?.(true);
      emailOrderCustomer(order);
    });

    row.querySelector(".swipe-action-text").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      suppressRowClick(row);
      row._closeSwipe?.(true);
      textOrderCustomer(order);
    });
    
    row.querySelector(".swipe-action-ship")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      suppressRowClick(row);
      row._closeSwipe?.(true);
      await copyPirateShipInfo(order);
    });

    row.querySelector(".swipe-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      suppressRowClick(row);
      await confirmAndDeleteOrder(order.orderNumber);
    });

    ordersList.appendChild(row);
    enableOrderSwipeActions(row, order);
  });
}

function renderOrderDetail(order) {
  currentOrder = order;
  if (detailTitle) {
  detailTitle.textContent = order.customerName || "Order Detail";
}
  clearSaveStatus();

  const isLocal = looksLocalDropOff(order);

  const primaryLaceColor = order.primaryLaceColor || order.lacePrimary || "";
  const secondaryLaceColor = order.secondaryLaceColor || order.laceAccent || "";
  const customColorRequest = order.customColorRequest || order.customLaceNotes || "";

  orderDetail.innerHTML = `
    <div class="detail-delete-row">
      <button id="detailDeleteBtn" class="detail-delete-btn" type="button">Delete Order</button>
    </div>

    <div class="detail-grid">
      ${renderSectionHeading("Order Summary")}

      ${renderFieldLike("Order #", order.orderNumber || "")}
      ${renderFieldLike("Customer", order.customerName || "")}
      ${renderPhoneInput("Phone", "editPhoneNumber", order.phoneNumber || "")}
      ${renderFieldLike("Email", order.emailAddress || "")}
      <div class="detail-block">
        <div class="label">Social Tag</div>
        <input id="editSocialTag" type="text" value="${escapeAttr(order.socialTag || "")}" />
      </div>
      ${renderReferralSourceEditor(order.referralSource || "")}

      ${renderSectionHeading("Order Status")}

      <div class="detail-block">
        <div class="label">Status</div>
        <select id="editStatus">
           <option value="Received">Received</option>
           <option value="Estimate Sent">Estimate Sent</option>
           <option value="Customer Approved">Customer Approved</option>
           <option value="Pending Response">Pending Response</option>
           <option value="In Transit to Me">In Transit to Me</option>
           <option value="In Progress">In Progress</option>
           <option value="Waiting on Lace/Parts">Waiting on Lace/Parts</option>
           <option value="Ready to Go">Ready to Go</option>
           <option value="On Hold">On Hold</option>
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

      <div id="editShippingCostWrap" class="detail-block ${isLocal ? "is-hidden" : ""}">
        <div class="label">Shipping Cost</div>
        <input id="editShippingCost" type="text" inputmode="decimal" placeholder="$0.00" />
      </div>
      
      <div id="editTotalDueWrap" class="detail-block ${isLocal ? "is-hidden" : ""}">
        <div class="label">Total Due</div>
        <div id="editTotalDue" class="field-like readonly">$0.00</div>
      </div>

      <div class="detail-block">
        <div class="label">Date Received</div>
        <input id="editDateReceived" type="date" />
      </div>

      <div class="detail-block">
        <div class="label">Estimated Completion</div>
        <input id="editEstimatedCompletion" type="date" />
      </div>

      <div class="detail-block">
        <div class="label">Date Completed</div>
        <input id="editDateCompleted" type="date" />
      </div>

      <div class="detail-block full">
        <div class="label">Internal Notes</div>
        <textarea id="editInternalNotes" rows="1"></textarea>
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

      <div id="editWebTypeWrap" class="detail-block">
        <div class="label">Web Type</div>
        <select id="editWebType">${webTypeOptions(order.webType)}</select>
      </div>

      <div class="detail-block">
        <div class="label">Drop-Off Method</div>
        <select id="editDropOffMethod">${dropOffMethodOptions(order.dropOffMethod)}</select>
      </div>

      ${renderServicesEditor(order.servicesRequested || "")}

      ${renderLaceInput("Primary Lace Color", "editPrimaryLaceColor", primaryLaceColor, "Choose")}

      <div class="detail-block">
        <div class="label">Primary Lace Used</div>
        <input id="editPrimaryLaceUsed" type="number" step="0.25" min="0" placeholder="0" />
      </div>
      
      ${renderLaceInput("Secondary / Accent Lace Color", "editSecondaryLaceColor", secondaryLaceColor, "Only if multi-colors wanted")}

      <div class="detail-block">
        <div class="label">Secondary Lace Used</div>
        <input id="editSecondaryLaceUsed" type="number" step="0.25" min="0" placeholder="0" />
      </div>

      <div class="detail-block full">
        <div class="label">Custom Color Request</div>
        <textarea id="editCustomColorRequest" rows="1" placeholder="Don’t see your color? Describe it here.">${escapeHtml(customColorRequest)}</textarea>
      </div>

      <div class="detail-block full">
        <div class="label">Customer Notes</div>
        <textarea id="editGloveNotes" rows="2"></textarea>
      </div>

      ${renderPhotoGallery(order)}

      <div id="editShippingSection" class="full ${isLocal ? "is-hidden" : ""}">
        ${renderSectionHeading("Shipping")}

        <div class="detail-grid">
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
            <select id="editState">${stateOptions(order.state)}</select>
          </div>

          <div class="detail-block">
            <div class="label">Zip Code</div>
            <input id="editZipCode" type="text" inputmode="numeric" />
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("editStatus").value = order.status || "Received";
  document.getElementById("editPaid").value = normalizeText(order.paid) === "paid" ? "Paid" : "Unpaid";
  document.getElementById("editPriceQuoted").value = formatMoneyForInput(order.priceQuoted);
  document.getElementById("editShippingCost").value = formatMoneyForInput(order.shippingCost);

  const totalDue =
     moneyNumber(order.priceQuoted) + moneyNumber(order.shippingCost);

  document.getElementById("editTotalDue").textContent =
     formatMoneyForInput(totalDue);
  document.getElementById("editDateReceived").value = formatDateForInput(order.dateReceived);
  document.getElementById("editEstimatedCompletion").value = formatDateForInput(order.estimatedCompletion);
  document.getElementById("editDateCompleted").value = formatDateForInput(order.dateCompleted);
  document.getElementById("editInternalNotes").value = order.internalNotes || "";

  document.getElementById("editBrandModel").value = order.brandModel || "";
  document.getElementById("editGloveType").value = order.gloveType || "";
  document.getElementById("editWebType").value = order.webType || "";
  document.getElementById("editDropOffMethod").value = order.dropOffMethod || "";
  document.getElementById("editGloveNotes").value = order.gloveNotes || order.customerNotes || "";

  document.getElementById("editPrimaryLaceColor").value = primaryLaceColor;
  document.getElementById("editSecondaryLaceColor").value = secondaryLaceColor;
  document.getElementById("editCustomColorRequest").value = customColorRequest;
  document.getElementById("editPrimaryLaceUsed").value = order.primaryLaceUsed ?? "";
  document.getElementById("editSecondaryLaceUsed").value = order.secondaryLaceUsed ?? "";

  const trackingEl = document.getElementById("editTrackingNumber");
  const carrierEl = document.getElementById("editCarrier");
  const allowShipEl = document.getElementById("editAllowShipWithoutPayment");
  const streetEl = document.getElementById("editStreetAddress");
  const cityEl = document.getElementById("editCity");
  const stateEl = document.getElementById("editState");
  const zipEl = document.getElementById("editZipCode");

  if (trackingEl) trackingEl.value = order.trackingNumber || order.tracking || "";
  if (carrierEl) carrierEl.value = order.carrier || "";
  if (allowShipEl) allowShipEl.value = order.allowShipWithoutPayment ? "true" : "false";
  if (streetEl) streetEl.value = order.streetAddress || order.address || "";
  if (cityEl) cityEl.value = order.city || "";
  if (stateEl && !stateEl.value) stateEl.value = order.state || "";
  if (zipEl) zipEl.value = order.zipCode || order.zip || "";

  document.getElementById("detailDeleteBtn")?.addEventListener("click", async () => {
    await confirmAndDeleteOrder(order.orderNumber);
  });
   
  const photos = Array.isArray(order.glovePhotos) ? order.glovePhotos : [];

const lightbox = document.getElementById("photoLightbox");
const lightboxImg = document.getElementById("lightboxImage");

if (photos.length && lightbox && lightboxImg) {
  let currentPhoto = 0;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartCount = 0;
  let touchMoved = false;
  let ignoreNextClick = false;

  function showPhoto(index) {
    currentPhoto = Math.max(0, Math.min(photos.length - 1, index));
    lightboxImg.src = photos[currentPhoto];
  }

  function closeLightbox() {
    lightbox.classList.remove("show");
    lightboxImg.src = "";
  }

  function nextPhoto() {
    if (currentPhoto < photos.length - 1) {
      showPhoto(currentPhoto + 1);
    }
  }

  function prevPhoto() {
    if (currentPhoto > 0) {
      showPhoto(currentPhoto - 1);
    }
  }

  document.querySelectorAll(".photo-thumb-img").forEach(img => {
    img.addEventListener("click", () => {
      showPhoto(Number(img.dataset.index));
      lightbox.classList.add("show");
    });
  });

  lightbox.addEventListener("touchstart", e => {
    touchStartCount = e.touches.length;
    touchMoved = false;

    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    if (e.touches.length > 1) {
      ignoreNextClick = true;
    }
  }, { passive: true });

  lightbox.addEventListener("touchmove", e => {
    touchMoved = true;

    if (e.touches.length > 1) {
      ignoreNextClick = true;
    }
  }, { passive: true });

  lightbox.addEventListener("touchend", e => {
    if (touchStartCount > 1) {
      ignoreNextClick = true;
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) return;

    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    // Swipes only. Pinch/zoom/tap release should do nothing here.
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      ignoreNextClick = true;

      if (diffX < 0) {
        nextPhoto();
      } else {
        prevPhoto();
      }
    }
  }, { passive: true });

  lightbox.addEventListener("click", e => {
    if (ignoreNextClick || touchMoved) {
      ignoreNextClick = false;
      touchMoved = false;
      return;
    }

    const rect = lightboxImg.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    const clickedImage =
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom;

    if (!clickedImage) {
      closeLightbox();
      return;
    }

    const imageMidpoint = rect.left + rect.width / 2;

    if (x < imageMidpoint) {
      prevPhoto();
    } else {
      nextPhoto();
    }
  });
}

  wireDetailForm();
}

function wireDetailForm() {
  const gloveTypeEl = document.getElementById("editGloveType");
  const webTypeWrap = document.getElementById("editWebTypeWrap");
  const webTypeEl = document.getElementById("editWebType");
  const dropOffEl = document.getElementById("editDropOffMethod");
  const shippingSection = document.getElementById("editShippingSection");
  const phoneEl = document.getElementById("editPhoneNumber");

  function toggleConditionalFields() {
    const isFielders = gloveTypeEl && gloveTypeEl.value === "Fielders Glove";
    if (webTypeWrap) {
      webTypeWrap.classList.toggle("is-hidden", !isFielders);
    }
    if (!isFielders && webTypeEl) {
      webTypeEl.value = "";
    }

    const isLocal = looksLocalDropOff({ dropOffMethod: dropOffEl?.value || "" });
    document
      .getElementById("editShippingCostWrap")
      ?.classList.toggle("is-hidden", isLocal);
    
    document
      .getElementById("editTotalDueWrap")
      ?.classList.toggle("is-hidden", isLocal);
    if (shippingSection) {
      shippingSection.classList.toggle("is-hidden", isLocal);
    }

    if (isLocal) {
      const ids = [
        "editAllowShipWithoutPayment",
        "editTrackingNumber",
        "editCarrier",
        "editStreetAddress",
        "editCity",
        "editState",
        "editZipCode"
      ];

      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (el.tagName === "SELECT") {
          el.value = id === "editAllowShipWithoutPayment" ? "false" : "";
        } else {
          el.value = "";
        }
      });
    }
  }

  if (gloveTypeEl) {
    gloveTypeEl.addEventListener("change", toggleConditionalFields);
  }

  if (dropOffEl) {
    dropOffEl.addEventListener("change", toggleConditionalFields);
  }

  if (phoneEl) {
    phoneEl.addEventListener("input", () => {
      phoneEl.value = formatPhoneForInput(phoneEl.value);
    });
  }

  toggleConditionalFields();
}

async function saveCurrentOrderFromForm() {
  if (!currentOrder) return;
  if (!saveStatusEl) return;

  saveStatusEl.textContent = "Saving...";

  const dropOffMethod = val("editDropOffMethod");
  const isLocal = looksLocalDropOff({ dropOffMethod });

  const gloveType = val("editGloveType");
  const webType = gloveType === "Fielders Glove" ? val("editWebType") : "";

  const streetAddress = isLocal ? "" : val("editStreetAddress");
  const city = isLocal ? "" : val("editCity");
  const state = isLocal ? "" : val("editState");
  const zipCode = isLocal ? "" : val("editZipCode");
  const trackingNumber = isLocal ? "" : val("editTrackingNumber");
  const carrier = isLocal ? "" : val("editCarrier");
  const allowShipWithoutPayment = isLocal ? false : (val("editAllowShipWithoutPayment") === "true");

  let dateCompleted = val("editDateCompleted");
  const newStatus = val("editStatus");

  if (newStatus === "Ready to Go" && !dateCompleted) {
    dateCompleted = todayForInput();
  }

  const parsedPrice = parseMoneyInput(val("editPriceQuoted"));
  const parsedShipping = parseMoneyInput(val("editShippingCost"));

  const updates = {
    status: newStatus,
    paid: val("editPaid"),
    phoneNumber: formatPhoneForInput(val("editPhoneNumber")),
    priceQuoted: parsedPrice === "" ? null : parsedPrice,
    shippingCost: parsedShipping === "" ? null : parsedShipping,
    dateReceived: emptyToNull(val("editDateReceived")),
    estimatedCompletion: emptyToNull(val("editEstimatedCompletion")),
    dateCompleted: emptyToNull(dateCompleted),
    internalNotes: emptyToNull(val("editInternalNotes")),
    brandModel: val("editBrandModel"),
    gloveType,
    webType,
    servicesRequested: getSelectedServices(),
    dropOffMethod,
    referralSource: getReferralSourceValue(),
    socialTag: emptyToNull(val("editSocialTag")),
    gloveNotes: val("editGloveNotes"),
    customerNotes: val("editGloveNotes"),
    primaryLaceColor: val("editPrimaryLaceColor"),
    lacePrimary: val("editPrimaryLaceColor"),
    secondaryLaceColor: val("editSecondaryLaceColor"),
    laceAccent: val("editSecondaryLaceColor"),
    customColorRequest: val("editCustomColorRequest"),
    customLaceNotes: val("editCustomColorRequest"),
    primaryLaceUsed: emptyToNull(val("editPrimaryLaceUsed")),
    secondaryLaceUsed: emptyToNull(val("editSecondaryLaceUsed"))
  };

  if (!isLocal) {
    updates.streetAddress = streetAddress || null;
    updates.city = city || null;
    updates.state = state || null;
    updates.zipCode = zipCode || null;
    updates.trackingNumber = trackingNumber || null;
    updates.carrier = carrier || null;
    updates.allowShipWithoutPayment = allowShipWithoutPayment;
  } else {
    updates.trackingNumber = null;
    updates.carrier = null;
    updates.allowShipWithoutPayment = false;
    updates.streetAddress = null;
    updates.city = null;
    updates.state = null;
    updates.zipCode = null;
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

  localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
  applyFilters();
  return updatedOrder;
}

const LACE_COLOR_MAP = {
  "black": "#111111",
  "gray": "#777777",
  "grey": "#777777",
  "tan – camel": "#c49a6c",
  "tan - camel": "#c49a6c",
  "camel": "#c49a6c",
  "tan – indian": "#b8793a",
  "tan - indian": "#b8793a",
  "indian tan": "#b8793a",
  "brown – chestnut": "#7a3f1d",
  "brown - chestnut": "#7a3f1d",
  "brown – chocolate": "#4a2616",
  "brown - chocolate": "#4a2616",
  "chocolate": "#4a2616",
  "blue – royal": "#1f4fbf",
  "blue - royal": "#1f4fbf",
  "royal blue": "#1f4fbf",
  "blue – navy": "#092f4d",
  "blue - navy": "#092f4d",
  "navy blue": "#092f4d",
  "blue – carolina": "#78aeda",
  "blue - carolina": "#78aeda",
  "carolina blue": "#78aeda",
  "red": "#b01f2e",
  "red - dark": "#6f111a",
  "dark red": "#6f111a",
  "orange": "#d46a1f",
  "pink": "#e889b9",
  "white": "#f4eee4",
  "yellow": "#d6b21f",
  "other (special order)": "linear"
};

function normalizeLaceName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getLaceColor(value) {
  const key = normalizeLaceName(value);
  return LACE_COLOR_MAP[key] || "#dacab1";
}

function renderLaceChips(order) {
  const primary = order.primaryLaceColor || order.lacePrimary || "";
  const secondary = order.secondaryLaceColor || order.laceAccent || "";
  const custom = order.customColorRequest || order.customLaceNotes || "";

  const chips = [];

  if (primary) {
    chips.push(`
      <span 
  class="lace-dot ${getLaceColor(primary) === "linear" ? "custom-dot" : ""}"
  style="${getLaceColor(primary) === "linear"
    ? ""
    : `background:${getLaceColor(primary)}`}"
>
  ${getLaceColor(primary) === "linear" ? "?" : ""}
</span>
    `);
  }

  if (secondary) {
    chips.push(`
      <span 
  class="lace-dot ${getLaceColor(secondary) === "linear" ? "custom-dot" : ""}"
  style="${getLaceColor(secondary) === "linear"
    ? ""
    : `background:${getLaceColor(secondary)}`}"
>
  ${getLaceColor(secondary) === "linear" ? "?" : ""}
</span>
    `);
  }

  if (custom) {
  const customColor = getCustomLaceColor(custom);

  chips.push(`
    <span
      class="lace-dot ${customColor ? "" : "custom-dot"}"
      style="${customColor ? `background:${escapeAttr(customColor)}` : ""}"
    >${customColor ? "" : "?"}</span>
  `);
}

  return chips.length
    ? `<div class="lace-dot-row">${chips.join("")}</div>`
    : "";
}

function getWorkflowStep(order) {
  const status = normalizeStatus(order.status);
  if (status === "received") return 1;
  if (status === "estimate sent" || status === "pending response" || status === "on hold") return 2;
  if (
    status === "customer approved" ||
    status === "in transit to me" ||
    status === "waiting on lace/parts" ||
    status === "in progress"
  ) return 3;
  if (status === "ready to go") return 4;
  if (status === "completed" || status === "picked up") return 5;
  return 1;
}

function getWorkflowLabel(order) {
  const step = getWorkflowStep(order);
  if (step === 1) return "Received";
  if (step === 2) return "Estimate";
  if (step === 3) return "Work";
  if (step === 4) return "Ready";
  return "Completed";
}

function renderWorkflowProgress(order) {
  const step = getWorkflowStep(order);
  const dots = [1, 2, 3, 4, 5]
    .map((value) => {
      const done = value <= step;
      const active = value === step;
      return `
        <span class="workflow-step${done ? " complete" : ""}${active ? " active" : ""}"></span>
        ${value < 5 ? `<span class="workflow-connector${value < step ? " complete" : ""}"></span>` : ""}`;
    })
    .join("");

  return `
    <div class="workflow-progress">
      <div class="workflow-meter">${dots}</div>
    </div>
  `;
}

function openWorkflowSheet(order, source, suppressOpeningTouch = false) {
  if (!workflowSheetEl) createWorkflowSheet();

  if (typeof source === "boolean") {
    suppressOpeningTouch = source;
    source = null;
  }

  workflowSheetEl.order = order;
  workflowSheetEl.anchor = getMenuAnchorPosition(source, source?.currentTarget);
  workflowSuppressOpeningTouch = suppressOpeningTouch;
  clearWorkflowOpeningTouchTimer();
  document.removeEventListener("touchend", consumeWorkflowOpeningTouchEnd, true);
  if (suppressOpeningTouch) {
    document.addEventListener("touchend", consumeWorkflowOpeningTouchEnd, {
      capture: true,
      once: true
    });
    workflowSuppressOpeningTouchTimer = setTimeout(() => {
      workflowSuppressOpeningTouch = false;
      workflowSuppressOpeningTouchTimer = null;
      document.removeEventListener("touchend", consumeWorkflowOpeningTouchEnd, true);
    }, 700);
  }
  const headerCustomer = workflowSheetEl.querySelector(".workflow-customer-name");
  const headerNumber = workflowSheetEl.querySelector(".workflow-order-number");
  const headerStatus = workflowSheetEl.querySelector(".workflow-current-status");
  const actions = workflowSheetEl.querySelector(".workflow-action-list");
  const form = workflowSheetEl.querySelector(".workflow-sheet-form");

  headerCustomer.textContent = order.customerName || "Unknown";
  headerNumber.textContent = `Order #${order.orderNumber || ""}`;
  headerStatus.textContent = order.status || "";
  actions.innerHTML = getWorkflowActions(order)
    .map(action => `
      <button class="workflow-action-btn" type="button" role="menuitem" aria-haspopup="true" data-action="${action.key}">
        <span>${escapeHtml(action.label)}</span>
        <span class="workflow-menu-chevron" aria-hidden="true">›</span>
      </button>
    `)
    .join("");

  form.innerHTML = "";
  workflowSheetEl.querySelector(".workflow-sheet-title").textContent = "Workflow actions";
  workflowSheetEl.classList.remove("workflow-action-selected");
  workflowSheetEl.classList.add("open");
  document.body.classList.add("workflow-open");
  document.addEventListener("keydown", handleWorkflowMenuKeydown);
  requestAnimationFrame(() => {
    positionWorkflowMenu(workflowSheetEl.querySelector(".workflow-sheet"), workflowSheetEl.anchor);
  });
}

function closeWorkflowSheet() {
  if (!workflowSheetEl) return;
  workflowSuppressOpeningTouch = false;
  clearWorkflowOpeningTouchTimer();
  document.removeEventListener("touchend", consumeWorkflowOpeningTouchEnd, true);
  document.removeEventListener("keydown", handleWorkflowMenuKeydown);
  workflowSheetEl.classList.remove("open");
  workflowSheetEl.classList.remove("workflow-action-selected");
  workflowSheetEl.querySelector(".workflow-action-list").innerHTML = "";
  workflowSheetEl.querySelector(".workflow-sheet-form").innerHTML = "";
  document.body.classList.remove("workflow-open");
}

function closeWorkflowMenu() {
  closeWorkflowSheet();
}

function createWorkflowSheet() {
  workflowSheetEl = document.createElement("div");
  workflowSheetEl.className = "workflow-sheet-root";
  workflowSheetEl.innerHTML = `
    <div class="workflow-backdrop"></div>
    <div class="workflow-sheet" role="menu" aria-label="Workflow actions">
      <div class="workflow-sheet-header">
        <div>
          <div class="workflow-customer-name"></div>
          <div class="workflow-order-number"></div>
          <div class="workflow-current-status"></div>
        </div>
        <button class="workflow-close-btn" type="button" aria-label="Close">✕</button>
      </div>
      <div class="workflow-section">
        <div class="workflow-sheet-title">Workflow actions</div>
        <div class="workflow-action-list"></div>
      </div>
      <div class="workflow-sheet-form"></div>
    </div>
  `;

  workflowSheetEl.querySelector(".workflow-backdrop").addEventListener("click", closeWorkflowSheet);
  workflowSheetEl.querySelector(".workflow-close-btn").addEventListener("click", closeWorkflowSheet);

  workflowSheetEl.addEventListener("click", (e) => {
    const actionBtn = e.target.closest(".workflow-action-btn");
    if (actionBtn) {
      openWorkflowActionForm(workflowSheetEl.order, actionBtn.dataset.action);
      return;
    }

    if (e.target.closest(".workflow-form-submit")) {
      e.preventDefault();
      submitWorkflowAction(workflowSheetEl.order, workflowSheetEl.actionKey);
      return;
    }

    if (e.target.closest(".workflow-form-cancel")) {
      e.preventDefault();
      closeWorkflowSheet();
      return;
    }
  });

  document.body.appendChild(workflowSheetEl);
}

function handleWorkflowMenuKeydown(e) {
  if (e.key !== "Escape") return;
  closeWorkflowMenu();
}

function getMenuAnchorPosition(event, element) {
  const source = event || window.event;

  if (Number.isFinite(source?.x) && Number.isFinite(source?.y)) {
    return { x: source.x, y: source.y };
  }

  const touch = source?.touches?.[0] || source?.changedTouches?.[0];
  if (touch) {
    return { x: touch.clientX, y: touch.clientY };
  }

  if (Number.isFinite(source?.clientX) && Number.isFinite(source?.clientY)) {
    return { x: source.clientX, y: source.clientY };
  }

  const rect = element?.getBoundingClientRect?.();
  if (rect) {
    return {
      x: rect.left + Math.min(rect.width / 2, 32),
      y: rect.top + Math.min(rect.height / 2, 32)
    };
  }

  return {
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2)
  };
}

function positionWorkflowMenu(menu, anchor) {
  if (!menu || !anchor) return;

  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.right = "auto";
  menu.style.bottom = "auto";

  const margin = 12;
  const rect = menu.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const preferTouchMenu = window.matchMedia("(pointer: coarse)").matches;
  const offsetY = preferTouchMenu ? 10 : 2;

  const left = Math.min(Math.max(margin, anchor.x), maxLeft);
  const top = Math.min(Math.max(margin, anchor.y + offsetY), maxTop);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function consumeWorkflowOpeningTouchEnd(e) {
  if (!workflowSuppressOpeningTouch) return;

  workflowSuppressOpeningTouch = false;
  clearWorkflowOpeningTouchTimer();

  if (workflowSheetEl?.contains(e.target)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

function clearWorkflowOpeningTouchTimer() {
  if (!workflowSuppressOpeningTouchTimer) return;
  clearTimeout(workflowSuppressOpeningTouchTimer);
  workflowSuppressOpeningTouchTimer = null;
}

function getWorkflowActions(order) {
  const status = normalizeStatus(order.status);
  const actions = [];

  const add = (key, label) => actions.push({ key, label });

  if (status === "received") {
    add("sendEstimate", "Send Estimate");
    add("onHold", "On Hold");
  } else if (status === "estimate sent") {
    add("customerApproved", "Customer Approved");
    add("pendingResponse", "Pending Response");
    add("onHold", "On Hold");
  } else if (status === "pending response") {
    add("customerApproved", "Customer Approved");
    add("onHold", "On Hold");
  } else if (status === "customer approved") {
    add("inTransitToMe", "In Transit to Me");
    add("waitingOnLaceParts", "Waiting on Lace/Parts");
    add("startWork", "Start Work");
    add("onHold", "On Hold");
  } else if (status === "in transit to me") {
    add("waitingOnLaceParts", "Waiting on Lace/Parts");
    add("startWork", "Start Work");
    add("onHold", "On Hold");
  } else if (status === "waiting on lace/parts") {
    add("startWork", "Start Work");
    add("onHold", "On Hold");
  } else if (status === "in progress") {
    add("readyToGo", "Ready to Go");
    add("onHold", "On Hold");
  } else if (status === "on hold") {
    add("sendEstimate", "Send Estimate");
    add("customerApproved", "Customer Approved");
    add("inTransitToMe", "In Transit to Me");
    add("waitingOnLaceParts", "Waiting on Lace/Parts");
    add("startWork", "Start Work");
  } else if (status === "ready to go") {
    add("completed", "Completed");
  }

  if (normalizeText(order.paid) !== "paid") {
    add("markPaid", "Mark as Paid");
  }
  return actions;
}

function openWorkflowActionForm(order, actionKey) {
  const form = workflowSheetEl.querySelector(".workflow-sheet-form");
  workflowSheetEl.actionKey = actionKey;
  workflowSheetEl.classList.add("workflow-action-selected");
  workflowSheetEl.querySelectorAll(".workflow-action-btn").forEach((button) => {
    const active = button.dataset.action === actionKey;
    button.hidden = !active;
    button.classList.toggle("active", active);
  });
  const isLocal = looksLocalDropOff(order);
  const existingNote = order.internalNotes || "";
  const priceQuoted = order.priceQuoted ?? "";
  const estimatedCompletion = order.estimatedCompletion || todayForInput();
  const dateCompleted = order.dateCompleted || todayForInput();
  const shippingCost = order.shippingCost ?? "";
  const primaryLaceUsed = order.primaryLaceUsed ?? "";
  const secondaryLaceUsed = order.secondaryLaceUsed ?? "";

  let inner = "";

  if (actionKey === "sendEstimate") {
    inner = `
      <div class="workflow-action-form">
        <label>Estimated amount</label>
        <input id="workflowPriceQuoted" type="text" inputmode="decimal" value="${escapeAttr(formatMoneyForInput(priceQuoted))}" />
      </div>
    `;
  } else if (actionKey === "customerApproved") {
    inner = `<div class="workflow-action-form"><p>Mark this order as Customer Approved?</p></div>`;
  } else if (actionKey === "pendingResponse") {
    inner = `<div class="workflow-action-form"><p>Place this order in Pending Response?</p></div>`;
  } else if (actionKey === "inTransitToMe") {
    inner = `<div class="workflow-action-form"><p>Mark this order as In Transit to Me?</p></div>`;
  } else if (actionKey === "waitingOnLaceParts") {
    inner = `
      <div class="workflow-action-form">
        <label>Internal note (optional)</label>
        <textarea id="workflowInternalNote" rows="3">${escapeHtml(existingNote)}</textarea>
      </div>
    `;
  } else if (actionKey === "startWork") {
    inner = `
      <div class="workflow-action-form">
        <label>Estimated completion</label>
        <input id="workflowEstimatedCompletion" type="date" value="${escapeAttr(estimatedCompletion)}" />
      </div>
    `;
  } else if (actionKey === "onHold") {
    inner = `
      <div class="workflow-action-form">
        <label>Internal note (optional)</label>
        <textarea id="workflowInternalNote" rows="3">${escapeHtml(existingNote)}</textarea>
      </div>
    `;
  } else if (actionKey === "readyToGo") {
    inner = `
      <div class="workflow-action-form">
        <label>Date completed</label>
        <input id="workflowDateCompleted" type="date" value="${escapeAttr(dateCompleted)}" />
        ${!isLocal ? `
          <label>Shipping cost</label>
          <input id="workflowShippingCost" type="text" inputmode="decimal" value="${escapeAttr(formatMoneyForInput(shippingCost))}" />
        ` : ""}
        <label>Primary lace used</label>
        <input id="workflowPrimaryLaceUsed" type="text" inputmode="decimal" value="${escapeAttr(primaryLaceUsed)}" />
        ${order.secondaryLaceColor || order.laceAccent ? `
          <label>Secondary lace used</label>
          <input id="workflowSecondaryLaceUsed" type="text" inputmode="decimal" value="${escapeAttr(secondaryLaceUsed)}" />
        ` : ""}
      </div>
    `;
  } else if (actionKey === "completed") {
    inner = `
      <div class="workflow-action-form">
        <label>Paid?</label>
        <select id="workflowPaid">
          <option value="Paid"${normalizeText(order.paid) === "paid" ? " selected" : ""}>Paid</option>
          <option value="Unpaid"${normalizeText(order.paid) !== "paid" ? " selected" : ""}>Unpaid</option>
        </select>
        ${!isLocal ? `
          <label>Carrier</label>
          <select id="workflowCarrier">
            <option value="">Select carrier</option>
            <option value="USPS"${order.carrier === "USPS" ? " selected" : ""}>USPS</option>
            <option value="UPS"${order.carrier === "UPS" ? " selected" : ""}>UPS</option>
            <option value="FedEx"${order.carrier === "FedEx" ? " selected" : ""}>FedEx</option>
          </select>
          <label>Tracking number</label>
          <input id="workflowTrackingNumber" type="text" value="${escapeAttr(order.trackingNumber || order.tracking || "")}" />
        ` : ""}
      </div>
    `;
  } else if (actionKey === "markPaid") {
    inner = `
      <div class="workflow-action-form">
        <p>${normalizeText(order.paid) === "paid" ? "This order is already marked paid." : "Mark this order as paid?"}</p>
      </div>
    `;
  }

  form.innerHTML = `
    <div class="workflow-form-content">
      ${inner}
      <div class="workflow-form-actions">
        <button class="secondary workflow-form-cancel" type="button">Cancel</button>
        <button class="primary workflow-form-submit" type="button">Save</button>
      </div>
    </div>
  `;
  requestAnimationFrame(() => {
    positionWorkflowMenu(workflowSheetEl.querySelector(".workflow-sheet"), workflowSheetEl.anchor);
  });
}

async function submitWorkflowAction(order, actionKey) {
  const updates = {};
  const isLocal = looksLocalDropOff(order);
  const note = document.getElementById("workflowInternalNote")?.value.trim();

  if (actionKey === "sendEstimate") {
    const value = document.getElementById("workflowPriceQuoted")?.value || "";
    const parsed = parseMoneyInput(value);
    updates.status = "Estimate Sent";
    updates.priceQuoted = parsed === "" ? null : parsed;
  } else if (actionKey === "customerApproved") {
    updates.status = "Customer Approved";
  } else if (actionKey === "pendingResponse") {
    updates.status = "Pending Response";
  } else if (actionKey === "inTransitToMe") {
    updates.status = "In Transit to Me";
  } else if (actionKey === "waitingOnLaceParts") {
    updates.status = "Waiting on Lace/Parts";
    if (note) updates.internalNotes = appendInternalNote(order.internalNotes, note);
  } else if (actionKey === "startWork") {
    updates.status = "In Progress";
    updates.estimatedCompletion = document.getElementById("workflowEstimatedCompletion")?.value || null;
  } else if (actionKey === "onHold") {
    updates.status = "On Hold";
    if (note) updates.internalNotes = appendInternalNote(order.internalNotes, note);
  } else if (actionKey === "readyToGo") {
    updates.status = "Ready to Go";
    updates.dateCompleted = document.getElementById("workflowDateCompleted")?.value || null;
    updates.shippingCost = !isLocal ? (parseMoneyInput(document.getElementById("workflowShippingCost")?.value || "") || null) : null;
    updates.primaryLaceUsed = document.getElementById("workflowPrimaryLaceUsed")?.value || null;
    if (order.secondaryLaceColor || order.laceAccent) {
      updates.secondaryLaceUsed = document.getElementById("workflowSecondaryLaceUsed")?.value || null;
    }
  } else if (actionKey === "completed") {
    updates.status = "Completed";
    updates.paid = document.getElementById("workflowPaid")?.value || "Unpaid";
    if (!isLocal) {
      updates.carrier = document.getElementById("workflowCarrier")?.value || null;
      updates.trackingNumber = document.getElementById("workflowTrackingNumber")?.value || null;
    }
  } else if (actionKey === "markPaid") {
    updates.paid = "Paid";
  }

  try {
    await saveOrderUpdate(order.orderNumber, updates, true);
    closeWorkflowSheet();
  } catch (err) {
    const form = workflowSheetEl.querySelector(".workflow-sheet-form");
    form.insertAdjacentHTML("afterbegin", `<div class="workflow-form-message">${escapeHtml(err.message || "Unable to save.")}</div>`);
  }
}

function appendInternalNote(existingNotes, newNote) {
  if (!newNote) return existingNotes || "";
  const timestamp = new Date().toLocaleString();
  const noteLine = `[${timestamp}] ${newNote}`;
  if (!existingNotes || !existingNotes.trim()) {
    return noteLine;
  }
  return `${existingNotes.trim()}\n\n${noteLine}`;
}

function startWorkflowPress(e, order) {
  cancelWorkflowPress();
  const anchor = getMenuAnchorPosition(e, e.currentTarget);
  workflowPressTimer = setTimeout(() => {
    clearTextSelection();
    suppressNextOrderCardClick(800);
    openWorkflowSheet(order, anchor, true);
  }, 500);
}

function cancelWorkflowPress() {
  if (workflowPressTimer) {
    clearTimeout(workflowPressTimer);
    workflowPressTimer = null;
  }
}

function clearTextSelection() {
  const selection = window.getSelection?.();
  if (selection && typeof selection.removeAllRanges === "function") {
    selection.removeAllRanges();
  }
}

async function renderMapView() {
  const token = ++mapRenderToken;

  if (!mapView || !orderMapEl) return;

  if (mapStatus) mapStatus.textContent = "Preparing map...";
  if (mapCount) mapCount.textContent = "Customer reach";
  renderUnmappedAddresses([]);

  if (!window.L) {
    if (mapStatus) mapStatus.textContent = "Map library failed to load.";
    return;
  }

  const orders = getMappableOrders();

  if (!orders.length) {
    initOrderMap();
    orderMapMarkers.clearLayers();
    if (mapStatus) mapStatus.textContent = "No shipped addresses found.";
    if (mapCount) mapCount.textContent = "0 addresses";
    return;
  }

  initOrderMap();

  const storedItems = orders
    .map(applyStoredMapLocation)
    .filter(item => item.mapLocation);
  const needsGeocode = orders.filter(item => !getStoredMapLocation(item));

  if (mapCount) mapCount.textContent = `${orders.length} address${orders.length === 1 ? "" : "es"}`;

  if (storedItems.length) {
    if (mapStatus) mapStatus.textContent = `Using ${storedItems.length} saved location${storedItems.length === 1 ? "" : "s"}.`;
    renderOrderMapMarkers(storedItems, token, {
      includeFailures: false,
      updateStatus: false,
      total: orders.length
    });
  } else {
    renderOrderMapMarkers([], token, {
      includeFailures: false,
      updateStatus: false,
      total: orders.length
    });
  }

  let geocodeResults = new Map();
  if (needsGeocode.length) {
    if (mapStatus) mapStatus.textContent = `Resolving ${needsGeocode.length} new/changed address${needsGeocode.length === 1 ? "" : "es"}...`;
    geocodeResults = await geocodeMissingMapAddresses(needsGeocode, token);
    if (token !== mapRenderToken) return;
  }

  const finalItems = getMappableOrders()
    .map(applyStoredMapLocation)
    .map(item => applyTransientMapGeocodeResult(item, geocodeResults))
    .map(applyLocalMapCacheFallback);
  const finalRender = renderOrderMapMarkers(finalItems, token, {
    total: finalItems.length
  });

  if (!needsGeocode.length && storedItems.length && finalRender && mapStatus) {
    mapStatus.textContent = `Using ${storedItems.length} saved location${storedItems.length === 1 ? "" : "s"}. ${getMapStatusText(finalRender.mapped, finalItems.length, finalRender.failures.length)}`;
  }
}

function initOrderMap() {
  if (!window.L || !orderMapEl) return;

  if (!orderMap) {
    orderMap = L.map(orderMapEl, {
      scrollWheelZoom: true
    }).setView([39.5, -98.35], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(orderMap);

    orderMapMarkers = L.layerGroup().addTo(orderMap);

    orderMapEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-map-order]");
      if (!btn) return;
      e.preventDefault();
      openOrder(btn.dataset.mapOrder);
    });
  }

  requestAnimationFrame(() => {
    orderMap.invalidateSize();
  });
}

function getMappableOrders() {
  return allOrders
    .map(order => ({
      order,
      key: String(order.orderNumber || "").trim(),
      streetAddress: String(order.streetAddress || order.address || "").trim(),
      address2: String(order.address2 || order.aptUnit || order.apartment || "").trim(),
      city: String(order.city || "").trim(),
      state: String(order.state || "").trim(),
      zipCode: String(order.zipCode || order.zip || "").trim(),
      address: buildFullAddress(order),
      addressCandidates: buildMapAddressCandidates(order),
      storedLat: order.mapLat,
      storedLng: order.mapLng,
      storedGeocodedAddress: order.mapGeocodedAddress,
      storedGeocodeStatus: order.mapGeocodeStatus,
      storedGeocodeError: order.mapGeocodeError,
      storedGeocodeSource: order.mapGeocodeSource,
      storedAddressHash: order.mapAddressHash,
      currentAddressHash: buildMapAddressHash(order)
    }))
    .filter(item => item.address);
}

function buildFullAddress(order) {
  const street = String(order.streetAddress || order.address || "").trim();
  const city = String(order.city || "").trim();
  const state = String(order.state || "").trim();
  const zip = String(order.zipCode || order.zip || "").trim();

  if (!street || !city || !state || !zip) return "";

  return `${street}, ${city}, ${state} ${zip}`;
}

function buildMapAddressHash(order) {
  return [
    order.streetAddress || order.address,
    order.city,
    order.state,
    order.zipCode || order.zip
  ]
    .map(normalizeMapAddressHashPart)
    .join("|");
}

function normalizeMapAddressHashPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildMapAddressCandidates(order) {
  const street = String(order.streetAddress || order.address || "").trim();
  const city = String(order.city || "").trim();
  const state = String(order.state || "").trim();
  const zip = String(order.zipCode || order.zip || "").trim();

  if (!street || !city || !state || !zip) return [];

  const cleanedStreet = cleanMapStreetAddress(street);
  const zip5 = zip.match(/\d{5}/)?.[0] || zip;
  const cityStateZip = `${city}, ${state} ${zip}`;
  const cityStateZip5 = `${city}, ${state} ${zip5}`;

  return uniqueAddresses([
    `${street}, ${city}, ${state} ${zip}`,
    `${cleanedStreet}, ${city}, ${state} ${zip}`,
    `${cleanedStreet}, ${city}, ${state} ${zip5}`,
    cityStateZip,
    cityStateZip5,
    zip5
  ]);
}

function cleanMapStreetAddress(street) {
  return String(street || "")
    .replace(/\b(?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|#)\s*[\w-]+.*$/i, "")
    .replace(/[.,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStoredMapLocation(item) {
  const lat = Number(item.storedLat);
  const lng = Number(item.storedLng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    item.storedAddressHash !== item.currentAddressHash
  ) {
    return null;
  }

  return {
    address: item.storedGeocodedAddress || item.address,
    coords: { lat, lng },
    source: item.storedGeocodeSource || "stored"
  };
}

function applyStoredMapLocation(item) {
  return {
    ...item,
    mapLocation: getStoredMapLocation(item),
    mapFailureReason:
      item.storedGeocodeStatus === "failed" && item.storedAddressHash === item.currentAddressHash
        ? item.storedGeocodeError
        : ""
  };
}

function applyLocalMapCacheFallback(item) {
  if (item.mapLocation) return item;

  for (const address of item.addressCandidates || [item.address]) {
    const coords = getCachedCoordinates(address);
    if (coords) {
      return {
        ...item,
        mapLocation: {
          address,
          coords,
          source: "local-cache"
        }
      };
    }
  }

  return item;
}

function applyTransientMapGeocodeResult(item, geocodeResults) {
  if (item.mapLocation || !geocodeResults?.size) return item;

  const result = geocodeResults.get(String(item.key));
  if (!result || result.ok || item.mapFailureReason) return item;

  return {
    ...item,
    mapFailureReason: formatMapGeocodeResultError(result)
  };
}

function formatMapGeocodeResultError(result) {
  if (!result) return "No coordinates found.";
  if (result.error) return String(result.error);
  if (result.details) {
    return typeof result.details === "string"
      ? result.details
      : JSON.stringify(result.details);
  }
  return "No coordinates found.";
}

async function geocodeMissingMapAddresses(items, token) {
  const input = items
    .filter(item => item.key && item.addressCandidates?.length)
    .map(item => ({
      orderNumber: item.key,
      addressHash: item.currentAddressHash,
      candidates: item.addressCandidates?.length ? item.addressCandidates : [item.address]
    }));

  if (!input.length) return new Map();

  try {
    const data = await postJson({
      action: "geocodeMissingOrderAddresses",
      items: input
    }, true);

    if (token !== mapRenderToken) return new Map();

    mergeMapGeocodeResults(data.results || {});
    return new Map(Object.entries(data.results || {}));
  } catch (err) {
    if (mapStatus && token === mapRenderToken) {
      mapStatus.textContent = `Server geocoding failed. ${err.message || "Using saved locations."}`;
    }
    return new Map();
  }
}

function mergeMapGeocodeResults(results) {
  let changed = false;

  Object.values(results || {}).forEach(result => {
    if (!result?.order?.orderNumber) return;

    const idx = allOrders.findIndex(order => String(order.orderNumber) === String(result.order.orderNumber));
    if (idx === -1) {
      allOrders.push(result.order);
    } else {
      allOrders[idx] = result.order;
    }

    if (currentOrder && String(currentOrder.orderNumber) === String(result.order.orderNumber)) {
      currentOrder = result.order;
    }

    if (result.ok && result.address && Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lng))) {
      setCachedCoordinates(result.address, {
        lat: Number(result.lat),
        lng: Number(result.lng)
      });
    }

    changed = true;
  });

  if (changed) {
    localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
  }
}

function uniqueAddresses(addresses) {
  const seen = new Set();
  const out = [];

  addresses.forEach(address => {
    const key = normalizeAddress(address);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });

  return out;
}

function normalizeAddress(address) {
  return String(address || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCachedCoordinates(address) {
  const key = normalizeAddress(address);
  if (!key) return null;

  try {
    const cache = JSON.parse(localStorage.getItem("mm_geocode_cache_v1") || "{}");
    const coords = cache[key];
    if (!coords) return null;

    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

function setCachedCoordinates(address, coords) {
  const key = normalizeAddress(address);
  if (!key) return;

  try {
    const cache = JSON.parse(localStorage.getItem("mm_geocode_cache_v1") || "{}");
    cache[key] = {
      lat: Number(coords.lat),
      lng: Number(coords.lng)
    };
    localStorage.setItem("mm_geocode_cache_v1", JSON.stringify(cache));
  } catch {
    // Local cache is helpful, but the map still works without it.
  }
}

function renderOrderMapMarkers(items, token, options = {}) {
  if (!orderMap || !orderMapMarkers || !window.L) return null;

  orderMapMarkers.clearLayers();

  let mapped = 0;
  const bounds = [];
  const failures = [];
  const total = Number.isFinite(options.total) ? options.total : items.length;
  const includeFailures = options.includeFailures !== false;
  const updateStatus = options.updateStatus !== false;

  for (const item of items) {
    if (token !== mapRenderToken) return null;

    if (item.mapLocation?.coords) {
      const { coords } = item.mapLocation;
      const marker = L.marker([coords.lat, coords.lng]);
      marker.bindPopup(renderMapPopup(item.order, item.mapLocation.address || item.address));
      marker.addTo(orderMapMarkers);

      bounds.push([coords.lat, coords.lng]);
      mapped += 1;
    } else if (includeFailures) {
      failures.push({
        order: item.order,
        address: item.address,
        reason: item.mapFailureReason || "No coordinates found."
      });
    }
  }

  if (token !== mapRenderToken) return null;

  if (bounds.length === 1) {
    orderMap.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    orderMap.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 10
    });
  }

  if (mapStatus && updateStatus) {
    mapStatus.textContent = getMapStatusText(mapped, total, failures.length);
  }
  if (mapCount) {
    mapCount.textContent = `${mapped} mapped`;
  }
  renderUnmappedAddresses(failures);
  return { mapped, failures };
}

function renderMapPopup(order, address) {
  return `
    <div class="map-popup">
      <div class="map-popup-name">${escapeHtml(order.customerName || "Customer")}</div>
      <div class="map-popup-meta">Order #${escapeHtml(order.orderNumber || "")}</div>
      <div class="map-popup-meta">${escapeHtml(order.status || "")}</div>
      <div class="map-popup-address">${escapeHtml(address)}</div>
      <button class="map-popup-btn" type="button" data-map-order="${escapeAttr(order.orderNumber || "")}">View Order</button>
    </div>
  `;
}

function getMapStatusText(mapped, total, unmapped) {
  const addressLabel = `address${total === 1 ? "" : "es"}`;
  const unmappedText = unmapped ? ` ${unmapped} unmapped.` : "";
  return `Mapped ${mapped} of ${total} ${addressLabel}.${unmappedText}`;
}

function renderUnmappedAddresses(failures) {
  if (!mapUnmappedList) return;

  if (!failures.length) {
    mapUnmappedList.hidden = true;
    mapUnmappedList.innerHTML = "";
    return;
  }

  mapUnmappedList.hidden = false;
  mapUnmappedList.innerHTML = `
    <div class="map-unmapped-title">Unmapped addresses (${failures.length})</div>
    ${failures.map(({ order, address, reason }) => `
      <div class="map-unmapped-item">
        <div class="map-unmapped-main">
          <strong>${escapeHtml(order.customerName || "Customer")}</strong>
          <span>Order #${escapeHtml(order.orderNumber || "")}</span>
          <span class="map-unmapped-address">${escapeHtml(address)}</span>
          <span class="map-unmapped-reason">${escapeHtml(reason)}</span>
        </div>
        <button class="map-unmapped-btn" type="button" data-map-order="${escapeAttr(order.orderNumber || "")}">View Order</button>
      </div>
    `).join("")}
  `;
}

function isValidCssColor(value) {
  const s = String(value || "").trim();
  if (!s) return false;

  const test = new Option().style;
  test.color = s;
  return test.color !== "";
}

function getCustomLaceColor(customValue) {
  const s = String(customValue || "").trim();
  return isValidCssColor(s) ? s : "";
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
    syncAuthUI();
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
  try {
     const inv = await postJson({ action: "listInventory" }, true);
     laceInventory = inv.inventory || [];
     renderReorderBanner(laceInventory);
   } catch {
     // Don't block orders if inventory check fails.
   }
}

async function loadSaleGloves() {
  saleGlovesList.innerHTML =
    `<div class="no-results">Loading gloves...</div>`;

  try {
    const data = await postJson({
      action: "listSaleGloves"
    }, true);

    const gloves = data.gloves || [];

    saleGlovesCount.textContent =
      `${gloves.length} glove${gloves.length === 1 ? "" : "s"}`;

    if (!gloves.length) {
      saleGlovesList.innerHTML =
        `<div class="no-results">No gloves listed.</div>`;
      return;
    }

    saleGlovesList.innerHTML = gloves.map(glove => `
      <div class="order-card sale-glove-card"
           data-id="${glove.id}">
        <div class="order-top">
          <div>
            <div class="order-name">${escapeHtml(glove.title || "")}</div>
            <div class="order-number">
              $${Number(glove.price || 0).toFixed(2)}
            </div>
          </div>

          <div class="order-status">
            ${escapeHtml(glove.status || "")}
          </div>
        </div>
      </div>
    `).join("");

    saleGlovesList
      .querySelectorAll(".sale-glove-card")
      .forEach(card => {

       card.addEventListener("click", async () => {

         const gloveId = card.dataset.id;

         try {

           const data = await postJson({
             action: "getSaleGlove",
             id: gloveId
           }, true);

           renderSaleGloveEditor(data.glove);

         } catch (err) {
           alert(err.message);
         }

       });

    });

  } catch (err) {
    saleGlovesList.innerHTML =
      `<div class="no-results">${escapeHtml(err.message)}</div>`;
  }
}

function renderSaleGloveEditor(glove) {
  const isNew = !glove;

  saleGlovesList.innerHTML = `
    <div class="upload-panel">
      <div class="upload-card">
        <h2>${isNew ? "Add Glove" : "Edit Glove"}</h2>
        <p class="muted">Create or update a glove listing.</p>

        <div class="detail-grid">
          <div class="detail-block full">
            <div class="label">Title</div>
            <input id="saleTitle" type="text" value="${escapeAttr(glove?.title || "")}">
          </div>

          <div class="detail-block">
            <div class="label">Slug</div>
            <input id="saleSlug" type="text" value="${escapeAttr(glove?.slug || "")}" placeholder="rawlings-pro200-4s">
          </div>

          <div class="detail-block">
            <div class="label">Price</div>
            <input id="salePrice" type="text" inputmode="decimal" value="${escapeAttr(formatMoneyForInput(glove?.price || ""))}" placeholder="$0.00">
          </div>

          <div class="detail-block full">
            <div class="label">Short Description</div>
            <textarea id="saleShortDescription" rows="2">${escapeHtml(glove?.shortDescription || "")}</textarea>
          </div>

          <div class="detail-block full">
            <div class="label">Full Description</div>
            <textarea id="saleDescription" rows="5">${escapeHtml(glove?.description || "")}</textarea>
          </div>

          <div class="detail-block">
            <div class="label">Brand</div>
            <input id="saleBrand" type="text" value="${escapeAttr(glove?.brand || "")}">
          </div>

          <div class="detail-block">
            <div class="label">Model</div>
            <input id="saleModel" type="text" value="${escapeAttr(glove?.model || "")}">
          </div>

          <div class="detail-block">
            <div class="label">Size</div>
            <input id="saleSize" type="text" value="${escapeAttr(glove?.gloveSize || "")}" placeholder='11.5"'>
          </div>

          <div class="detail-block">
            <div class="label">Position</div>
            <input id="salePosition" type="text" value="${escapeAttr(glove?.position || "")}" placeholder="Infield">
          </div>

          <div class="detail-block">
            <div class="label">Web</div>
            <input id="saleWeb" type="text" value="${escapeAttr(glove?.web || "")}" placeholder="I-Web">
          </div>

          <div class="detail-block">
            <div class="label">Throw Hand</div>
            <select id="saleThrowHand">
              <option value="">Select</option>
              <option value="Right Hand Throw" ${glove?.throwHand === "Right Hand Throw" ? "selected" : ""}>Right Hand Throw</option>
              <option value="Left Hand Throw" ${glove?.throwHand === "Left Hand Throw" ? "selected" : ""}>Left Hand Throw</option>
            </select>
          </div>

          <div class="detail-block">
            <div class="label">Condition</div>
            <input id="saleCondition" type="text" value="${escapeAttr(glove?.condition || "")}" placeholder="Used / Restored / Game-ready">
          </div>

          <div class="detail-block">
            <div class="label">Status</div>
            <select id="saleStatus">
              <option value="available" ${glove?.status === "available" ? "selected" : ""}>Available</option>
              <option value="sold" ${glove?.status === "sold" ? "selected" : ""}>Sold</option>
              <option value="hidden" ${glove?.status === "hidden" ? "selected" : ""}>Hidden</option>
            </select>
          </div>

          <div class="detail-block">
            <div class="label">Featured?</div>
            <select id="saleFeatured">
              <option value="false" ${!glove?.featured ? "selected" : ""}>No</option>
              <option value="true" ${glove?.featured ? "selected" : ""}>Yes</option>
            </select>
          </div>

          <div class="detail-block">
            <div class="label">Sort Order</div>
            <input id="saleSortOrder" type="number" value="${escapeAttr(glove?.sortOrder ?? 0)}">
          </div>

          <div class="detail-block full">
            <div class="label">Purchase URL</div>
            <input id="salePurchaseUrl" type="url" value="${escapeAttr(glove?.purchaseUrl || "")}">
          </div>
        </div>

        ${isNew ? "" : `
           <div class="detail-block full">
             <div class="detail-section-title full">Photos</div>

             <label class="upload-drop" for="saleGlovePhotoInput">
               <span class="upload-drop-title">Choose glove photos</span>
               <span class="upload-drop-note">Select photos, review them, then upload.</span>
             </label>

             <input id="saleGlovePhotoInput" type="file" accept="image/*" multiple>

             <div id="saleGlovePhotoPreview" class="upload-preview-grid"></div>

             <div class="upload-actions">
               <button id="saleGloveUploadBtn" class="secondary" type="button" disabled>
                 Upload
               </button>

               <button id="saleGloveClearBtn" class="secondary" type="button" disabled>
                 Clear
               </button>
             </div>

             <p id="saleGloveUploadStatus" class="upload-status">
               No photos selected.
             </p>
            <div id="saleGlovePhotosList"></div>
           </div>
        `}

        <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;">
           <button id="saveSaleGloveBtn" class="secondary" type="button">
             ${isNew ? "Create Glove" : "Save Changes"}
           </button>

           <button id="cancelSaleGloveBtn" class="secondary" type="button">Cancel</button>

           ${isNew ? "" : `
             <button id="deleteSaleGloveBtn" class="secondary" type="button">
               Delete
             </button>
           `}
         </div>

        <p id="saleGloveEditStatus" class="upload-status"></p>
      </div>
    </div>
  `;

  document.getElementById("cancelSaleGloveBtn")?.addEventListener("click", loadSaleGloves);

  document.getElementById("saveSaleGloveBtn")
     ?.addEventListener("click", async () => {

     const statusEl =
       document.getElementById("saleGloveEditStatus");

     try {
       statusEl.textContent = "Saving...";

       const result = await postJson({
         action: isNew ? "createSaleGlove" : "updateSaleGlove",
         id: glove?.id,

         slug: val("saleSlug"),
         title: val("saleTitle"),

         shortDescription:
           val("saleShortDescription"),

         description:
           val("saleDescription"),

         price: parseMoneyInput(
           val("salePrice")
         ),

         brand: val("saleBrand"),
         model: val("saleModel"),

         gloveSize: val("saleSize"),
         position: val("salePosition"),
         web: val("saleWeb"),

         throwHand: val("saleThrowHand"),

         condition: val("saleCondition"),
   
         status: val("saleStatus"),

         featured:
           val("saleFeatured") === "true",

         sortOrder:
           Number(val("saleSortOrder") || 0),

         purchaseUrl:
           val("salePurchaseUrl")

       }, true);

       statusEl.textContent = isNew
        ? "Glove created."
        : "Glove updated.";

       if (isNew && result.glove?.id) {
        renderSaleGloveEditor(result.glove);
        return;
       }

       await loadSaleGloves();

     } catch (err) {
       statusEl.textContent =
         err.message || "Save failed.";
     }
  });

  document.getElementById("deleteSaleGloveBtn")
  ?.addEventListener("click", async () => {
    if (isNew || !glove?.id) return;

    const ok = confirm(`Delete "${glove.title || "this glove"}"? This cannot be undone.`);
    if (!ok) return;

    const statusEl = document.getElementById("saleGloveEditStatus");

    try {
      statusEl.textContent = "Deleting...";

      await postJson({
        action: "deleteSaleGlove",
        id: glove.id
      }, true);

      await loadSaleGloves();

    } catch (err) {
      statusEl.textContent = err.message || "Delete failed.";
    }
  });

  if (!isNew && glove?.id) {
    initSaleGlovePhotoUploader(glove);
    loadSaleGlovePhotos(glove.id);
  }
}

function initSaleGlovePhotoUploader(glove) {
  const input = document.getElementById("saleGlovePhotoInput");
  const preview = document.getElementById("saleGlovePhotoPreview");
  const uploadBtn = document.getElementById("saleGloveUploadBtn");
  const clearBtn = document.getElementById("saleGloveClearBtn");
  const status = document.getElementById("saleGloveUploadStatus");

  if (!input || !preview || !uploadBtn || !clearBtn || !status) return;

  let stagedFiles = [];

  function clearSelection() {
    stagedFiles = [];
    input.value = "";
    preview.innerHTML = "";
    uploadBtn.disabled = true;
    clearBtn.disabled = true;
    status.textContent = "No photos selected.";
  }

  function renderPreview() {
    preview.innerHTML = "";

    if (!stagedFiles.length) {
      clearSelection();
      return;
    }

    preview.innerHTML = stagedFiles.map((file, index) => `
      <div class="upload-preview-item">
        <img src="${escapeAttr(URL.createObjectURL(file))}" alt="Selected photo ${index + 1}">
        <div class="upload-preview-name">${escapeHtml(file.name)}</div>
      </div>
    `).join("");

    uploadBtn.disabled = false;
    clearBtn.disabled = false;

    status.textContent =
      `${stagedFiles.length} photo${stagedFiles.length === 1 ? "" : "s"} selected. Review, then click Upload.`;
  }

  input.addEventListener("change", () => {
    stagedFiles = Array.from(input.files || []).filter(file => {
      const type = file.type || "image/jpeg";
      return type.startsWith("image/");
    });

    renderPreview();
  });

  clearBtn.addEventListener("click", clearSelection);

  uploadBtn.addEventListener("click", async () => {
    if (!stagedFiles.length) {
      status.textContent = "Choose photos before uploading.";
      return;
    }

    uploadBtn.disabled = true;
    clearBtn.disabled = true;

    let uploaded = 0;
    const failed = [];

    status.textContent =
      `Uploading ${stagedFiles.length} photo${stagedFiles.length === 1 ? "" : "s"}...`;

    for (const file of stagedFiles) {
      try {
        const contentType = file.type || "image/jpeg";
        const dataUrl = await fileToDataUrl(file);

        await postJson({
          action: "uploadSaleGlovePhoto",
          gloveId: glove.id,
          filename: file.name,
          contentType,
          dataUrl
        }, true);

        uploaded++;

        status.textContent =
          `Uploaded ${uploaded} of ${stagedFiles.length} photo${stagedFiles.length === 1 ? "" : "s"}...`;
      } catch (err) {
        failed.push(`${file.name}: ${err.message || "Upload failed"}`);
      }
    }

    if (failed.length) {
      status.textContent = `Uploaded ${uploaded}. Failed: ${failed.join(" | ")}`;
      uploadBtn.disabled = false;
      clearBtn.disabled = false;
      return;
    }

    clearSelection();
    await loadSaleGlovePhotos(glove.id);
    status.textContent =
      `Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"}.`;
  });
}

async function loadSaleGlovePhotos(gloveId) {
  const wrap = document.getElementById("saleGlovePhotosList");
  if (!wrap) return;

  try {
    const data = await postJson({
      action: "listSaleGlovePhotos",
      gloveId
    }, true);

    const photos = data.photos || [];

    if (!photos.length) {
      wrap.innerHTML = `
        <p class="muted">
          No uploaded photos yet.
        </p>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="upload-preview-grid">
        ${photos.map(photo => `
          <div class="upload-preview-item sale-photo-item">
            <img
              src="${escapeAttr(photo.url)}"
              alt=""
              loading="lazy"
            >

            <div class="upload-preview-name sale-photo-badges">
              ${photo.is_primary ? "★Primary★" : ""}
              ${photo.is_hover ? "↔Hover↔" : ""}
            </div>

            <div class="sale-photo-actions">
              <select
                class="sale-photo-action-select"
                data-glove-id="${escapeAttr(gloveId)}"
                data-photo-id="${escapeAttr(photo.id)}"
              >
                <option value="">...</option>
                <option value="primary" ${photo.is_primary ? "disabled" : ""}>
                  ${photo.is_primary ? "Already Primary" : "A"}
                </option>
                <option value="hover" ${photo.is_hover ? "disabled" : ""}>
                  ${photo.is_hover ? "Already Hover" : "B"}
                </option>
                <option value="delete">🗑</option>
              </select>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    wrap.querySelectorAll(".sale-photo-action-select").forEach(select => {
      select.addEventListener("change", async () => {
        const actionValue = select.value;
        if (!actionValue) return;

        const gloveIdFromSelect = select.dataset.gloveId;
        const photoId = select.dataset.photoId;

        if (actionValue === "delete") {
          const ok = confirm("Delete this photo from the listing?");
          if (!ok) {
            select.value = "";
            return;
          }
        }

        try {
          select.disabled = true;

          const action =
            actionValue === "primary"
              ? "setSalePhotoPrimary"
              : actionValue === "hover"
                ? "setSalePhotoHover"
                : "deleteSaleGlovePhoto";

          await postJson({
            action,
            gloveId: gloveIdFromSelect,
            photoId
          }, true);

          await loadSaleGlovePhotos(gloveId);

        } catch (err) {
          alert(err.message || "Photo action failed.");
          select.disabled = false;
          select.value = "";
        }
      });
    });

  } catch (err) {
    wrap.innerHTML = `
      <p class="muted">
        Failed to load photos.
      </p>
    `;
  }
}

async function loadInventory() {
  const data = await postJson({ action: "listInventory" }, true);
  laceInventory = data.inventory || [];
  renderInventory(laceInventory);
  renderReorderBanner(laceInventory);
}

function renderInventory(rows) {
  const filteredRows = window.inventoryNeedsOrderOnly
    ? rows.filter(item => Number(item.quantity_on_hand || 0) <= Number(item.reorder_at || 0))
    : rows;

  orderCount.textContent = `${filteredRows.length} color${filteredRows.length === 1 ? "" : "s"}`;
  ordersList.innerHTML = "";

  const filterBar = document.createElement("div");
  filterBar.className = "inventory-filter-bar";
  filterBar.innerHTML = `
    <button
      id="inventoryAllBtn"
      type="button"
      class="${window.inventoryNeedsOrderOnly ? "" : "active"}"
    >
      All
    </button>

    <button
      id="inventoryNeedsOrderBtn"
      type="button"
      class="${window.inventoryNeedsOrderOnly ? "active" : ""}"
    >
      Needs Order
    </button>
  `;

  ordersList.appendChild(filterBar);

  document.getElementById("inventoryAllBtn")?.addEventListener("click", () => {
    window.inventoryNeedsOrderOnly = false;
    renderInventory(laceInventory);
  });

  document.getElementById("inventoryNeedsOrderBtn")?.addEventListener("click", () => {
    window.inventoryNeedsOrderOnly = true;
    renderInventory(laceInventory);
  });

  if (!filteredRows.length) {
    ordersList.insertAdjacentHTML("beforeend", `<div class="no-results">No matching lace inventory.</div>`);
    return;
  }

  filteredRows.forEach(item => {
    const qty = Number(item.quantity_on_hand || 0);
    const reorderAt = Number(item.reorder_at || 0);
    const out = qty === 0;
    const low = qty > 0 && qty <= reorderAt;

    const statusText = out ? "OUT" : low ? "LOW" : "OK";
    const statusColor = out || low ? "var(--red)" : "var(--green)";

    const row = document.createElement("div");
    row.className = "order-card";

    row.innerHTML = `
      <div class="order-top">
        <div class="order-main">
          <div class="order-name">${escapeHtml(item.color || "")}</div>
          <div class="muted">${qty} piece${qty === 1 ? "" : "s"} on hand</div>
        </div>
        <div class="order-status" style="color:${statusColor};">
          ${statusText}
        </div>
      </div>

      <div class="muted" style="margin-top:8px;">
        Reorder at: ${reorderAt}
      </div>
    `;

    ordersList.appendChild(row);
  });
}

function getLowInventoryItems(rows) {
  return rows.filter(item =>
    Number(item.quantity_on_hand || 0) <= Number(item.reorder_at || 0)
  );
}

function renderReorderBanner(rows) {
  const existing = document.getElementById("reorderBanner");
  if (existing) existing.remove();

  if (reorderBannerDismissed) return;

  const lowItems = getLowInventoryItems(rows);
  if (!lowItems.length) return;

  const lowText = lowItems.map(item => {
    const color = String(item.color || "").trim();
    const qty = Number(item.quantity_on_hand ?? 0);
    return `${color} (${qty} left)`;
  }).join(", ");

  const banner = document.createElement("div");
  banner.id = "reorderBanner";
  banner.className = "reorder-banner";

  banner.innerHTML = `
    <div class="reorder-banner-text">
      <strong>⚠ Reorder Lace Needed</strong>
      <span>${escapeHtml(lowText)}</span>
    </div>

    <div class="reorder-banner-actions">
      <button id="reorderViewBtn" type="button">View Inventory</button>
      <button id="reorderDismissBtn" type="button" aria-label="Dismiss reorder alert">×</button>
    </div>
  `;

  const dashboardTopbar = dashboardView.querySelector(".topbar");
  if (dashboardTopbar) {
    dashboardTopbar.insertAdjacentElement("afterend", banner);
  }

  document.getElementById("reorderDismissBtn")?.addEventListener("click", () => {
    reorderBannerDismissed = true;
    banner.remove();
  });

  document.getElementById("reorderViewBtn")?.addEventListener("click", () => {
    setActiveView("inventory");
  });
}

function initUploadView() {
  const input = document.getElementById("galleryUploadInput");
  const status = document.getElementById("galleryUploadStatus");
  const sectionSelect = document.getElementById("gallerySectionSelect");
  const preview = document.getElementById("galleryUploadPreview");
  const uploadBtn = document.getElementById("galleryUploadBtn");
  const clearBtn = document.getElementById("galleryClearBtn");

  if (!input || !status || !preview || !uploadBtn || !clearBtn) return;

  let stagedFiles = [];

  function clearSelection() {
    stagedFiles = [];
    input.value = "";
    preview.innerHTML = "";
    uploadBtn.disabled = true;
    clearBtn.disabled = true;
    status.textContent = "No photos selected.";
  }

  function renderPreview() {
    preview.innerHTML = "";

    if (!stagedFiles.length) {
      clearSelection();
      return;
    }

    preview.innerHTML = stagedFiles.map((file, index) => `
      <div class="upload-preview-item">
        <img src="${escapeAttr(URL.createObjectURL(file))}" alt="Selected photo ${index + 1}">
        <div class="upload-preview-name">${escapeHtml(file.name)}</div>
      </div>
    `).join("");

    uploadBtn.disabled = false;
    clearBtn.disabled = false;
    status.textContent = `${stagedFiles.length} photo${stagedFiles.length === 1 ? "" : "s"} selected. Review, then click Upload.`;
  }

  input.addEventListener("change", () => {
    stagedFiles = Array.from(input.files || []).filter(file => {
      const type = file.type || "image/jpeg";
      return type.startsWith("image/");
    });

    renderPreview();
  });

  clearBtn.addEventListener("click", clearSelection);

  uploadBtn.addEventListener("click", async () => {
    const files = stagedFiles;
    const section = sectionSelect?.value || "fielding-gloves";

    if (!files.length) {
      status.textContent = "Choose photos before uploading.";
      return;
    }

    uploadBtn.disabled = true;
    clearBtn.disabled = true;
    status.textContent = `Uploading ${files.length} photo${files.length === 1 ? "" : "s"}...`;

    let uploaded = 0;
    const failed = [];

    for (const file of files) {
      try {
        const type = file.type || "image/jpeg";

        if (!type.startsWith("image/")) {
          throw new Error("Not an image file.");
        }

        const dataUrl = await fileToDataUrl(file);

        await postJson({
          action: "uploadGalleryPhoto",
          section,
          filename: file.name,
          contentType: type,
          dataUrl
        }, true);

        uploaded++;
        status.textContent = `Uploaded ${uploaded} of ${files.length} photo${files.length === 1 ? "" : "s"} to ${section}...`;
      } catch (err) {
        failed.push(`${file.name}: ${err.message || "Upload failed"}`);
      }
    }

    if (failed.length) {
      status.textContent = `Uploaded ${uploaded}. Failed: ${failed.join(" | ")}`;
      uploadBtn.disabled = false;
      clearBtn.disabled = false;
      return;
    }

    clearSelection();
    status.textContent = `Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"} to the website gallery.`;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));

    reader.readAsDataURL(file);
  });
}

function openOrder(orderNumber) {
  listScrollY = window.scrollY || document.documentElement.scrollTop || 0;
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
  closeMenu();
  syncAuthUI();
  showView(loginView);
});

searchInput.addEventListener("input", applyFilters);

backBtn.addEventListener("click", () => {
  clearSaveStatus();
  showView(dashboardView);

  requestAnimationFrame(() => {
    window.scrollTo(0, listScrollY);
  });
});

saleGlovesMenuBtn?.addEventListener("click", openMenu);

saleGlovesRefreshBtn?.addEventListener("click", loadSaleGloves);

saleGlovesLogoutBtn?.addEventListener("click", () => {
  clearToken();
  location.reload();
});

addSaleGloveBtn?.addEventListener("click", () => {
  renderSaleGloveEditor(null);
});

mapMenuBtn?.addEventListener("click", openMenu);

mapRefreshBtn?.addEventListener("click", async () => {
  if (mapStatus) mapStatus.textContent = "Refreshing orders...";
  await loadOrders();
  renderMapView();
});

mapUnmappedList?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-map-order]");
  if (!btn) return;
  openOrder(btn.dataset.mapOrder);
});

mapLogoutBtn?.addEventListener("click", () => {
  clearToken();
  currentOrder = null;
  closeMenu();
  syncAuthUI();
  showView(loginView);
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

document.querySelector(".side-nav")?.addEventListener("click", (e) => {
  const treeBtn = e.target.closest("[data-tree-toggle]");

  if (treeBtn) {
    const key = treeBtn.dataset.treeToggle;
    const group = document.querySelector(`[data-tree="${key}"]`);
    if (!group) return;

    const collapsed = group.classList.toggle("is-collapsed");
    treeBtn.classList.toggle("is-collapsed", collapsed);
    treeBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    return;
  }

  const navBtn = e.target.closest(".nav-link[data-view]");

  if (navBtn) {
    setActiveView(navBtn.dataset.view);
  }
});

document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  try {
    localStorage.removeItem("mm_orders_cache");
    await loadOrders();
    applyFilters();
  } catch (err) {
    alert("Refresh failed: " + err.message);
  }
});

document.getElementById("uploadMenuBtn")?.addEventListener("click", openMenu);

document.getElementById("uploadLogoutBtn")?.addEventListener("click", () => {
  clearToken();
  currentOrder = null;
  clearSaveStatus();
  closeMenu();
  syncAuthUI();
  showView(loginView);
});

document.getElementById("uploadRefreshBtn")?.addEventListener("click", () => {
  const input = document.getElementById("galleryUploadInput");
  const status = document.getElementById("galleryUploadStatus");
  const preview = document.getElementById("galleryUploadPreview");
  const uploadBtn = document.getElementById("galleryUploadBtn");
  const clearBtn = document.getElementById("galleryClearBtn");

  if (input) input.value = "";
  if (preview) preview.innerHTML = "";
  if (uploadBtn) uploadBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  if (status) status.textContent = "No photos selected.";
});

/* =========================
   INIT
========================= */
(async function init() {
  installSwipeDeleteStyles();
  initUploadView();
  syncAuthUI();

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
    closeMenu();
    syncAuthUI();
    showView(loginView);
  }
})();
