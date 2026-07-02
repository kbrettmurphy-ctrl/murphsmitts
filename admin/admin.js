const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";
const ADMIN_PHOTO_ACTION_PLACEHOLDER_LABEL = "Action";
const ADMIN_PHOTO_ACTION_PLACEHOLDER = `<option value="" disabled hidden>${ADMIN_PHOTO_ACTION_PLACEHOLDER_LABEL}</option>`;
const ADMIN_PHOTO_PLACEHOLDER_VALUES = new Set(["", "action", "actions"]);
const ADMIN_STORE_PHOTO_ACTIONS = new Set(["primary", "hover", "delete"]);
const ADMIN_GALLERY_PHOTO_ACTIONS = new Set(["view", "hide", "restore", "delete"]);

// Admin v2 default: keep controls compact, icon-first, and as close to native iOS/macOS behavior as practical.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");
const uploadView = document.getElementById("uploadView");
const mapView = document.getElementById("mapView");
const detailTitle = document.getElementById("detailTitle");
const pinInput = document.getElementById("pinInput");
const loginStatus = document.getElementById("loginStatus");
const mainPanel = document.querySelector(".main-panel");

const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const searchToolbar = document.getElementById("searchToolbar");
const searchToggleBtn = document.getElementById("searchToggleBtn");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchCloseBtn = document.getElementById("searchCloseBtn");
const orderFilterToggleBtn = document.getElementById("orderFilterToggleBtn");
const orderFilterPopover = document.getElementById("orderFilterPopover");
const orderFilterButtons = Array.from(document.querySelectorAll("[data-order-filter]"));
const orderNewBtn = document.getElementById("orderNewBtn");
const inventoryFilterToggleBtn = document.getElementById("inventoryFilterToggleBtn");
const inventoryAddBtn = document.getElementById("inventoryAddBtn");
const inventoryFilterPopover = document.getElementById("inventoryFilterPopover");
const inventoryAllBtn = document.getElementById("inventoryAllBtn");
const inventoryNeedsOrderBtn = document.getElementById("inventoryNeedsOrderBtn");
const inventoryHiddenBtn = document.getElementById("inventoryHiddenBtn");
const pullRefreshIndicator = document.getElementById("pullRefreshIndicator");
const pullRefreshText = document.getElementById("pullRefreshText");
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
const galleryUploaderToggleBtn = document.getElementById("galleryUploaderToggleBtn");
const galleryUploaderCloseBtn = document.getElementById("galleryUploaderCloseBtn");
const galleryUploaderCard = document.getElementById("galleryUploaderCard");
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
let mapFocusOrderNumber = null;
let mapFocusHandled = false;
const orderMapMarkerByNumber = new Map();
let currentOrder = null;
let detailMode = "edit";
let customerSuggestionState = null;
let workflowSheetEl = null;
let inventorySheetEl = null;
let adminMenuLayer = null;
let orderPhotoActionMenuEl = null;
let galleryPhotoActionMenuEl = null;
let galleryPhotos = [];
let galleryManagerFilter = "all";
let galleryPhotoPressTimer = null;
let galleryPhotoPressStart = null;
let orderPhotoPressTimer = null;
let orderPhotoPressStart = null;
let orderActivityLoadToken = 0;
let orderDetailCollapseState = {};
let orderDetailCollapseOrderNumber = null;
let detailCollapseDelegated = false;
let adminMenuTapSuppressUntil = 0;
let suppressPhotoLightboxUntil = 0;
let inventoryPressTimer = null;
let inventoryPressStart = null;
let workflowPressTimer = null;
let workflowSuppressOpeningTouch = false;
let workflowSuppressOpeningTouchTimer = null;
let suppressOrderCardClickUntil = 0;
let searchExpanded = false;
let desktopOrderActionMenu = null;
let desktopOrderActionState = null;
let orderFiltersExpanded = false;
let inventoryFiltersExpanded = false;
let pullRefreshState = {
  tracking: false,
  pulling: false,
  refreshing: false,
  startX: 0,
  startY: 0,
  distance: 0
};
let loginInProgress = false;
let listScrollY = 0;
let orderMap = null;
let orderMapMarkers = null;
let mapRenderToken = 0;

window.inventoryViewMode = "active";

document.addEventListener("selectstart", (e) => {
  if (isEditableAdminTarget(e.target)) return;
  if (isAdminActionSurface(e.target)) {
    e.preventDefault();
  }
});

document.addEventListener("contextmenu", (e) => {
  if (isEditableAdminTarget(e.target)) return;
  if (isAdminActionSurface(e.target)) {
    e.preventDefault();
  }
});

function isEditableAdminTarget(target) {
  return !!target?.closest?.("input, textarea, select, [contenteditable='true']");
}

function isAdminActionSurface(target) {
  return !!target?.closest?.(
    ".order-card, .inventory-card, .workflow-sheet, .workflow-action-btn, .admin-filter-popover, .gallery-manager-item, .gallery-manager-thumb, .photo-thumb-wrap, .photo-thumb-img, .sale-photo-action-select, .gallery-manager-action-select, .topbar-icon-action"
  );
}

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

function resetAdminScroll(activeContainer = null) {
  const anchor =
    activeContainer?.querySelector?.(".topbar") ||
    activeContainer?.firstElementChild ||
    activeContainer;

  const containers = new Set([
    document.scrollingElement,
    document.documentElement,
    document.body,
    mainPanel,
    loginView,
    dashboardView,
    detailView,
    uploadView,
    mapView,
    saleGlovesView,
    ordersList,
    orderDetail,
    activeContainer
  ].filter(Boolean));

  containers.forEach(container => {
    container.scrollTop = 0;
    container.scrollLeft = 0;
  });

  window.scrollTo(0, 0);

  if (anchor && typeof anchor.scrollIntoView === "function") {
    anchor.scrollIntoView({ block: "start", inline: "nearest" });
  }
}

function getAdminScrollTop() {
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
    mainPanel?.scrollTop || 0
  );
}

function setAdminScrollTop(value) {
  const top = Math.max(0, Number(value) || 0);

  window.scrollTo(0, top);
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;

  if (mainPanel) {
    mainPanel.scrollTop = top;
    mainPanel.scrollLeft = 0;
  }
}

function resetViewScroll(viewEl, { invalidateMap = false, blurActive = false } = {}) {
  if (blurActive && document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }

  const invalidate = () => {
    if (invalidateMap && orderMap) {
      orderMap.invalidateSize();
    }
  };

  resetAdminScroll(viewEl);
  invalidate();

  queueMicrotask(() => {
    resetAdminScroll(viewEl);
    invalidate();
  });

  setTimeout(() => {
    resetAdminScroll(viewEl);
    invalidate();
  }, 0);

  setTimeout(() => {
    resetAdminScroll(viewEl);
    invalidate();
  }, 90);

  setTimeout(() => {
    resetAdminScroll(viewEl);
    invalidate();
  }, 260);

  requestAnimationFrame(() => {
    resetAdminScroll(viewEl);
    invalidate();

    requestAnimationFrame(() => {
      resetAdminScroll(viewEl);
      invalidate();
    });
  });
}

