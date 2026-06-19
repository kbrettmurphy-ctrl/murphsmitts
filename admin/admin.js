const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");
const uploadView = document.getElementById("uploadView");
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

let laceInventory = [];
let reorderBannerDismissed = false;
let allOrders = [];
let activeView = "current";
let currentOrder = null;
let loginInProgress = false;
let listScrollY = 0;

window.inventoryNeedsOrderOnly = false;

/* =========================
   VIEW / MENU
========================= */
function showView(view) {
  [loginView, dashboardView, detailView, uploadView, saleGlovesView]
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
    }

    .swipe-delete-bg{
      position:absolute;
      inset:0;
      display:flex;
      justify-content:flex-end;
      align-items:stretch;
      background:#921a24;
      border-radius:0;
    }

    .swipe-delete-btn{
      min-width:94px;
      border:0;
      background:#921a24;
      color:#fff;
      font:inherit;
      font-weight:700;
      padding:0 18px;
      cursor:pointer;
    }

    .swipe-row .order-card{
      position:relative;
      z-index:1;
      margin-bottom:0;
      transition:transform .18s ease;
      will-change:transform;
      touch-action:pan-y;
    }

    .swipe-row.swiped .order-card{
      transform:translateX(-94px);
    }

    .action-delete svg{
      stroke:#921a24;
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

function enableSwipeDelete(row) {
  const card = row.querySelector(".order-card");
  if (!card) return;

  const MAX_SWIPE = 94;
  let startX = 0;
  let currentX = 0;
  let startOffset = 0;
  let dragging = false;
  let currentOffset = 0;

  function setOffset(x, withTransition = false) {
    currentOffset = Math.max(-MAX_SWIPE, Math.min(0, x));
    card.style.transition = withTransition ? "transform .18s ease" : "none";
    card.style.transform = `translateX(${currentOffset}px)`;
    row.classList.toggle("swiped", currentOffset <= -MAX_SWIPE + 2);
  }

  function closeSwipe(withTransition = true) {
    setOffset(0, withTransition);
  }

  function openSwipe(withTransition = true) {
    closeOtherSwipes(row);
    setOffset(-MAX_SWIPE, withTransition);
  }

  card.addEventListener("touchstart", (e) => {
    if (window.innerWidth > 900) return;

    startX = e.touches[0].clientX;
    currentX = startX;
    startOffset = currentOffset;
    dragging = true;
    closeOtherSwipes(row);
    card.style.transition = "none";
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    if (!dragging || window.innerWidth > 900) return;

    currentX = e.touches[0].clientX;
    const dx = currentX - startX;

    let next = startOffset + dx;

    if (next > 0) {
      next = next * 0.35;
    }

    if (next < -MAX_SWIPE) {
      next = -MAX_SWIPE + (next + MAX_SWIPE) * 0.35;
    }

    setOffset(next, false);
  }, { passive: true });

  card.addEventListener("touchend", () => {
    if (!dragging || window.innerWidth > 900) return;
    dragging = false;

    if (currentOffset <= -MAX_SWIPE / 2) {
      openSwipe(true);
    } else {
      closeSwipe(true);
    }
  });

  card.addEventListener("touchcancel", () => {
    if (!dragging || window.innerWidth > 900) return;
    dragging = false;

    if (currentOffset <= -MAX_SWIPE / 2) {
      openSwipe(true);
    } else {
      closeSwipe(true);
    }
  });

  document.addEventListener("touchstart", (e) => {
    if (!row.contains(e.target)) {
      closeSwipe(true);
    }
  }, { passive: true });

  row._closeSwipe = closeSwipe;
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
      <div class="swipe-delete-bg">
        <button class="swipe-delete-btn" type="button">Delete</button>
      </div>

      <div class="order-card clickable-card" tabindex="0">
        <div class="order-top">
          <div class="order-main">
            <div class="order-name">${escapeHtml(order.customerName || "")}</div>
            <div class="order-number ${paidClass}">${escapeHtml(order.orderNumber || "")}</div>
          </div>
          <div class="order-status">${escapeHtml(order.status || "")}</div>
        </div>

        <div class="action-row">
          ${renderLaceChips(order)}
          <button class="action-btn action-email" type="button" aria-label="Email">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/></svg>
          </button>
          <button class="action-btn action-phone" type="button" aria-label="Call">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.15a2 2 0 0 1 2.11-.45c.83.3 1.71.51 2.61.63A2 2 0 0 1 22 16.92z"/></svg>
          </button>
          <button class="action-btn action-text" type="button" aria-label="Text">
            <svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
          </button>
          <button class="action-btn action-delete" type="button" aria-label="Delete">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </div>
    `;

    const card = row.querySelector(".order-card");

    card.addEventListener("click", () => openOrder(order.orderNumber));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOrder(order.orderNumber);
      }
    });

    row.querySelector(".action-email").addEventListener("click", (e) => {
      e.stopPropagation();
      const email = String(order.emailAddress || "").trim();
      if (email) window.location.href = `mailto:${email}`;
    });

    row.querySelector(".action-phone").addEventListener("click", (e) => {
      e.stopPropagation();
      const phone = String(order.phoneNumber || "").trim();
      if (phone) window.location.href = `tel:${phone}`;
    });

    row.querySelector(".action-text").addEventListener("click", (e) => {
      e.stopPropagation();
      const phone = String(order.phoneNumber || "").replace(/[^\d+]/g, "").trim();
      if (phone) window.location.href = `sms:${phone}`;
    });

    row.querySelector(".action-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      await confirmAndDeleteOrder(order.orderNumber);
    });

    row.querySelector(".swipe-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      await confirmAndDeleteOrder(order.orderNumber);
    });

    ordersList.appendChild(row);
    enableSwipeDelete(row);
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
      ${renderLaceInput("Secondary / Accent Lace Color", "editSecondaryLaceColor", secondaryLaceColor, "Only if multi-colors wanted")}

      <div class="detail-block full">
        <div class="label">Custom Color Request</div>
        <textarea id="editCustomColorRequest" rows="1" placeholder="Don’t see your color? Describe it here.">${escapeHtml(customColorRequest)}</textarea>
      </div>

      <div class="detail-block">
        <div class="label">Primary Lace Used</div>
        <input id="editPrimaryLaceUsed" type="number" step="0.25" min="0" placeholder="0" />
      </div>

      <div class="detail-block">
        <div class="label">Secondary Lace Used</div>
        <input id="editSecondaryLaceUsed" type="number" step="0.25" min="0" placeholder="0" />
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

  const updates = {
    status: newStatus,
    paid: val("editPaid"),
    phoneNumber: formatPhoneForInput(val("editPhoneNumber")),
    priceQuoted: parsedPrice === "" ? null : parsedPrice,
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
  const wrap =
    document.getElementById("saleGlovePhotosList");

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

             <div class="upload-preview-name">
               ${photo.is_primary ? "★ Primary · " : ""}
               ${escapeHtml(photo.filename || "")}
             </div>

             <button
               class="secondary sale-photo-primary-btn"
               type="button"
               data-glove-id="${escapeAttr(gloveId)}"
               data-photo-id="${escapeAttr(photo.id)}"
               ${photo.is_primary ? "disabled" : ""}
             >
               ${photo.is_primary ? "Primary Photo" : "Set Primary"}
             </button>
           </div>
         `).join("")}
      </div>
    `;

  } catch (err) {

    wrap.innerHTML = `
      <p class="muted">
        Failed to load photos.
      </p>
    `;

    wrap.querySelectorAll(".sale-photo-primary-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          btn.textContent = "Saving...";
          btn.disabled = true;

          await postJson({
            action: "setSalePhotoPrimary",
            gloveId: btn.dataset.gloveId,
            photoId: btn.dataset.photoId
          }, true);

          await loadSaleGlovePhotos(gloveId);

        } catch (err) {
          btn.textContent = "Set Primary";
          btn.disabled = false;
          alert(err.message || "Failed to set primary photo.");
        }
      });
    });
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
    alert("Orders refreshed.");
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