function beginAdminViewSwitch() {
  closeOtherSwipes(null);
  cancelWorkflowPress();
  resetAdminScroll();
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

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function getSearchTokens(value) {
  return normalizeForSearch(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function getOrderSearchText(order) {
  const paidState = normalizeText(order.paid) === "paid" ? "paid" : "unpaid needs payment";
  const fulfillmentState = looksLocalDropOff(order)
    ? "local pickup drop off drop-off"
    : "shipping shipped mail mail-in";

  return [
    order.orderNumber,
    order.customerName,
    String(order.customerName || "").split(/\s+/).filter(Boolean).join(" "),
    order.emailAddress,
    order.phoneNumber,
    order.status,
    paidState,
    order.brandModel,
    order.gloveType,
    order.webType,
    order.servicesRequested,
    order.primaryLaceColor,
    order.lacePrimary,
    order.secondaryLaceColor,
    order.laceAccent,
    order.customColorRequest,
    order.customLaceNotes,
    order.dropOffMethod,
    order.shippingMethod,
    fulfillmentState,
    order.city,
    order.state,
    order.zipCode,
    order.zip,
    order.internalNotes,
    order.customerNotes,
    order.gloveNotes
  ].join(" ");
}

function orderMatchesSearch(order, query) {
  const tokens = getSearchTokens(query);
  if (!tokens.length) return true;

  const text = normalizeForSearch(getOrderSearchText(order));
  const compactText = text.replace(/\s+/g, "");
  const digitText = [
    order.phoneNumber,
    order.orderNumber,
    order.zipCode,
    order.zip
  ].map(digitsOnly).join(" ");

  return tokens.every(token => {
    if (text.includes(token) || compactText.includes(token)) return true;

    const tokenDigits = digitsOnly(token);
    return tokenDigits.length > 0 && digitText.includes(tokenDigits);
  });
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

const ORDER_FILTER_LABELS = {
  current: "Current",
  all: "All",
  estimate: "Estimate Sent",
  "customer-response": "Pending Response",
  approved: "Customer Approved",
  transit: "In Transit to Me",
  progress: "In Progress",
  waiting: "Waiting Parts",
  ready: "Ready to Go",
  hold: "On Hold",
  completed: "Completed"
};

function isOrderFilterView(viewName) {
  return Object.prototype.hasOwnProperty.call(ORDER_FILTER_LABELS, viewName);
}

function getOrderFilterLabel(viewName) {
  return ORDER_FILTER_LABELS[viewName] || ORDER_FILTER_LABELS.current;
}

function getOrderStatusDisplay(status) {
  const raw = String(status || "").trim();
  const normalized = normalizeStatus(raw);

  if (normalized === "waiting on lace/parts" || normalized === "waiting on parts") {
    return "Waiting Parts";
  }

  return raw;
}

function getViewTitle(viewName) {
  switch (viewName) {
    case "map": return "Map";
    case "upload": return "Gallery";
    case "inventory": return "Lace Inventory";
    case "gloves-sale": return "Gloves For Sale";
    default: return "Orders";
  }
}

function getViewOrders() {
  switch (activeView) {
    case "all":
      return allOrders;
      
    case "completed":
      return allOrders.filter(isCompletedOrder);

    case "waiting":
      return allOrders.filter(order => {
        const status = normalizeStatus(order.status);
        return status === "waiting on lace/parts" || status === "waiting on parts";
      });

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

function captureOrderDetailCollapseState() {
  if (!orderDetail) return;

  orderDetail.querySelectorAll("[data-section-key]").forEach(section => {
    const key = section.dataset.sectionKey;
    if (!key || section.classList.contains("is-empty")) return;
    orderDetailCollapseState[key] = !section.classList.contains("is-collapsed");
  });
}

function getDefaultSectionExpanded(sectionKey, order) {
  switch (sectionKey) {
    case "customer":
    case "orderStatus":
      return true;
    case "gloveDetails":
    case "lace":
      return false;
    case "services": {
      const parsed = parseServicesValue(order.servicesRequested || "");
      return parsed.selected.length > 0 || parsed.otherChecked;
    }
    case "shipping": {
      if (looksLocalDropOff(order)) return false;
      const tracking = String(order.trackingNumber || order.tracking || "").trim();
      const carrier = String(order.carrier || "").trim();
      const street = String(order.streetAddress || order.address || "").trim();
      const city = String(order.city || "").trim();
      const state = String(order.state || "").trim();
      const zip = String(order.zipCode || order.zip || "").trim();
      return !!(
        tracking ||
        carrier ||
        street ||
        city ||
        state ||
        zip ||
        order.allowShipWithoutPayment === true
      );
    }
    case "notes": {
      const customerNotes = String(order.gloveNotes || order.customerNotes || "").trim();
      const internalNotes = String(order.internalNotes || "").trim();
      return !!(customerNotes || internalNotes);
    }
    case "photos":
      return (Array.isArray(order.glovePhotos) ? order.glovePhotos.length : 0) > 0;
    case "activity":
      return false;
    default:
      return true;
  }
}

function getSectionExpanded(sectionKey, defaultExpanded) {
  if (Object.prototype.hasOwnProperty.call(orderDetailCollapseState, sectionKey)) {
    return orderDetailCollapseState[sectionKey];
  }
  return defaultExpanded;
}

function summarizeCustomer(order) {
  const parts = [];
  const name = String(order.customerName || "").trim();
  const orderNum = String(order.orderNumber || "").trim();
  const phone = formatPhoneForInput(order.phoneNumber || "").trim();
  const email = String(order.emailAddress || "").trim();

  if (name) parts.push(name);
  if (orderNum) parts.push(`#${orderNum}`);
  if (phone) parts.push(phone);
  else if (email) parts.push(email);

  return parts.join(" · ") || "No customer info";
}

function summarizeOrderStatus(order) {
  const parts = [];
  if (order.status) parts.push(order.status);
  parts.push(normalizeText(order.paid) === "paid" ? "Paid" : "Unpaid");

  const price = formatMoneyForInput(order.priceQuoted);
  if (price) parts.push(price);

  return parts.join(" · ") || "Status";
}

function summarizeGloveDetails(order) {
  const parts = [];
  if (order.brandModel) parts.push(String(order.brandModel).trim());
  if (order.gloveType) parts.push(String(order.gloveType).trim());
  if (order.dropOffMethod) parts.push(String(order.dropOffMethod).trim());
  return parts.join(" · ") || "No glove details";
}

function summarizeLace(order) {
  const parts = [];
  const primary = String(order.primaryLaceColor || order.lacePrimary || "").trim();
  const secondary = String(order.secondaryLaceColor || order.laceAccent || "").trim();
  const primaryUsed = order.primaryLaceUsed;
  const secondaryUsed = order.secondaryLaceUsed;

  if (primary) parts.push(primary);
  if (secondary) parts.push(secondary);
  if (primaryUsed !== null && primaryUsed !== undefined && primaryUsed !== "") {
    parts.push(`${primaryUsed} primary used`);
  }
  if (secondaryUsed !== null && secondaryUsed !== undefined && secondaryUsed !== "") {
    parts.push(`${secondaryUsed} secondary used`);
  }

  return parts.join(" · ") || "No lace info";
}

function summarizeNotes(order) {
  const customer = String(order.gloveNotes || order.customerNotes || "").trim();
  const internal = String(order.internalNotes || "").trim();

  if (customer && internal) return "Customer + internal notes";
  if (customer) return "Customer note";
  if (internal) return "Internal note";
  return "No notes";
}

function summarizePhotos(order) {
  const count = Array.isArray(order.glovePhotos) ? order.glovePhotos.length : 0;
  if (!count) return "No photos";
  return count === 1 ? "1 photo" : `${count} photos`;
}

function summarizeServices(order) {
  const parsed = parseServicesValue(order.servicesRequested || "");
  const parts = [...parsed.selected];

  if (parsed.otherChecked && parsed.otherText) {
    parts.push(parsed.otherText);
  } else if (parsed.otherChecked) {
    parts.push("Other");
  }

  return parts.length ? parts.join(" · ") : "No services selected";
}

function summarizeServicesFromForm() {
  const checked = Array.from(
    document.querySelectorAll('input[name="editServicesRequested"]:checked')
  ).map(el => el.value);

  const otherChecked = document.getElementById("editServiceOtherCheck")?.checked;
  const otherText = String(document.getElementById("editServiceOtherText")?.value || "").trim();

  if (otherChecked && otherText) checked.push(otherText);
  else if (otherChecked) checked.push("Other");

  return checked.length ? checked.join(" · ") : "No services selected";
}

function summarizeShipping(order) {
  if (looksLocalDropOff(order)) return "Local Drop-Off";

  const tracking = String(order.trackingNumber || order.tracking || "").trim();
  const carrier = String(order.carrier || "").trim();
  const street = String(order.streetAddress || order.address || "").trim();
  const city = String(order.city || "").trim();
  const state = String(order.state || "").trim();
  const zip = String(order.zipCode || order.zip || "").trim();
  const allowShip = order.allowShipWithoutPayment === true;
  const hasShippingData = !!(tracking || carrier || street || city || state || zip || allowShip);

  if (!hasShippingData) return "No shipping info";

  const parts = ["Shipped"];
  if (carrier && tracking) parts.push(`${carrier} · ${tracking}`);
  else if (tracking) parts.push(tracking);
  else if (carrier) parts.push(carrier);
  if (allowShip) parts.push("Ship without payment allowed");

  return parts.join(" · ");
}

function summarizeShippingFromForm() {
  const dropOff = document.getElementById("editDropOffMethod")?.value || currentOrder?.dropOffMethod || "";
  if (looksLocalDropOff({ dropOffMethod: dropOff })) return "Local Drop-Off";

  const tracking = String(document.getElementById("editTrackingNumber")?.value || "").trim();
  const carrier = String(document.getElementById("editCarrier")?.value || "").trim();
  const street = String(document.getElementById("editStreetAddress")?.value || "").trim();
  const city = String(document.getElementById("editCity")?.value || "").trim();
  const state = String(document.getElementById("editState")?.value || "").trim();
  const zip = String(document.getElementById("editZipCode")?.value || "").trim();
  const allowShip = document.getElementById("editAllowShipWithoutPayment")?.value === "true";
  const hasShippingData = !!(tracking || carrier || street || city || state || zip || allowShip);

  if (!hasShippingData) return "No shipping info";

  const parts = ["Shipped"];
  if (carrier && tracking) parts.push(`${carrier} · ${tracking}`);
  else if (tracking) parts.push(tracking);
  else if (carrier) parts.push(carrier);
  if (allowShip) parts.push("Ship without payment allowed");

  return parts.join(" · ");
}

function summarizeCustomerFromForm() {
  const order = currentOrder || {};
  const phone = formatPhoneForInput(document.getElementById("editPhoneNumber")?.value || "").trim();
  const email = String(order.emailAddress || "").trim();
  const parts = [];

  if (order.customerName) parts.push(String(order.customerName).trim());
  if (order.orderNumber) parts.push(`#${order.orderNumber}`);
  if (phone) parts.push(phone);
  else if (email) parts.push(email);

  return parts.join(" · ") || "No customer info";
}

function summarizeOrderStatusFromForm() {
  const parts = [];
  const status = document.getElementById("editStatus")?.value;
  const paid = document.getElementById("editPaid")?.value;
  const price = String(document.getElementById("editPriceQuoted")?.value || "").trim();

  if (status) parts.push(status);
  if (paid) parts.push(paid);
  if (price) parts.push(price);

  return parts.join(" · ") || "Status";
}

function summarizeGloveDetailsFromForm() {
  const parts = [];
  const brand = String(document.getElementById("editBrandModel")?.value || "").trim();
  const gloveType = String(document.getElementById("editGloveType")?.value || "").trim();
  const dropOff = String(document.getElementById("editDropOffMethod")?.value || "").trim();

  if (brand) parts.push(brand);
  if (gloveType) parts.push(gloveType);
  if (dropOff) parts.push(dropOff);

  return parts.join(" · ") || "No glove details";
}

function summarizeLaceFromForm() {
  const parts = [];
  const primary = String(document.getElementById("editPrimaryLaceColor")?.value || "").trim();
  const secondary = String(document.getElementById("editSecondaryLaceColor")?.value || "").trim();
  const primaryUsed = String(document.getElementById("editPrimaryLaceUsed")?.value || "").trim();
  const secondaryUsed = String(document.getElementById("editSecondaryLaceUsed")?.value || "").trim();

  if (primary) parts.push(primary);
  if (secondary) parts.push(secondary);
  if (primaryUsed) parts.push(`${primaryUsed} primary used`);
  if (secondaryUsed) parts.push(`${secondaryUsed} secondary used`);

  return parts.join(" · ") || "No lace info";
}

function summarizeNotesFromForm() {
  const customer = String(document.getElementById("editGloveNotes")?.value || "").trim();
  const internal = String(document.getElementById("editInternalNotes")?.value || "").trim();

  if (customer && internal) return "Customer + internal notes";
  if (customer) return "Customer note";
  if (internal) return "Internal note";
  return "No notes";
}

function getDetailSectionSummary(sectionKey, order = currentOrder) {
  switch (sectionKey) {
    case "customer":
      return orderDetail?.querySelector("#editPhoneNumber")
        ? summarizeCustomerFromForm()
        : summarizeCustomer(order || {});
    case "orderStatus":
      return orderDetail?.querySelector("#editStatus")
        ? summarizeOrderStatusFromForm()
        : summarizeOrderStatus(order || {});
    case "gloveDetails":
      return orderDetail?.querySelector("#editBrandModel")
        ? summarizeGloveDetailsFromForm()
        : summarizeGloveDetails(order || {});
    case "lace":
      return orderDetail?.querySelector("#editPrimaryLaceColor")
        ? summarizeLaceFromForm()
        : summarizeLace(order || {});
    case "notes":
      return orderDetail?.querySelector("#editGloveNotes")
        ? summarizeNotesFromForm()
        : summarizeNotes(order || {});
    case "photos":
      return summarizePhotos(order || {});
    case "services":
      return orderDetail?.querySelector("#editServicesRequestedWrap")
        ? summarizeServicesFromForm()
        : summarizeServices(order || {});
    case "shipping":
      return orderDetail?.querySelector("#editShippingSection")
        ? summarizeShippingFromForm()
        : summarizeShipping(order || {});
    case "activity":
      return "";
    default:
      return "";
  }
}

function updateDetailSectionSummary(sectionKey, order = currentOrder) {
  const summaryEl = orderDetail?.querySelector(`[data-section-summary="${sectionKey}"]`);
  if (!summaryEl) return;

  const summary = getDetailSectionSummary(sectionKey, order);
  summaryEl.textContent = summary ? `· ${summary}` : "";
}

function renderCollapsibleDetailSection(sectionKey, title, summary, bodyHtml, {
  defaultExpanded = true,
  isEmpty = false,
  sectionId = `${sectionKey}Section`,
  bodyId = `${sectionKey}SectionBody`,
  headerActionsHtml = "",
  extraClass = ""
} = {}) {
  const expanded = getSectionExpanded(sectionKey, defaultExpanded);
  const collapsed = !isEmpty && !expanded;
  const ariaExpanded = isEmpty || expanded;
  const extraClassText = extraClass ? ` ${extraClass}` : "";

  return `
    <section
      id="${sectionId}"
      class="detail-section detail-collapsible-section detail-${sectionKey}-section${collapsed ? " is-collapsed" : ""}${isEmpty ? " is-empty" : ""}${extraClassText}"
      data-section-key="${sectionKey}">
      <div class="detail-section-toggle-row">
        <button
          type="button"
          class="detail-section-toggle order-activity-toggle"
          data-section-toggle="${sectionKey}"
          aria-expanded="${ariaExpanded ? "true" : "false"}"
          aria-controls="${bodyId}">
          <span class="order-activity-toggle-main">
            <span class="order-activity-toggle-title">${escapeHtml(title)}</span>
            <span class="detail-section-summary muted" data-section-summary="${sectionKey}">${summary ? `· ${escapeHtml(summary)}` : ""}</span>
          </span>
          <span class="order-activity-chevron" aria-hidden="true">›</span>
        </button>
        ${headerActionsHtml}
      </div>
      <div id="${bodyId}" class="detail-section-body">
        ${bodyHtml}
      </div>
    </section>
  `;
}

function ensureDetailCollapseDelegation() {
  if (detailCollapseDelegated || !orderDetail) return;

  detailCollapseDelegated = true;
  orderDetail.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-section-toggle]");
    if (!toggle) return;

    const key = toggle.dataset.sectionToggle;
    const section = orderDetail.querySelector(`[data-section-key="${key}"]`);
    if (!section || section.classList.contains("is-empty")) return;

    const collapsed = section.classList.toggle("is-collapsed");
    const expanded = !collapsed;
    orderDetailCollapseState[key] = expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

function wireDetailSectionSummaries() {
  const summaryBindings = [
    { ids: ["editPhoneNumber"], key: "customer" },
    { ids: ["editStatus", "editPaid", "editPriceQuoted", "editShippingCost"], key: "orderStatus" },
    { ids: ["editBrandModel", "editGloveType", "editDropOffMethod", "editWebType"], key: "gloveDetails" },
    { ids: ["editPrimaryLaceColor", "editSecondaryLaceColor", "editPrimaryLaceUsed", "editSecondaryLaceUsed", "editCustomColorRequest"], key: "lace" },
    { ids: ["editGloveNotes", "editInternalNotes"], key: "notes" },
    {
      ids: [
        "editAllowShipWithoutPayment",
        "editTrackingNumber",
        "editCarrier",
        "editStreetAddress",
        "editCity",
        "editState",
        "editZipCode"
      ],
      key: "shipping"
    }
  ];

  summaryBindings.forEach(({ ids, key }) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.summaryBound === "1") return;
      el.dataset.summaryBound = "1";
      el.addEventListener("input", () => updateDetailSectionSummary(key));
      el.addEventListener("change", () => updateDetailSectionSummary(key));
    });
  });

  const servicesWrap = document.getElementById("editServicesRequestedWrap");
  if (servicesWrap && servicesWrap.dataset.summaryBound !== "1") {
    servicesWrap.dataset.summaryBound = "1";
    servicesWrap.addEventListener("change", () => updateDetailSectionSummary("services"));
    document.getElementById("editServiceOtherText")?.addEventListener("input", () => {
      updateDetailSectionSummary("services");
    });
  }
}

function renderPhotoGallery(order) {
  const photos = Array.isArray(order.glovePhotos) ? order.glovePhotos : [];
  const photoBody = `
    <input id="orderPhotoInput" class="order-photo-input" type="file" accept="image/*" multiple>
    <p id="orderPhotoStatus" class="upload-status order-photo-status" aria-live="polite"></p>
    ${photos.length ? `
      <div class="photo-grid">
        ${photos.map((url, index) => `
          <div class="photo-thumb-wrap">
            <img
              class="photo-thumb-img"
              src="${escapeAttr(url)}"
              data-index="${index}"
              alt="Glove photo ${index + 1}"
              loading="lazy"
            >
          </div>
        `).join("")}
      </div>
    ` : `
      <p class="muted order-photo-empty">No order photos yet.</p>
    `}
  `;

  const photoSection = renderCollapsibleDetailSection(
    "photos",
    "Photos",
    summarizePhotos(order),
    photoBody,
    {
      defaultExpanded: getDefaultSectionExpanded("photos", order),
      sectionId: "detailPhotoSection",
      bodyId: "photosSectionBody",
      headerActionsHtml: `<button id="orderPhotoAddBtn" class="secondary topbar-icon-action detail-photo-add-btn" type="button" aria-label="Add order photos">+</button>`
    }
  );

  return `
    ${photoSection}
    <div id="photoLightbox" class="photo-lightbox">
      <img id="lightboxImage" src="">
    </div>
  `;
}

function getDeliveryDisplay(value) {
  return value ? escapeHtml(value) : "Not sent";
}

function clientTextResendAllowed(status) {
  const s = normalizeStatus(status);
  return (
    s === "estimate sent" ||
    s === "in progress" ||
    s === "ready to go" ||
    s === "completed"
  );
}

function clientEmailResendAllowed(status) {
  const s = normalizeStatus(status);
  return !!s && ![
    "picked up",
    "pending response",
    "in transit to me",
    "customer approved"
  ].includes(s);
}

function renderStatusDelivery(order) {
  const emailAvailable = !!String(order.emailAddress || "").trim() && clientEmailResendAllowed(order.status);
  const textAvailable =
    !!String(order.phoneNumber || "").trim() &&
    order.smsOptIn === true &&
    clientTextResendAllowed(order.status);
  const textSuffix = order.lastStatusTextedAt ? ` · ${escapeHtml(formatDeliveryDateTime(order.lastStatusTextedAt))}` : "";

  return `
    <div id="statusDeliveryBlock" class="status-delivery-block detail-block full">
      <div class="status-delivery-heading">Status Delivery</div>
      <div class="status-delivery-rows">
        <div class="status-delivery-row">
          <span>Last emailed</span>
          <strong>${getDeliveryDisplay(order.lastStatusEmailed)}</strong>
        </div>
        <div class="status-delivery-row">
          <span>Last texted</span>
          <strong>${getDeliveryDisplay(order.lastStatusTexted)}${textSuffix}</strong>
        </div>
      </div>
      <div class="status-delivery-actions">
        <button id="resendStatusEmailBtn" class="secondary status-delivery-btn" type="button" ${emailAvailable ? "" : "disabled"}>Send Email Again</button>
        <button id="resendStatusTextBtn" class="secondary status-delivery-btn" type="button" ${textAvailable ? "" : "disabled"}>Send Text Again</button>
      </div>
      <p id="statusDeliveryMessage" class="status-delivery-message" aria-live="polite"></p>
    </div>
  `;
}

function renderOrderActivity(order) {
  const activityBody = `
    <div id="orderActivityList" class="order-activity-list" data-order-number="${escapeAttr(order.orderNumber || "")}">
      <p class="muted order-activity-empty">Loading activity...</p>
    </div>
  `;

  return renderCollapsibleDetailSection(
    "activity",
    "Activity",
    "",
    activityBody,
    {
      defaultExpanded: false,
      isEmpty: true,
      sectionId: "orderActivitySection",
      bodyId: "activitySectionBody"
    }
  );
}

function formatOrderActivityCount(count) {
  if (!count) return "";
  return count === 1 ? "1 event" : `${count} events`;
}

function updateOrderActivityCollapse(activity, { isError = false } = {}) {
  const section = document.getElementById("orderActivitySection");
  const toggle = section?.querySelector("[data-section-toggle='activity']");
  const countEl = section?.querySelector("[data-section-summary='activity']");
  if (!section || !toggle) return;

  const items = Array.isArray(activity) ? activity : [];
  const hasEntries = !isError && items.length > 0;

  if (!hasEntries) {
    section.classList.add("is-empty");
    section.classList.remove("is-collapsed");
    toggle.setAttribute("aria-expanded", "true");
    if (countEl) countEl.textContent = "";
    return;
  }

  section.classList.remove("is-empty");

  if (countEl) {
    const countText = formatOrderActivityCount(items.length);
    countEl.textContent = countText ? `· ${countText}` : "";
  }

  const expanded = getSectionExpanded("activity", false);
  section.classList.toggle("is-collapsed", !expanded);
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
}

async function loadOrderActivity(orderNumber) {
  const activityList = document.getElementById("orderActivityList");
  if (!activityList || !orderNumber) return;

  const token = orderActivityLoadToken + 1;
  orderActivityLoadToken = token;

  try {
    const data = await postJson({
      action: "listOrderActivity",
      orderNumber
    }, true);

    if (token !== orderActivityLoadToken) return;
    if (!currentOrder || String(currentOrder.orderNumber) !== String(orderNumber)) return;

    const activity = data.activity || [];
    activityList.innerHTML = renderOrderActivityRows(activity);
    updateOrderActivityCollapse(activity);
  } catch {
    if (token !== orderActivityLoadToken) return;
    activityList.innerHTML = `<p class="muted order-activity-empty">Activity could not be loaded.</p>`;
    updateOrderActivityCollapse([], { isError: true });
  }
}

function renderOrderActivityRows(activity) {
  if (!Array.isArray(activity) || !activity.length) {
    return `<p class="muted order-activity-empty">No activity yet.</p>`;
  }

  let currentGroup = "";
  let html = "";

  activity.forEach(item => {
    const date = parseActivityDate(item.createdAt || item.created_at);
    const group = formatActivityDateGroup(date);
    if (group !== currentGroup) {
      if (currentGroup) html += `</div>`;
      currentGroup = group;
      html += `
        <div class="order-activity-group">
          <div class="order-activity-date">${escapeHtml(group)}</div>
      `;
    }

    html += `
      <div class="order-activity-row">
        <time class="order-activity-time">${escapeHtml(formatActivityTime(date))}</time>
        <div class="order-activity-main">
          <strong>${escapeHtml(item.eventLabel || item.event_label || "Activity")}</strong>
          ${item.eventDetail || item.event_detail ? `<span>${escapeHtml(item.eventDetail || item.event_detail)}</span>` : ""}
        </div>
      </div>
    `;
  });

  if (currentGroup) html += `</div>`;
  return html;
}

function parseActivityDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatActivityDateGroup(date) {
  if (!date) return "Unknown";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) return "Today";
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
}

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatActivityTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDeliveryDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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
      opacity:0;
      visibility:hidden;
      pointer-events:none;
      z-index:0;
      transition:
        opacity 120ms ease,
        visibility 0s linear 120ms;
    }

    .swipe-actions-start{
      justify-content:flex-start;
      background:transparent;
    }

    .swipe-actions-end{
      justify-content:flex-end;
      background:transparent;
    }

    .swipe-row.swiped-right .swipe-actions-start{
      background:transparent;
      opacity:1;
      visibility:visible;
      z-index:1;
      transition:
        opacity 120ms ease,
        visibility 0s;
    }

    .swipe-row.swiped-left .swipe-actions-end{
      background:transparent;
      opacity:1;
      visibility:visible;
      z-index:1;
      transition:
        opacity 120ms ease,
        visibility 0s;
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
      opacity:0;
      visibility:hidden;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 50px;
      transform:scale(.94);
      transition:
        opacity 120ms ease,
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
        visibility 0s linear 120ms;
      box-shadow:
        0 8px 16px rgba(0,0,0,.24),
        inset 0 1px 0 rgba(255,255,255,.16);
      -webkit-tap-highlight-color:transparent;
    }

    .swipe-row.swiped-right .swipe-actions-start .swipe-circle-action,
    .swipe-row.swiped-left .swipe-actions-end .swipe-circle-action{
      opacity:1;
      visibility:visible;
      transform:scale(1);
      transition:
        opacity 120ms ease,
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
        visibility 0s;
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
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 50px;
      box-shadow:
        0 8px 16px rgba(0,0,0,.24),
        inset 0 1px 0 rgba(255,255,255,.14);
      -webkit-tap-highlight-color:transparent;
    }

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
      background:#fffaf3;
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
       font-weight:600;
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

function closeDesktopOrderActionMenus(exceptMenu = null) {
  if (!desktopOrderActionMenu || desktopOrderActionMenu === exceptMenu) return;

  desktopOrderActionMenu.hidden = true;
  desktopOrderActionState?.row?.classList.remove("actions-open");
  desktopOrderActionState?.button?.setAttribute("aria-expanded", "false");
  desktopOrderActionState = null;
}

function getDesktopOrderActionMenu() {
  if (desktopOrderActionMenu) return desktopOrderActionMenu;

  desktopOrderActionMenu = document.createElement("div");
  desktopOrderActionMenu.className = "order-actions-menu";
  desktopOrderActionMenu.setAttribute("role", "menu");
  desktopOrderActionMenu.hidden = true;
  desktopOrderActionMenu.innerHTML = `
    <button class="order-menu-action order-menu-text" type="button" role="menuitem">Text</button>
    <button class="order-menu-action order-menu-email" type="button" role="menuitem">Email</button>
    <button class="order-menu-action order-menu-ship" type="button" role="menuitem">Ship</button>
    <button class="order-menu-action order-menu-delete" type="button" role="menuitem">Delete</button>
  `;

  desktopOrderActionMenu.addEventListener("click", async (e) => {
    e.stopPropagation();
    const action = e.target.closest(".order-menu-action");
    if (!action || !desktopOrderActionState?.order) return;

    e.preventDefault();
    const { row, order } = desktopOrderActionState;
    suppressRowClick(row);
    closeDesktopOrderActionMenus();

    if (action.classList.contains("order-menu-text")) {
      textOrderCustomer(order);
    } else if (action.classList.contains("order-menu-email")) {
      emailOrderCustomer(order);
    } else if (action.classList.contains("order-menu-ship")) {
      await copyPirateShipInfo(order);
    } else if (action.classList.contains("order-menu-delete")) {
      await confirmAndDeleteOrder(order.orderNumber);
    }
  });

  document.body.appendChild(desktopOrderActionMenu);
  return desktopOrderActionMenu;
}

function positionDesktopOrderActionMenu(button, menu) {
  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const margin = 10;
  const left = Math.min(
    window.innerWidth - menuRect.width - margin,
    Math.max(margin, rect.left + (rect.width / 2) - (menuRect.width / 2))
  );
  const top = Math.min(
    window.innerHeight - menuRect.height - margin,
    rect.bottom + gap
  );

  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(margin, top)}px`;
}

function toggleDesktopOrderActionMenu(row, button, order) {
  const isOpen = desktopOrderActionState?.button === button && !desktopOrderActionMenu?.hidden;

  if (isOpen) {
    closeDesktopOrderActionMenus();
    return;
  }

  const menu = getDesktopOrderActionMenu();
  closeDesktopOrderActionMenus();
  closeOtherSwipes(row);

  desktopOrderActionState = { row, button, order };
  row.classList.add("actions-open");
  button.setAttribute("aria-expanded", "true");
  menu.querySelector(".order-menu-ship").hidden = looksLocalDropOff(order);
  menu.hidden = false;
  positionDesktopOrderActionMenu(button, menu);
}

function setActiveView(viewName) {
  if (!isAuthenticated()) {
    activeView = "current";
    showView(loginView);
    closeMenu();
    syncAuthUI();
    return;
  }

  beginAdminViewSwitch();
  closeInventorySheet();
  closeOrderPhotoActionMenu();
  closeGalleryPhotoActionMenu();
  orderFiltersExpanded = false;
  inventoryFiltersExpanded = false;
  activeView = viewName;
  navLinks.forEach(link => {
    const isOrdersLink = link.dataset.view === "current" && isOrderFilterView(viewName);
    link.classList.toggle("active", link.dataset.view === viewName || isOrdersLink);
  });

  viewTitle.textContent = getViewTitle(viewName);
  syncOrderFilterUI();
  syncInventoryFilterUI();

  if (viewName === "upload") {
    showView(uploadView);
    loadGalleryManagerPhotos();
    closeMenu();
    resetViewScroll(uploadView, { blurActive: true });
    return;
  }

  if (viewName === "gloves-sale") {
    const loadPromise = loadSaleGloves();
    showView(saleGlovesView);
    closeMenu();
    resetViewScroll(saleGlovesView, { blurActive: true });
    loadPromise.finally(() => resetViewScroll(saleGlovesView));
    return;
  }

  if (viewName === "map") {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("order")) {
      mapFocusOrderNumber = null;
      mapFocusHandled = true;
    }
    showView(mapView);
    closeMenu();
    resetViewScroll(mapView, { invalidateMap: true, blurActive: true });
    renderMapView().finally(() => resetViewScroll(mapView, { invalidateMap: true }));
    return;
  }

  let renderPromise = null;
  if (viewName === "inventory") {
    searchInput.value = "";
    syncSearchUI();
    renderPromise = loadInventory().catch(err => {
      ordersList.innerHTML = `<div class="no-results">${escapeHtml(err.message || "Failed to load inventory.")}</div>`;
    });
  } else {
    applyFilters();
  }

  showView(dashboardView);
  closeMenu();
  resetViewScroll(dashboardView, { blurActive: true });

  if (renderPromise) {
    renderPromise.finally(() => resetViewScroll(dashboardView));
  }
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
  const q = searchInput.value.trim();
  const isSearching = !!q;
  let list = (isSearching ? allOrders : getViewOrders()).slice();

  if (isSearching) {
    list = list.filter(order => orderMatchesSearch(order, q));
  }

  sortOrders(list);
  renderOrders(list);

  if (isSearching) {
    viewTitle.textContent = "Search";
    orderCount.textContent = `${list.length} result${list.length === 1 ? "" : "s"}`;
  } else {
    viewTitle.textContent = getViewTitle(activeView);
    orderCount.textContent = isOrderFilterView(activeView)
      ? `${getOrderFilterLabel(activeView)} · ${list.length}`
      : `${list.length} order${list.length === 1 ? "" : "s"}`;
  }

  syncOrderFilterUI();
  syncSearchUI();
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function syncSearchUI() {
  const hasQuery = !!searchInput?.value.trim();
  const showSearch = isOrderFilterView(activeView);

  if (hasQuery && !searchExpanded) {
    searchExpanded = true;
  }

  const expanded = showSearch && searchExpanded;

  searchToolbar?.classList.toggle("is-collapsed", !expanded);

  if (searchToggleBtn) {
    searchToggleBtn.hidden = !showSearch;
    searchToggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  if (orderNewBtn) {
    orderNewBtn.hidden = !showSearch;
  }

  if (searchClearBtn) {
    searchClearBtn.hidden = !hasQuery;
  }
}

function syncOrderFilterUI() {
  const showOrderFilter = isOrderFilterView(activeView);
  const showPopover = showOrderFilter && orderFiltersExpanded;

  if (orderFilterToggleBtn) {
    orderFilterToggleBtn.hidden = !showOrderFilter;
    orderFilterToggleBtn.setAttribute("aria-expanded", showPopover ? "true" : "false");
    orderFilterToggleBtn.classList.toggle("is-active", showPopover);
    orderFilterToggleBtn.classList.toggle("has-active-filter", showOrderFilter && activeView !== "current");
  }

  if (orderFilterPopover) {
    orderFilterPopover.hidden = !showPopover;
    if (showPopover) {
      requestAnimationFrame(() => positionAdminFilterPopover(orderFilterPopover, orderFilterToggleBtn));
    }
  }

  orderFilterButtons.forEach(btn => {
    const active = btn.dataset.orderFilter === activeView;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function expandSearch({ focus = false } = {}) {
  searchExpanded = true;
  syncSearchUI();

  if (focus) {
    requestAnimationFrame(() => {
      searchInput?.focus({ preventScroll: true });
    });
  }
}

function collapseSearchIfEmpty() {
  if (searchInput?.value.trim()) {
    searchInput.focus({ preventScroll: true });
    return;
  }

  searchExpanded = false;
  syncSearchUI();
}

function clearSearch() {
  if (!searchInput) return;

  searchInput.value = "";
  applyFilters();
  expandSearch({ focus: true });
}

function cancelSearch() {
  if (!searchInput) return;

  searchInput.value = "";
  applyFilters();
  searchExpanded = false;
  syncSearchUI();
  searchInput.blur();
  resetAdminScroll(dashboardView);
}

function handleSearchKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancelSearch();
    return;
  }

  if (e.key === "Enter") {
    searchInput.blur();
  }
}

function canStartPullRefresh(e) {
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  if (!isAuthenticated()) return false;
  if (pullRefreshState.refreshing) return false;
  if (loginView?.classList.contains("active") || detailView?.classList.contains("active")) return false;
  if (document.body.classList.contains("workflow-open")) return false;
  if (sideMenu?.classList.contains("open")) return false;
  if (orderFiltersExpanded || inventoryFiltersExpanded) return false;

  const activeEl = document.activeElement;
  if (
    activeEl &&
    activeEl !== document.body &&
    activeEl.matches?.("input, textarea, select, [contenteditable='true']")
  ) {
    return false;
  }

  if (getAdminScrollTop() > 1) return false;
  if (!e.touches || e.touches.length !== 1) return false;
  if (
    e.target.closest(
      "button, input, textarea, select, .swipe-action-panel, .side-menu, .admin-filter-popover, .leaflet-container, .leaflet-popup, .order-map, .upload-drop"
    )
  ) {
    return false;
  }

  return true;
}

function setPullRefreshIndicator(distance, state = "pull") {
  if (!pullRefreshIndicator || !pullRefreshText) return;

  const threshold = 74;
  const clamped = Math.max(0, Math.min(82, distance));
  const visible = clamped > 1 || state === "refreshing";

  pullRefreshIndicator.classList.toggle("visible", visible);
  pullRefreshIndicator.classList.toggle("ready", state === "ready");
  pullRefreshIndicator.classList.toggle("refreshing", state === "refreshing");
  pullRefreshIndicator.style.transform = `translate(-50%, ${visible ? clamped : 0}px)`;
  pullRefreshText.textContent =
    state === "refreshing"
      ? "Refreshing..."
      : distance >= threshold
        ? "Release to refresh"
        : "Pull to refresh";
}

function resetPullRefreshIndicator() {
  pullRefreshState.tracking = false;
  pullRefreshState.pulling = false;
  pullRefreshState.distance = 0;
  setPullRefreshIndicator(0, "pull");
}

async function refreshActiveViewFromPull() {
  if (pullRefreshState.refreshing) return;

  pullRefreshState.refreshing = true;
  setPullRefreshIndicator(74, "refreshing");

  try {
    if (isOrderFilterView(activeView)) {
      await loadOrders();
    } else if (activeView === "map") {
      if (mapStatus) mapStatus.textContent = "Refreshing orders...";
      await loadOrders();
      await renderMapView();
      orderMap?.invalidateSize();
    } else if (activeView === "inventory") {
      await loadInventory();
    } else if (activeView === "gloves-sale") {
      if (document.getElementById("saveSaleGloveBtn")) return;
      await loadSaleGloves();
    }
    // Upload has no safe data-only refresh; staged photos are intentionally preserved.
  } catch {
    // Existing loaders surface their own recoverable states; keep pull-to-refresh quiet.
  } finally {
    setTimeout(() => {
      pullRefreshState.refreshing = false;
      resetPullRefreshIndicator();
    }, 240);
  }
}

function initPullToRefresh() {
  const threshold = 74;
  const directionThreshold = 10;

  document.addEventListener("touchstart", (e) => {
    if (!canStartPullRefresh(e)) return;

    const touch = e.touches[0];
    pullRefreshState.tracking = true;
    pullRefreshState.pulling = false;
    pullRefreshState.startX = touch.clientX;
    pullRefreshState.startY = touch.clientY;
    pullRefreshState.distance = 0;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!pullRefreshState.tracking || pullRefreshState.refreshing) return;
    if (!e.touches || e.touches.length !== 1) {
      resetPullRefreshIndicator();
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - pullRefreshState.startX;
    const dy = touch.clientY - pullRefreshState.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!pullRefreshState.pulling) {
      if (dy < 0 || (absX > directionThreshold && absX > absY)) {
        resetPullRefreshIndicator();
        return;
      }

      if (dy < directionThreshold || absY < absX * 1.2) {
        return;
      }

      pullRefreshState.pulling = true;
      closeOtherSwipes(null);
      cancelWorkflowPress();
    }

    if (!pullRefreshState.pulling) return;

    e.preventDefault();
    cancelWorkflowPress();

    const distance = Math.min(92, (dy - directionThreshold) * 0.55);
    pullRefreshState.distance = Math.max(0, distance);
    setPullRefreshIndicator(
      pullRefreshState.distance,
      pullRefreshState.distance >= threshold ? "ready" : "pull"
    );
  }, { passive: false });

  document.addEventListener("touchend", () => {
    if (!pullRefreshState.tracking) return;

    const shouldRefresh = pullRefreshState.pulling && pullRefreshState.distance >= threshold;
    pullRefreshState.tracking = false;
    pullRefreshState.pulling = false;

    if (shouldRefresh) {
      refreshActiveViewFromPull();
    } else {
      resetPullRefreshIndicator();
    }
  });

  document.addEventListener("touchcancel", resetPullRefreshIndicator);
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
  orderCount.textContent = isOrderFilterView(activeView)
    ? `${getOrderFilterLabel(activeView)} · ${list.length}`
    : `${list.length}`;
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = `<div class="no-results">No matching orders.</div>`;
    return;
  }

  list.forEach(order => {
    const row = document.createElement("div");
    row.className = "swipe-row";

    const paidClass = normalizeText(order.paid) === "paid" ? "paid" : "unpaid";
    const isLocal = looksLocalDropOff(order);

    row.innerHTML = `
      <div class="swipe-action-panel swipe-rail-left swipe-actions-start">
        <div class="swipe-quick-actions">
          <button class="swipe-action-btn swipe-circle-action swipe-circle-text swipe-action-text" type="button" aria-label="Text customer">
            ${SWIPE_ICONS.text}
          </button>
          <button class="swipe-action-btn swipe-circle-action swipe-circle-email swipe-action-email" type="button" aria-label="Email customer">
            ${SWIPE_ICONS.email}
          </button>
          ${!isLocal ? `
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
          <div class="order-status">${escapeHtml(getOrderStatusDisplay(order.status))}</div>
        </div>

        <div class="order-subrow">
          <div class="order-meta-left">
            <div class="order-number ${paidClass}">${escapeHtml(order.orderNumber || "")}</div>
            ${renderLaceChips(order)}
          </div>
          <div class="order-actions-wrap">
            <button class="order-actions-btn" type="button" aria-label="Order actions" aria-haspopup="menu" aria-expanded="false">
              <span aria-hidden="true">•••</span>
            </button>
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
      if (e.target.closest(".swipe-action-btn") || e.target.closest(".swipe-delete-btn") || e.target.closest(".order-actions-wrap")) return;
      e.preventDefault();
      openWorkflowSheet(order, e);
    });

    card.addEventListener("touchstart", (e) => {
      if (e.target.closest(".swipe-action-btn") || e.target.closest(".swipe-delete-btn") || e.target.closest(".order-actions-wrap")) return;
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

    row.querySelector(".order-actions-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      suppressRowClick(row, 250);
      toggleDesktopOrderActionMenu(row, e.currentTarget, order);
    });

    ordersList.appendChild(row);
    enableOrderSwipeActions(row, order);
  });
}

function renderOrderDetail(order) {
  detailMode = "edit";
  currentOrder = order;

  const orderNum = String(order.orderNumber || "");
  if (orderDetailCollapseOrderNumber === orderNum) {
    captureOrderDetailCollapseState();
  } else {
    orderDetailCollapseOrderNumber = orderNum;
    orderDetailCollapseState = {};
  }

  if (detailTitle) {
    detailTitle.textContent = "Order Detail";
  }
  if (saveOrderBtn) {
    saveOrderBtn.textContent = "Save";
  }
  clearSaveStatus();

  const isLocal = looksLocalDropOff(order);

  const primaryLaceColor = order.primaryLaceColor || order.lacePrimary || "";
  const secondaryLaceColor = order.secondaryLaceColor || order.laceAccent || "";
  const customColorRequest = order.customColorRequest || order.customLaceNotes || "";

  const customerSection = renderCollapsibleDetailSection(
    "customer",
    "Customer",
    summarizeCustomer(order),
    `
      <div class="detail-section-grid">
        ${renderFieldLike("Order #", order.orderNumber || "")}
        ${renderFieldLike("Customer", order.customerName || "")}
        ${renderPhoneInput("Phone", "editPhoneNumber", order.phoneNumber || "")}
        ${renderFieldLike("Email", order.emailAddress || "")}
        <div class="detail-block">
          <div class="label">Social Tag</div>
          <input id="editSocialTag" type="text" value="${escapeAttr(order.socialTag || "")}" />
        </div>
        ${renderReferralSourceEditor(order.referralSource || "")}
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("customer", order) }
  );

  const orderStatusSection = renderCollapsibleDetailSection(
    "orderStatus",
    "Order Status",
    summarizeOrderStatus(order),
    `
      <div class="detail-section-grid">
          <div class="detail-block">
            <div class="label">Status</div>
            <select id="editStatus">
               <option value="Received">Received</option>
               <option value="Estimate Sent">Estimate Sent</option>
               <option value="Customer Approved">Customer Approved</option>
               <option value="Pending Response">Pending Response</option>
               <option value="In Transit to Me">In Transit to Me</option>
               <option value="In Progress">In Progress</option>
               <option value="Waiting on Lace/Parts">Waiting Parts</option>
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

          ${renderStatusDelivery(order)}
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("orderStatus", order) }
  );

  const gloveDetailsSection = renderCollapsibleDetailSection(
    "gloveDetails",
    "Glove Details",
    summarizeGloveDetails(order),
    `
      <div class="detail-section-grid">
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
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("gloveDetails", order) }
  );

  const servicesSection = renderCollapsibleDetailSection(
    "services",
    "Services",
    summarizeServices(order),
    `
      <div class="detail-section-grid">
        ${renderServicesEditor(order.servicesRequested || "")}
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("services", order) }
  );

  const laceSection = renderCollapsibleDetailSection(
    "lace",
    "Lace",
    summarizeLace(order),
    `
      <div class="detail-section-grid">
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
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("lace", order) }
  );

  const shippingSection = renderCollapsibleDetailSection(
    "shipping",
    "Shipping",
    summarizeShipping(order),
    `
      <div class="detail-section-grid">
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
    `,
    {
      defaultExpanded: getDefaultSectionExpanded("shipping", order),
      sectionId: "editShippingSection",
      headerActionsHtml: renderShowOnMapControl(order),
      extraClass: isLocal ? "is-hidden" : ""
    }
  );

  const notesSection = renderCollapsibleDetailSection(
    "notes",
    "Notes",
    summarizeNotes(order),
    `
      <div class="detail-section-grid">
        <div class="detail-block full">
          <div class="label">Customer Notes</div>
          <textarea id="editGloveNotes" rows="2"></textarea>
        </div>

        <div class="detail-block full">
          <div class="label">Internal Notes</div>
          <textarea id="editInternalNotes" rows="2"></textarea>
        </div>
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("notes", order) }
  );

  orderDetail.innerHTML = `
    <div class="detail-form-shell">
      ${customerSection}
      ${orderStatusSection}
      ${gloveDetailsSection}
      ${servicesSection}
      ${laceSection}
      ${shippingSection}
      ${notesSection}
      ${renderPhotoGallery(order)}
      ${renderOrderActivity(order)}

      <div class="detail-delete-row">
        <button id="detailDeleteBtn" class="detail-delete-btn" type="button">Delete Order</button>
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

  wireOrderPhotoControls(order);
  wireOrderPhotoLightbox(order);

  wireDetailForm();
  wireStatusDeliveryControls(order);
  ensureDetailCollapseDelegation();
  wireDetailSectionSummaries();
  wireShowOnMapControl();
  loadOrderActivity(order.orderNumber);
}

function getBlankAdminOrder() {
  return {
    orderNumber: "",
    customerName: "",
    phoneNumber: "",
    emailAddress: "",
    socialTag: "",
    referralSource: "",
    status: "Received",
    paid: "Unpaid",
    priceQuoted: null,
    shippingCost: null,
    dateReceived: "",
    estimatedCompletion: "",
    dateCompleted: "",
    brandModel: "",
    gloveType: "",
    webType: "",
    servicesRequested: "",
    dropOffMethod: "Local Drop-Off",
    primaryLaceColor: "",
    secondaryLaceColor: "",
    customColorRequest: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    gloveNotes: "",
    internalNotes: "",
    smsOptIn: false
  };
}

function renderNewOrderForm() {
  detailMode = "new";
  currentOrder = null;
  const order = getBlankAdminOrder();
  if (detailTitle) {
    detailTitle.textContent = "New Order";
  }
  if (saveOrderBtn) {
    saveOrderBtn.textContent = "Create";
  }
  clearSaveStatus();

  orderDetail.innerHTML = `
    <div class="detail-form-shell">
      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Customer</h2>
        </div>

        <div class="detail-section-grid">
          <div class="detail-block">
            <div class="label">Customer Name</div>
            <input id="editCustomerName" type="text" autocomplete="name" required />
            <div id="customerLookupPopover" class="admin-customer-autocomplete" role="listbox" hidden></div>
          </div>
          ${renderPhoneInput("Phone", "editPhoneNumber", "")}
          <div class="detail-block">
            <div class="label">Email</div>
            <input id="editEmailAddress" type="email" autocomplete="email" />
          </div>
          <div class="detail-block">
            <div class="label">SMS Opt-In</div>
            <select id="editSmsOptIn">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div class="detail-block">
            <div class="label">Social Tag</div>
            <input id="editSocialTag" type="text" value="${escapeAttr(order.socialTag)}" />
          </div>
          ${renderReferralSourceEditor(order.referralSource)}
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Order Status</h2>
        </div>

        <div class="detail-section-grid">
          <div class="detail-block">
            <div class="label">Status</div>
            <select id="editStatus">
               <option value="Received">Received</option>
               <option value="Estimate Sent">Estimate Sent</option>
               <option value="Customer Approved">Customer Approved</option>
               <option value="Pending Response">Pending Response</option>
               <option value="In Transit to Me">In Transit to Me</option>
               <option value="In Progress">In Progress</option>
               <option value="Waiting on Lace/Parts">Waiting Parts</option>
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
              <option value="Unpaid" selected>Unpaid</option>
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
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Glove Details</h2>
        </div>

        <div class="detail-section-grid">
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
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Services</h2>
        </div>

        <div class="detail-section-grid">
          ${renderServicesEditor(order.servicesRequested)}
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Lace</h2>
        </div>

        <div class="detail-section-grid">
          ${renderLaceInput("Primary Lace Color", "editPrimaryLaceColor", "", "Choose")}
          ${renderLaceInput("Secondary / Accent Lace Color", "editSecondaryLaceColor", "", "Only if multi-colors wanted")}

          <div class="detail-block full">
            <div class="label">Custom Color Request</div>
            <textarea id="editCustomColorRequest" rows="1" placeholder="Don’t see your color? Describe it here."></textarea>
          </div>
        </div>
      </section>

      <div id="editShippingSection" class="detail-section is-hidden">
        <div class="detail-section-header">
          <h2>Shipping</h2>
        </div>

        <div class="detail-section-grid">
          <div class="detail-block full">
            <div class="label">Street Address</div>
            <input id="editStreetAddress" type="text" autocomplete="street-address" />
          </div>

          <div class="detail-block">
            <div class="label">City</div>
            <input id="editCity" type="text" autocomplete="address-level2" />
          </div>

          <div class="detail-block">
            <div class="label">State</div>
            <select id="editState">${stateOptions(order.state)}</select>
          </div>

          <div class="detail-block">
            <div class="label">Zip Code</div>
            <input id="editZipCode" type="text" inputmode="numeric" autocomplete="postal-code" />
          </div>
        </div>
      </div>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Notes</h2>
        </div>

        <div class="detail-section-grid">
          <div class="detail-block full">
            <div class="label">Customer Notes</div>
            <textarea id="editGloveNotes" rows="2"></textarea>
          </div>

          <div class="detail-block full">
            <div class="label">Internal Notes</div>
            <textarea id="editInternalNotes" rows="2"></textarea>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById("editStatus").value = order.status;
  document.getElementById("editDropOffMethod").value = order.dropOffMethod;
  wireDetailForm();
  wireNewOrderCustomerLookup();
}

function getOrderRecencyTime(order) {
  const candidates = [
    order.createdAt,
    order.updatedAt,
    order.dateReceived,
    order.timestampSubmitted
  ];

  for (const candidate of candidates) {
    const time = Date.parse(String(candidate || "").trim());
    if (!Number.isNaN(time)) return time;
  }

  return Number(String(order.orderNumber || "").replace(/[^\d]/g, "")) || 0;
}

function buildCustomerSuggestions() {
  const suggestions = [];
  const seenEmails = new Set();
  const seenPhones = new Set();
  const seenNames = new Set();

  allOrders
    .slice()
    .sort((a, b) => getOrderRecencyTime(b) - getOrderRecencyTime(a))
    .forEach(order => {
      const email = normalizeText(order.emailAddress).toLowerCase();
      const phone = digitsOnly(order.phoneNumber);
      const name = normalizeText(order.customerName).toLowerCase();
      if (!email && !phone && !name) return;

      if (
        (email && seenEmails.has(email)) ||
        (phone && seenPhones.has(phone)) ||
        (!email && !phone && name && seenNames.has(name))
      ) {
        return;
      }

      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
      if (name) seenNames.add(name);
      suggestions.push(order);
    });

  return suggestions;
}

function customerMatchesQuery(order, query) {
  const q = normalizeText(query).toLowerCase();
  const qDigits = digitsOnly(query);
  if (!q && !qDigits) return false;

  const haystack = [
    order.customerName,
    order.emailAddress,
    order.city,
    order.state,
    order.orderNumber
  ].map(value => normalizeText(value).toLowerCase());

  const textMatch = q && haystack.some(value => value.includes(q));
  const phoneMatch = qDigits && digitsOnly(order.phoneNumber).includes(qDigits);
  return textMatch || phoneMatch;
}

function renderCustomerSuggestionRow(order, index, activeIndex) {
  const location = [order.city, order.state].map(normalizeText).filter(Boolean).join(", ");
  const contactBits = [
    formatPhoneForInput(order.phoneNumber || ""),
    order.emailAddress || "",
    location
  ].filter(Boolean);
  const meta = [
    order.orderNumber ? `#${order.orderNumber}` : "",
    order.dateReceived || order.createdAt || ""
  ].filter(Boolean).join(" · ");

  return `
    <button
      class="admin-customer-suggestion${index === activeIndex ? " is-active" : ""}"
      type="button"
      role="option"
      aria-selected="${index === activeIndex ? "true" : "false"}"
      data-customer-index="${index}"
    >
      <span class="admin-customer-suggestion-main">
        <span class="admin-customer-suggestion-name">${escapeHtml(order.customerName || "Unnamed customer")}</span>
        ${meta ? `<span class="admin-customer-suggestion-meta">${escapeHtml(meta)}</span>` : ""}
      </span>
      ${contactBits.length ? `<span class="admin-customer-suggestion-sub">${escapeHtml(contactBits.join(" · "))}</span>` : ""}
    </button>
  `;
}

function renderCustomerSuggestions() {
  const state = customerSuggestionState;
  if (!state?.popover) return;

  if (!state.matches.length) {
    state.popover.hidden = true;
    state.activeIndex = -1;
    return;
  }

  state.popover.innerHTML = state.matches
    .map((order, index) => renderCustomerSuggestionRow(order, index, state.activeIndex))
    .join("");
  state.popover.hidden = false;
}

function updateCustomerSuggestions(query) {
  if (!customerSuggestionState) return;

  const normalized = normalizeText(query);
  const qDigits = digitsOnly(query);
  if (normalized.length < 2 && qDigits.length < 3) {
    customerSuggestionState.matches = [];
    renderCustomerSuggestions();
    return;
  }

  customerSuggestionState.matches = buildCustomerSuggestions()
    .filter(order => customerMatchesQuery(order, query))
    .slice(0, 6);
  customerSuggestionState.activeIndex = customerSuggestionState.matches.length ? 0 : -1;
  renderCustomerSuggestions();
}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const nextValue = value || "";
  if (el.tagName === "SELECT" && nextValue && !Array.from(el.options).some(option => option.value === nextValue)) {
    el.add(new Option(nextValue, nextValue));
  }
  el.value = nextValue;
}

function selectCustomerSuggestion(order) {
  if (!order) return;

  setFieldValue("editCustomerName", order.customerName || "");
  setFieldValue("editPhoneNumber", formatPhoneForInput(order.phoneNumber || ""));
  setFieldValue("editEmailAddress", order.emailAddress || "");
  setFieldValue("editSmsOptIn", order.smsOptIn ? "true" : "false");
  setFieldValue("editSocialTag", order.socialTag || "");
  setFieldValue("editReferralSource", order.referralSource || "");

  const dropOffMethod = order.dropOffMethod || order.dropoffMethod || "Local Drop-Off";
  setFieldValue("editDropOffMethod", dropOffMethod);
  document.getElementById("editDropOffMethod")?.dispatchEvent(new Event("change"));

  if (!looksLocalDropOff({ dropOffMethod })) {
    setFieldValue("editStreetAddress", order.streetAddress || order.address || "");
    setFieldValue("editCity", order.city || "");
    setFieldValue("editState", order.state || "");
    setFieldValue("editZipCode", order.zipCode || order.zip || "");
  }

  if (customerSuggestionState?.popover) {
    customerSuggestionState.popover.hidden = true;
  }
  if (saveStatusEl) {
    saveStatusEl.textContent = "Customer info filled.";
  }
}

function clearNewOrderCustomerInfo() {
  [
    "editCustomerName",
    "editPhoneNumber",
    "editEmailAddress",
    "editSocialTag",
    "editStreetAddress",
    "editCity",
    "editState",
    "editZipCode"
  ].forEach(id => setFieldValue(id, ""));
  setFieldValue("editSmsOptIn", "false");
  setFieldValue("editReferralSource", "");
  setFieldValue("editDropOffMethod", "Local Drop-Off");
  document.getElementById("editDropOffMethod")?.dispatchEvent(new Event("change"));
  if (saveStatusEl) {
    saveStatusEl.textContent = "Customer info cleared.";
  }
}

function wireNewOrderCustomerLookup() {
  const nameInput = document.getElementById("editCustomerName");
  const phoneInput = document.getElementById("editPhoneNumber");
  const emailInput = document.getElementById("editEmailAddress");
  const popover = document.getElementById("customerLookupPopover");
  if (!nameInput || !phoneInput || !emailInput || !popover) return;

  customerSuggestionState = {
    popover,
    matches: [],
    activeIndex: -1
  };

  const searchableInputs = [nameInput, phoneInput, emailInput];
  searchableInputs.forEach(input => {
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "customerLookupPopover");
    input.addEventListener("input", () => updateCustomerSuggestions(input.value));
    input.addEventListener("focus", () => updateCustomerSuggestions(input.value));
    input.addEventListener("keydown", (e) => {
      const state = customerSuggestionState;
      if (!state || state.popover.hidden) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        state.activeIndex = Math.min(state.matches.length - 1, state.activeIndex + 1);
        renderCustomerSuggestions();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        state.activeIndex = Math.max(0, state.activeIndex - 1);
        renderCustomerSuggestions();
      } else if (e.key === "Enter" && state.activeIndex >= 0) {
        e.preventDefault();
        selectCustomerSuggestion(state.matches[state.activeIndex]);
      } else if (e.key === "Escape") {
        state.popover.hidden = true;
      }
    });
  });

  popover.addEventListener("pointerdown", e => {
    e.preventDefault();
  });

  popover.addEventListener("click", e => {
    const btn = e.target.closest("[data-customer-index]");
    if (!btn || !customerSuggestionState) return;
    selectCustomerSuggestion(customerSuggestionState.matches[Number(btn.dataset.customerIndex)]);
  });

  const clearBtn = document.createElement("button");
  clearBtn.className = "admin-customer-clear";
  clearBtn.type = "button";
  clearBtn.textContent = "Clear customer info";
  clearBtn.addEventListener("click", clearNewOrderCustomerInfo);
  popover.insertAdjacentElement("afterend", clearBtn);

  document.addEventListener("click", (e) => {
    if (detailMode !== "new" || !customerSuggestionState?.popover) return;
    if (customerSuggestionState.popover !== popover) return;
    if (popover.contains(e.target) || searchableInputs.some(input => input.contains(e.target))) return;
    customerSuggestionState.popover.hidden = true;
  });
}

function wireOrderPhotoControls(order) {
  const addBtn = document.getElementById("orderPhotoAddBtn");
  const input = document.getElementById("orderPhotoInput");

  addBtn?.addEventListener("click", () => {
    input?.click();
  });

  input?.addEventListener("change", async () => {
    const files = Array.from(input.files || []).filter(file => file.type.startsWith("image/"));
    input.value = "";
    if (!files.length) return;

    await uploadOrderPhotos(order, files);
  });

  document.querySelectorAll(".photo-thumb-img").forEach(img => {
    const index = Number(img.dataset.index);
    const url = order.glovePhotos?.[index];
    if (!url) return;

    img.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openOrderPhotoActionMenu(order, url, e);
    });

    img.addEventListener("selectstart", (e) => {
      e.preventDefault();
    });

    img.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      setAdminLongPressArmed(true);
      const touch = e.touches[0];
      orderPhotoPressStart = {
        x: touch.clientX,
        y: touch.clientY
      };
      orderPhotoPressTimer = window.setTimeout(() => {
        orderPhotoPressTimer = null;
        setAdminLongPressArmed(false);
        suppressPhotoLightboxUntil = Date.now() + 700;
        suppressNextAdminMenuActivation();
        openOrderPhotoActionMenu(order, url, e);
      }, 520);
    }, { passive: true });

    img.addEventListener("touchmove", (e) => {
      if (!orderPhotoPressStart || !e.touches.length) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - orderPhotoPressStart.x);
      const dy = Math.abs(touch.clientY - orderPhotoPressStart.y);
      if (dx > 10 || dy > 10) cancelOrderPhotoLongPress();
    }, { passive: true });

    img.addEventListener("touchend", cancelOrderPhotoLongPress, { passive: true });
    img.addEventListener("touchcancel", cancelOrderPhotoLongPress, { passive: true });
  });
}

function wireOrderPhotoLightbox(order) {
  const photos = Array.isArray(order.glovePhotos) ? order.glovePhotos : [];
  const lightbox = document.getElementById("photoLightbox");
  const lightboxImg = document.getElementById("lightboxImage");

  if (!photos.length || !lightbox || !lightboxImg) return;

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
    img.addEventListener("click", (e) => {
      if (Date.now() < suppressPhotoLightboxUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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

async function uploadOrderPhotos(order, files) {
  const addBtn = document.getElementById("orderPhotoAddBtn");
  const total = files.length;
  let uploaded = 0;
  let failed = 0;
  let latestPhotos = Array.isArray(order.glovePhotos) ? order.glovePhotos : [];

  if (addBtn) addBtn.disabled = true;
  setOrderPhotoStatus(`Uploading ${total} photo${total === 1 ? "" : "s"}...`);

  for (const file of files) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await postJson({
        action: "uploadOrderPhoto",
        orderNumber: order.orderNumber,
        filename: file.name,
        contentType: file.type || "image/jpeg",
        dataUrl
      }, true);

      uploaded += 1;
      latestPhotos = result.photos || result.order?.glovePhotos || latestPhotos;
      if (result.order) {
        mergeUpdatedOrder(result.order);
      }
      setOrderPhotoStatus(`Uploading... ${uploaded}/${total}`);
    } catch {
      failed += 1;
    }
  }

  const nextOrder = {
    ...(currentOrder || order),
    glovePhotos: latestPhotos
  };
  mergeUpdatedOrder(nextOrder);
  refreshOrderPhotoSection(nextOrder);
  loadOrderActivity(nextOrder.orderNumber);

  if (uploaded && failed) {
    setOrderPhotoStatus(`${uploaded} added, ${failed} failed.`);
  } else if (uploaded) {
    setOrderPhotoStatus(`${uploaded} photo${uploaded === 1 ? "" : "s"} added.`);
  } else {
    setOrderPhotoStatus("Upload failed.");
  }

  if (addBtn) addBtn.disabled = false;
}

function mergeUpdatedOrder(order) {
  if (!order) return;

  currentOrder = {
    ...(currentOrder || {}),
    ...order
  };

  const idx = allOrders.findIndex(item => String(item.orderNumber) === String(order.orderNumber));
  if (idx !== -1) {
    allOrders[idx] = {
      ...allOrders[idx],
      ...order
    };
  }
}

function refreshOrderPhotoSection(order) {
  const existingSection = document.getElementById("detailPhotoSection");
  if (!existingSection) return;

  if (!Object.prototype.hasOwnProperty.call(orderDetailCollapseState, "photos")) {
    orderDetailCollapseState.photos = !existingSection.classList.contains("is-collapsed");
  }

  const existingLightbox = document.getElementById("photoLightbox");
  const holder = document.createElement("div");
  holder.innerHTML = renderPhotoGallery(order);

  const nextSection = holder.querySelector("#detailPhotoSection");
  const nextLightbox = holder.querySelector("#photoLightbox");

  if (nextSection) existingSection.replaceWith(nextSection);
  if (existingLightbox && nextLightbox) {
    existingLightbox.replaceWith(nextLightbox);
  } else if (nextLightbox) {
    nextSection?.insertAdjacentElement("afterend", nextLightbox);
  }

  const expanded = getSectionExpanded("photos", getDefaultSectionExpanded("photos", order));
  const section = document.getElementById("detailPhotoSection");
  const toggle = section?.querySelector("[data-section-toggle='photos']");
  section?.classList.toggle("is-collapsed", !expanded);
  toggle?.setAttribute("aria-expanded", expanded ? "true" : "false");
  updateDetailSectionSummary("photos", order);

  wireOrderPhotoControls(order);
  wireOrderPhotoLightbox(order);
}

function setOrderPhotoStatus(message) {
  const status = document.getElementById("orderPhotoStatus");
  if (status) status.textContent = message || "";
}

function cancelOrderPhotoLongPress() {
  if (orderPhotoPressTimer) {
    window.clearTimeout(orderPhotoPressTimer);
    orderPhotoPressTimer = null;
  }
  setAdminLongPressArmed(false);
  orderPhotoPressStart = null;
}

function ensureOrderPhotoActionMenu() {
  if (orderPhotoActionMenuEl) return orderPhotoActionMenuEl;

  orderPhotoActionMenuEl = document.createElement("div");
  orderPhotoActionMenuEl.className = "admin-action-menu-root workflow-sheet-root order-photo-menu-root";
  orderPhotoActionMenuEl.innerHTML = `
    <div class="admin-action-backdrop workflow-backdrop"></div>
    <div class="admin-action-menu workflow-sheet" role="menu" aria-label="Photo actions">
      <div class="admin-action-section workflow-section">
        <div class="workflow-action-list">
          <button class="workflow-action-btn danger" type="button" data-photo-action="remove">Remove Photo</button>
        </div>
      </div>
    </div>
  `;

  getAdminMenuLayer().appendChild(orderPhotoActionMenuEl);
  orderPhotoActionMenuEl.querySelector(".workflow-backdrop")?.addEventListener("click", closeOrderPhotoActionMenu);
  orderPhotoActionMenuEl.querySelector("[data-photo-action='remove']")?.addEventListener("click", async (e) => {
    if (shouldSuppressAdminMenuActivation()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const order = orderPhotoActionMenuEl.order;
    const url = orderPhotoActionMenuEl.url;
    closeOrderPhotoActionMenu();
    await removeOrderPhoto(order, url);
  });
  return orderPhotoActionMenuEl;
}

function openOrderPhotoActionMenu(order, url, source) {
  const root = ensureOrderPhotoActionMenu();
  root.order = order;
  root.url = url;
  root.anchor = getAdminAnchorPosition(source, source?.currentTarget || source?.target);
  root.classList.add("open");
  requestAnimationFrame(() => {
    positionWorkflowMenu(root.querySelector(".workflow-sheet"), root.anchor);
  });
}

function closeOrderPhotoActionMenu() {
  if (!orderPhotoActionMenuEl) return;
  orderPhotoActionMenuEl.classList.remove("open");
  orderPhotoActionMenuEl.order = null;
  orderPhotoActionMenuEl.url = "";
}

async function removeOrderPhoto(order, url) {
  if (!order || !url) return;
  const ok = window.confirm("Remove this photo from the order?");
  if (!ok) return;

  try {
    setOrderPhotoStatus("Removing photo...");
    const result = await postJson({
      action: "removeOrderPhoto",
      orderNumber: order.orderNumber,
      url
    }, true);

    const nextOrder = {
      ...(currentOrder || order),
      ...(result.order || {}),
      glovePhotos: result.photos || result.order?.glovePhotos || []
    };
    mergeUpdatedOrder(nextOrder);
    refreshOrderPhotoSection(nextOrder);
    loadOrderActivity(nextOrder.orderNumber);
    setOrderPhotoStatus("Photo removed.");
  } catch (err) {
    setOrderPhotoStatus(err.message || "Remove failed.");
  }
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

    updateDetailSectionSummary("gloveDetails");
    updateDetailSectionSummary("orderStatus");
    updateDetailSectionSummary("shipping");
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
  resetAdminScroll(detailView);
}

function setStatusDeliveryMessage(message, type = "") {
  const el = document.getElementById("statusDeliveryMessage");
  if (!el) return;
  el.textContent = message || "";
  el.dataset.type = type;
}

function refreshStatusDelivery(order, message = "", type = "") {
  const block = document.getElementById("statusDeliveryBlock");
  if (!block) return;
  block.outerHTML = renderStatusDelivery(order);
  wireStatusDeliveryControls(order);
  setStatusDeliveryMessage(message, type);
}

async function resendCurrentStatus(kind, order) {
  const activeOrder = currentOrder || order;
  if (!activeOrder?.orderNumber) return;

  const isEmail = kind === "email";
  const confirmMessage = isEmail
    ? "Send current status email again?"
    : "Send current status text again?";

  if (!window.confirm(confirmMessage)) return;

  const button = document.getElementById(isEmail ? "resendStatusEmailBtn" : "resendStatusTextBtn");
  if (button) button.disabled = true;
  setStatusDeliveryMessage(isEmail ? "Sending email..." : "Sending text...", "pending");

  try {
    const data = await postJson({
      action: isEmail ? "resendStatusEmail" : "resendStatusText",
      orderNumber: activeOrder.orderNumber
    }, true);

    const updated = data.order;
    if (!updated) {
      throw new Error("Resend succeeded, but no updated order was returned.");
    }

    mergeUpdatedOrder(updated);
    localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
    refreshStatusDelivery(updated, isEmail ? "Status email sent." : "Status text sent.", "success");
    loadOrderActivity(updated.orderNumber);
  } catch (err) {
    setStatusDeliveryMessage(err.message || "Unable to resend status.", "error");
    if (button) button.disabled = false;
  }
}

function wireStatusDeliveryControls(order) {
  document.getElementById("resendStatusEmailBtn")?.addEventListener("click", () => {
    resendCurrentStatus("email", order);
  });

  document.getElementById("resendStatusTextBtn")?.addEventListener("click", () => {
    resendCurrentStatus("text", order);
  });
}

function getAdminOrderFormPayload() {
  const dropOffMethod = val("editDropOffMethod");
  const isLocal = looksLocalDropOff({ dropOffMethod });
  const gloveType = val("editGloveType");
  const webType = gloveType === "Fielders Glove" ? val("editWebType") : "";
  const parsedPrice = parseMoneyInput(val("editPriceQuoted"));

  const payload = {
    customerName: val("editCustomerName"),
    phoneNumber: formatPhoneForInput(val("editPhoneNumber")),
    emailAddress: val("editEmailAddress"),
    smsOptIn: val("editSmsOptIn") === "true",
    status: val("editStatus") || "Received",
    paid: val("editPaid") || "Unpaid",
    priceQuoted: parsedPrice === "" ? null : parsedPrice,
    dateReceived: emptyToNull(val("editDateReceived")),
    estimatedCompletion: emptyToNull(val("editEstimatedCompletion")),
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
    streetAddress: isLocal ? null : emptyToNull(val("editStreetAddress")),
    city: isLocal ? null : emptyToNull(val("editCity")),
    state: isLocal ? null : emptyToNull(val("editState")),
    zipCode: isLocal ? null : emptyToNull(val("editZipCode"))
  };

  return payload;
}

function validateNewOrderPayload(payload) {
  if (!payload.customerName) {
    return "Customer name is required.";
  }

  if (!payload.phoneNumber && !payload.emailAddress) {
    return "Add a phone number or email.";
  }

  if (payload.smsOptIn && !payload.phoneNumber) {
    return "Phone is required when SMS opt-in is enabled.";
  }

  if (!looksLocalDropOff({ dropOffMethod: payload.dropOffMethod })) {
    if (!payload.streetAddress || !payload.city || !payload.state || !payload.zipCode) {
      return "Shipping orders need street, city, state, and zip.";
    }
  }

  return "";
}

async function createNewOrderFromForm() {
  if (!saveStatusEl) return;

  const payload = getAdminOrderFormPayload();
  const validationMessage = validateNewOrderPayload(payload);
  if (validationMessage) {
    saveStatusEl.textContent = validationMessage;
    return;
  }

  saveStatusEl.textContent = "Creating...";

  const data = await postJson({
    action: "createOrder",
    order: payload
  }, true);

  if (!data.order) {
    throw new Error("Order created, but no order was returned.");
  }

  const created = data.order;
  mergeUpdatedOrder(created);
  localStorage.setItem("mm_orders_cache", JSON.stringify(allOrders));
  applyFilters();
  openOrder(created.orderNumber);
  if (saveStatusEl) {
    saveStatusEl.textContent = "Created.";
  }
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
  "vintage chestnut": "#6f3a1f",
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

function getInventoryQuantity(item) {
  return Number(item.quantity_on_hand ?? 0);
}

function getInventoryReorderAt(item) {
  return Number(item.reorder_at ?? item.reorder_threshold ?? 0);
}

function inventoryAlertEnabled(item) {
  if (item.reorder_alert_enabled === false) return false;
  return getInventoryReorderAt(item) !== -1;
}

function getInventoryStatus(item) {
  const qty = getInventoryQuantity(item);
  const reorderAt = getInventoryReorderAt(item);

  if (!inventoryAlertEnabled(item)) {
    return {
      key: "ignore",
      label: "Ignore",
      note: "No alert"
    };
  }

  if (qty === 0) {
    return {
      key: "out",
      label: "Out",
      note: "Reorder"
    };
  }

  if (qty <= reorderAt) {
    return {
      key: "low",
      label: "Low",
      note: "Reorder"
    };
  }

  return {
    key: "ok",
    label: "OK",
    note: "Stocked"
  };
}

function inventoryNeedsOrder(item) {
  const status = getInventoryStatus(item);
  return status.key === "low" || status.key === "out";
}

function renderInventorySwatch(colorName) {
  const swatchColor = getLaceColor(colorName);
  const isCustom = swatchColor === "linear";
  const style = isCustom ? "" : `style="background:${escapeAttr(swatchColor)}"`;

  return `
    <span
      class="inventory-swatch ${isCustom ? "inventory-swatch-custom" : ""}"
      ${style}
      aria-hidden="true"
    >${isCustom ? "?" : ""}</span>
  `;
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
  workflowSheetEl.anchor = getAdminAnchorPosition(source, source?.currentTarget);
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
  form.classList.remove("is-submenu");
  workflowSheetEl.querySelector(".workflow-sheet-title").textContent = "Workflow actions";
  workflowSheetEl.classList.remove("workflow-action-selected", "workflow-form-compact", "workflow-form-small", "workflow-form-large");
  workflowSheetEl.classList.add("open");
  document.body.classList.add("workflow-open");
  document.addEventListener("keydown", handleWorkflowMenuKeydown);
  requestAnimationFrame(() => {
    positionWorkflowMenu(workflowSheetEl.querySelector(".workflow-sheet"), workflowSheetEl.anchor);
  });

  actions.querySelectorAll(".workflow-action-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      if (!isDesktopHoverMenu()) return;
      openWorkflowActionForm(order, btn.dataset.action, { button: btn });
    });
  });
}

function closeWorkflowSheet() {
  if (!workflowSheetEl) return;
  workflowSuppressOpeningTouch = false;
  clearWorkflowOpeningTouchTimer();
  document.removeEventListener("touchend", consumeWorkflowOpeningTouchEnd, true);
  document.removeEventListener("keydown", handleWorkflowMenuKeydown);
  workflowSheetEl.classList.remove("open");
  workflowSheetEl.classList.remove("workflow-action-selected", "workflow-form-compact", "workflow-form-small", "workflow-form-large");
  workflowSheetEl.querySelector(".workflow-action-list").innerHTML = "";
  workflowSheetEl.querySelector(".workflow-sheet-form").innerHTML = "";
  workflowSheetEl.querySelector(".workflow-sheet-form").classList.remove("is-submenu");
  document.body.classList.remove("workflow-open");
}

function closeWorkflowMenu() {
  closeWorkflowSheet();
}

function getAdminMenuLayer() {
  if (adminMenuLayer) return adminMenuLayer;

  adminMenuLayer = document.createElement("div");
  adminMenuLayer.className = "admin-menu-layer";
  document.body.appendChild(adminMenuLayer);
  return adminMenuLayer;
}

function createWorkflowSheet() {
  workflowSheetEl = document.createElement("div");
  workflowSheetEl.className = "admin-action-menu-root workflow-sheet-root";
  workflowSheetEl.innerHTML = `
    <div class="admin-action-backdrop workflow-backdrop"></div>
    <div class="admin-action-menu workflow-sheet" role="menu" aria-label="Workflow actions">
      <div class="admin-action-header workflow-sheet-header">
        <div>
          <div class="workflow-customer-name"></div>
          <div class="workflow-order-number"></div>
          <div class="workflow-current-status"></div>
        </div>
        <button class="workflow-close-btn" type="button" aria-label="Close">✕</button>
      </div>
      <div class="admin-action-section workflow-section">
        <div class="workflow-sheet-title">Workflow actions</div>
        <div class="admin-action-list workflow-action-list"></div>
      </div>
      <div class="admin-action-form-panel workflow-sheet-form"></div>
    </div>
  `;

  workflowSheetEl.querySelector(".workflow-backdrop").addEventListener("click", closeWorkflowSheet);
  workflowSheetEl.querySelector(".workflow-close-btn").addEventListener("click", closeWorkflowSheet);

  workflowSheetEl.addEventListener("click", (e) => {
    const actionBtn = e.target.closest(".workflow-action-btn");
    if (actionBtn) {
      if (shouldSuppressAdminMenuActivation()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openWorkflowActionForm(workflowSheetEl.order, actionBtn.dataset.action, { button: actionBtn });
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

  getAdminMenuLayer().appendChild(workflowSheetEl);
}

function handleWorkflowMenuKeydown(e) {
  if (e.key !== "Escape") return;
  closeWorkflowMenu();
}

function getAdminAnchorPosition(event, element) {
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

function getMenuAnchorPosition(event, element) {
  return getAdminAnchorPosition(event, element);
}

function clampAdminFloatingPanel(panel, anchor, options = {}) {
  if (!panel || !anchor) return;

  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.right = "auto";
  panel.style.bottom = "auto";

  const margin = options.margin ?? 12;
  const rect = panel.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const preferTouchMenu = window.matchMedia("(pointer: coarse)").matches;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? (preferTouchMenu ? 10 : 2);

  const left = Math.min(Math.max(margin, anchor.x + offsetX), maxLeft);
  const top = Math.min(Math.max(margin, anchor.y + offsetY), maxTop);

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function positionWorkflowMenu(menu, anchor) {
  clampAdminFloatingPanel(menu, anchor);
}

function positionAdminFilterPopover(popover, toggle) {
  if (!popover || !toggle || popover.hidden) return;

  const rect = toggle.getBoundingClientRect();
  const anchor = {
    x: rect.right,
    y: rect.bottom + 8
  };

  popover.style.left = "0px";
  popover.style.top = "0px";
  popover.style.right = "auto";
  popover.style.bottom = "auto";

  const margin = 12;
  const popoverRect = popover.getBoundingClientRect();
  const left = Math.min(
    Math.max(margin, anchor.x - popoverRect.width),
    Math.max(margin, window.innerWidth - popoverRect.width - margin)
  );
  const top = Math.min(
    Math.max(margin, anchor.y),
    Math.max(margin, window.innerHeight - popoverRect.height - margin)
  );

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function isDesktopHoverMenu() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function getActionButtonKey(button) {
  return button?.dataset?.action || button?.dataset?.inventoryAction || "";
}

function buildStorePhotoActionSelectOptions(photo) {
  const isPrimary = !!photo.is_primary;
  const isHover = !isPrimary && !!photo.is_hover;
  const placeholderSelected = !isPrimary && !isHover;

  return `
    <option value="" disabled hidden${placeholderSelected ? " selected" : ""}>${ADMIN_PHOTO_ACTION_PLACEHOLDER_LABEL}</option>
    <option value="primary"${isPrimary ? " selected" : ""}>Primary</option>
    <option value="hover"${isHover ? " selected" : ""}>Hover</option>
    <option value="delete">Delete</option>
  `;
}

function buildGalleryPhotoActionSelectOptions(photo) {
  const toggleAction = photo.hidden ? "restore" : "hide";
  const toggleLabel = photo.hidden ? "Restore" : "Hide";

  return `
    <option value="" disabled hidden selected>${ADMIN_PHOTO_ACTION_PLACEHOLDER_LABEL}</option>
    <option value="view">View</option>
    <option value="${toggleAction}">${toggleLabel}</option>
    <option value="delete">Delete</option>
  `;
}

function resetAdminPhotoActionSelect(select) {
  if (!select) return;
  let placeholder = select.querySelector('option[value=""]');
  if (!placeholder) {
    select.insertAdjacentHTML("afterbegin", ADMIN_PHOTO_ACTION_PLACEHOLDER);
    placeholder = select.querySelector('option[value=""]');
  }
  const placeholderIndex = Array.from(select.options).indexOf(placeholder);
  if (placeholderIndex >= 0) {
    select.selectedIndex = placeholderIndex;
  }
}

function syncStorePhotoActionSelect(select) {
  if (!select) return;
  if (select.dataset.isPrimary === "true") {
    select.value = "primary";
    return;
  }
  if (select.dataset.isHover === "true") {
    select.value = "hover";
    return;
  }
  resetAdminPhotoActionSelect(select);
}

function isAdminPhotoActionValue(value, allowedActions) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ADMIN_PHOTO_PLACEHOLDER_VALUES.has(normalized)) return false;
  return allowedActions.has(normalized);
}

function bindAdminPhotoActionSelect(select, { allowedActions, restore, onAction }) {
  if (!select || select.dataset.actionSelectBound === "true") return;
  select.dataset.actionSelectBound = "true";

  let valueBeforeOpen = select.value;

  const captureOpenValue = () => {
    valueBeforeOpen = select.value;
  };

  select.addEventListener("mousedown", captureOpenValue);
  select.addEventListener("touchstart", captureOpenValue, { passive: true });
  select.addEventListener("focus", captureOpenValue);

  select.addEventListener("change", async () => {
    const actionValue = String(select.value || "").trim().toLowerCase();
    const previousValue = String(valueBeforeOpen || "").trim().toLowerCase();

    if (!isAdminPhotoActionValue(actionValue, allowedActions)) {
      restore(select);
      return;
    }

    if (actionValue === previousValue) {
      restore(select);
      return;
    }

    try {
      await onAction(actionValue, select);
    } catch (err) {
      restore(select);
      throw err;
    }
  });
}

function getWorkflowFormSize(actionKey) {
  const compact = new Set([
    "customerApproved",
    "pendingResponse",
    "inTransitToMe",
    "markPaid"
  ]);
  const large = new Set([
    "readyToGo",
    "completed"
  ]);

  if (compact.has(actionKey)) return "compact";
  if (large.has(actionKey)) return "large";
  return "small";
}

function getInventoryFormSize(action) {
  if (action === "add") return "large";
  if (action === "set") return "compact";
  return "small";
}

function openAdminActionSubmenu(root, button, html, options = {}) {
  const form = root?.querySelector(".workflow-sheet-form");
  if (!root || !form || !button) return;

  const actionKey = getActionButtonKey(button);
  const desktopMenu = isDesktopHoverMenu();

  if (options.assignActionKey) {
    root.actionKey = actionKey;
  }

  root.classList.remove("workflow-form-compact", "workflow-form-small", "workflow-form-large");
  root.classList.add(`workflow-form-${options.formSize || "small"}`);
  root.classList.add("workflow-action-selected");
  root.querySelectorAll(".workflow-action-btn").forEach((actionBtn) => {
    const active = getActionButtonKey(actionBtn) === actionKey;
    actionBtn.hidden = !desktopMenu && !active;
    actionBtn.classList.toggle("active", active);
  });

  form.classList.remove("is-submenu");
  form.style.left = "";
  form.style.top = "";
  form.style.right = "";
  form.style.bottom = "";
  form.innerHTML = html;

  requestAnimationFrame(() => {
    if (desktopMenu) {
      positionActionSubmenu(root, button);
    } else {
      positionWorkflowMenu(root.querySelector(".workflow-sheet"), root.anchor);
    }
  });
}

function suppressNextAdminMenuActivation(duration = 700) {
  adminMenuTapSuppressUntil = Date.now() + duration;
}

function shouldSuppressAdminMenuActivation() {
  return Date.now() < adminMenuTapSuppressUntil;
}

function setAdminLongPressArmed(armed) {
  document.body.classList.toggle("admin-longpress-armed", armed);
}

function positionActionSubmenu(root, activeButton) {
  const form = root?.querySelector(".workflow-sheet-form");
  if (!form) return;

  form.classList.remove("is-submenu");
  form.style.left = "";
  form.style.top = "";
  form.style.right = "";
  form.style.bottom = "";

  if (!isDesktopHoverMenu() || !activeButton || !form.innerHTML.trim()) return;

  form.classList.add("is-submenu");
  const buttonRect = activeButton.getBoundingClientRect();
  const menuRect = root.querySelector(".workflow-sheet")?.getBoundingClientRect();
  if (!menuRect) return;

  const margin = 12;
  const gap = 8;
  const formRect = form.getBoundingClientRect();
  const width = formRect.width || 292;
  const height = formRect.height || 140;
  const canOpenRight = buttonRect.right + gap + width <= window.innerWidth - margin;
  const viewportLeft = canOpenRight
    ? buttonRect.right + gap
    : Math.max(margin, buttonRect.left - width - gap);
  const viewportTop = Math.min(
    Math.max(margin, buttonRect.top),
    Math.max(margin, window.innerHeight - height - margin)
  );

  const left = viewportLeft - menuRect.left;
  const top = viewportTop - menuRect.top;

  form.style.left = `${left}px`;
  form.style.top = `${top}px`;
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
    add("waitingOnLaceParts", "Waiting Parts");
    add("startWork", "Start Work");
    add("onHold", "On Hold");
  } else if (status === "in transit to me") {
    add("waitingOnLaceParts", "Waiting Parts");
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
    add("waitingOnLaceParts", "Waiting Parts");
    add("startWork", "Start Work");
  } else if (status === "ready to go") {
    add("completed", "Completed");
  }

  if (normalizeText(order.paid) !== "paid") {
    add("markPaid", "Mark as Paid");
  }
  return actions;
}

function openWorkflowActionForm(order, actionKey, options = {}) {
  const activeButton = options.button || Array.from(workflowSheetEl.querySelectorAll(".workflow-action-btn"))
    .find(button => button.dataset.action === actionKey);
  const isLocal = looksLocalDropOff(order);
  const existingNote = order.internalNotes || "";
  const priceQuoted = order.priceQuoted ?? "";
  const dateReceived = order.dateReceived || todayForInput();
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
        <label>Date Received</label>
        <input id="workflowDateReceived" type="date" required value="${escapeAttr(dateReceived)}" />
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

  const formSize = getWorkflowFormSize(actionKey);

  openAdminActionSubmenu(workflowSheetEl, activeButton, `
    <div class="workflow-form-content">
      ${inner}
      <div class="workflow-form-actions">
        <button class="secondary workflow-form-cancel" type="button">Cancel</button>
        <button class="primary workflow-form-submit" type="button">Save</button>
      </div>
    </div>
  `, { assignActionKey: true, formSize });
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
    updates.dateReceived = document.getElementById("workflowDateReceived")?.value || todayForInput();
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
  setAdminLongPressArmed(true);
  const anchor = getMenuAnchorPosition(e, e.currentTarget);
  workflowPressTimer = setTimeout(() => {
    clearTextSelection();
    setAdminLongPressArmed(false);
    suppressNextOrderCardClick(800);
    suppressNextAdminMenuActivation();
    openWorkflowSheet(order, anchor, true);
  }, 500);
}

function cancelWorkflowPress() {
  if (workflowPressTimer) {
    clearTimeout(workflowPressTimer);
    workflowPressTimer = null;
  }
  setAdminLongPressArmed(false);
}

function clearTextSelection() {
  const selection = window.getSelection?.();
  if (selection && typeof selection.removeAllRanges === "function") {
    selection.removeAllRanges();
  }
}

function readAdminDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const view = String(params.get("view") || "").trim();
  const order = String(params.get("order") || "").trim();

  if (view === "map" && order) {
    mapFocusOrderNumber = order;
    mapFocusHandled = false;
    return "map";
  }

  if (["current", "map", "inventory", "upload", "gloves-sale"].includes(view)) {
    return view;
  }

  return null;
}

function updateAdminMapDeepLink(orderNumber) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "map");
  if (orderNumber) {
    url.searchParams.set("order", String(orderNumber));
  } else {
    url.searchParams.delete("order");
  }
  window.history.replaceState({}, "", url);
}

function clearAdminMapDeepLinkOrder() {
  const url = new URL(window.location.href);
  url.searchParams.delete("order");
  window.history.replaceState({}, "", url);
}

function hasOrderMapCoordinates(order) {
  const lat = Number(order?.mapLat);
  const lng = Number(order?.mapLng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function mapAddressHasStreet(address) {
  const value = String(address || "").trim();
  if (!value) return false;
  if (/^\d+\s+\S/.test(value)) return true;
  return /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place|cir|circle|hwy|highway|pkwy|parkway|trl|trail|pike|run|pass|cove|loop)\b/i.test(value);
}

function mapStreetTokens(streetAddress) {
  const cleaned = String(streetAddress || "")
    .replace(/\b(?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|#)\s*[\w-]+.*$/i, "")
    .replace(/[.,;]+/g, " ")
    .trim()
    .toLowerCase();

  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .filter(token => token && !/^\d+$/.test(token) && token.length > 2)
    .slice(0, 3);
}

function mapStreetAppearsInGeocodedText(streetAddress, geocodedText) {
  const tokens = mapStreetTokens(streetAddress);
  if (!tokens.length) return true;
  const haystack = String(geocodedText || "").toLowerCase();
  return tokens.some(token => haystack.includes(token));
}

function isMapCityStateZipOnlyAddress(address) {
  const value = String(address || "").trim();
  return /^[^,]+,\s*[A-Za-z]{2}\s+\d{5}(?:-\d{4})?$/.test(value);
}

function deriveMapGeocodeQuality(order) {
  const street = String(order?.streetAddress || order?.address || "").trim();
  const geocoded = String(order?.mapGeocodedAddress || "").trim();
  const source = String(order?.mapGeocodeSource || "").trim().toLowerCase();

  if (order?.mapGeocodeStatus === "failed" || !hasOrderMapCoordinates(order)) {
    return "failed";
  }

  if (geocoded && isMapCityStateZipOnlyAddress(geocoded)) {
    return "approximate";
  }

  if (street && mapAddressHasStreet(street) && geocoded && !mapStreetAppearsInGeocodedText(street, geocoded)) {
    return "approximate";
  }

  if (source === "nominatim" && street && mapAddressHasStreet(street) && geocoded) {
    return mapStreetAppearsInGeocodedText(street, geocoded) ? "exact" : "approximate";
  }

  return "exact";
}

function getMapGeocodeQuality(order) {
  if (!order) return "failed";

  const stored = String(order.mapGeocodeQuality || "").trim().toLowerCase();
  if (stored === "exact" || stored === "approximate" || stored === "failed") {
    return stored;
  }

  return deriveMapGeocodeQuality(order);
}

function getMapFocusZoom(quality) {
  if (quality === "exact") return 14;
  if (quality === "approximate") return 11;
  return 13;
}

function canShowOrderOnMap(order) {
  if (!order || !hasOrderMapCoordinates(order)) return false;
  if (String(order.mapGeocodeStatus || "").trim().toLowerCase() === "failed") return false;

  const currentHash = buildMapAddressHash(order);
  const storedHash = String(order.mapAddressHash || "").trim();
  if (storedHash && storedHash !== currentHash) return false;

  return true;
}

function renderShowOnMapControl(order) {
  if (!canShowOrderOnMap(order)) return "";

  return `<button type="button" class="detail-show-on-map-link" data-show-on-map="${escapeAttr(order.orderNumber || "")}">Show on Map</button>`;
}

function wireShowOnMapControl() {
  orderDetail?.querySelectorAll("[data-show-on-map]").forEach(button => {
    if (button.dataset.showOnMapBound === "1") return;
    button.dataset.showOnMapBound = "1";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const orderNumber = button.dataset.showOnMap;
      if (orderNumber) openOrderOnAdminMap(orderNumber);
    });
  });
}

function openOrderOnAdminMap(orderNumber) {
  mapFocusOrderNumber = String(orderNumber || "").trim();
  mapFocusHandled = false;
  updateAdminMapDeepLink(mapFocusOrderNumber);
  setActiveView("map");
}

function focusMapOnOrder(orderNumber) {
  const marker = orderMapMarkerByNumber.get(String(orderNumber || "").trim());
  if (!marker || !orderMap) return false;

  const order = allOrders.find(item => String(item.orderNumber) === String(orderNumber));
  const quality = getMapGeocodeQuality(order);
  const zoom = getMapFocusZoom(quality);

  orderMap.setView(marker.getLatLng(), zoom, { animate: true });
  marker.openPopup();
  return true;
}

function tryFocusMapOrder() {
  if (!mapFocusOrderNumber || mapFocusHandled) return;

  const focused = focusMapOnOrder(mapFocusOrderNumber);
  if (focused) {
    mapFocusHandled = true;
    clearAdminMapDeepLinkOrder();
  }
}

async function renderMapView() {
  const token = ++mapRenderToken;

  if (!mapView || !orderMapEl) return;

  setMapStatus("");
  if (mapCount) mapCount.textContent = "Customer reach";
  renderUnmappedAddresses([]);

  if (!window.L) {
    setMapStatus("Map could not load.", "warning");
    return;
  }

  const orders = getMappableOrders();

  if (!orders.length) {
    initOrderMap();
    orderMapMarkers.clearLayers();
    setMapStatus("No shipped addresses found.", "warning");
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
    geocodeResults = await geocodeMissingMapAddresses(needsGeocode, token);
    if (token !== mapRenderToken) return;
  }

  const finalItems = getMappableOrders()
    .map(applyStoredMapLocation)
    .map(item => applyTransientMapGeocodeResult(item, geocodeResults))
    .map(applyLocalMapCacheFallback);
  const mapWarningBeforeFinal = mapStatus && !mapStatus.hidden
    ? mapStatus.textContent
    : "";
  const finalRender = renderOrderMapMarkers(finalItems, token, {
    total: finalItems.length
  });

  if (mapWarningBeforeFinal && finalRender && !finalRender.failures.length) {
    setMapStatus(mapWarningBeforeFinal, "warning");
  }

  tryFocusMapOrder();
}

function setMapStatus(message, tone = "") {
  if (!mapStatus) return;

  const text = String(message || "").trim();
  mapStatus.textContent = text;
  mapStatus.hidden = !text;
  mapStatus.classList.toggle("map-status-warning", !!text && tone === "warning");
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
    source: item.storedGeocodeSource || "stored",
    quality: getMapGeocodeQuality(item.order)
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
    if (token === mapRenderToken) {
      setMapStatus(`Geocoding failed. ${err.message || "Using saved locations."}`, "warning");
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
  orderMapMarkerByNumber.clear();

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
      const quality = item.mapLocation.quality || getMapGeocodeQuality(item.order);
      marker.bindPopup(renderMapPopup(item.order, item.mapLocation.address || item.address, quality));
      marker.addTo(orderMapMarkers);
      orderMapMarkerByNumber.set(String(item.order.orderNumber || "").trim(), marker);

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

  if (bounds.length === 1 && !mapFocusOrderNumber) {
    const singleItem = items.find(item => item.mapLocation?.coords);
    const quality = singleItem?.mapLocation?.quality || getMapGeocodeQuality(singleItem?.order);
    orderMap.setView(bounds[0], getMapFocusZoom(quality));
  } else if (bounds.length > 1 && !mapFocusOrderNumber) {
    orderMap.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 10
    });
  }

  if (updateStatus) {
    setMapStatus(getMapStatusText(mapped, total, failures.length), failures.length ? "warning" : "");
  }
  if (mapCount) {
    mapCount.textContent = `${mapped} mapped`;
  }
  renderUnmappedAddresses(failures);
  return { mapped, failures };
}

function getMapPopupStatusToneClass(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "on hold") return "map-popup-status-on-hold";
  return "";
}

function renderMapPopupMeta(order) {
  const orderNumber = String(order.orderNumber || "").trim();
  const statusLabel = String(getOrderStatusDisplay(order.status) || "").trim();
  const statusClass = statusLabel ? getMapPopupStatusToneClass(order.status) : "";

  if (orderNumber && statusLabel) {
    return `Order #${escapeHtml(orderNumber)} · <span class="map-popup-status${statusClass ? ` ${statusClass}` : ""}">${escapeHtml(statusLabel)}</span>`;
  }

  if (orderNumber) {
    return `Order #${escapeHtml(orderNumber)}`;
  }

  if (statusLabel) {
    return `<span class="map-popup-status${statusClass ? ` ${statusClass}` : ""}">${escapeHtml(statusLabel)}</span>`;
  }

  return "";
}

function renderMapPopup(order, address, quality = "") {
  const location = getMapPopupLocation(order, address);
  const metaHtml = renderMapPopupMeta(order);
  const resolvedQuality = quality || getMapGeocodeQuality(order);
  const approximateNote = resolvedQuality === "approximate"
    ? `<div class="map-popup-approximate">Approximate location</div>`
    : "";

  return `
    <div class="map-popup">
      <div class="map-popup-head">
        <div>
          <div class="map-popup-name">${escapeHtml(order.customerName || "Customer")}</div>
          ${metaHtml ? `<div class="map-popup-meta">${metaHtml}</div>` : ""}
        </div>
      </div>
      ${location ? `<div class="map-popup-location">${escapeHtml(location)}</div>` : ""}
      ${approximateNote}
      <button class="map-popup-btn" type="button" data-map-order="${escapeAttr(order.orderNumber || "")}">View Order</button>
    </div>
  `;
}

function getMapPopupLocation(order, fallbackAddress) {
  const city = String(order.city || "").trim();
  const state = String(order.state || "").trim();

  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;

  return String(fallbackAddress || "").trim();
}

function getMapStatusText(mapped, total, unmapped) {
  if (unmapped) {
    return `${unmapped} address${unmapped === 1 ? "" : "es"} could not be mapped.`;
  }

  if (!total) {
    return "No shipped addresses found.";
  }

  return "";
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
    `<div class="store-empty-state">Loading gloves...</div>`;

  try {
    const data = await postJson({
      action: "listSaleGloves"
    }, true);

    const gloves = data.gloves || [];

    saleGlovesCount.textContent =
      `${gloves.length} listing${gloves.length === 1 ? "" : "s"}`;

    if (!gloves.length) {
      saleGlovesList.innerHTML = `
        <div class="store-empty-state">
          <strong>No gloves listed.</strong>
          <span>Add a glove when one is ready for the site.</span>
          <button class="secondary store-empty-add" type="button">+ Add</button>
        </div>
      `;

      saleGlovesList.querySelector(".store-empty-add")?.addEventListener("click", () => {
        renderSaleGloveEditor(null);
      });
      resetStoreScrollSoon();
      return;
    }

    saleGlovesList.innerHTML = `
      <div class="sale-gloves-list">
        ${gloves.map(glove => {
          const status = getSaleGloveStatus(glove.status);
          const meta = getSaleGloveMeta(glove);

          return `
            <button class="sale-glove-row"
                 type="button"
                 data-id="${escapeAttr(glove.id)}">
              <span class="sale-glove-row-main">
                <span class="sale-glove-title">${escapeHtml(glove.title || "Untitled glove")}</span>
                <span class="sale-status-pill sale-status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span>
              </span>

              <span class="sale-glove-row-meta">
                <span class="sale-glove-price">$${Number(glove.price || 0).toFixed(2)}</span>
                <span class="sale-glove-meta">${escapeHtml(meta || "Listing")}</span>
              </span>
            </button>
          `;
        }).join("")}
      </div>
    `;

    saleGlovesList
      .querySelectorAll(".sale-glove-row")
      .forEach(row => {
        row.addEventListener("click", async () => {
          const gloveId = row.dataset.id;

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

    resetStoreScrollSoon();

  } catch (err) {
    saleGlovesList.innerHTML =
      `<div class="store-empty-state">${escapeHtml(err.message)}</div>`;
    resetStoreScrollSoon();
  }
}

function getSaleGloveStatus(statusValue) {
  const status = String(statusValue || "available").trim().toLowerCase();

  if (status === "sold") {
    return { key: "sold", label: "Sold" };
  }

  if (status === "hidden" || status === "draft") {
    return { key: "draft", label: "Draft" };
  }

  return { key: "available", label: "Available" };
}

function getSaleGloveMeta(glove) {
  return [
    glove.gloveSize,
    glove.position,
    glove.throwHand
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
}

function resetStoreScrollSoon() {
  resetViewScroll(saleGlovesView, { blurActive: false });
}

function renderSaleGloveEditor(glove) {
  const isNew = !glove;

  saleGlovesList.innerHTML = `
    <div class="store-editor-panel">
      <div class="store-editor-card">
        <div class="upload-card-heading store-editor-header">
          <div>
            <h2>${isNew ? "Add Glove" : "Edit Glove"}</h2>
            <p class="muted">Create or update a glove listing.</p>
          </div>
        </div>

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
           <div class="store-photo-section">
             <div class="upload-card-heading store-photo-header">
               <div>
                 <h3>Photos</h3>
                 <p class="muted">Upload photos and choose the primary and hover images.</p>
               </div>
             </div>

             <label class="upload-drop" for="saleGlovePhotoInput">
               <span class="upload-drop-icon" aria-hidden="true">
                 <svg viewBox="0 0 24 24" focusable="false">
                   <rect x="4" y="5" width="16" height="14" rx="3"></rect>
                   <circle cx="9" cy="10" r="1.6"></circle>
                   <path d="m7 17 4.2-4.2a1.8 1.8 0 0 1 2.5 0L17 16"></path>
                 </svg>
               </span>
               <span class="upload-drop-title">Choose Photos</span>
               <span class="upload-drop-note">Select photos, review them, then upload.</span>
             </label>

             <input id="saleGlovePhotoInput" type="file" accept="image/*" multiple>

             <div id="saleGlovePhotoPreview" class="upload-preview-grid"></div>

             <div class="upload-actions">
               <button id="saleGloveUploadBtn" class="secondary upload-primary" type="button" disabled>
                 Upload
               </button>

               <button id="saleGloveClearBtn" class="secondary upload-clear" type="button" disabled>
                 Clear
               </button>
             </div>

             <p id="saleGloveUploadStatus" class="upload-status">
               No photos selected.
             </p>
            <div id="saleGlovePhotosList"></div>
           </div>
        `}

        <div class="admin-action-row store-editor-actions">
           <button id="saveSaleGloveBtn" class="secondary admin-action-btn admin-action-btn-primary store-save-btn" type="button">
             ${isNew ? "Create Glove" : "Save Changes"}
           </button>

           <button id="cancelSaleGloveBtn" class="secondary admin-action-btn store-cancel-btn" type="button">Cancel</button>

           ${isNew ? "" : `
             <button id="deleteSaleGloveBtn" class="secondary admin-action-btn admin-action-btn-danger store-delete-btn" type="button">
               Delete
             </button>
           `}
         </div>

        <p id="saleGloveEditStatus" class="upload-status"></p>
      </div>
    </div>
  `;

  resetStoreScrollSoon();

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
      <div class="store-photo-grid">
        ${photos.map(photo => `
          <div class="upload-preview-item sale-photo-item">
            <img
              src="${escapeAttr(photo.url)}"
              alt=""
              loading="lazy"
            >

            <div class="upload-preview-name sale-photo-badges">
              ${photo.is_primary ? "<span>Primary</span>" : ""}
              ${photo.is_hover ? "<span>Hover</span>" : ""}
            </div>

            <div class="sale-photo-actions">
              <select
                class="sale-photo-action-select"
                data-glove-id="${escapeAttr(gloveId)}"
                data-photo-id="${escapeAttr(photo.id)}"
                data-is-primary="${photo.is_primary ? "true" : "false"}"
                data-is-hover="${photo.is_hover ? "true" : "false"}"
              >
                ${buildStorePhotoActionSelectOptions(photo)}
              </select>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    wrap.querySelectorAll(".sale-photo-action-select").forEach(select => {
      bindAdminPhotoActionSelect(select, {
        allowedActions: ADMIN_STORE_PHOTO_ACTIONS,
        restore: syncStorePhotoActionSelect,
        onAction: async (actionValue, actionSelect) => {
          const gloveIdFromSelect = actionSelect.dataset.gloveId;
          const photoId = actionSelect.dataset.photoId;

          if (actionValue === "delete") {
            const ok = confirm("Delete this photo from the listing?");
            if (!ok) {
              syncStorePhotoActionSelect(actionSelect);
              return;
            }
          }

          actionSelect.disabled = true;

          try {
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
            throw err;
          } finally {
            actionSelect.disabled = false;
          }
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
  const viewMode = window.inventoryViewMode || "active";
  const activeRows = rows.filter(item => item.active !== false);
  const hiddenRows = rows.filter(item => item.active === false);
  const filteredRows = viewMode === "hidden"
    ? hiddenRows
    : viewMode === "needs"
      ? activeRows.filter(inventoryNeedsOrder)
      : activeRows;

  const modeLabel = viewMode === "hidden" ? " · Hidden" : viewMode === "needs" ? " · Needs Order" : "";
  orderCount.textContent = `${filteredRows.length} color${filteredRows.length === 1 ? "" : "s"}${modeLabel}`;
  ordersList.innerHTML = "";
  syncInventoryFilterUI();

  if (!filteredRows.length) {
    ordersList.insertAdjacentHTML("beforeend", `<div class="no-results">No matching lace inventory.</div>`);
    return;
  }

  filteredRows.forEach(item => {
    const colorName = String(item.color || "").trim();
    const qty = getInventoryQuantity(item);
    const reorderAt = getInventoryReorderAt(item);
    const status = getInventoryStatus(item);
    const alertEnabled = inventoryAlertEnabled(item);

    const row = document.createElement("div");
    row.className = `inventory-card inventory-status-${status.key}`;
    row.tabIndex = 0;

    row.innerHTML = `
      <div class="inventory-card-row inventory-card-row-main">
        <div class="inventory-color">
          ${renderInventorySwatch(colorName)}
          <span class="inventory-color-name">${escapeHtml(colorName || "Unknown")}</span>
        </div>
        <span class="inventory-status-pill">${escapeHtml(status.label)}</span>
      </div>

      <div class="inventory-card-row inventory-card-row-meta">
        <div class="inventory-qty">
          <strong>${qty}</strong>
          <span>piece${qty === 1 ? "" : "s"} on hand</span>
        </div>
        <div class="inventory-reorder">
          ${alertEnabled ? `Reorder at ${reorderAt}` : "No Alert"}
        </div>
      </div>
    `;

    attachInventoryRowActions(row, item);
    ordersList.appendChild(row);
  });
}

function getLowInventoryItems(rows) {
  return rows.filter(item => item.active !== false).filter(inventoryNeedsOrder);
}

function syncInventoryFilterUI() {
  const showInventoryFilter = activeView === "inventory";
  const showPopover = showInventoryFilter && inventoryFiltersExpanded;

  if (inventoryFilterToggleBtn) {
    inventoryFilterToggleBtn.hidden = !showInventoryFilter;
    inventoryFilterToggleBtn.setAttribute("aria-expanded", showPopover ? "true" : "false");
    inventoryFilterToggleBtn.classList.toggle("is-active", showPopover);
    inventoryFilterToggleBtn.classList.toggle("has-active-filter", (window.inventoryViewMode || "active") !== "active");
  }

  if (inventoryAddBtn) {
    inventoryAddBtn.hidden = !showInventoryFilter;
  }

  if (inventoryFilterPopover) {
    inventoryFilterPopover.hidden = !showPopover;
    if (showPopover) {
      requestAnimationFrame(() => positionAdminFilterPopover(inventoryFilterPopover, inventoryFilterToggleBtn));
    }
  }

  const mode = window.inventoryViewMode || "active";
  inventoryAllBtn?.classList.toggle("active", mode === "active");
  inventoryNeedsOrderBtn?.classList.toggle("active", mode === "needs");
  inventoryHiddenBtn?.classList.toggle("active", mode === "hidden");
}

function setInventoryFilter(mode) {
  window.inventoryViewMode = mode || "active";
  inventoryFiltersExpanded = false;
  renderInventory(laceInventory);
  syncInventoryFilterUI();
}

function closeAdminFilterPopovers() {
  let changed = false;

  if (orderFiltersExpanded) {
    orderFiltersExpanded = false;
    changed = true;
  }

  if (inventoryFiltersExpanded) {
    inventoryFiltersExpanded = false;
    changed = true;
  }

  if (changed) {
    syncOrderFilterUI();
    syncInventoryFilterUI();
  }
}

function attachInventoryRowActions(row, item) {
  row.addEventListener("selectstart", (e) => {
    e.preventDefault();
  });

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openInventoryActions(item, e);
  });

  row.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openInventoryActions(item, row);
  });

  row.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    setAdminLongPressArmed(true);
    const touch = e.touches[0];
    inventoryPressStart = {
      x: touch.clientX,
      y: touch.clientY
    };
    inventoryPressTimer = window.setTimeout(() => {
      inventoryPressTimer = null;
      setAdminLongPressArmed(false);
      suppressNextAdminMenuActivation();
      openInventoryActions(item, row);
    }, 520);
  }, { passive: true });

  row.addEventListener("touchmove", (e) => {
    if (!inventoryPressStart || !e.touches.length) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - inventoryPressStart.x);
    const dy = Math.abs(touch.clientY - inventoryPressStart.y);
    if (dx > 10 || dy > 10) cancelInventoryLongPress();
  }, { passive: true });

  row.addEventListener("touchend", cancelInventoryLongPress, { passive: true });
  row.addEventListener("touchcancel", cancelInventoryLongPress, { passive: true });
}

function cancelInventoryLongPress() {
  if (inventoryPressTimer) {
    window.clearTimeout(inventoryPressTimer);
    inventoryPressTimer = null;
  }
  setAdminLongPressArmed(false);
  inventoryPressStart = null;
}

function ensureInventorySheet() {
  if (inventorySheetEl) return inventorySheetEl;

  inventorySheetEl = document.createElement("div");
  inventorySheetEl.className = "admin-action-menu-root workflow-sheet-root inventory-sheet-root";
  inventorySheetEl.innerHTML = `
    <div class="admin-action-backdrop workflow-backdrop"></div>
    <div class="admin-action-menu workflow-sheet inventory-sheet" role="menu" aria-label="Lace inventory actions">
      <div class="admin-action-header workflow-sheet-header">
        <button class="workflow-close-btn" type="button" aria-label="Close">×</button>
        <div class="workflow-sheet-title">Lace inventory actions</div>
        <div class="workflow-customer-name"></div>
        <div class="workflow-current-status"></div>
      </div>
      <div class="admin-action-section workflow-section">
        <div class="admin-action-list workflow-action-list"></div>
      </div>
      <div class="admin-action-form-panel workflow-sheet-form"></div>
    </div>
  `;

  getAdminMenuLayer().appendChild(inventorySheetEl);
  inventorySheetEl.querySelector(".workflow-backdrop")?.addEventListener("click", closeInventorySheet);
  inventorySheetEl.querySelector(".workflow-close-btn")?.addEventListener("click", closeInventorySheet);
  return inventorySheetEl;
}

function closeInventorySheet() {
  if (!inventorySheetEl) return;
  inventorySheetEl.classList.remove("open", "workflow-action-selected", "workflow-form-compact", "workflow-form-small", "workflow-form-large");
  inventorySheetEl.querySelector(".workflow-sheet-form")?.classList.remove("is-submenu");
  inventorySheetEl.anchor = null;
}

function openInventoryActions(item, source) {
  const sheetRoot = ensureInventorySheet();
  const sheet = sheetRoot.querySelector(".workflow-sheet");
  const list = sheetRoot.querySelector(".workflow-action-list");
  const form = sheetRoot.querySelector(".workflow-sheet-form");
  const colorName = String(item.color || "").trim();
  const qty = getInventoryQuantity(item);
  const status = getInventoryStatus(item);
  const alertEnabled = inventoryAlertEnabled(item);

  sheetRoot.anchor = getAdminAnchorPosition(source, source?.currentTarget || source);
  sheetRoot.className = "admin-action-menu-root workflow-sheet-root inventory-sheet-root open";
  sheetRoot.querySelector(".workflow-customer-name").textContent = colorName || "Lace color";
  sheetRoot.querySelector(".workflow-current-status").textContent = `${qty} on hand · ${status.label}`;
  form.innerHTML = "";
  form.classList.remove("is-submenu");
  form.style.left = "";
  form.style.top = "";
  form.style.right = "";
  form.style.bottom = "";
  list.innerHTML = item.active === false
    ? `
      <button class="workflow-action-btn" type="button" data-inventory-action="restore">Restore Color</button>
      <button class="workflow-action-btn" type="button" data-inventory-action="set">Set Quantity <span class="workflow-menu-chevron">›</span></button>
      <button class="workflow-action-btn" type="button" data-inventory-action="alertSettings">Alert Settings <span class="workflow-menu-chevron">›</span></button>
      <button class="workflow-action-btn" type="button" data-inventory-action="rename">Edit Lace Color <span class="workflow-menu-chevron">›</span></button>
    `
    : `
      <button class="workflow-action-btn" type="button" data-inventory-action="set">Set Quantity <span class="workflow-menu-chevron">›</span></button>
      <button class="workflow-action-btn" type="button" data-inventory-action="alertSettings">Alert Settings <span class="workflow-menu-chevron">›</span></button>
      <button class="workflow-action-btn" type="button" data-inventory-action="rename">Edit Lace Color <span class="workflow-menu-chevron">›</span></button>
      <button class="workflow-action-btn danger" type="button" data-inventory-action="deactivate">Deactivate / Hide Color</button>
    `;

  list.querySelectorAll("[data-inventory-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (shouldSuppressAdminMenuActivation()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      handleInventoryAction(item, btn.dataset.inventoryAction, btn);
    });
    btn.addEventListener("mouseenter", () => {
      if (!isDesktopHoverMenu()) return;
      if (!inventoryActionHasForm(btn.dataset.inventoryAction)) {
        form.innerHTML = "";
        form.classList.remove("is-submenu");
        sheetRoot.querySelectorAll(".workflow-action-btn").forEach(actionBtn => {
          actionBtn.classList.remove("active");
          actionBtn.hidden = false;
        });
        return;
      }
      renderInventoryActionForm(item, btn.dataset.inventoryAction, btn);
    });
  });

  requestAnimationFrame(() => positionWorkflowMenu(sheet, sheetRoot.anchor));
}

function handleInventoryAction(item, action, button) {
  if (action === "deactivate") {
    deactivateInventoryItem(item, button);
    return;
  }

  if (action === "restore") {
    restoreInventoryItem(item, button);
    return;
  }

  renderInventoryActionForm(item, action, button);
}

function inventoryActionHasForm(action) {
  return action === "set" || action === "alertSettings" || action === "rename";
}

function renderInventoryActionForm(item, action, button) {
  const sheetRoot = ensureInventorySheet();
  const form = sheetRoot.querySelector(".workflow-sheet-form");
  const colorName = String(item?.color || "").trim();
  const isAdd = action === "add";
  const titles = {
    add: "Add lace color",
    set: "Set quantity",
    alertSettings: "Alert settings",
    rename: "Edit lace color"
  };

  const currentQty = getInventoryQuantity(item || {});
  const currentReorderAt = getInventoryReorderAt(item || {});
  const safeReorderAt = currentReorderAt === -1 ? 4 : currentReorderAt;
  const alertEnabled = item ? inventoryAlertEnabled(item) : true;

  let fields = "";
  if (isAdd) {
    fields = `
      <label for="inventoryColorInput">Color</label>
      <input id="inventoryColorInput" type="text" autocomplete="off" />
      <label for="inventoryQtyInput">Quantity on hand</label>
      <input id="inventoryQtyInput" type="number" min="0" step="1" inputmode="numeric" value="0" />
      <label for="inventoryReorderAtInput">Reorder at</label>
      <input id="inventoryReorderAtInput" type="number" min="0" step="1" inputmode="numeric" value="4" />
      <label class="inventory-check-row"><input id="inventoryAlertEnabledInput" type="checkbox" checked /> <span>Alert enabled</span></label>
      <label class="inventory-check-row"><input id="inventoryActiveInput" type="checkbox" checked /> <span>Active</span></label>
    `;
  } else if (action === "set") {
    fields = `
      <label for="inventoryQtyInput">Quantity on hand</label>
      <input id="inventoryQtyInput" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(currentQty)}" />
    `;
  } else if (action === "alertSettings") {
    fields = `
      <label for="inventoryReorderAtInput">Reorder at</label>
      <input id="inventoryReorderAtInput" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(safeReorderAt)}" />
      <label class="inventory-check-row"><input id="inventoryAlertEnabledInput" type="checkbox" ${alertEnabled ? "checked" : ""} /> <span>Alert enabled</span></label>
    `;
  } else if (action === "rename") {
    fields = `
      <label for="inventoryColorInput">Lace color</label>
      <input id="inventoryColorInput" type="text" autocomplete="off" value="${escapeAttr(colorName)}" />
      <p class="workflow-form-helper">Renaming can affect future order matching.</p>
    `;
  }

  const html = `
    <form class="workflow-action-form inventory-action-form" data-inventory-form="${escapeAttr(action)}">
      <div class="workflow-form-content">
        <p class="inventory-form-title">${escapeHtml(titles[action] || "Inventory action")}</p>
        <div class="workflow-form-message" hidden></div>
        ${fields}
        <div class="workflow-form-actions">
          <button class="workflow-form-cancel" type="button">Cancel</button>
          <button class="workflow-form-submit" type="submit">Save</button>
        </div>
      </div>
    </form>
  `;

  if (button) {
    openAdminActionSubmenu(sheetRoot, button, html, { formSize: getInventoryFormSize(action) });
  } else {
    sheetRoot.classList.remove("workflow-form-compact", "workflow-form-small", "workflow-form-large");
    sheetRoot.classList.add("workflow-form-large");
    sheetRoot.classList.add("workflow-action-selected");
    form.classList.remove("is-submenu");
    form.style.left = "";
    form.style.top = "";
    form.style.right = "";
    form.style.bottom = "";
    form.innerHTML = html;
  }

  form.querySelector(".workflow-form-cancel")?.addEventListener("click", () => {
    if (isAdd) closeInventorySheet();
    else openInventoryActions(item, sheetRoot.anchor);
  });

  form.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveInventoryAction(item, action, e.currentTarget);
  });

  if (isDesktopHoverMenu()) {
    form.querySelector("input")?.focus();
  }
}

function openAddInventoryForm(source) {
  const sheetRoot = ensureInventorySheet();
  const sheet = sheetRoot.querySelector(".workflow-sheet");
  const rect = source?.getBoundingClientRect?.();
  sheetRoot.anchor = rect
    ? { x: rect.right, y: rect.bottom + 8 }
    : getAdminAnchorPosition(null, source);
  sheetRoot.className = "admin-action-menu-root workflow-sheet-root inventory-sheet-root open workflow-action-selected workflow-form-large";
  sheetRoot.querySelector(".workflow-customer-name").textContent = "New lace color";
  sheetRoot.querySelector(".workflow-current-status").textContent = "Inventory";
  sheetRoot.querySelector(".workflow-action-list").innerHTML = "";
  renderInventoryActionForm(null, "add", null);
  requestAnimationFrame(() => positionWorkflowMenu(sheet, sheetRoot.anchor));
}

function readInventoryInteger(id, { allowBlank = false, min = 0 } = {}) {
  const el = document.getElementById(id);
  const raw = String(el?.value || "").trim();
  if (!raw && allowBlank) return null;
  if (!raw) throw new Error("Enter a valid whole number.");
  const number = Number(raw);
  if (!Number.isInteger(number) || number < min) {
    throw new Error("Enter a valid whole number.");
  }
  return number;
}

function inventoryColorExists(color, currentColor = "") {
  const next = normalizeLaceName(color);
  const current = normalizeLaceName(currentColor);
  return laceInventory.some(item => {
    const itemColor = normalizeLaceName(item.color);
    return itemColor && itemColor === next && itemColor !== current;
  });
}

async function saveInventoryAction(item, action, formEl) {
  const messageEl = formEl.querySelector(".workflow-form-message");
  const submitBtn = formEl.querySelector(".workflow-form-submit");

  try {
    messageEl.hidden = true;
    submitBtn.disabled = true;

    if (action === "add") {
      const color = String(document.getElementById("inventoryColorInput")?.value || "").trim();
      if (!color) throw new Error("Enter a lace color.");
      if (inventoryColorExists(color)) throw new Error("That lace color already exists.");

      await postJson({
        action: "createInventoryItem",
        color,
        quantityOnHand: readInventoryInteger("inventoryQtyInput"),
        reorderAt: readInventoryInteger("inventoryReorderAtInput"),
        reorderAlertEnabled: document.getElementById("inventoryAlertEnabledInput")?.checked === true,
        active: document.getElementById("inventoryActiveInput")?.checked === true
      }, true);
    } else if (action === "set") {
      await updateInventoryItem(item, {
        quantityOnHand: readInventoryInteger("inventoryQtyInput")
      });
    } else if (action === "alertSettings") {
      await updateInventoryItem(item, {
        reorderAt: readInventoryInteger("inventoryReorderAtInput"),
        reorderAlertEnabled: document.getElementById("inventoryAlertEnabledInput")?.checked === true
      });
    } else if (action === "rename") {
      const color = String(document.getElementById("inventoryColorInput")?.value || "").trim();
      if (!color) throw new Error("Enter a lace color.");
      if (inventoryColorExists(color, item.color)) throw new Error("That lace color already exists.");
      if (normalizeLaceName(color) !== normalizeLaceName(item.color)) {
        const ok = window.confirm("Rename this lace color? Existing orders may still reference the old color name.");
        if (!ok) return;
      }
      await updateInventoryItem(item, { color });
    }

    closeInventorySheet();
    await loadInventory();
  } catch (err) {
    messageEl.textContent = err.message || "Inventory update failed.";
    messageEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

async function updateInventoryItem(item, updates) {
  await postJson({
    action: "updateInventoryItem",
    color: item.color,
    updates
  }, true);
}

async function deactivateInventoryItem(item, button) {
  const ok = window.confirm(`Hide ${item.color || "this lace color"} from the inventory list?`);
  if (!ok) return;

  button.disabled = true;
  try {
    await updateInventoryItem(item, { active: false });
    closeInventorySheet();
    await loadInventory();
  } catch (err) {
    alert(err.message || "Inventory update failed.");
  } finally {
    button.disabled = false;
  }
}

async function restoreInventoryItem(item, button) {
  button.disabled = true;
  try {
    await updateInventoryItem(item, { active: true });
    window.inventoryViewMode = "active";
    closeInventorySheet();
    await loadInventory();
  } catch (err) {
    alert(err.message || "Inventory update failed.");
  } finally {
    button.disabled = false;
  }
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
  const refreshBtn = document.getElementById("galleryRefreshBtn");
  const managerFilter = document.getElementById("galleryManagerFilter");

  if (!input || !status || !preview || !uploadBtn || !clearBtn) return;

  let stagedFiles = [];

  function setGalleryUploaderOpen(open) {
    galleryUploaderCard?.classList.toggle("is-collapsed", !open);
    if (galleryUploaderToggleBtn) {
      galleryUploaderToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      galleryUploaderToggleBtn.setAttribute("aria-label", open ? "Hide gallery uploader" : "Show gallery uploader");
    }
  }

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

  galleryUploaderToggleBtn?.addEventListener("click", () => {
    const nextOpen = galleryUploaderCard?.classList.contains("is-collapsed") !== false;
    setGalleryUploaderOpen(nextOpen);
  });

  galleryUploaderCloseBtn?.addEventListener("click", () => {
    setGalleryUploaderOpen(false);
  });

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
    await loadGalleryManagerPhotos();
  });

  refreshBtn?.addEventListener("click", loadGalleryManagerPhotos);
  managerFilter?.addEventListener("change", () => {
    galleryManagerFilter = managerFilter.value || "all";
    renderGalleryManagerPhotos();
  });
  setGalleryUploaderOpen(false);
  loadGalleryManagerPhotos();
}

const GALLERY_SECTION_LABELS = {
  "fielding-gloves": "Fielding Gloves",
  "catchers-mitts": "Catcher's Mitts",
  "first-base-mitts": "First Base Mitts",
  "custom-color-relaces": "Custom Color Relaces",
  "vintage": "Vintage"
};

function getGallerySectionLabel(section) {
  return GALLERY_SECTION_LABELS[section] || section || "Gallery";
}

async function loadGalleryManagerPhotos() {
  const list = document.getElementById("galleryManagerList");
  const status = document.getElementById("galleryManagerStatus");
  const refreshBtn = document.getElementById("galleryRefreshBtn");
  if (!list || !status) return;

  try {
    if (refreshBtn) refreshBtn.disabled = true;
    status.textContent = "Loading gallery photos...";
    list.innerHTML = "";

    const data = await postJson({
      action: "listGalleryPhotos",
      includeHidden: true
    }, true);

    galleryPhotos = flattenGalleryPhotos(data.gallery || {}, data.hiddenGallery || {});
    renderGalleryManagerPhotos();
  } catch (err) {
    galleryPhotos = [];
    list.innerHTML = `<p class="muted gallery-manager-empty">Gallery photos could not be loaded.</p>`;
    status.textContent = err.message || "Gallery photos could not be loaded.";
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function flattenGalleryPhotos(gallery, hiddenGallery) {
  const sections = Object.keys(GALLERY_SECTION_LABELS);
  return sections.flatMap(section => {
    const active = (Array.isArray(gallery[section]) ? gallery[section] : [])
      .map(photo => ({
        ...photo,
        section,
        sectionLabel: getGallerySectionLabel(section),
        hidden: false
      }));

    const hidden = (Array.isArray(hiddenGallery[section]) ? hiddenGallery[section] : [])
      .map(photo => ({
        ...photo,
        section,
        sectionLabel: getGallerySectionLabel(section),
        hidden: true
      }));

    return [...active, ...hidden];
  });
}

function renderGalleryManagerPhotos() {
  const list = document.getElementById("galleryManagerList");
  const status = document.getElementById("galleryManagerStatus");
  const filterSelect = document.getElementById("galleryManagerFilter");
  if (!list || !status) return;

  const activeFilter = galleryManagerFilter || "all";
  if (filterSelect && filterSelect.value !== activeFilter) {
    filterSelect.value = activeFilter;
  }

  const entries = getFilteredGalleryManagerEntries();
  const activeCount = entries.filter(entry => !entry.photo.hidden).length;
  const hiddenCount = entries.filter(entry => entry.photo.hidden).length;
  const filterLabel = activeFilter === "all" ? "" : ` ${getGallerySectionLabel(activeFilter)}`;

  status.textContent = galleryPhotos.length
    ? `${activeCount}${filterLabel} visible${hiddenCount ? ` · ${hiddenCount} hidden` : ""}`
    : "No gallery photos have been uploaded yet.";

  if (!galleryPhotos.length) {
    list.innerHTML = `<p class="muted gallery-manager-empty">No gallery photos yet.</p>`;
    return;
  }

  if (!entries.length) {
    list.innerHTML = `<p class="muted gallery-manager-empty">No ${escapeHtml(getGallerySectionLabel(activeFilter))} photos found.</p>`;
    return;
  }

  list.innerHTML = `
    <div class="gallery-manager-grid">
      ${entries.map(({ photo, index }) => `
        <article
          class="gallery-manager-item${photo.hidden ? " is-hidden" : ""}"
          data-gallery-index="${index}"
          tabindex="0">
          <button class="gallery-manager-thumb" type="button" data-gallery-action="view">
            <img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.name || "Gallery photo")}" loading="lazy">
          </button>
          <div class="gallery-manager-meta">
            <div class="gallery-manager-name">${escapeHtml(photo.name || "Gallery photo")}</div>
            <div class="gallery-manager-subrow">
              <span>${escapeHtml(photo.sectionLabel)}</span>
              <span class="gallery-manager-pill">${photo.hidden ? "Hidden" : "Visible"}</span>
            </div>
          </div>
          <label class="sr-only" for="galleryActionSelect${index}">Gallery photo actions</label>
          <select id="galleryActionSelect${index}" class="gallery-manager-action-select" data-gallery-action="select" aria-label="Gallery photo actions">
            ${buildGalleryPhotoActionSelectOptions(photo)}
          </select>
        </article>
      `).join("")}
    </div>
  `;

  list.querySelectorAll(".gallery-manager-item").forEach(item => {
    attachGalleryManagerItemActions(item);
  });
}

function getFilteredGalleryManagerEntries() {
  const activeFilter = galleryManagerFilter || "all";

  return galleryPhotos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => activeFilter === "all" || photo.section === activeFilter);
}

function attachGalleryManagerItemActions(item) {
  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const photo = getGalleryManagerPhoto(item);
    if (photo) openGalleryPhotoActionMenu(photo, e);
  });

  const gallerySelect = item.querySelector("[data-gallery-action='select']");
  if (gallerySelect) {
    bindAdminPhotoActionSelect(gallerySelect, {
      allowedActions: ADMIN_GALLERY_PHOTO_ACTIONS,
      restore: resetAdminPhotoActionSelect,
      onAction: async (action, actionSelect) => {
        const photo = getGalleryManagerPhoto(item);
        if (photo) await runGalleryPhotoAction(photo, action);
        resetAdminPhotoActionSelect(actionSelect);
      }
    });
  }

  item.querySelector("[data-gallery-action='view']")?.addEventListener("click", (e) => {
    e.preventDefault();
    const photo = getGalleryManagerPhoto(item);
    if (photo?.url) window.open(photo.url, "_blank", "noopener");
  });

  item.addEventListener("touchstart", (e) => {
    const touch = e.touches?.[0];
    galleryPhotoPressStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    clearTimeout(galleryPhotoPressTimer);
    galleryPhotoPressTimer = setTimeout(() => {
      const photo = getGalleryManagerPhoto(item);
      if (photo) openGalleryPhotoActionMenu(photo, e);
    }, 520);
  }, { passive: true });

  item.addEventListener("touchmove", (e) => {
    if (!galleryPhotoPressStart) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - galleryPhotoPressStart.x);
    const dy = Math.abs(touch.clientY - galleryPhotoPressStart.y);
    if (dx > 10 || dy > 10) cancelGalleryPhotoPress();
  }, { passive: true });

  item.addEventListener("touchend", cancelGalleryPhotoPress, { passive: true });
  item.addEventListener("touchcancel", cancelGalleryPhotoPress, { passive: true });
}

function cancelGalleryPhotoPress() {
  if (galleryPhotoPressTimer) {
    clearTimeout(galleryPhotoPressTimer);
    galleryPhotoPressTimer = null;
  }
  galleryPhotoPressStart = null;
}

function getGalleryManagerPhoto(item) {
  const index = Number(item?.dataset?.galleryIndex);
  return Number.isFinite(index) ? galleryPhotos[index] : null;
}

function ensureGalleryPhotoActionMenu() {
  if (galleryPhotoActionMenuEl) return galleryPhotoActionMenuEl;

  galleryPhotoActionMenuEl = document.createElement("div");
  galleryPhotoActionMenuEl.className = "admin-action-menu-root workflow-sheet-root gallery-photo-menu-root";
  galleryPhotoActionMenuEl.innerHTML = `
    <div class="admin-action-backdrop workflow-backdrop"></div>
    <div class="admin-action-menu workflow-sheet" role="menu" aria-label="Gallery photo actions">
      <div class="admin-action-section workflow-section">
        <div class="workflow-action-list"></div>
      </div>
    </div>
  `;

  getAdminMenuLayer().appendChild(galleryPhotoActionMenuEl);
  galleryPhotoActionMenuEl.querySelector(".workflow-backdrop")?.addEventListener("click", closeGalleryPhotoActionMenu);
  galleryPhotoActionMenuEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-gallery-menu-action]");
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.galleryMenuAction;
    const photo = galleryPhotoActionMenuEl.photo;
    closeGalleryPhotoActionMenu();
    await runGalleryPhotoAction(photo, action);
  });

  return galleryPhotoActionMenuEl;
}

function openGalleryPhotoActionMenu(photo, source) {
  if (!photo) return;
  const root = ensureGalleryPhotoActionMenu();
  const actions = root.querySelector(".workflow-action-list");
  root.photo = photo;
  root.anchor = getAdminAnchorPosition(source, source?.currentTarget || source?.target);

  actions.innerHTML = `
    <button class="workflow-action-btn" type="button" data-gallery-menu-action="view">View Full Photo</button>
    ${photo.hidden
      ? `<button class="workflow-action-btn" type="button" data-gallery-menu-action="restore">Restore / Show in Gallery</button>`
      : `<button class="workflow-action-btn" type="button" data-gallery-menu-action="hide">Hide from Gallery</button>`}
    <button class="workflow-action-btn danger" type="button" data-gallery-menu-action="delete">Delete Photo</button>
  `;

  root.classList.add("open");
  document.addEventListener("keydown", handleGalleryPhotoMenuKeydown);
  requestAnimationFrame(() => {
    positionWorkflowMenu(root.querySelector(".workflow-sheet"), root.anchor);
  });
}

function closeGalleryPhotoActionMenu() {
  if (!galleryPhotoActionMenuEl) return;
  galleryPhotoActionMenuEl.classList.remove("open");
  galleryPhotoActionMenuEl.photo = null;
  document.removeEventListener("keydown", handleGalleryPhotoMenuKeydown);
}

function handleGalleryPhotoMenuKeydown(e) {
  if (e.key !== "Escape") return;
  closeGalleryPhotoActionMenu();
}

async function runGalleryPhotoAction(photo, action) {
  const status = document.getElementById("galleryManagerStatus");
  if (!photo || !action) return;

  if (action === "view") {
    if (photo.url) window.open(photo.url, "_blank", "noopener");
    return;
  }

  if (action === "delete") {
    const ok = window.confirm("Delete this gallery photo? This removes it from the website gallery storage bucket.");
    if (!ok) return;
  }

  try {
    if (status) status.textContent = "Updating gallery photo...";
    const apiAction = action === "hide"
      ? "hideGalleryPhoto"
      : action === "restore"
        ? "restoreGalleryPhoto"
        : "deleteGalleryPhoto";

    await postJson({
      action: apiAction,
      path: photo.path
    }, true);

    await loadGalleryManagerPhotos();
  } catch (err) {
    if (status) status.textContent = err.message || "Gallery photo action failed.";
  }
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
  listScrollY = getAdminScrollTop();
  const order = allOrders.find(o => String(o.orderNumber) === String(orderNumber));
  if (!order) {
    alert("Order not found.");
    return;
  }

  renderOrderDetail(order);
  clearSaveStatus();
  showView(detailView);
  resetViewScroll(detailView);

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
searchInput.addEventListener("keydown", handleSearchKeydown);

searchToggleBtn?.addEventListener("click", () => {
  if (searchExpanded && !isMobileViewport()) {
    cancelSearch();
    return;
  }

  if (searchExpanded && !searchInput.value.trim() && isMobileViewport()) {
    collapseSearchIfEmpty();
    return;
  }

  expandSearch({ focus: true });
});

searchClearBtn?.addEventListener("click", clearSearch);
searchCloseBtn?.addEventListener("click", cancelSearch);

orderFilterToggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!isOrderFilterView(activeView)) return;

  inventoryFiltersExpanded = false;
  orderFiltersExpanded = !orderFiltersExpanded;
  syncOrderFilterUI();
  syncInventoryFilterUI();
});

orderFilterPopover?.addEventListener("click", (e) => {
  e.stopPropagation();
});

orderFilterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const nextFilter = btn.dataset.orderFilter;
    if (!isOrderFilterView(nextFilter)) return;

    orderFiltersExpanded = false;
    setActiveView(nextFilter);
  });
});

orderNewBtn?.addEventListener("click", () => {
  listScrollY = getAdminScrollTop();
  orderFiltersExpanded = false;
  inventoryFiltersExpanded = false;
  syncOrderFilterUI();
  syncInventoryFilterUI();
  renderNewOrderForm();
  showView(detailView);
  resetViewScroll(detailView, { blurActive: true });
});

inventoryFilterToggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (activeView !== "inventory") return;

  orderFiltersExpanded = false;
  inventoryFiltersExpanded = !inventoryFiltersExpanded;
  syncOrderFilterUI();
  syncInventoryFilterUI();
});

inventoryAddBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (activeView !== "inventory") return;

  orderFiltersExpanded = false;
  inventoryFiltersExpanded = false;
  syncOrderFilterUI();
  syncInventoryFilterUI();
  openAddInventoryForm(e.currentTarget);
});

inventoryFilterPopover?.addEventListener("click", (e) => {
  e.stopPropagation();
});

inventoryAllBtn?.addEventListener("click", () => {
  setInventoryFilter("active");
});

inventoryNeedsOrderBtn?.addEventListener("click", () => {
  setInventoryFilter("needs");
});

inventoryHiddenBtn?.addEventListener("click", () => {
  setInventoryFilter("hidden");
});

document.addEventListener("click", (e) => {
  let changed = false;

  if (
    orderFiltersExpanded &&
    !orderFilterPopover?.contains(e.target) &&
    !orderFilterToggleBtn?.contains(e.target)
  ) {
    orderFiltersExpanded = false;
    changed = true;
  }

  if (
    inventoryFiltersExpanded &&
    !inventoryFilterPopover?.contains(e.target) &&
    !inventoryFilterToggleBtn?.contains(e.target)
  ) {
    inventoryFiltersExpanded = false;
    changed = true;
  }

  if (changed) {
    syncOrderFilterUI();
    syncInventoryFilterUI();
  }

  if (!e.target.closest?.(".order-actions-wrap")) {
    closeDesktopOrderActionMenus();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  let changed = false;

  if (searchExpanded) {
    cancelSearch();
  }

  if (orderFiltersExpanded) {
    orderFiltersExpanded = false;
    changed = true;
  }

  if (inventoryFiltersExpanded) {
    inventoryFiltersExpanded = false;
    changed = true;
  }

  closeDesktopOrderActionMenus();
  closeInventorySheet();
  closeOrderPhotoActionMenu();

  if (changed) {
    syncOrderFilterUI();
    syncInventoryFilterUI();
  }
});

window.addEventListener("resize", () => {
  if (!searchInput.value.trim()) {
    searchExpanded = false;
  }

  closeDesktopOrderActionMenus();
  closeInventorySheet();
  closeOrderPhotoActionMenu();
  syncOrderFilterUI();
  syncInventoryFilterUI();
  syncSearchUI();
});

window.addEventListener("scroll", closeDesktopOrderActionMenus, { passive: true, capture: true });
window.addEventListener("scroll", closeInventorySheet, { passive: true, capture: true });
window.addEventListener("scroll", closeOrderPhotoActionMenu, { passive: true, capture: true });
window.addEventListener("scroll", closeAdminFilterPopovers, { passive: true, capture: true });

backBtn.addEventListener("click", () => {
  clearSaveStatus();
  detailMode = "edit";
  if (saveOrderBtn) {
    saveOrderBtn.textContent = "Save";
  }
  showView(dashboardView);

  requestAnimationFrame(() => {
    setAdminScrollTop(listScrollY);
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

if (addSaleGloveBtn) {
  addSaleGloveBtn.textContent = "+";
  addSaleGloveBtn.setAttribute("aria-label", "Add glove");
  addSaleGloveBtn.setAttribute("title", "Add glove");
}

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
      if (detailMode === "new") {
        await createNewOrderFromForm();
      } else {
        await saveCurrentOrderFromForm();
      }
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
  initPullToRefresh();
  searchExpanded = false;
  syncSearchUI();
  syncAuthUI();
  resetAdminScroll();

  if (!getToken()) {
    showView(loginView);
    return;
  }

  try {
    await loadOrders();
    const deepLinkView = readAdminDeepLink();
    if (deepLinkView) {
      activeView = deepLinkView;
    }
    setActiveView(activeView);
    showView(dashboardView);
  } catch (err) {
    clearToken();
    closeMenu();
    syncAuthUI();
    showView(loginView);
  }
})();
