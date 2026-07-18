const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";
const ROLE_KEY = "mm_admin_role";
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
const homeDashboardView = document.getElementById("homeDashboardView");
const dashboardPanel = document.getElementById("dashboardPanel");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");
const uploadView = document.getElementById("uploadView");
const mapView = document.getElementById("mapView");
const moneyView = document.getElementById("moneyView");
const moneyMenuBtn = document.getElementById("moneyMenuBtn");
const detailTitle = document.getElementById("detailTitle");
const pinInput = document.getElementById("pinInput");
const emailInput = document.getElementById("emailInput");
const loginStatus = document.getElementById("loginStatus");
const mainPanel = document.querySelector(".main-panel");

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
const homeMenuBtn = document.getElementById("homeMenuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const sideNavLogoutBtn = document.getElementById("sideNavLogoutBtn");
const sideNavPasskeyBtn = document.getElementById("sideNavPasskeyBtn");
const passkeyLoginBtn = document.getElementById("passkeyLoginBtn");
const passwordLoginBtn = document.getElementById("passwordLoginBtn");
const usersView = document.getElementById("usersView");
const customersView = document.getElementById("customersView");
const calendarView = document.getElementById("calendarView");
const usersPanel = document.getElementById("usersPanel");
const messagesView = document.getElementById("messagesView");
const messagesPanel = document.getElementById("messagesPanel");
const inviteView = document.getElementById("inviteView");

const saleGlovesView = document.getElementById("saleGlovesView");
const saleGlovesList = document.getElementById("saleGlovesList");
const saleGlovesCount = document.getElementById("saleGlovesCount");

const saleGlovesMenuBtn = document.getElementById("saleGlovesMenuBtn");
const saleGlovesRefreshBtn = document.getElementById("saleGlovesRefreshBtn");
const addSaleGloveBtn = document.getElementById("addSaleGloveBtn");
const galleryUploaderToggleBtn = document.getElementById("galleryUploaderToggleBtn");
const galleryUploaderCloseBtn = document.getElementById("galleryUploaderCloseBtn");
const galleryUploaderCard = document.getElementById("galleryUploaderCard");
const mapMenuBtn = document.getElementById("mapMenuBtn");
const mapRefreshBtn = document.getElementById("mapRefreshBtn");
const mapCount = document.getElementById("mapCount");
const mapStatus = document.getElementById("mapStatus");
const orderMapEl = document.getElementById("orderMap");
const mapUnmappedList = document.getElementById("mapUnmappedList");

let laceInventory = [];
let reorderBannerDismissed = false;
let allOrders = [];
let activeView = "dashboard";
let orderDetailReturnView = "dashboard";
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
let galleryManagerSearch = "";
let galleryPhotoPressTimer = null;
let galleryPhotoPressStart = null;
let orderPhotoPressTimer = null;
let orderPhotoPressStart = null;
let orderActivityLoadToken = 0;
let laborTimerLoadToken = 0;
let laborTimerTickInterval = null;
let laborTimerDelegated = false;
let orderDetailLaborMinutes = null;
let orderEconomicsDelegated = false;
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
let financeFilterKey = "ytd";
let financeFilterCustomStart = "";
let financeFilterCustomEnd = "";
let financeFilterMenuOpen = false;
let dashboardLaborSessions = {};
let dashboardTimerPopoverOrder = null;
let dashboardTimerBusy = false;

/* Set of order numbers that have at least one real activity-log entry
   (the manual-creation event is excluded server-side). Drives the New
   Orders section: an order is "new" until it picks up activity. Loaded
   async — dashboardActivityLoaded gates New so it doesn't flash every
   order as new before the index arrives. */
let dashboardActivityOrders = new Set();
let dashboardActivityLoaded = false;

/* Persisted collapse state for the Shop Metrics / Finance Snapshot
   dashboard sections. Kept in localStorage so a collapsed section stays
   collapsed across reloads. Toggling only flips a class (no re-render),
   so it never trips the focused-finance-date-input hazard. */
const DASHBOARD_COLLAPSE_KEY = "mm_dashboard_collapsed";

function readDashboardCollapseState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_COLLAPSE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let dashboardCollapseState = readDashboardCollapseState();

function isDashboardSectionCollapsed(key) {
  return dashboardCollapseState[key] === true;
}

function setDashboardSectionCollapsed(key, collapsed) {
  dashboardCollapseState[key] = collapsed;
  try {
    localStorage.setItem(DASHBOARD_COLLAPSE_KEY, JSON.stringify(dashboardCollapseState));
  } catch {
    /* Non-fatal — collapse just won't persist across reloads. */
  }
}

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

/* iOS Safari keyboard dead-space fix: html/body are overflow:hidden and
   .main-panel is the only scroller, so the window itself must always sit at
   scroll 0. When the on-screen keyboard (or a select/date picker) opens,
   WebKit shifts the layout viewport to keep the focused field visible, and
   on dismiss it sometimes never shifts back — leaving keyboard-sized dead
   space at the bottom that touch scrolling can't undo (the body isn't
   scrollable). Snap the stranded window offset back to 0 once the keyboard
   is gone. Never touches .main-panel scroll position, never re-renders. */
function resetStrandedWindowScroll() {
  /* Mobile browser mode scrolls the document itself (so Safari's toolbar
     can collapse) — window scroll is legitimate there, never reset it. */
  if (window.matchMedia("(max-width: 899px) and (display-mode: browser)").matches) return;
  const stranded =
    (window.scrollY || 0) ||
    (document.documentElement.scrollTop || 0) ||
    (document.body.scrollTop || 0);
  if (!stranded) return;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

if (window.visualViewport) {
  /* Covers the keyboard's own dismiss button, which hides the keyboard
     without blurring the field (no focusout fires). Skips while the
     viewport is shrunk — keyboard open or pinch-zoomed in. */
  window.visualViewport.addEventListener("resize", () => {
    const keyboardOpen = window.innerHeight - window.visualViewport.height > 80;
    if (!keyboardOpen) resetStrandedWindowScroll();
  });
}

document.addEventListener("focusout", (e) => {
  if (!isEditableAdminTarget(e.target)) return;
  setTimeout(() => {
    if (isEditableAdminTarget(document.activeElement)) return;
    resetStrandedWindowScroll();
  }, 250);
});

/* =========================
   VIEW / MENU
========================= */
function showView(view) {
  [loginView, inviteView, homeDashboardView, dashboardView, detailView, uploadView, mapView, moneyView, saleGlovesView, messagesView, usersView, customersView, calendarView]
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
    homeDashboardView,
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
  localStorage.removeItem(ROLE_KEY);
}

function setRole(role) {
  if (role) localStorage.setItem(ROLE_KEY, role);
}

/* Current role, preferring the stored value, falling back to decoding the
   (unencrypted) token payload so existing sessions resolve correctly. */
function getCurrentRole() {
  const stored = localStorage.getItem(ROLE_KEY);
  if (stored) return stored;
  try {
    const token = getToken();
    const payloadB64 = token.split(".")[0];
    if (!payloadB64) return "admin";
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payloadB64.length + 3) % 4));
    const payload = JSON.parse(json);
    return payload.role || "admin";
  } catch {
    return "admin";
  }
}

function isDemoRole() {
  return getCurrentRole() === "demo";
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
const DEMO_LIVE_ACTIONS = new Set(["login", "getInvite", "acceptInvite"]);

async function postJson(body, useAuth = false, endpoint = API_BASE_URL) {
  /* Demo users run entirely in a browser-side sandbox — no real-data call
     ever leaves the page (the server also blocks demo as a backstop). */
  if (body && body.action && !DEMO_LIVE_ACTIONS.has(body.action) && isDemoRole()) {
    return demoApi(body);
  }

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
   DEMO SANDBOX (client-only)

   For demo accounts every action is served from this in-memory store seeded
   with masked sample data — nothing hits the server, so real data can't be
   read or changed. Resets on reload (a clean demo every time). Shapes mirror
   the real API responses so the app behaves normally.
========================= */
let demoStore = null;

function demoNow() {
  return new Date().toISOString();
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/* Canonical status progression for seeded demo activity. */
const DEMO_STATUS_FLOW = [
  "Received",
  "Estimate Sent",
  "Pending Response",
  "Customer Approved",
  "In Progress",
  "Ready to Go",
  "Completed"
];

/* Build the status-change activity an order would have accumulated to reach
   its current status (newest first, one step per day from the received date).
   Received orders get none, so they still read as "new / no activity yet". */
function demoStatusActivity(status, receivedIso) {
  const base = new Date(`${receivedIso || daysAgoIso(3)}T09:15:00`).getTime();
  const dayMs = 86400000;
  const idx = DEMO_STATUS_FLOW.indexOf(status);
  const events = [];

  if (idx > 0) {
    for (let i = 1; i <= idx; i++) {
      events.push({
        createdAt: new Date(base + i * dayMs).toISOString(),
        eventLabel: "Status changed",
        eventDetail: DEMO_STATUS_FLOW[i]
      });
    }
  } else if (status && status !== "Received") {
    events.push({
      createdAt: new Date(base + dayMs).toISOString(),
      eventLabel: "Status changed",
      eventDetail: status
    });
  }

  return events.reverse();
}

function seedDemoStore() {
  const mkOrder = (n, over) => ({
    orderNumber: n,
    customerName: over.customerName,
    phoneNumber: "(555) 010-" + n,
    emailAddress: `${over.customerName.split(" ")[0].toLowerCase()}@example.com`,
    brandModel: over.brandModel || "Rawlings Heart of the Hide",
    gloveType: over.gloveType || "Fielders",
    webType: over.webType || "I-Web",
    servicesRequested: over.services,
    primaryLaceColor: over.lace,
    secondaryLaceColor: over.secondaryLace || "",
    customColorRequest: "",
    primaryLaceUsed: "",
    secondaryLaceUsed: "",
    status: over.status,
    paid: over.paid || "Unpaid",
    /* Price is set when the estimate is sent; completion date when work
       starts — so earlier statuses leave them blank. */
    priceQuoted: over.price ?? "",
    shippingCost: over.shippingCost ?? 0,
    dropOffMethod: over.dropOffMethod || "Local drop-off",
    streetAddress: "", city: "Sample City", state: "OH", zipCode: "",
    dateReceived: daysAgoIso(over.age),
    estimatedCompletion: over.estCompletion || "",
    dateCompleted: over.dateCompleted || "",
    internalNotes: "", gloveNotes: over.gloveNotes || "",
    trackingNumber: "", carrier: "",
    createdAt: daysAgoIso(over.age),
    updatedAt: demoNow()
  });

  const orders = [
    mkOrder("9001", { customerName: "Sample Slugger", status: "Received", age: 1, services: "Cleaning + Conditioning + Relacing", lace: "Tan – Camel" }),
    mkOrder("9002", { customerName: "Demo Diaz", status: "In Progress", age: 5, paid: "Paid", price: 100, estCompletion: daysAgoIso(-3), brandModel: "Wilson A2000", gloveType: "Catchers", services: "Relacing", lace: "Black" }),
    mkOrder("9003", { customerName: "Test Tanaka", status: "Ready to Go", age: 7, price: 80, estCompletion: daysAgoIso(-1), services: "Cleaning + Conditioning + Relacing", lace: "Brown – Chestnut" }),
    mkOrder("9004", { customerName: "Practice Park", status: "Pending Response", age: 9, price: 100, gloveType: "First Base", services: "Cleaning + Conditioning", lace: "Blue – Navy" }),
    mkOrder("9005", { customerName: "Sandbox Singh", status: "Completed", age: 22, paid: "Paid", price: 80, estCompletion: daysAgoIso(4), dateCompleted: daysAgoIso(2), services: "Relacing", lace: "Tan – Camel" }),
    mkOrder("9006", { customerName: "Example Estrada", status: "In Transit to Me", age: 2, dropOffMethod: "Shipped", shippingCost: 12, services: "ShockTec Air2Gel Palm Pad", lace: "Black" })
  ];

  const activity = {};
  orders.forEach(o => {
    const events = demoStatusActivity(o.status, o.dateReceived);
    if (events.length) activity[o.orderNumber] = events;
  });

  return {
    orders,
    inventory: [
      { id: "d1", color: "Black", quantity_on_hand: 3, reorder_at: 4, active: true, reorder_alert_enabled: true },
      { id: "d2", color: "Tan – Camel", quantity_on_hand: 12, reorder_at: 4, active: true, reorder_alert_enabled: true },
      { id: "d3", color: "Brown – Chestnut", quantity_on_hand: 7, reorder_at: 4, active: true, reorder_alert_enabled: true },
      { id: "d4", color: "Blue – Navy", quantity_on_hand: 5, reorder_at: 4, active: true, reorder_alert_enabled: true }
    ],
    gloves: [
      { id: "g1", brandModel: "Rawlings Pro Preferred", gloveType: "Fielders", price: 220, status: "available", description: "Sample listing", photos: [] }
    ],
    sessions: [],
    activity,
    messages: [
      { id: "m1", direction: "in", phoneNumber: "(555) 010-9004", customerName: "Practice Park", orderNumber: "9004", body: "Yes — approved! Go ahead.", mediaUrls: [], read: false, createdAt: new Date(Date.now() - 5400000).toISOString() },
      { id: "m2", direction: "in", phoneNumber: "(555) 010-9002", customerName: "Demo Diaz", orderNumber: "9002", body: "Any update on my A2000?", mediaUrls: [], read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: "m3", direction: "out", phoneNumber: "(555) 010-9002", customerName: "Demo Diaz", orderNumber: "9002", body: "Relacing it now — should be ready in a couple days!", mediaUrls: [], read: true, createdAt: new Date(Date.now() - 3000000).toISOString() }
    ],
    nextOrderNum: 9007,
    seq: 10
  };
}

function getDemoStore() {
  if (!demoStore) demoStore = seedDemoStore();
  return demoStore;
}

function demoAdjustLaceInventory(store, color, delta) {
  const c = String(color || "").trim();
  const d = Number(delta || 0);
  if (!c || !d) return;
  const item = store.inventory.find(i => i.color === c);
  if (item) item.quantity_on_hand = Number(item.quantity_on_hand || 0) + d;
}

function demoResult(extra) {
  return Promise.resolve(Object.assign({ ok: true }, extra || {}));
}

function demoApi(body) {
  const store = getDemoStore();
  const action = body.action;
  const findOrder = (n) => store.orders.find(o => String(o.orderNumber) === String(n));

  switch (action) {
    case "listOrders":
      return demoResult({ orders: store.orders });
    case "getOrder":
      return demoResult({ order: findOrder(body.orderNumber) || null });
    case "updateOrder": {
      const order = findOrder(body.orderNumber);
      if (order) {
        /* Mirror the server: credit back the old lace used, deduct the new,
           per color — so recording lace used at Ready to Go decrements the
           matching demo inventory color (net delta = oldUsed - newUsed). */
        const oldPrimaryColor = order.primaryLaceColor;
        const oldSecondaryColor = order.secondaryLaceColor;
        const oldPrimaryUsed = Number(order.primaryLaceUsed || 0);
        const oldSecondaryUsed = Number(order.secondaryLaceUsed || 0);

        Object.assign(order, body.updates || {});
        order.updatedAt = demoNow();

        demoAdjustLaceInventory(store, oldPrimaryColor, oldPrimaryUsed);
        demoAdjustLaceInventory(store, oldSecondaryColor, oldSecondaryUsed);
        demoAdjustLaceInventory(store, order.primaryLaceColor, -Number(order.primaryLaceUsed || 0));
        demoAdjustLaceInventory(store, order.secondaryLaceColor, -Number(order.secondaryLaceUsed || 0));
      }
      return demoResult({ order });
    }
    case "createOrder": {
      const n = String(store.nextOrderNum++);
      const order = Object.assign({
        orderNumber: n,
        customerName: body.customerName || "New Sample",
        phoneNumber: "", emailAddress: "",
        brandModel: "", gloveType: "Fielders", webType: "",
        servicesRequested: "", primaryLaceColor: "", secondaryLaceColor: "",
        primaryLaceUsed: "", secondaryLaceUsed: "",
        status: "Received", paid: "Unpaid", priceQuoted: "", shippingCost: 0,
        dropOffMethod: "Local drop-off", streetAddress: "", city: "", state: "", zipCode: "",
        dateReceived: daysAgoIso(0), estimatedCompletion: "", dateCompleted: "",
        internalNotes: "", gloveNotes: "", createdAt: demoNow(), updatedAt: demoNow()
      }, body.order || {});
      store.orders.unshift(order);
      return demoResult({ order });
    }
    case "deleteOrder":
      store.orders = store.orders.filter(o => String(o.orderNumber) !== String(body.orderNumber));
      return demoResult();

    case "listOpenLaborSessions":
      return demoResult({ sessions: store.sessions.filter(s => !s.endedAt) });
    case "listLaborSessions":
      return demoResult({ sessions: store.sessions.filter(s => String(s.orderNumber) === String(body.orderNumber)) });
    case "listLaborSummary":
      return demoResult({ sessions: store.sessions.filter(s => s.endedAt) });
    case "startLaborSession": {
      const session = {
        id: "s" + (store.seq++),
        orderNumber: String(body.orderNumber),
        phase: body.phase || "Work",
        status: "running",
        startedAt: demoNow(),
        pausedAt: null,
        endedAt: null,
        pauseAccumulatedSeconds: 0
      };
      store.sessions.push(session);
      return demoResult({ session });
    }
    case "pauseLaborSession": {
      const s = store.sessions.find(x => x.id === body.sessionId);
      if (s) { s.status = "paused"; s.pausedAt = demoNow(); }
      return demoResult();
    }
    case "resumeLaborSession": {
      const s = store.sessions.find(x => x.id === body.sessionId);
      if (s && s.pausedAt) {
        s.pauseAccumulatedSeconds += Math.max(0, Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 1000));
        s.status = "running"; s.pausedAt = null;
      }
      return demoResult();
    }
    case "stopLaborSession": {
      const s = store.sessions.find(x => x.id === body.sessionId);
      if (s) { s.status = "stopped"; s.endedAt = demoNow(); }
      return demoResult();
    }
    case "updateLaborSessionNotes":
      return demoResult();

    case "listOrdersWithActivity":
      return demoResult({ orderNumbers: store.orders.filter(o => normalizeStatus(o.status) !== "received").map(o => o.orderNumber) });
    case "listOrderActivity":
      return demoResult({ activity: store.activity[body.orderNumber] || [] });

    case "listInventory":
      return demoResult({ inventory: store.inventory });
    case "createInventoryItem":
      store.inventory.push({
        id: "d" + (store.seq++),
        color: body.color || "New Color",
        quantity_on_hand: Number(body.quantityOnHand) || 0,
        reorder_at: Number(body.reorderAt) || 4,
        active: body.active !== false,
        reorder_alert_enabled: body.reorderAlertEnabled !== false
      });
      return demoResult();
    case "updateInventoryItem": {
      const item = store.inventory.find(i => i.color === body.color || String(i.id) === String(body.id));
      const u = body.updates || {};
      if (item) {
        if ("quantityOnHand" in u) item.quantity_on_hand = Number(u.quantityOnHand) || 0;
        if ("reorderAt" in u) item.reorder_at = Number(u.reorderAt) || 0;
        if ("reorderAlertEnabled" in u) item.reorder_alert_enabled = !!u.reorderAlertEnabled;
        if ("color" in u) item.color = u.color;
        if ("active" in u) item.active = !!u.active;
      }
      return demoResult();
    }

    case "listSaleGloves":
      return demoResult({ gloves: store.gloves });
    case "getSaleGlove":
      return demoResult({ glove: store.gloves.find(g => String(g.id) === String(body.id)) || null });
    case "createSaleGlove":
      store.gloves.push({ id: "g" + (store.seq++), brandModel: body.brandModel || "New Glove", gloveType: body.gloveType || "Fielders", price: Number(body.price) || 0, status: "available", description: body.description || "", photos: [] });
      return demoResult();
    case "updateSaleGlove": {
      const g = store.gloves.find(x => String(x.id) === String(body.id));
      if (g) Object.assign(g, body.updates || body);
      return demoResult();
    }
    case "deleteSaleGlove":
      store.gloves = store.gloves.filter(g => String(g.id) !== String(body.id));
      return demoResult();
    case "listSaleGlovePhotos":
      return demoResult({ photos: [] });
    case "listGalleryPhotos":
      return demoResult({ photos: [] });

    case "listMessages":
      return demoResult({ messages: store.messages });
    case "markMessagesRead":
      store.messages.forEach(m => {
        if (m.direction === "in" && (!body.phoneNumber || m.phoneNumber === body.phoneNumber)) m.read = true;
      });
      return demoResult();
    case "deleteMessage":
      store.messages = store.messages.filter(m => String(m.id) !== String(body.id));
      return demoResult();
    case "deleteMessageThread": {
      const keys = new Set((body.phoneNumbers || []).map(pn => String(pn).replace(/\D/g, "").slice(-10)));
      store.messages = store.messages.filter(m => !keys.has(String(m.phoneNumber).replace(/\D/g, "").slice(-10)));
      return demoResult();
    }
    case "sendMessageReply":
      store.messages.push({
        id: "m" + (store.seq++), direction: "out", phoneNumber: body.phoneNumber,
        customerName: body.customerName || "", orderNumber: body.orderNumber || "",
        body: body.body, mediaUrls: [], read: true, createdAt: demoNow()
      });
      return demoResult();

    case "resendStatusEmail":
    case "resendStatusText":
      return Promise.resolve({ ok: false, error: "Demo mode: emails and texts are disabled." });

    case "geocodeAddresses":
    case "geocodeMissingOrderAddresses":
      return demoResult({ results: [], updated: 0 });

    case "listUsers":
    case "createUserInvite":
    case "setUserPassword":
    case "updateUser":
    case "deleteUser":
      return Promise.resolve({ ok: false, error: "Admins only." });

    default:
      return demoResult();
  }
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

function isPaid(order) {
  return normalizeText(order?.paid) === "paid";
}

function isCancelledOrder(order) {
  return normalizeStatus(order?.status) === "cancelled";
}

function isOnHoldOrder(order) {
  return normalizeStatus(order?.status) === "on hold";
}

function isCurrentOrder(order) {
  return !isCompletedOrder(order) && !isCancelledOrder(order) && !isOnHoldOrder(order);
}

function isWaitingOnCustomer(order) {
  const status = normalizeStatus(order?.status);
  return status === "estimate sent" || status === "pending response";
}

function isWaitingOnParts(order) {
  const status = normalizeStatus(order?.status);
  return (
    status === "waiting on lace/parts" ||
    status === "waiting on parts" ||
    status === "waiting parts"
  );
}

function isReadyToGo(order) {
  return normalizeStatus(order?.status) === "ready to go";
}

function isInProgressOrder(order) {
  return normalizeStatus(order?.status) === "in progress";
}

function parseOrderDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isThisMonth(date) {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isCompletedThisMonth(order) {
  if (!isCompletedOrder(order)) return false;
  const completed = parseOrderDate(order.dateCompleted);
  return completed ? isThisMonth(completed) : false;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const ms = endDate.getTime() - startDate.getTime();
  if (ms < 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatCurrency(value) {
  return `$${moneyNumber(value).toFixed(2)}`;
}

const ON_DECK_STATUS_PRIORITY = {
  "in transit to me": 1,
  "customer approved": 2
};

const OUTSTANDING_UNPAID_STATUSES = new Set([
  "in progress",
  "ready to go",
  "completed",
  "picked up"
]);

function isOutstandingUnpaidOrder(order) {
  if (isOnHoldOrder(order) || isPaid(order)) return false;
  return OUTSTANDING_UNPAID_STATUSES.has(normalizeStatus(order?.status));
}

function isOnDeckOrder(order) {
  if (!isCurrentOrder(order)) return false;
  return Object.prototype.hasOwnProperty.call(
    ON_DECK_STATUS_PRIORITY,
    normalizeStatus(order?.status)
  );
}

/* New order = an active order with nothing in its activity log yet
   (manual-creation events don't count). Once any real activity lands —
   status change, note, email/text, photo, timer — it drops out of New.
   Gated on the activity index having loaded to avoid a false "everything
   is new" flash. */
function isNewOrder(order) {
  if (!isCurrentOrder(order)) return false;
  if (!dashboardActivityLoaded) return false;
  return !dashboardActivityOrders.has(String(order?.orderNumber || ""));
}

function getOnDeckPriority(order) {
  return ON_DECK_STATUS_PRIORITY[normalizeStatus(order?.status)] ?? 99;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getOrderFinanceCompletedDate(order) {
  return parseOrderDate(order?.dateCompleted);
}

function getOrderFinanceReceivedDate(order) {
  return (
    parseOrderDate(order?.dateReceived) ||
    parseOrderDate(order?.timestampSubmitted) ||
    parseOrderDate(order?.createdAt)
  );
}

function getFinanceDateRange(
  filterKey = financeFilterKey,
  customStart = financeFilterCustomStart,
  customEnd = financeFilterCustomEnd
) {
  const now = new Date();
  const today = startOfDay(now);

  switch (filterKey) {
    case "last-30-days":
      return {
        start: startOfDay(new Date(today.getTime() - 29 * 86400000)),
        end: endOfDay(now),
        label: "Last 30 days"
      };
    case "last-60-days":
      return {
        start: startOfDay(new Date(today.getTime() - 59 * 86400000)),
        end: endOfDay(now),
        label: "Last 60 days"
      };
    case "ytd":
      return {
        start: startOfDay(new Date(today.getFullYear(), 0, 1)),
        end: endOfDay(now),
        label: "Year to date"
      };
    case "last-365-days":
      return {
        start: startOfDay(new Date(today.getTime() - 364 * 86400000)),
        end: endOfDay(now),
        label: "Last 365 days"
      };
    case "all-time":
      return {
        start: null,
        end: null,
        label: "All time"
      };
    case "custom": {
      const start = parseOrderDate(customStart);
      const end = parseOrderDate(customEnd);
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      const label = start && end
        ? `${formatDateForInput(start)} – ${formatDateForInput(end)}`
        : "Custom range";
      return { start, end, label };
    }
    case "ytd":
    default:
      return {
        start: startOfDay(new Date(today.getFullYear(), 0, 1)),
        end: endOfDay(now),
        label: "Year to date"
      };
  }
}

function isDateInFinanceRange(date, range) {
  if (!date) return false;
  if (!range?.start && !range?.end) return true;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

function isFinanceRangeReady(range, filterKey = financeFilterKey) {
  if (filterKey !== "custom") return true;
  return !!(range?.start && range?.end);
}

function computeDashboardStats(orders = allOrders) {
  const list = Array.isArray(orders) ? orders : [];
  const currentOrders = list.filter(isCurrentOrder);
  const completedThisMonth = list.filter(isCompletedThisMonth);
  const turnaroundDays = list
    .filter(isCompletedOrder)
    .map(order => daysBetween(parseOrderDate(order.dateReceived), parseOrderDate(order.dateCompleted)))
    .filter(days => days !== null);

  const averageTurnaround = turnaroundDays.length
    ? turnaroundDays.reduce((sum, days) => sum + days, 0) / turnaroundDays.length
    : null;

  return {
    currentOrders: currentOrders.length,
    waitingOnCustomer: currentOrders.filter(isWaitingOnCustomer).length,
    waitingOnParts: currentOrders.filter(isWaitingOnParts).length,
    readyToGo: currentOrders.filter(isReadyToGo).length,
    inProgress: currentOrders.filter(isInProgressOrder).length,
    completedThisMonth: completedThisMonth.length,
    averageTurnaround
  };
}

function computeFinanceStats(
  orders = allOrders,
  filterKey = financeFilterKey,
  customStart = financeFilterCustomStart,
  customEnd = financeFilterCustomEnd
) {
  const list = Array.isArray(orders) ? orders : [];
  const range = getFinanceDateRange(filterKey, customStart, customEnd);
  const rangeReady = isFinanceRangeReady(range, filterKey);

  const paidCompletedInRange = rangeReady
    ? list.filter(order => {
        if (!isCompletedOrder(order) || !isPaid(order)) return false;
        return isDateInFinanceRange(getOrderFinanceCompletedDate(order), range);
      })
    : [];

  const revenue = paidCompletedInRange.reduce((sum, order) => sum + moneyNumber(order.priceQuoted), 0);
  const paidOrders = paidCompletedInRange.length;
  const averagePaidOrder = paidOrders ? revenue / paidOrders : null;

  const outstandingOrders = rangeReady
    ? list.filter(order => {
        if (!isOutstandingUnpaidOrder(order)) return false;
        return isDateInFinanceRange(getOrderFinanceReceivedDate(order), range);
      })
    : [];

  const outstandingUnpaid = outstandingOrders.reduce((sum, order) => sum + moneyNumber(order.priceQuoted), 0);

  return {
    range,
    rangeReady,
    revenue,
    paidOrders,
    averagePaidOrder,
    outstandingUnpaid,
    outstandingUnpaidCount: outstandingOrders.length
  };
}

function sortDashboardOrders(list, getPriority) {
  return [...list].sort((a, b) => {
    if (typeof getPriority === "function") {
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
    }

    const aNum = Number(String(a.orderNumber || "").replace(/[^\d]/g, "")) || 0;
    const bNum = Number(String(b.orderNumber || "").replace(/[^\d]/g, "")) || 0;
    return aNum - bNum;
  });
}

function getBenchPreviewOrders(orders = allOrders, limit = 5) {
  const list = Array.isArray(orders) ? orders : [];
  return sortDashboardOrders(list.filter(isInProgressOrder)).slice(0, limit);
}

function getOnDeckOrders(orders = allOrders, limit = 5) {
  const list = Array.isArray(orders) ? orders : [];
  return sortDashboardOrders(list.filter(isOnDeckOrder), getOnDeckPriority).slice(0, limit);
}

function getNewOrders(orders = allOrders, limit = 5) {
  const list = Array.isArray(orders) ? orders : [];
  return sortDashboardOrders(list.filter(isNewOrder)).slice(0, limit);
}

function getDashboardAttentionItems(orders = allOrders) {
  const list = Array.isArray(orders) ? orders : [];
  const items = [];
  const now = Date.now();
  const staleMs = 48 * 60 * 60 * 1000;
  const followUpMs = 3 * 24 * 60 * 60 * 1000;
  const eligible = list.filter(isCurrentOrder);

  const readyUnpaid = eligible.filter(order => isReadyToGo(order) && !isPaid(order));
  if (readyUnpaid.length) {
    items.push({
      key: "ready-unpaid",
      label: `${readyUnpaid.length} ready to go but unpaid`,
      view: "ready"
    });
  }

  const waitingParts = eligible.filter(isWaitingOnParts);
  if (waitingParts.length) {
    items.push({
      key: "waiting-parts",
      label: `${waitingParts.length} waiting on lace/parts`,
      view: "waiting"
    });
  }

  const staleCustomer = eligible.filter(order => {
    /* Pending-response orders get their own follow-up reminder below,
       so this line stays scoped to estimate-sent to avoid double-counting. */
    if (normalizeStatus(order?.status) !== "estimate sent") return false;
    const updated = parseOrderDate(order.updatedAt);
    if (!updated) return false;
    return now - updated.getTime() >= staleMs;
  });

  if (staleCustomer.length) {
    items.push({
      key: "stale-customer",
      label: `${staleCustomer.length} estimates pending over 48 hours`,
      view: "estimate"
    });
  }

  /* Follow up on orders sitting in "Pending Response" — nudge Brett to
     chase customers who've gone quiet after the estimate conversation. */
  const followUpResponse = eligible.filter(order => {
    if (!isWaitingForCustomerResponse(order)) return false;
    const updated = parseOrderDate(order.updatedAt);
    if (!updated) return false;
    return now - updated.getTime() >= followUpMs;
  });

  if (followUpResponse.length) {
    items.push({
      key: "pending-response",
      label: `${followUpResponse.length} pending response — follow up`,
      view: "customer-response"
    });
  }

  return items;
}

const DASHBOARD_TIMER_ICONS = {
  start: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="14" r="7"></circle><path d="M12 14v-4"></path><path d="M9 3h6"></path><path d="M12 3v4"></path></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7v10"></path><path d="M15 7v10"></path></svg>`,
  resume: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7l8 5-8 5z"></path></svg>`
};

function getDashboardTimerStateLabel(session) {
  const stateLabel = getLaborSessionStatus(session) === "paused" ? "Paused" : "Running";
  const elapsed = formatLaborDuration(getLaborActiveSeconds(session) / 60);
  return `${stateLabel} · ${session.phase || "Work"} · ${elapsed}`;
}

function renderDashboardTimerButton(order, session) {
  const orderKey = String(order.orderNumber || "");
  const sessionStatus = session ? getLaborSessionStatus(session) : "";
  /* No session: the icon starts a timer (via the phase picker). Once a
     timer exists, the same icon opens a small menu with Pause/Resume and
     Stop. The icon still reflects state (pause = running, play = paused). */
  const action = !session ? "start" : "menu";
  const icon = !session ? "start" : (sessionStatus === "paused" ? "resume" : "pause");
  const ariaLabel = !session
    ? `Start timer for ${order.customerName || "customer"}`
    : "Timer options";
  const modifier = sessionStatus === "running"
    ? " dashboard-timer-btn--running"
    : (sessionStatus === "paused" ? " dashboard-timer-btn--paused" : "");

  return `
    <button
      type="button"
      class="dashboard-timer-btn${modifier}"
      data-timer-action="${escapeAttr(action)}"
      data-timer-order="${escapeAttr(orderKey)}"
      aria-haspopup="menu"
      aria-label="${escapeAttr(ariaLabel)}"
    >${DASHBOARD_TIMER_ICONS[icon]}</button>
  `;
}

function renderDashboardOrderRow(order, { timerControls = false } = {}) {
  const lace = String(order.primaryLaceColor || order.lacePrimary || "").trim();
  const brand = String(order.brandModel || "").trim();
  const meta = [brand, lace].filter(Boolean).join(" · ");
  const orderKey = String(order.orderNumber || "");
  const session = timerControls ? (dashboardLaborSessions[orderKey] || null) : null;
  const timerStateHtml = session
    ? `<span class="dashboard-bench-timer-state" data-bench-timer="${escapeAttr(orderKey)}">${escapeHtml(getDashboardTimerStateLabel(session))}</span>`
    : "";

  return `
    <div
      class="dashboard-bench-row"
      data-order-number="${escapeAttr(order.orderNumber || "")}"
      data-dashboard-order="${escapeAttr(order.orderNumber || "")}"
      role="button"
      tabindex="0"
      aria-label="Open order for ${escapeAttr(order.customerName || "customer")}"
    >
      <div class="dashboard-bench-main">
        <div class="dashboard-bench-title">${escapeHtml(order.customerName || "Customer")}</div>
        <div class="dashboard-bench-meta">
          <span>#${escapeHtml(order.orderNumber || "")}</span>
          ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
          <span>${escapeHtml(getOrderStatusDisplay(order.status))}</span>
          ${timerStateHtml}
        </div>
      </div>
      ${timerControls ? `
        <div class="dashboard-bench-actions">
          ${renderDashboardTimerButton(order, session)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderDashboardOrderList(orders, emptyMessage, options = {}) {
  return orders.length
    ? orders.map(order => renderDashboardOrderRow(order, options)).join("")
    : `<p class="dashboard-empty muted">${escapeHtml(emptyMessage)}</p>`;
}

async function refreshDashboardLaborSessions({ rerender = true } = {}) {
  try {
    const data = await postJson({ action: "listOpenLaborSessions" }, true);
    const nextMap = {};
    (data.sessions || []).forEach(session => {
      if (!session?.orderNumber) return;
      nextMap[String(session.orderNumber)] = session;
    });

    const changed = JSON.stringify(nextMap) !== JSON.stringify(dashboardLaborSessions);
    dashboardLaborSessions = nextMap;

    if (changed && rerender && activeView === "dashboard") {
      renderHomeDashboard();
    }
  } catch {
    /* Timer state is a dashboard extra — keep the old map and never
       block orders or dashboard rendering on it. */
  }
}

async function refreshDashboardActivityIndex({ rerender = true } = {}) {
  try {
    const data = await postJson({ action: "listOrdersWithActivity" }, true);
    const nextSet = new Set((data.orderNumbers || []).map(n => String(n)));
    const changed =
      !dashboardActivityLoaded ||
      nextSet.size !== dashboardActivityOrders.size ||
      [...nextSet].some(n => !dashboardActivityOrders.has(n));

    dashboardActivityOrders = nextSet;
    dashboardActivityLoaded = true;

    if (changed && rerender && activeView === "dashboard") {
      renderHomeDashboard();
    }
  } catch {
    /* New Orders is a dashboard extra — never block rendering on it. */
  }
}

function closeDashboardTimerPopover() {
  dashboardTimerPopoverOrder = null;
  document.querySelectorAll(".dashboard-timer-popover").forEach(el => el.remove());
}

function openDashboardTimerPopover(button, orderKey) {
  closeDashboardTimerPopover();

  const actions = button.closest(".dashboard-bench-actions");
  if (!actions) return;

  dashboardTimerPopoverOrder = orderKey;
  const popover = document.createElement("div");
  popover.className = "dashboard-timer-popover";
  popover.innerHTML = LABOR_TIMER_PHASES.map(phase => `
    <button
      type="button"
      class="dashboard-timer-phase-option"
      data-timer-phase="${escapeAttr(phase)}"
      data-timer-order="${escapeAttr(orderKey)}"
    >${escapeHtml(phase)}</button>
  `).join("");
  actions.appendChild(popover);
}

/* Options menu shown once a timer is running/paused: Pause or Resume,
   plus Stop. Reuses the phase popover styling. */
function openDashboardTimerControlsPopover(button, orderKey, session) {
  closeDashboardTimerPopover();

  const actions = button.closest(".dashboard-bench-actions");
  if (!actions) return;

  const primary = getLaborSessionStatus(session) === "paused"
    ? { control: "resume", label: "Resume" }
    : { control: "pause", label: "Pause" };

  dashboardTimerPopoverOrder = orderKey;
  const popover = document.createElement("div");
  popover.className = "dashboard-timer-popover";
  popover.innerHTML = `
    <button
      type="button"
      class="dashboard-timer-phase-option"
      data-timer-control="${escapeAttr(primary.control)}"
      data-timer-order="${escapeAttr(orderKey)}"
    >${escapeHtml(primary.label)}</button>
    <button
      type="button"
      class="dashboard-timer-phase-option dashboard-timer-stop-option"
      data-timer-control="stop"
      data-timer-order="${escapeAttr(orderKey)}"
    >Stop</button>
  `;
  actions.appendChild(popover);
}

function hasRunningDashboardSessionOtherThan(orderKey) {
  return Object.values(dashboardLaborSessions).some(session =>
    String(session.orderNumber) !== String(orderKey) &&
    getLaborSessionStatus(session) === "running"
  );
}

async function handleDashboardTimerPhaseSelect(orderKey, phase) {
  if (dashboardTimerBusy) return;
  dashboardTimerBusy = true;
  closeDashboardTimerPopover();

  try {
    await postJson({
      action: "startLaborSession",
      orderNumber: orderKey,
      phase
    }, true);
    await refreshDashboardLaborSessions();
  } catch (err) {
    alert(err?.message || "Labor timer could not be started.");
  } finally {
    dashboardTimerBusy = false;
  }
}

async function handleDashboardTimerAction(button) {
  if (dashboardTimerBusy) return;

  const orderKey = String(button.dataset.timerOrder || "");
  const action = button.dataset.timerAction;
  const session = dashboardLaborSessions[orderKey] || null;

  if (dashboardTimerPopoverOrder === orderKey) {
    closeDashboardTimerPopover();
    return;
  }

  if (action === "start") {
    if (hasRunningDashboardSessionOtherThan(orderKey)) {
      alert("Pause or stop the current timer first.");
      return;
    }
    openDashboardTimerPopover(button, orderKey);
    return;
  }

  if (action === "menu") {
    if (!session?.id) return;
    openDashboardTimerControlsPopover(button, orderKey, session);
  }
}

async function handleDashboardTimerControl(orderKey, control) {
  if (dashboardTimerBusy) return;

  const session = dashboardLaborSessions[orderKey] || null;
  if (!session?.id) return;

  if (control === "resume" && hasRunningDashboardSessionOtherThan(orderKey)) {
    closeDashboardTimerPopover();
    alert("Pause or stop the current timer first.");
    return;
  }

  closeDashboardTimerPopover();
  dashboardTimerBusy = true;
  try {
    if (control === "pause") {
      await postJson({ action: "pauseLaborSession", sessionId: session.id }, true);
    } else if (control === "resume") {
      await postJson({ action: "resumeLaborSession", sessionId: session.id }, true);
    } else if (control === "stop") {
      await postJson({ action: "stopLaborSession", sessionId: session.id }, true);
    }
    await refreshDashboardLaborSessions();
  } catch (err) {
    alert(err?.message || "Labor timer could not be updated.");
    refreshDashboardLaborSessions();
  } finally {
    dashboardTimerBusy = false;
  }
}

function renderDashboardMetricCard(label, value, { sub = "", view = "" } = {}) {
  const tag = view ? "button" : "div";
  const attrs = view
    ? ` type="button" class="dashboard-card dashboard-metric is-clickable" data-dashboard-view="${escapeAttr(view)}"`
    : ` class="dashboard-card dashboard-metric"`;

  return `
    <${tag}${attrs}>
      <span class="dashboard-metric-label">${escapeHtml(label)}</span>
      <span class="dashboard-metric-value">${escapeHtml(String(value))}</span>
      ${sub ? `<span class="dashboard-metric-sub">${escapeHtml(sub)}</span>` : ""}
    </${tag}>
  `;
}

const FINANCE_FILTER_OPTIONS = [
  ["this-month", "This Month", "This Month"],
  ["last-30-days", "Last 30 Days", "30 Days"],
  ["last-60-days", "Last 60 Days", "60 Days"],
  ["ytd", "Year to Date", "YTD"],
  ["last-365-days", "Last 365 Days", "365 Days"],
  ["all-time", "All Time", "All Time"],
  ["custom", "Custom", "Custom"]
];

function getFinanceFilterShortLabel(key) {
  const option = FINANCE_FILTER_OPTIONS.find(([value]) => value === key);
  return option ? option[2] : "YTD";
}

function renderFinanceFilterOptions(selectedKey) {
  return FINANCE_FILTER_OPTIONS.map(([value, label]) => `
    <button
      type="button"
      class="dashboard-finance-filter-option${value === selectedKey ? " active" : ""}"
      role="menuitemradio"
      aria-checked="${value === selectedKey ? "true" : "false"}"
      data-finance-filter="${escapeAttr(value)}"
    >${escapeHtml(label)}</button>
  `).join("");
}

function renderFinanceMetricCards(financeStats) {
  const avgPaidOrderDisplay = !financeStats.rangeReady || financeStats.averagePaidOrder === null
    ? "—"
    : formatCurrency(financeStats.averagePaidOrder);
  const revenueDisplay = financeStats.rangeReady
    ? formatCurrency(financeStats.revenue)
    : "—";
  const outstandingDisplay = financeStats.rangeReady
    ? formatCurrency(financeStats.outstandingUnpaid)
    : "—";
  const paidOrdersDisplay = financeStats.rangeReady
    ? String(financeStats.paidOrders)
    : "—";

  return [
    renderDashboardMetricCard("Revenue", revenueDisplay),
    renderDashboardMetricCard("Outstanding Unpaid", outstandingDisplay),
    renderDashboardMetricCard("Average Paid Order", avgPaidOrderDisplay),
    renderDashboardMetricCard("Paid Orders", paidOrdersDisplay)
  ].join("");
}

/* Updates only the finance range label and metric cards in place.
   Must not rebuild the custom date inputs — replacing a focused
   date input closes the native iOS picker and commits today. */
function updateFinanceSnapshotSummary() {
  if (!dashboardPanel) return;
  const financeSection = dashboardPanel.querySelector(".dashboard-section-finance");
  if (!financeSection) return;

  const financeStats = computeFinanceStats();
  const rangeEl = financeSection.querySelector(".dashboard-section-range");
  if (rangeEl) rangeEl.textContent = financeStats.range.label;

  const grid = financeSection.querySelector(".dashboard-grid-finance");
  if (grid) grid.innerHTML = renderFinanceMetricCards(financeStats);
}

function setFinanceFilterMenuOpen(open) {
  financeFilterMenuOpen = open;
  const popover = document.getElementById("financeFilterPopover");
  if (popover) popover.hidden = !open;

  const toggle = document.getElementById("financeFilterToggleBtn");
  if (toggle) {
    toggle.classList.toggle("is-active", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

const CLUBHOUSE_GREETING_NAME = "Brett";

function getClubhouseGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return `Mornin', ${CLUBHOUSE_GREETING_NAME}!`;
  if (hour < 17) return `Afternoon, ${CLUBHOUSE_GREETING_NAME}!`;
  return `Evenin', ${CLUBHOUSE_GREETING_NAME}!`;
}

function getClubhouseGreetingDateLabel() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function renderClubhouseGreeting() {
  const dateLabel = getClubhouseGreetingDateLabel();
  return `
    <div class="clubhouse-greeting">
      <p class="clubhouse-greeting-title">${escapeHtml(getClubhouseGreetingText())}</p>
      <p class="clubhouse-greeting-sub muted">
        <span class="clubhouse-greeting-date">${escapeHtml(dateLabel)}</span>
        <span class="clubhouse-greeting-sub-sep" aria-hidden="true">·</span>
        Here's your lineup card
      </p>
    </div>
  `;
}

function renderHomeDashboard() {
  if (!dashboardPanel) return;

  const stats = computeDashboardStats();
  const financeStats = computeFinanceStats();
  const benchOrders = getBenchPreviewOrders();
  const onDeckOrders = getOnDeckOrders();
  const newOrders = getNewOrders();
  const attentionItems = getDashboardAttentionItems();
  const metricsCollapsed = isDashboardSectionCollapsed("metrics");
  const financeCollapsed = isDashboardSectionCollapsed("finance");
  const avgTurnaroundDisplay = stats.averageTurnaround === null
    ? "—"
    : `${Math.round(stats.averageTurnaround)}d`;
  const financeRangeLabel = financeStats.range.label;

  const metricsHtml = [
    renderDashboardMetricCard("Current Orders", stats.currentOrders, { view: "current" }),
    ...(stats.waitingOnCustomer > 0
      ? [renderDashboardMetricCard("Waiting on Customer", stats.waitingOnCustomer, { view: "estimate" })]
      : []),
    ...(stats.waitingOnParts > 0
      ? [renderDashboardMetricCard("Waiting on Lace/Parts", stats.waitingOnParts, { view: "waiting" })]
      : []),
    renderDashboardMetricCard("Ready to Go", stats.readyToGo, { view: "ready" }),
    renderDashboardMetricCard("In Progress", stats.inProgress, { view: "progress" }),
    renderDashboardMetricCard("Completed This Month", stats.completedThisMonth, { view: "completed" }),
    renderDashboardMetricCard("Average Turnaround", avgTurnaroundDisplay, { sub: "All completed orders" })
  ].join("");

  const financeHtml = renderFinanceMetricCards(financeStats);

  const financeCustomHtml = financeFilterKey === "custom"
    ? `
      <div class="dashboard-finance-custom">
        <label>
          Start Date
          <input
            id="financeCustomStart"
            type="date"
            data-finance-custom-date
            value="${escapeAttr(financeFilterCustomStart)}"
          >
        </label>
        <label>
          End Date
          <input
            id="financeCustomEnd"
            type="date"
            data-finance-custom-date
            value="${escapeAttr(financeFilterCustomEnd)}"
          >
        </label>
      </div>
    `
    : "";

  /* Any dynamically-attached bench timer popover is about to be wiped
     by the innerHTML rebuild — clear its state too. */
  closeDashboardTimerPopover();

  const benchHtml = renderDashboardOrderList(benchOrders, "No bench work queued.", { timerControls: true });
  const onDeckHtml = renderDashboardOrderList(onDeckOrders, "No orders on deck.");
  const newHtml = renderDashboardOrderList(newOrders, "No new orders.");

  const attentionHtml = attentionItems.length
    ? attentionItems.map(item => `
        <button
          class="dashboard-attention-item"
          type="button"
          data-dashboard-view="${escapeAttr(item.view)}"
        >${escapeHtml(item.label)}</button>
      `).join("")
    : `<p class="dashboard-empty muted">Nothing needs attention right now.</p>`;

  dashboardPanel.innerHTML = `
    <div class="dashboard-shell">
      ${renderClubhouseGreeting()}
      <section class="dashboard-section dashboard-section-bench">
        <div class="dashboard-section-heading-row">
          <h2 class="dashboard-section-title">Today's Bench</h2>
          <span class="dashboard-section-kicker dashboard-section-kicker-primary">Work now</span>
        </div>
        <div class="dashboard-card dashboard-bench-card dashboard-bench-card--primary">${benchHtml}</div>
      </section>

      <section class="dashboard-section dashboard-section-ondeck">
        <div class="dashboard-section-heading-row">
          <h2 class="dashboard-section-title">On Deck</h2>
          <span class="dashboard-section-kicker">Coming up</span>
        </div>
        <div class="dashboard-card dashboard-bench-card dashboard-bench-card--secondary">${onDeckHtml}</div>
      </section>

      <section class="dashboard-section dashboard-section-neworders">
        <div class="dashboard-section-heading-row">
          <h2 class="dashboard-section-title">New Orders</h2>
          <span class="dashboard-section-kicker">No activity yet</span>
        </div>
        <div class="dashboard-card dashboard-bench-card dashboard-bench-card--secondary">${newHtml}</div>
      </section>

      <section class="dashboard-section">
        <h2 class="dashboard-section-title">Needs Attention</h2>
        <div class="dashboard-card dashboard-attention-card">${attentionHtml}</div>
      </section>

      <section class="dashboard-section dashboard-section-collapsible${metricsCollapsed ? " is-collapsed" : ""}" data-dashboard-collapse="metrics">
        <div class="dashboard-section-collapse-head">
          <h2 class="dashboard-section-title">Shop Metrics</h2>
          <button
            type="button"
            class="dashboard-section-collapse-btn"
            data-dashboard-collapse-toggle="metrics"
            aria-expanded="${metricsCollapsed ? "false" : "true"}"
            aria-label="Toggle Shop Metrics"
          >
            <span class="dashboard-section-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <div class="dashboard-section-body">
          <div class="dashboard-grid">${metricsHtml}</div>
        </div>
      </section>

      <section class="dashboard-section dashboard-section-finance dashboard-section-collapsible${financeCollapsed ? " is-collapsed" : ""}" data-dashboard-collapse="finance">
        <div class="dashboard-section-heading">
          <div class="dashboard-section-title-group">
            <h2 class="dashboard-section-title">Finance Snapshot</h2>
            <p class="dashboard-section-range muted">${escapeHtml(financeRangeLabel)}</p>
          </div>
          <div class="dashboard-finance-controls">
            <button
              id="financeFilterToggleBtn"
              class="dashboard-finance-filter-toggle${financeFilterMenuOpen ? " is-active" : ""}"
              type="button"
              aria-haspopup="menu"
              aria-expanded="${financeFilterMenuOpen ? "true" : "false"}"
              aria-controls="financeFilterPopover"
              aria-label="Finance date range"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h16"></path>
                <circle cx="9" cy="7" r="2"></circle>
                <path d="M4 17h16"></path>
                <circle cx="15" cy="17" r="2"></circle>
              </svg>
              <span>${escapeHtml(getFinanceFilterShortLabel(financeFilterKey))}</span>
            </button>
            <div
              id="financeFilterPopover"
              class="admin-filter-popover dashboard-finance-filter-popover"
              role="menu"
              aria-label="Finance date range"
              ${financeFilterMenuOpen ? "" : "hidden"}
            >
              <div class="admin-filter-list dashboard-finance-filter-list">
                ${renderFinanceFilterOptions(financeFilterKey)}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="dashboard-section-collapse-btn"
            data-dashboard-collapse-toggle="finance"
            aria-expanded="${financeCollapsed ? "false" : "true"}"
            aria-label="Toggle Finance Snapshot"
          >
            <span class="dashboard-section-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <div class="dashboard-section-body">
          ${financeCustomHtml}
          <div class="dashboard-grid dashboard-grid-finance">${financeHtml}</div>
        </div>
      </section>
    </div>
  `;
}

function wireHomeDashboardActions() {
  if (!dashboardPanel || dashboardPanel.dataset.wired === "true") return;
  dashboardPanel.dataset.wired = "true";

  dashboardPanel.addEventListener("click", (e) => {
    const collapseToggle = e.target.closest("[data-dashboard-collapse-toggle]");
    if (collapseToggle) {
      const key = collapseToggle.dataset.dashboardCollapseToggle;
      const section = collapseToggle.closest("[data-dashboard-collapse]");
      if (section) {
        /* Class-only toggle — never re-renders, so focused finance date
           inputs are safe. */
        const collapsed = section.classList.toggle("is-collapsed");
        setDashboardSectionCollapsed(key, collapsed);
        collapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
      return;
    }

    const financeToggle = e.target.closest("#financeFilterToggleBtn");
    if (financeToggle) {
      setFinanceFilterMenuOpen(!financeFilterMenuOpen);
      return;
    }

    const financeOption = e.target.closest("[data-finance-filter]");
    if (financeOption) {
      financeFilterKey = financeOption.dataset.financeFilter || "ytd";
      financeFilterMenuOpen = false;
      renderHomeDashboard();
      return;
    }

    const timerPhaseBtn = e.target.closest("[data-timer-phase]");
    if (timerPhaseBtn) {
      handleDashboardTimerPhaseSelect(
        timerPhaseBtn.dataset.timerOrder,
        timerPhaseBtn.dataset.timerPhase
      );
      return;
    }

    const timerControlBtn = e.target.closest("[data-timer-control]");
    if (timerControlBtn) {
      handleDashboardTimerControl(
        timerControlBtn.dataset.timerOrder,
        timerControlBtn.dataset.timerControl
      );
      return;
    }

    const timerActionBtn = e.target.closest("[data-timer-action]");
    if (timerActionBtn) {
      handleDashboardTimerAction(timerActionBtn);
      return;
    }

    const orderBtn = e.target.closest("[data-dashboard-order]");
    if (orderBtn) {
      /* Whole row is clickable — swallow the click that follows a
         long-press so the workflow sheet isn't immediately buried. */
      if (shouldSuppressOrderCardClick(orderBtn)) return;
      openOrder(orderBtn.dataset.dashboardOrder, { returnView: "dashboard" });
      return;
    }

    const viewBtn = e.target.closest("[data-dashboard-view]");
    if (viewBtn) {
      setActiveView(viewBtn.dataset.dashboardView);
    }
  });

  /* Rows replaced their Open button — keep them keyboard-operable. */
  dashboardPanel.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest?.(".dashboard-bench-row[data-dashboard-order]");
    if (!row || e.target !== row) return;
    e.preventDefault();
    openOrder(row.dataset.dashboardOrder, { returnView: "dashboard" });
  });

  /* Right-click / long-press on a Clubhouse row opens the workflow
     sheet, mirroring the Orders list card gesture. Skips the timer
     button, phase popover, Open button, and any other button so their
     behavior is untouched. */
  const resolveDashboardRowOrder = (e) => {
    if (
      e.target.closest?.(".dashboard-bench-actions") ||
      e.target.closest?.(".dashboard-timer-popover") ||
      e.target.closest?.("button")
    ) {
      return null;
    }
    const rowEl = e.target.closest?.(".dashboard-bench-row");
    if (!rowEl) return null;
    return allOrders.find(o => String(o.orderNumber) === String(rowEl.dataset.orderNumber)) || null;
  };

  dashboardPanel.addEventListener("contextmenu", (e) => {
    const order = resolveDashboardRowOrder(e);
    if (!order) return;
    e.preventDefault();
    openWorkflowSheet(order, e);
  });

  dashboardPanel.addEventListener("touchstart", (e) => {
    const order = resolveDashboardRowOrder(e);
    if (!order) return;
    startWorkflowPress(e, order);
  }, { passive: true });

  dashboardPanel.addEventListener("touchmove", cancelWorkflowPress, { passive: true });
  dashboardPanel.addEventListener("touchend", cancelWorkflowPress);
  dashboardPanel.addEventListener("touchcancel", cancelWorkflowPress);

  /* Close the bench timer phase popover on outside clicks by removing
     the element directly — never re-render the dashboard from here
     (same hazard as the finance popover below). */
  document.addEventListener("click", (e) => {
    if (!dashboardTimerPopoverOrder) return;
    if (e.target.closest?.(".dashboard-bench-actions")) return;
    closeDashboardTimerPopover();
  });

  /* Keep bench timer elapsed text from going stale without re-rendering. */
  setInterval(() => {
    if (activeView !== "dashboard") return;
    dashboardPanel.querySelectorAll("[data-bench-timer]").forEach(el => {
      const session = dashboardLaborSessions[el.dataset.benchTimer];
      if (session) el.textContent = getDashboardTimerStateLabel(session);
    });
  }, 30000);

  /* Close the popover without re-rendering the dashboard — a full
     re-render here would destroy a focused custom date input and
     kill the native date picker. */
  document.addEventListener("click", (e) => {
    if (!financeFilterMenuOpen) return;
    if (e.target.closest?.(".dashboard-finance-controls")) return;
    setFinanceFilterMenuOpen(false);
  });

  dashboardPanel.addEventListener("change", (e) => {
    if (e.target.matches("[data-finance-custom-date]")) {
      financeFilterCustomStart = document.getElementById("financeCustomStart")?.value || "";
      financeFilterCustomEnd = document.getElementById("financeCustomEnd")?.value || "";
      updateFinanceSnapshotSummary();
    }
  });
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
    case "dashboard": return "Clubhouse";
    case "map": return "Map";
    case "money": return "Money";
    case "upload": return "Gallery";
    case "inventory": return "Lace Inventory";
    case "gloves-sale": return "Gloves For Sale";
    case "users": return "Users";
    case "customers": return "Customers";
    case "calendar": return "Calendar";
    case "messages": return "Messages";
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

function getDefaultSectionExpanded(sectionKey) {
  switch (sectionKey) {
    case "customer":
    case "photos":
      return true;
    default:
      return false;
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

function buildCompactShippingAddress(street, city, state, zip) {
  const streetLine = String(street || "").trim();
  const cityLine = [String(city || "").trim(), String(state || "").trim()].filter(Boolean).join(", ");
  const zipLine = String(zip || "").trim();
  const cityStateZip = [cityLine, zipLine].filter(Boolean).join(" ");

  if (streetLine && cityStateZip) return `${streetLine}, ${cityStateZip}`;
  if (streetLine) return streetLine;
  if (cityStateZip) return cityStateZip;
  return "";
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
  const address = buildCompactShippingAddress(street, city, state, zip);
  const hasShippingData = !!(tracking || carrier || address || allowShip);

  if (!hasShippingData) return "No shipping info";

  const parts = ["Shipped"];
  if (address) parts.push(address);
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
  const address = buildCompactShippingAddress(street, city, state, zip);
  const hasShippingData = !!(tracking || carrier || address || allowShip);

  if (!hasShippingData) return "No shipping info";

  const parts = ["Shipped"];
  if (address) parts.push(address);
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
    <div data-photo-drop="orderPhotoInput" class="order-photo-drop">
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
    <div class="detail-photo-actions">
      <button id="orderPhotoAddBtn" class="detail-show-on-map-link detail-photo-add-link" type="button">Add Photo</button>
    </div>
    </div>
  `;

  const photoSection = renderCollapsibleDetailSection(
    "photos",
    "Photos",
    summarizePhotos(order),
    photoBody,
    {
      defaultExpanded: getDefaultSectionExpanded("photos"),
      sectionId: "detailPhotoSection",
      bodyId: "photosSectionBody"
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

const LABOR_TIMER_PHASES = [
  "Tear down",
  "Cleaning",
  "Relacing",
  "Conditioning",
  "Palm Pad",
  "Custom Work",
  "Photos",
  "Packing/Shipping",
  "Admin/Messaging",
  "Other"
];

/* =========================
   SHOP ECONOMICS V1
   All job-costing and pricing constants live here — nothing inline.
   Shipping is intentionally excluded from all economics math:
   shipping_cost is what the customer pays for the label plus a small
   rounded-up markup, charged on top of the quote at Ready to Go.
   It is pure pass-through — neither revenue nor expense.
========================= */
const SHOP_ECONOMICS = {
  laceCostPerPiece: 3.60,
  lacePieceDefaults: { "Fielders Glove": 3, "Catchers Mitt": 4, "First Base Mitt": 5 },
  lacePiecesTrapezeBonus: 1,
  palmPadUnitCost: 1.25, // $25 ShockTec 5 sq ft sheet ÷ twenty 6"x6" pads
  consumablesPerCleaning: 1.00,
  /* Measured pricing (2.1): suggested = median measured hours x target
     rate + materials. Tune the target rate here. */
  targetHourlyRate: 45,
  /* Every finished glove goes out with 1 business card + 1 sticker.
     Priced at replacement cost (cards $40.22/100, stickers $41.63/100) —
     the free replacement cards are a windfall, not a cost basis. */
  packagingPerOrder: 0.82
};

const SHOP_PRICING = {
  relaceBase: { "Fielders Glove": 80, "Catchers Mitt": 100, "First Base Mitt": 100 },
  trapezeUpcharge: 20, // fielders w/ Trapeze or Modified Trapeze web => 100
  palmPadAddOn: 20
};

function getOrderSelectedServices(order) {
  return parseServicesValue(order?.servicesRequested || "").selected;
}

function orderHasRelacingService(order) {
  const services = getOrderSelectedServices(order);
  return services.includes("Relacing") || services.includes("Cleaning + Conditioning + Relacing");
}

function orderHasCleaningService(order) {
  const services = getOrderSelectedServices(order);
  return services.includes("Cleaning + Conditioning") || services.includes("Cleaning + Conditioning + Relacing");
}

function orderHasPalmPadService(order) {
  return getOrderSelectedServices(order).includes("ShockTec Air2Gel Palm Pad");
}

function orderHasTrapezeWeb(order) {
  return String(order?.webType || "").toLowerCase().includes("trapeze");
}

function getDefaultLacePieces(order) {
  const base = SHOP_ECONOMICS.lacePieceDefaults[String(order?.gloveType || "")] ?? 4;
  const trapezeBonus = String(order?.gloveType || "") === "Fielders Glove" && orderHasTrapezeWeb(order)
    ? SHOP_ECONOMICS.lacePiecesTrapezeBonus
    : 0;
  return base + trapezeBonus;
}

/* Actual lace consumption recorded at Ready to Go (these same numbers
   decrement lace inventory). Returns null until any usage is recorded. */
function getOrderActualLacePieces(order) {
  const primary = Number(order?.primaryLaceUsed);
  const secondary = Number(order?.secondaryLaceUsed);
  const total = (Number.isFinite(primary) ? primary : 0)
    + (Number.isFinite(secondary) ? secondary : 0);
  return total > 0 ? total : null;
}

/* Lace pieces precedence: manual override > actual recorded usage >
   glove-type estimate (estimate only applies to relacing orders). */
function getOrderMaterialsCost(order) {
  const override = order?.lacePiecesUsed != null && Number.isFinite(Number(order.lacePiecesUsed))
    ? Number(order.lacePiecesUsed)
    : null;
  const actual = getOrderActualLacePieces(order);

  let lacePieces;
  if (override !== null) {
    lacePieces = override;
  } else if (actual !== null) {
    lacePieces = actual;
  } else {
    lacePieces = orderHasRelacingService(order) ? getDefaultLacePieces(order) : 0;
  }

  const laceCost = lacePieces * SHOP_ECONOMICS.laceCostPerPiece;
  const palmPadCost = orderHasPalmPadService(order) ? SHOP_ECONOMICS.palmPadUnitCost : 0;
  const consumables = orderHasCleaningService(order) ? SHOP_ECONOMICS.consumablesPerCleaning : 0;
  const packaging = SHOP_ECONOMICS.packagingPerOrder;

  return {
    lacePieces,
    laceCost,
    palmPadCost,
    consumables,
    packaging,
    total: laceCost + palmPadCost + consumables + packaging
  };
}

function getOrderEconomics(order, laborMinutes) {
  const materials = getOrderMaterialsCost(order);
  const minutes = Number(laborMinutes);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const price = Number(order?.priceQuoted);
  const hasPrice = order?.priceQuoted != null && order?.priceQuoted !== "" && Number.isFinite(price);

  const net = hasPrice ? price - materials.total : null;

  let hourlyRate = null;
  let reason = "";
  if (!hasPrice) {
    reason = "No price set";
  } else if (safeMinutes <= 0) {
    reason = "No labor logged";
  } else {
    hourlyRate = net / (safeMinutes / 60);
  }

  return { materials, net, laborMinutes: safeMinutes, hourlyRate, reason };
}

function getOrderEconomicsSummaryText(order) {
  if (orderDetailLaborMinutes === null) return "";
  const econ = getOrderEconomics(order, orderDetailLaborMinutes);
  return econ.hourlyRate !== null ? `${formatCurrency(econ.hourlyRate)}/hr` : "";
}

function renderOrderEconomicsBody(order) {
  const laborLoaded = orderDetailLaborMinutes !== null;
  const econ = getOrderEconomics(order, laborLoaded ? orderDetailLaborMinutes : 0);
  const m = econ.materials;
  const hasPrice = econ.net !== null;
  const suggestion = getSuggestedPrice(order);
  const isOverride = order?.lacePiecesUsed != null;
  const actualPieces = getOrderActualLacePieces(order);
  const defaultPieces = getDefaultLacePieces(order);
  const piecesSourceLabel = isOverride
    ? `(override${actualPieces !== null ? ` — actual used ${actualPieces}` : ` — estimate ${defaultPieces}`})`
    : (actualPieces !== null
        ? "(actual lace used)"
        : `(estimate for glove type: ${defaultPieces})`);

  let suggestionHtml = "";
  const measured = getMeasuredSuggestion(order);
  const suggestedPrice = measured ? measured.price : (suggestion ? suggestion.price : null);
  if (suggestedPrice !== null) {
    let deltaText = "";
    if (hasPrice) {
      const delta = Number(order.priceQuoted) - suggestedPrice;
      if (delta !== 0) {
        const sign = delta > 0 ? "+" : "−";
        deltaText = ` (quoted ${formatCurrency(Number(order.priceQuoted))}, ${sign}${formatCurrency(Math.abs(delta))} vs suggested)`;
      }
    }
    let basis = measured
      ? `median ${formatLaborDuration(measured.medianMinutes)} × ${formatCurrency(SHOP_ECONOMICS.targetHourlyRate)}/hr + materials, from ${measured.n} measured jobs`
      : `rule-based — under ${MEASURED_MIN_BUCKET_JOBS} measured jobs of this type so far`;
    if (orderHasCustomWork(order)) {
      basis += orderCustomPhaseMinutes(order.orderNumber) > 0
        ? ` · custom work timed under its own phase — the standard time feeds the medians`
        : ` · custom work on this order — time the bespoke part under the "Custom Work" phase so the standard time can feed the medians`;
    }
    suggestionHtml = `
      <div class="order-economics-suggestion muted">Suggested price: ${escapeHtml(formatCurrency(suggestedPrice))}${escapeHtml(deltaText)}</div>
      <div class="order-economics-basis">${escapeHtml(basis)}</div>
    `;
  }

  const rateDisplay = econ.hourlyRate !== null
    ? escapeHtml(`${formatCurrency(econ.hourlyRate)}/hr`)
    : `— <span class="order-economics-reason muted">${escapeHtml(laborLoaded ? econ.reason : "Loading labor…")}</span>`;

  return `
    <div class="order-economics">
      <div class="order-economics-rate">
        <span class="order-economics-rate-label">Effective rate</span>
        <strong class="order-economics-rate-value">${rateDisplay}</strong>
      </div>
      ${suggestionHtml}
      <div class="order-economics-lines">
        <div class="order-economics-line"><span>Price</span><span>${hasPrice ? escapeHtml(formatCurrency(Number(order.priceQuoted))) : "—"}</span></div>
        ${m.lacePieces > 0 ? `<div class="order-economics-line"><span>Lace</span><span>${m.lacePieces} × ${escapeHtml(formatCurrency(SHOP_ECONOMICS.laceCostPerPiece))} = ${escapeHtml(formatCurrency(m.laceCost))}</span></div>` : ""}
        ${m.palmPadCost > 0 ? `<div class="order-economics-line"><span>Palm pad</span><span>${escapeHtml(formatCurrency(m.palmPadCost))}</span></div>` : ""}
        ${m.consumables > 0 ? `<div class="order-economics-line"><span>Consumables</span><span>${escapeHtml(formatCurrency(m.consumables))}</span></div>` : ""}
        ${m.packaging > 0 ? `<div class="order-economics-line"><span>Card + sticker</span><span>${escapeHtml(formatCurrency(m.packaging))}</span></div>` : ""}
        <div class="order-economics-line order-economics-line--strong"><span>Materials</span><span>${escapeHtml(formatCurrency(m.total))}</span></div>
        <div class="order-economics-line order-economics-line--strong"><span>Net</span><span>${econ.net !== null ? escapeHtml(formatCurrency(econ.net)) : "—"}</span></div>
        <div class="order-economics-line"><span>Labor</span><span>${laborLoaded ? escapeHtml(formatLaborDuration(econ.laborMinutes)) : "—"}</span></div>
      </div>
      ${orderHasRelacingService(order) ? `
        <div class="order-economics-pieces">
          <label class="order-economics-pieces-label" for="economicsLacePieces">
            Lace pieces <span class="muted">${escapeHtml(piecesSourceLabel)}</span>
          </label>
          <input
            id="economicsLacePieces"
            class="order-economics-pieces-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            value="${escapeAttr(String(m.lacePieces))}"
          >
        </div>
      ` : ""}
    </div>
  `;
}

function renderOrderEconomicsSection(order) {
  return renderCollapsibleDetailSection(
    "economics",
    "Economics",
    getOrderEconomicsSummaryText(order),
    renderOrderEconomicsBody(order),
    {
      defaultExpanded: getDefaultSectionExpanded("economics"),
      sectionId: "economicsSection",
      bodyId: "economicsSectionBody"
    }
  );
}

function updateOrderEconomicsSection(order = currentOrder) {
  if (!order) return;

  const body = document.getElementById("economicsSectionBody");
  if (body) body.innerHTML = renderOrderEconomicsBody(order);

  const summaryEl = orderDetail?.querySelector(`[data-section-summary="economics"]`);
  if (summaryEl) {
    const summary = getOrderEconomicsSummaryText(order);
    summaryEl.textContent = summary ? `· ${summary}` : "";
  }
}

/* Lace-pieces override has its own tiny save path — isolated from the
   main Order Detail Save button and form collection. */
function ensureOrderEconomicsDelegation() {
  if (orderEconomicsDelegated || !orderDetail) return;
  orderEconomicsDelegated = true;

  orderDetail.addEventListener("change", async (e) => {
    if (e.target?.id !== "economicsLacePieces") return;
    const order = currentOrder;
    if (!order?.orderNumber) return;

    const raw = String(e.target.value || "").trim();
    let nextValue = null;
    if (raw !== "") {
      const parsed = Math.round(Number(raw));
      if (!Number.isFinite(parsed) || parsed < 0) {
        updateOrderEconomicsSection(order);
        return;
      }
      nextValue = parsed;
    }

    e.target.disabled = true;
    try {
      await saveOrderUpdate(order.orderNumber, { lacePiecesUsed: nextValue }, true);
    } catch (err) {
      alert(err?.message || "Lace pieces could not be saved.");
    }
    updateOrderEconomicsSection();
  });
}

/* Rule-based quote suggestion from SHOP_PRICING only — never derived
   from historical quoted prices. The price table is swappable: a
   future sprint will replace it with measured timer data. */
function getSuggestedPrice(order) {
  if (!orderHasRelacingService(order)) return null;

  const gloveType = String(order?.gloveType || "");
  const base = SHOP_PRICING.relaceBase[gloveType] ?? SHOP_PRICING.relaceBase["Fielders Glove"];
  const parts = [`Relace: ${formatCurrency(base)}`];
  let price = base;

  if (gloveType === "Fielders Glove" && orderHasTrapezeWeb(order)) {
    price += SHOP_PRICING.trapezeUpcharge;
    parts.push(`Trapeze web: +${formatCurrency(SHOP_PRICING.trapezeUpcharge)}`);
  }

  if (orderHasPalmPadService(order)) {
    price += SHOP_PRICING.palmPadAddOn;
    parts.push(`Palm pad: +${formatCurrency(SHOP_PRICING.palmPadAddOn)}`);
  }

  return { price, parts };
}

/* =========================
   MONEY VIEW
========================= */
let moneyLaborSummaryCache = null;
let moneyViewDelegated = false;

async function renderMoneyView() {
  const panel = document.getElementById("moneyPanel");
  if (!panel) return;

  ensureMoneyViewDelegation();
  panel.innerHTML = `<div class="dashboard-card money-empty muted">Loading job economics…</div>`;

  let sessions = [];
  let loadError = "";
  try {
    const data = await postJson({ action: "listLaborSummary" }, true);
    sessions = data.sessions || [];
    moneyLaborSummaryCache = sessions;
  } catch (err) {
    if (moneyLaborSummaryCache) {
      sessions = moneyLaborSummaryCache;
    } else {
      loadError = err?.message || "Labor summary could not be loaded.";
    }
  }

  if (activeView !== "money") return;
  panel.innerHTML = renderMoneyViewContent(sessions, loadError);
}

function ensureMoneyViewDelegation() {
  if (moneyViewDelegated) return;
  const panel = document.getElementById("moneyPanel");
  if (!panel) return;
  moneyViewDelegated = true;

  panel.addEventListener("click", (e) => {
    const row = e.target.closest("[data-money-order]");
    if (!row) return;
    openOrder(row.dataset.moneyOrder, { returnView: "money" });
  });
}

function buildMoneyRollup(items, keyFn, { sortByLabelDesc = false } = {}) {
  const groups = new Map();
  items.forEach(item => {
    const label = keyFn(item) || "Other";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });

  const rows = Array.from(groups.entries()).map(([label, groupItems]) => {
    const jobs = groupItems.length;
    const priced = groupItems.filter(i => i.econ.net !== null);
    const avgPrice = priced.length
      ? priced.reduce((s, i) => s + Number(i.order.priceQuoted), 0) / priced.length
      : null;
    const avgMaterials = groupItems.reduce((s, i) => s + i.econ.materials.total, 0) / jobs;
    const avgMinutes = groupItems.reduce((s, i) => s + i.econ.laborMinutes, 0) / jobs;
    const netSum = priced.reduce((s, i) => s + i.econ.net, 0);
    const pricedHours = priced.reduce((s, i) => s + i.econ.laborMinutes, 0) / 60;
    const rate = pricedHours > 0 ? netSum / pricedHours : null;
    return { label, jobs, avgPrice, avgMaterials, avgMinutes, rate };
  });

  rows.sort(sortByLabelDesc
    ? (a, b) => String(b.label).localeCompare(String(a.label))
    : (a, b) => b.jobs - a.jobs);
  return rows;
}

function renderMoneyRollupTable(title, firstColumn, rows) {
  if (!rows.length) return "";
  return `
    <div class="dashboard-card money-card">
      <h3 class="money-card-title">${escapeHtml(title)}</h3>
      <div class="money-table-wrap">
        <table class="money-table">
          <thead>
            <tr><th>${escapeHtml(firstColumn)}</th><th>Jobs</th><th>Avg price</th><th>Avg materials</th><th>Avg hours</th><th>$/hr</th></tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${row.jobs}</td>
                <td>${row.avgPrice !== null ? escapeHtml(formatCurrency(row.avgPrice)) : "—"}</td>
                <td>${escapeHtml(formatCurrency(row.avgMaterials))}</td>
                <td>${escapeHtml(formatLaborDuration(row.avgMinutes))}</td>
                <td>${row.rate !== null ? escapeHtml(`${formatCurrency(row.rate)}/hr`) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMoneyJobsTable(title, items) {
  if (!items.length) return "";
  return `
    <div class="dashboard-card money-card">
      <h3 class="money-card-title">${escapeHtml(title)}</h3>
      <div class="money-table-wrap">
        <table class="money-table">
          <thead>
            <tr><th>Customer</th><th>Order</th><th>Service</th><th>Price</th><th>Hours</th><th>$/hr</th></tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const unpaid = String(item.order.paid || "").toLowerCase() !== "paid";
              return `
                <tr class="money-job-row" data-money-order="${escapeAttr(String(item.order.orderNumber || ""))}">
                  <td>${escapeHtml(item.order.customerName || "Customer")}</td>
                  <td>#${escapeHtml(String(item.order.orderNumber || ""))}</td>
                  <td>${escapeHtml(getOrderSelectedServices(item.order).join(" + ") || "—")}</td>
                  <td>${escapeHtml(formatCurrency(Number(item.order.priceQuoted)))}${unpaid ? ` <span class="money-unpaid muted">unpaid</span>` : ""}</td>
                  <td>${escapeHtml(formatLaborDuration(item.econ.laborMinutes))}</td>
                  <td>${escapeHtml(`${formatCurrency(item.econ.hourlyRate)}/hr`)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* Money view only counts finished work — in-progress orders have
   partial labor logged and would skew every rate. */
function isMoneyEligibleOrder(order) {
  return normalizeStatus(order?.status) === "ready to go" || isCompletedOrder(order);
}

function renderMoneyViewContent(sessions, loadError) {
  const laborByOrder = {};
  (Array.isArray(sessions) ? sessions : []).forEach(session => {
    const key = String(session.orderNumber || "");
    if (!key) return;
    laborByOrder[key] = (laborByOrder[key] || 0) + (Number(session.durationMinutes) || 0);
  });

  const rows = allOrders.filter(isMoneyEligibleOrder).map(order => {
    const laborMinutes = laborByOrder[String(order.orderNumber)] || 0;
    return { order, econ: getOrderEconomics(order, laborMinutes) };
  });

  /* Rollups only count orders with labor logged; the rest appear only in
     the coverage stat. Jobs under 15 logged minutes are excluded from the
     rollups and best/worst too — a 3-minute test session otherwise prints
     a $4,000/hr artifact. */
  const MIN_ROLLUP_LABOR_MINUTES = 15;
  const logged = rows.filter(r => r.econ.laborMinutes > 0);
  const withLabor = logged.filter(r => r.econ.laborMinutes >= MIN_ROLLUP_LABOR_MINUTES);
  const excludedCount = logged.length - withLabor.length;
  const rated = withLabor.filter(r => r.econ.hourlyRate !== null);

  const totalNet = rated.reduce((sum, r) => sum + r.econ.net, 0);
  const ratedHours = rated.reduce((sum, r) => sum + r.econ.laborMinutes, 0) / 60;
  const overallRate = ratedHours > 0 ? totalNet / ratedHours : null;
  const totalLaborMinutes = withLabor.reduce((sum, r) => sum + r.econ.laborMinutes, 0);
  const totalMaterials = withLabor.reduce((sum, r) => sum + r.econ.materials.total, 0);

  const errorHtml = loadError
    ? `<div class="money-error">${escapeHtml(loadError)}</div>`
    : "";

  const statsHtml = `
    <div class="dashboard-grid money-stat-grid">
      ${renderDashboardMetricCard("Effective $/hr", overallRate !== null ? `${formatCurrency(overallRate)}/hr` : "—", { sub: "Jobs with labor + price" })}
      ${renderDashboardMetricCard("Jobs with labor", `${withLabor.length} of ${rows.length}`, { sub: excludedCount ? `Ready to Go / Completed · ${excludedCount} under 15m excluded` : "Ready to Go / Completed" })}
      ${renderDashboardMetricCard("Total labor", formatLaborDuration(totalLaborMinutes))}
      ${renderDashboardMetricCard("Materials cost", formatCurrency(totalMaterials), { sub: "Jobs with labor" })}
    </div>
  `;

  if (!withLabor.length) {
    return `
      ${errorHtml}
      ${statsHtml}
      <div class="dashboard-card money-empty muted">No labor logged yet — run timers on your jobs and this page fills in.</div>
    `;
  }

  const byService = buildMoneyRollup(withLabor, r => getOrderSelectedServices(r.order).join(" + ") || "Other");
  const byGlove = buildMoneyRollup(withLabor, r => String(r.order.gloveType || "Unknown"));
  /* Referral ROI uses ALL money-eligible orders — revenue per source
     doesn't require labor logs; $/hr fills in as timers cover more jobs. */
  const byReferral = buildMoneyRollup(rows, r => {
    const src = String(r.order.referralSource || "").trim();
    if (!src) return "Unknown";
    return src.toLowerCase().startsWith("other") ? "Other" : src;
  });

  const byMonth = buildMoneyRollup(
    withLabor,
    r => String(r.order.dateCompleted || r.order.createdAt || r.order.timestampSubmitted || "").slice(0, 7) || "Unknown",
    { sortByLabelDesc: true }
  );

  const sortedByRate = rated.slice().sort((a, b) => b.econ.hourlyRate - a.econ.hourlyRate);
  const best = sortedByRate.slice(0, 5);
  const worst = sortedByRate.length > 5 ? sortedByRate.slice(-5).reverse() : [];

  return `
    ${errorHtml}
    ${statsHtml}
    ${renderMoneyRollupTable("By Service", "Service", byService)}
    ${renderMoneyRollupTable("By Glove Type", "Glove type", byGlove)}
    ${renderMoneyRollupTable("By Month", "Month", byMonth)}
    ${renderMoneyRollupTable("By Referral Source", "Source", byReferral)}
    ${renderMeasuredTimesTable(sessions)}
    ${renderMoneyJobsTable("Best Jobs ($/hr)", best)}
    ${worst.length ? renderMoneyJobsTable("Worst Jobs ($/hr)", worst) : ""}
  `;
}

function formatLaborDuration(minutes) {
  const totalMinutes = Number(minutes);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "—";

  const rounded = Math.round(totalMinutes);
  if (rounded < 60) return `${rounded}m`;

  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatLaborElapsed(startedAt) {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return "—";
  const minutes = (Date.now() - started.getTime()) / 60000;
  return formatLaborDuration(minutes);
}

function getLaborSessionStatus(session) {
  if (!session || session.endedAt) return "stopped";
  if (session.status === "paused") return "paused";
  return "running";
}

/* Client mirror of the API duration rules — active time excludes paused time:
   running: (now - startedAt) - pauseAccumulatedSeconds
   paused:  (pausedAt - startedAt) - pauseAccumulatedSeconds
   clamped at >= 0. */
function getLaborActiveSeconds(session) {
  if (!session?.startedAt) return 0;
  const started = new Date(session.startedAt);
  if (Number.isNaN(started.getTime())) return 0;

  const status = getLaborSessionStatus(session);
  let referenceMs = Date.now();
  if (status === "paused" && session.pausedAt) {
    const paused = new Date(session.pausedAt);
    if (!Number.isNaN(paused.getTime())) referenceMs = paused.getTime();
  } else if (status === "stopped" && session.endedAt) {
    const ended = new Date(session.endedAt);
    if (!Number.isNaN(ended.getTime())) referenceMs = ended.getTime();
  }

  const pausedSeconds = Number(session.pauseAccumulatedSeconds) || 0;
  const seconds = (referenceMs - started.getTime()) / 1000 - pausedSeconds;
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function formatLaborSessionElapsed(session) {
  return formatLaborDuration(getLaborActiveSeconds(session) / 60);
}

function formatLaborDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getLaborSessionsSummary(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return "";

  const active = sessions.find(session => !session.endedAt);
  if (active) {
    const stateLabel = getLaborSessionStatus(active) === "paused" ? "Paused" : "Running";
    return `${stateLabel} · ${active.phase}`;
  }

  const totalMinutes = sessions
    .filter(session => session.endedAt)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  if (totalMinutes > 0) return `${formatLaborDuration(totalMinutes)} logged`;
  return "";
}

function renderLaborPhaseOptions(selectedPhase = "") {
  const selected = String(selectedPhase || "");
  return `
    <option value="">Select phase</option>
    ${LABOR_TIMER_PHASES.map(phase => `
      <option value="${escapeAttr(phase)}"${phase === selected ? " selected" : ""}>${escapeHtml(phase)}</option>
    `).join("")}
  `;
}

function renderLaborTimerSection(order) {
  const body = `
    <div id="laborTimerPanel" class="labor-timer" data-order-number="${escapeAttr(order.orderNumber || "")}">
      <p class="muted labor-timer-empty">Loading labor timer...</p>
    </div>
  `;

  return renderCollapsibleDetailSection(
    "laborTimer",
    "Labor Timer",
    "",
    body,
    {
      defaultExpanded: getDefaultSectionExpanded("laborTimer"),
      sectionId: "laborTimerSection",
      bodyId: "laborTimerSectionBody"
    }
  );
}

function renderLaborSessionRows(sessions) {
  const completed = (Array.isArray(sessions) ? sessions : [])
    .filter(session => session.endedAt)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (!completed.length) {
    return `<p class="muted labor-timer-empty">No labor logged yet.</p>`;
  }

  return `
    <div class="labor-session-list">
      ${completed.map(session => `
        <div class="labor-session-row">
          <div class="labor-session-main">
            <strong>${escapeHtml(session.phase || "Work")}</strong>
            <span class="labor-session-duration">${escapeHtml(formatLaborDuration(session.durationMinutes))}</span>
          </div>
          <div class="labor-session-meta muted">
            <span>${escapeHtml(formatLaborDateTime(session.startedAt))}</span>
            ${session.notes ? `<span class="labor-session-notes">${escapeHtml(session.notes)}</span>` : ""}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLaborTimerPanel(sessions, { error = "" } = {}) {
  const active = (Array.isArray(sessions) ? sessions : []).find(session => !session.endedAt) || null;
  const totalMinutes = (Array.isArray(sessions) ? sessions : [])
    .filter(session => session.endedAt)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  const notesValue = active?.notes || "";
  const selectedPhase = active?.phase || "";

  return `
    ${error ? `<p class="labor-timer-error" role="alert">${escapeHtml(error)}</p>` : ""}

    ${active ? `
      <div class="labor-timer-card labor-timer-card--active">
        <div class="labor-timer-active-label">
          Active timer
          <span class="labor-timer-status${getLaborSessionStatus(active) === "paused" ? " labor-timer-status--paused" : ""}">${getLaborSessionStatus(active) === "paused" ? "Paused" : "Running"}</span>
        </div>
        <div class="labor-timer-active-main">
          <strong>${escapeHtml(active.phase)}</strong>
          <span id="laborTimerElapsed" class="labor-timer-elapsed">${escapeHtml(formatLaborSessionElapsed(active))}</span>
        </div>
        <div class="labor-timer-active-meta muted">
          Started ${escapeHtml(formatLaborDateTime(active.startedAt))}
        </div>
      </div>
    ` : ""}

    <div class="labor-timer-card labor-timer-controls">
      <div class="labor-timer-field">
        <label class="labor-timer-label" for="laborTimerPhase">Phase</label>
        <select id="laborTimerPhase" class="labor-timer-select"${active ? " disabled" : ""}>
          ${renderLaborPhaseOptions(selectedPhase)}
        </select>
      </div>

      <div class="labor-timer-field">
        <label class="labor-timer-label" for="laborTimerNotes">Notes</label>
        <textarea
          id="laborTimerNotes"
          class="labor-timer-notes"
          rows="2"
          placeholder="Optional notes for this session"
        >${escapeHtml(notesValue)}</textarea>
      </div>

      <div class="labor-timer-actions">
        <button
          id="laborTimerStartBtn"
          class="labor-timer-btn"
          type="button"
          data-labor-start
          ${active ? "disabled" : ""}
        >Start Timer</button>
        ${active && getLaborSessionStatus(active) === "running" ? `
          <button
            id="laborTimerPauseBtn"
            class="labor-timer-btn"
            type="button"
            data-labor-pause
            data-session-id="${escapeAttr(active.id)}"
          >Pause</button>
        ` : ""}
        ${active && getLaborSessionStatus(active) === "paused" ? `
          <button
            id="laborTimerResumeBtn"
            class="labor-timer-btn"
            type="button"
            data-labor-resume
            data-session-id="${escapeAttr(active.id)}"
          >Resume</button>
        ` : ""}
        ${active ? `
          <button
            id="laborTimerStopBtn"
            class="labor-timer-btn labor-timer-btn--stop"
            type="button"
            data-labor-stop
            data-session-id="${escapeAttr(active.id)}"
          >Stop Timer</button>
        ` : ""}
      </div>
    </div>

    <div class="labor-timer-total">
      <span class="labor-timer-total-label">Total logged</span>
      <strong class="labor-timer-total-value">${escapeHtml(formatLaborDuration(totalMinutes))}</strong>
    </div>

    <div class="labor-timer-history">
      <div class="labor-timer-history-label">Session history</div>
      ${renderLaborSessionRows(sessions)}
    </div>
  `;
}

function updateLaborTimerSummary(sessions) {
  const summary = getLaborSessionsSummary(sessions);
  const summaryEl = orderDetail?.querySelector(`[data-section-summary="laborTimer"]`);
  if (summaryEl) {
    summaryEl.textContent = summary ? `· ${summary}` : "";
  }
}

function stopLaborTimerTick() {
  if (laborTimerTickInterval) {
    clearInterval(laborTimerTickInterval);
    laborTimerTickInterval = null;
  }
}

function startLaborTimerTick(activeSession) {
  stopLaborTimerTick();
  if (!activeSession?.startedAt) return;
  if (getLaborSessionStatus(activeSession) !== "running") return;

  const elapsedEl = document.getElementById("laborTimerElapsed");
  if (!elapsedEl) return;

  laborTimerTickInterval = setInterval(() => {
    if (!document.getElementById("laborTimerElapsed")) {
      stopLaborTimerTick();
      return;
    }
    elapsedEl.textContent = formatLaborSessionElapsed(activeSession);
  }, 1000);
}

async function loadLaborSessions(orderNumber, { preserveError = "" } = {}) {
  const panel = document.getElementById("laborTimerPanel");
  if (!panel || !orderNumber) return;

  const token = laborTimerLoadToken + 1;
  laborTimerLoadToken = token;
  stopLaborTimerTick();

  try {
    const data = await postJson({
      action: "listLaborSessions",
      orderNumber
    }, true);

    if (token !== laborTimerLoadToken) return;
    if (!currentOrder || String(currentOrder.orderNumber) !== String(orderNumber)) return;

    const sessions = data.sessions || [];
    panel.innerHTML = renderLaborTimerPanel(sessions, { error: preserveError });
    updateLaborTimerSummary(sessions);

    /* Economics counts stopped sessions only — open/paused sessions
       don't contribute labor minutes until stopped. */
    orderDetailLaborMinutes = sessions
      .filter(session => session.endedAt)
      .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
    updateOrderEconomicsSection();

    const active = sessions.find(session => !session.endedAt);
    if (active) startLaborTimerTick(active);
  } catch (err) {
    if (token !== laborTimerLoadToken) return;
    panel.innerHTML = renderLaborTimerPanel([], {
      error: err?.message || "Labor timer could not be loaded."
    });
    updateLaborTimerSummary([]);
    orderDetailLaborMinutes = null;
    updateOrderEconomicsSection();
  }
}

async function handleLaborTimerStart(orderNumber) {
  const phase = document.getElementById("laborTimerPhase")?.value || "";
  const notes = document.getElementById("laborTimerNotes")?.value || "";

  if (!phase) {
    await loadLaborSessions(orderNumber, {
      preserveError: "Select a phase before starting the timer."
    });
    return;
  }

  const startBtn = document.getElementById("laborTimerStartBtn");
  if (startBtn) startBtn.disabled = true;

  try {
    await postJson({
      action: "startLaborSession",
      orderNumber,
      phase,
      notes
    }, true);

    await loadLaborSessions(orderNumber);
    loadOrderActivity(orderNumber);
  } catch (err) {
    await loadLaborSessions(orderNumber, {
      preserveError: err?.message || "Labor timer could not be started."
    });
  }
}

async function handleLaborTimerPause(orderNumber, sessionId) {
  const pauseBtn = document.getElementById("laborTimerPauseBtn");
  const notes = document.getElementById("laborTimerNotes")?.value || "";
  if (pauseBtn) pauseBtn.disabled = true;

  try {
    await postJson({
      action: "pauseLaborSession",
      sessionId,
      notes
    }, true);

    stopLaborTimerTick();
    await loadLaborSessions(orderNumber);
  } catch (err) {
    await loadLaborSessions(orderNumber, {
      preserveError: err?.message || "Labor timer could not be paused."
    });
  }
}

async function handleLaborTimerResume(orderNumber, sessionId) {
  const resumeBtn = document.getElementById("laborTimerResumeBtn");
  const notes = document.getElementById("laborTimerNotes")?.value || "";
  if (resumeBtn) resumeBtn.disabled = true;

  try {
    await postJson({
      action: "resumeLaborSession",
      sessionId,
      notes
    }, true);

    await loadLaborSessions(orderNumber);
  } catch (err) {
    await loadLaborSessions(orderNumber, {
      preserveError: err?.message || "Labor timer could not be resumed."
    });
  }
}

async function handleLaborTimerStop(orderNumber, sessionId) {
  const stopBtn = document.getElementById("laborTimerStopBtn");
  const notes = document.getElementById("laborTimerNotes")?.value || "";
  if (stopBtn) stopBtn.disabled = true;

  try {
    await postJson({
      action: "stopLaborSession",
      sessionId,
      notes
    }, true);

    stopLaborTimerTick();
    await loadLaborSessions(orderNumber);
    loadOrderActivity(orderNumber);
  } catch (err) {
    await loadLaborSessions(orderNumber, {
      preserveError: err?.message || "Labor timer could not be stopped."
    });
  }
}

function ensureLaborTimerDelegation() {
  if (laborTimerDelegated || !orderDetail) return;

  laborTimerDelegated = true;
  orderDetail.addEventListener("click", (e) => {
    const startBtn = e.target.closest("[data-labor-start]");
    if (startBtn) {
      e.preventDefault();
      const orderNumber = document.getElementById("laborTimerPanel")?.dataset.orderNumber || currentOrder?.orderNumber;
      if (!orderNumber) return;
      handleLaborTimerStart(orderNumber);
      return;
    }

    const pauseBtn = e.target.closest("[data-labor-pause]");
    if (pauseBtn) {
      e.preventDefault();
      const orderNumber = document.getElementById("laborTimerPanel")?.dataset.orderNumber || currentOrder?.orderNumber;
      const sessionId = pauseBtn.dataset.sessionId;
      if (!orderNumber || !sessionId) return;
      handleLaborTimerPause(orderNumber, sessionId);
      return;
    }

    const resumeBtn = e.target.closest("[data-labor-resume]");
    if (resumeBtn) {
      e.preventDefault();
      const orderNumber = document.getElementById("laborTimerPanel")?.dataset.orderNumber || currentOrder?.orderNumber;
      const sessionId = resumeBtn.dataset.sessionId;
      if (!orderNumber || !sessionId) return;
      handleLaborTimerResume(orderNumber, sessionId);
      return;
    }

    const stopBtn = e.target.closest("[data-labor-stop]");
    if (stopBtn) {
      e.preventDefault();
      const orderNumber = document.getElementById("laborTimerPanel")?.dataset.orderNumber || currentOrder?.orderNumber;
      const sessionId = stopBtn.dataset.sessionId;
      if (!orderNumber || !sessionId) return;
      handleLaborTimerStop(orderNumber, sessionId);
    }
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
  "Lace Repair",
  "ShockTec Air2Gel Palm Pad"
];

/* Lace color options come from the live lace inventory — same source, labels,
   and sort as the public services page and service request form, so an order's
   stored value always round-trips through the Order Detail selects. */
const ADMIN_LACE_LABEL_OVERRIDES = new Map([
  ["blue - carolina", "Carolina Blue"],
  ["blue - navy", "Navy Blue"],
  ["blue - royal", "Royal Blue"],
  ["brown - chocolate", "Chocolate"],
  ["red - dark", "Dark Red"],
  ["tan - camel", "Camel"],
  ["tan - indian", "Indian Tan"],
  ["tan - japan", "Japan Tan"]
]);
const ADMIN_LACE_SORT_ORDER = new Map([
  ["black", 10],
  ["gray", 20],
  ["tan - camel", 30],
  ["tan - indian", 40],
  ["tan - japan", 50],
  ["brown - chocolate", 60],
  ["blue - carolina", 80],
  ["blue - royal", 90],
  ["blue - navy", 100],
  ["red", 110],
  ["red - dark", 120],
  ["orange", 130],
  ["yellow", 140]
]);

let adminLaceOptionsCache = null;
let adminLaceOptionsPromise = null;

function normalizeAdminLaceColor(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/–|—/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
}

function adminLaceLabel(color) {
  const normalized = normalizeAdminLaceColor(color);
  if (ADMIN_LACE_LABEL_OVERRIDES.has(normalized)) return ADMIN_LACE_LABEL_OVERRIDES.get(normalized);
  const titled = normalized.split(/\s+/).filter(Boolean)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
  const parts = titled.split(" - ");
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return titled;
}

function loadAdminLaceOptions() {
  if (adminLaceOptionsCache) return Promise.resolve(adminLaceOptionsCache);
  if (!adminLaceOptionsPromise) {
    adminLaceOptionsPromise = fetch("/api/lace-inventory", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (!data?.ok || !Array.isArray(data.inventory)) throw new Error("Lace inventory unavailable.");
        const seen = new Set();
        const items = [];
        for (const item of data.inventory) {
          const value = String(item.color || "").trim();
          const normalized = normalizeAdminLaceColor(value);
          if (!value || seen.has(normalized) || item.active === false) continue;
          if (normalized.includes("pink") || normalized.includes("vintage")) continue;
          seen.add(normalized);
          items.push({ value, normalized, label: adminLaceLabel(value) });
        }
        items.sort((a, b) => {
          const ao = ADMIN_LACE_SORT_ORDER.get(a.normalized) ?? 1000;
          const bo = ADMIN_LACE_SORT_ORDER.get(b.normalized) ?? 1000;
          if (ao !== bo) return ao - bo;
          return a.label.localeCompare(b.label);
        });
        adminLaceOptionsCache = items;
        refreshAdminLaceSelects();
        return items;
      })
      .catch(() => {
        adminLaceOptionsPromise = null;
        return null;
      });
  }
  return adminLaceOptionsPromise;
}

function adminLaceOptionMarkup(current, placeholder = "Choose") {
  const items = adminLaceOptionsCache || [];
  const cur = String(current || "").trim();
  const curNormalized = normalizeAdminLaceColor(cur);
  const inList = !cur || items.some(i => i.normalized === curNormalized);
  return `<option value=""${!cur ? " selected" : ""}>${escapeHtml(placeholder)}</option>`
    + (inList ? "" : `<option value="${escapeAttr(cur)}" selected>${escapeHtml(cur)}</option>`)
    + items.map(i =>
        `<option value="${escapeAttr(i.value)}"${i.normalized === curNormalized ? " selected" : ""}>${escapeHtml(i.label)}</option>`
      ).join("");
}

/* Re-populate any rendered lace selects once the inventory arrives — options
   only; never re-renders the surrounding detail form. */
function refreshAdminLaceSelects() {
  document.querySelectorAll("select[data-lace-color-select]").forEach(select => {
    const current = select.value || select.dataset.current || "";
    select.innerHTML = adminLaceOptionMarkup(current, select.dataset.placeholder || "Choose");
    if ("allowCustom" in select.dataset) {
      select.insertAdjacentHTML("beforeend", `<option value="__custom__">Custom color…</option>`);
    }
  });
}

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
  loadAdminLaceOptions();
  return `
    <div class="detail-block">
      <div class="label">${escapeHtml(label)}</div>
      <select id="${escapeAttr(id)}" data-lace-color-select data-current="${escapeAttr(String(value || "").trim())}" data-placeholder="${escapeAttr(placeholder)}">
        ${adminLaceOptionMarkup(value, placeholder)}
      </select>
    </div>
  `;
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

function normalizeAdminView(viewName) {
  const view = String(viewName || "").trim().toLowerCase();
  if (!view || view === "dashboard") return "dashboard";
  if (view === "orders" || view === "current") return "current";
  if (view === "map") return "map";
  if (view === "money") return "money";
  if (view === "upload") return "upload";
  if (view === "inventory") return "inventory";
  if (view === "gloves-sale") return "gloves-sale";
  if (view === "users") return "users";
  if (view === "customers") return "customers";
  if (view === "calendar") return "calendar";
  if (view === "messages") return "messages";
  if (isOrderFilterView(view)) return view;
  return "dashboard";
}

function isKnownAdminView(viewName) {
  const view = String(viewName || "").trim().toLowerCase();
  if (!view || view === "dashboard") return true;
  if (view === "orders" || view === "current") return true;
  return ["map", "money", "upload", "inventory", "gloves-sale", "users", "customers", "calendar", "messages"].includes(view) || isOrderFilterView(view);
}

function syncAdminViewUrl(viewName) {
  const view = normalizeAdminView(viewName);
  const url = new URL(window.location.href);

  if (view === "dashboard") {
    url.searchParams.delete("view");
    url.searchParams.delete("order");
  } else if (view === "map") {
    url.searchParams.set("view", "map");
    if (mapFocusOrderNumber) {
      url.searchParams.set("order", String(mapFocusOrderNumber));
    } else {
      url.searchParams.delete("order");
    }
  } else if (view === "money") {
    url.searchParams.set("view", "money");
    url.searchParams.delete("order");
  } else if (view === "upload") {
    url.searchParams.set("view", "upload");
    url.searchParams.delete("order");
  } else if (view === "inventory") {
    url.searchParams.set("view", "inventory");
    url.searchParams.delete("order");
  } else if (view === "gloves-sale") {
    url.searchParams.set("view", "gloves-sale");
    url.searchParams.delete("order");
  } else if (view === "customers") {
    url.searchParams.set("view", "customers");
    url.searchParams.delete("order");
  } else if (view === "calendar") {
    url.searchParams.set("view", "calendar");
    url.searchParams.delete("order");
  } else if (isOrderFilterView(view)) {
    url.searchParams.set("view", "orders");
    url.searchParams.delete("order");
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState({}, "", url);
  }
}

function setActiveView(viewName) {
  if (!isAuthenticated()) {
    activeView = "dashboard";
    showView(loginView);
    closeMenu();
    syncAuthUI();
    return;
  }

  const resolvedView = normalizeAdminView(viewName);

  beginAdminViewSwitch();
  closeInventorySheet();
  closeOrderPhotoActionMenu();
  closeGalleryPhotoActionMenu();
  orderFiltersExpanded = false;
  inventoryFiltersExpanded = false;
  activeView = resolvedView;
  navLinks.forEach(link => {
    const isDashboardLink = link.dataset.view === "dashboard" && resolvedView === "dashboard";
    const isOrdersLink = link.dataset.view === "current" && isOrderFilterView(resolvedView);
    link.classList.toggle("active", isDashboardLink || isOrdersLink || link.dataset.view === resolvedView);
  });

  if (viewTitle) {
    viewTitle.textContent = getViewTitle(resolvedView);
  }
  syncOrderFilterUI();
  syncInventoryFilterUI();

  if (resolvedView === "dashboard") {
    syncAdminViewUrl(resolvedView);
    renderHomeDashboard();
    refreshDashboardLaborSessions();
    refreshDashboardActivityIndex();
    markOrdersSeen();
    showView(homeDashboardView);
    closeMenu();
    resetViewScroll(homeDashboardView, { blurActive: true });
    return;
  }

  if (resolvedView === "upload") {
    syncAdminViewUrl(resolvedView);
    showView(uploadView);
    loadGalleryManagerPhotos();
    closeMenu();
    resetViewScroll(uploadView, { blurActive: true });
    return;
  }

  if (resolvedView === "gloves-sale") {
    syncAdminViewUrl(resolvedView);
    const loadPromise = loadSaleGloves();
    showView(saleGlovesView);
    closeMenu();
    resetViewScroll(saleGlovesView, { blurActive: true });
    loadPromise.finally(() => resetViewScroll(saleGlovesView));
    return;
  }

  if (resolvedView === "users") {
    /* Admin-only. Demo/non-admin never see the nav entry, but guard anyway. */
    if (getCurrentRole() !== "admin") {
      setActiveView("dashboard");
      return;
    }
    showView(usersView);
    renderUsersView();
    closeMenu();
    resetViewScroll(usersView, { blurActive: true });
    return;
  }

  if (resolvedView === "calendar") {
    syncAdminViewUrl(resolvedView);
    showView(calendarView);
    renderCalendarView();
    closeMenu();
    resetViewScroll(calendarView, { blurActive: true });
    return;
  }

  if (resolvedView === "customers") {
    syncAdminViewUrl(resolvedView);
    showView(customersView);
    renderCustomersView();
    closeMenu();
    resetViewScroll(customersView, { blurActive: true });
    return;
  }

  if (resolvedView === "messages") {
    showView(messagesView);
    renderMessagesView();
    closeMenu();
    resetViewScroll(messagesView, { blurActive: true });
    return;
  }

  if (resolvedView === "money") {
    syncAdminViewUrl(resolvedView);
    showView(moneyView);
    closeMenu();
    resetViewScroll(moneyView, { blurActive: true });
    renderMoneyView();
    return;
  }

  if (resolvedView === "map") {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("order")) {
      mapFocusOrderNumber = null;
      mapFocusHandled = true;
    }
    syncAdminViewUrl(resolvedView);
    showView(mapView);
    closeMenu();
    resetViewScroll(mapView, { invalidateMap: true, blurActive: true });
    renderMapView().finally(() => resetViewScroll(mapView, { invalidateMap: true }));
    return;
  }

  let renderPromise = null;
  if (resolvedView === "inventory") {
    searchInput.value = "";
    syncSearchUI();
    renderPromise = loadInventory().catch(err => {
      ordersList.innerHTML = `<div class="no-results">${escapeHtml(err.message || "Failed to load inventory.")}</div>`;
    });
  } else {
    applyFilters();
  }

  syncAdminViewUrl(resolvedView);
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
    if (activeView === "dashboard") {
      await loadOrders();
    } else if (isOrderFilterView(activeView)) {
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

/* Scale the Order Detail title down until it fits its available width, so a
   long "Customer Name · 0111" shrinks instead of truncating. Resets to the
   CSS base size each call, then steps down to a floor. */
function fitDetailTitle() {
  if (!detailTitle) return;

  detailTitle.style.fontSize = "";
  if (!detailView || !detailView.classList.contains("active")) return;

  const available = detailTitle.clientWidth;
  if (!available) return;

  let size = parseFloat(getComputedStyle(detailTitle).fontSize) || 18;
  const minSize = 12;
  let guard = 0;
  while (detailTitle.scrollWidth > available && size > minSize && guard < 40) {
    size -= 0.5;
    detailTitle.style.fontSize = `${size}px`;
    guard += 1;
  }
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
    const titleName = String(order.customerName || "").trim();
    const titleNum = String(order.orderNumber || "").trim();
    const titleParts = [titleName, titleNum].filter(Boolean);
    detailTitle.textContent = titleParts.length ? titleParts.join(" · ") : "Order Detail";
    requestAnimationFrame(fitDetailTitle);
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
        <div class="detail-block">
          <div class="label">Customer</div>
          <div class="field-like readonly">${escapeHtml(order.customerName || "")}</div>
          <button id="detailViewCustomerBtn" class="detail-show-on-map-link customer-profile-link" type="button">View Customer Profile</button>
        </div>
        ${renderPhoneInput("Phone", "editPhoneNumber", order.phoneNumber || "")}
        ${renderFieldLike("Email", order.emailAddress || "")}
        <div class="detail-block">
          <div class="label">Social Tag</div>
          <input id="editSocialTag" type="text" value="${escapeAttr(order.socialTag || "")}" />
        </div>
        ${renderReferralSourceEditor(order.referralSource || "")}
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("customer") }
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
            <div id="promiseProposal" class="promise-proposal" hidden></div>
          </div>

          <div class="detail-block">
            <div class="label">Date Completed</div>
            <input id="editDateCompleted" type="date" />
          </div>

          ${renderStatusDelivery(order)}
      </div>
    `,
    { defaultExpanded: getDefaultSectionExpanded("orderStatus") }
  );

  orderDetailLaborMinutes = null;
  const laborTimerSection = renderLaborTimerSection(order);
  const economicsSection = renderOrderEconomicsSection(order);

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
    { defaultExpanded: getDefaultSectionExpanded("gloveDetails") }
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
    { defaultExpanded: getDefaultSectionExpanded("services") }
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
    { defaultExpanded: getDefaultSectionExpanded("lace") }
  );

  const showOnMapHtml = renderShowOnMapControl(order);
  const shippingSection = renderCollapsibleDetailSection(
    "shipping",
    "Shipping",
    summarizeShipping(order),
    `
      ${showOnMapHtml ? `<div class="detail-shipping-actions">${showOnMapHtml}</div>` : ""}
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
      defaultExpanded: getDefaultSectionExpanded("shipping"),
      sectionId: "editShippingSection",
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
    { defaultExpanded: getDefaultSectionExpanded("notes") }
  );

  orderDetail.innerHTML = `
    <div class="detail-form-shell">
      ${customerSection}
      ${orderStatusSection}
      ${laborTimerSection}
      ${economicsSection}
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
  ensureLaborTimerDelegation();
  ensureOrderEconomicsDelegation();
  loadLaborSessions(order.orderNumber);
  loadOrderActivity(order.orderNumber);
  renderPromiseProposal();
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
            <div id="promiseProposal" class="promise-proposal" hidden></div>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Glove Details</h2>
        </div>

        <div class="detail-section-grid">
          <div class="detail-block full">
            <div class="label">Template</div>
            <select id="orderTemplateSelect">
              <option value="">Start from a template…</option>
              ${ORDER_TEMPLATES.map((t, i) => `<option value="${i}">${escapeHtml(t.label)}</option>`).join("")}
            </select>
          </div>
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
  renderPromiseProposal();
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

  const expanded = getSectionExpanded("photos", getDefaultSectionExpanded("photos"));
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
  const form = workflowSheetEl.querySelector(".workflow-sheet-form");
  if (form) {
    form.innerHTML = "";
    form.classList.remove("is-submenu", "workflow-submenu--confirm", "workflow-submenu--form");
    form.style.left = "";
    form.style.top = "";
    form.style.right = "";
    form.style.bottom = "";
    form.style.maxWidth = "";
    form.style.width = "";
    form.style.minWidth = "";
    form.style.visibility = "";
  }
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

  form.classList.remove("is-submenu", "workflow-submenu--confirm", "workflow-submenu--form");
  form.style.left = "";
  form.style.top = "";
  form.style.right = "";
  form.style.bottom = "";
  form.style.maxWidth = "";
  form.style.width = "";
  form.style.minWidth = "";
  form.style.visibility = "";
  form.innerHTML = html;

  if (desktopMenu) {
    const formSize = options.formSize || "small";
    form.classList.add(formSize === "compact" ? "workflow-submenu--confirm" : "workflow-submenu--form");
  }

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
  const menuEl = root?.querySelector(".workflow-sheet");
  if (!form || !menuEl) return;

  form.classList.remove("is-submenu");
  form.style.left = "";
  form.style.top = "";
  form.style.right = "";
  form.style.bottom = "";
  form.style.maxWidth = "";
  form.style.width = "";
  form.style.minWidth = "";
  form.style.visibility = "";

  if (!isDesktopHoverMenu() || !activeButton || !form.innerHTML.trim()) return;

  form.classList.add("is-submenu");

  const margin = 16;
  const gap = 1;

  requestAnimationFrame(() => {
    const menuRect = menuEl.getBoundingClientRect();
    const itemRect = activeButton.getBoundingClientRect();

    form.style.visibility = "hidden";
    form.style.left = `${menuRect.right + gap - menuRect.left}px`;
    form.style.top = `${itemRect.top - menuRect.top}px`;

    requestAnimationFrame(() => {
      const formRect = form.getBoundingClientRect();
      const width = formRect.width;
      const height = formRect.height;

      let viewportLeft = menuRect.right + gap;
      if (viewportLeft + width > window.innerWidth - margin) {
        viewportLeft = menuRect.left - gap - width;
      }
      viewportLeft = Math.max(margin, Math.min(viewportLeft, window.innerWidth - margin - width));

      let viewportTop = itemRect.top;
      viewportTop = Math.max(margin, Math.min(viewportTop, window.innerHeight - margin - height));

      form.style.left = `${viewportLeft - menuRect.left}px`;
      form.style.top = `${viewportTop - menuRect.top}px`;
      form.style.visibility = "";
    });
  });
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
    const suggested = getSuggestedPrice(order);
    inner = `
      <div class="workflow-action-form">
        <label>Estimated amount</label>
        <input id="workflowPriceQuoted" type="text" inputmode="decimal" value="${escapeAttr(formatMoneyForInput(priceQuoted))}" />
        ${suggested ? `<p class="muted workflow-price-hint">Suggested: ${escapeHtml(formatCurrency(suggested.price))}</p>` : ""}
      </div>
    `;
  } else if (actionKey === "customerApproved") {
    inner = `<div class="workflow-action-form"><p>Mark as Customer Approved?</p></div>`;
  } else if (actionKey === "pendingResponse") {
    inner = `<div class="workflow-action-form"><p>Mark as Pending Response?</p></div>`;
  } else if (actionKey === "inTransitToMe") {
    inner = `<div class="workflow-action-form"><p>Mark as In Transit to Me?</p></div>`;
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
        <p>${normalizeText(order.paid) === "paid" ? "Already marked paid." : "Mark as paid?"}</p>
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
    if (activeView === "dashboard") {
      renderHomeDashboard();
      refreshDashboardLaborSessions();
      refreshDashboardActivityIndex();
    }
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
  }

  if (!view) return null;
  if (!isKnownAdminView(view)) return null;

  return normalizeAdminView(view);
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
      scrollWheelZoom: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
      wheelDebounceTime: 20,
      zoomAnimation: true,
      markerZoomAnimation: true
    }).setView([39.5, -98.35], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(orderMap);

    orderMapMarkers = L.layerGroup().addTo(orderMap);

    orderMapEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-map-order]");
      if (!btn) return;
      e.preventDefault();
      openOrder(btn.dataset.mapOrder, { returnView: "map" });
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
async function login(email, password) {
  if (loginInProgress) return;
  loginInProgress = true;
  loginStatus.textContent = "Signing in…";

  try {
    const data = await postJson({
      action: "login",
      email,
      password
    });

    await finishLoginWithToken(data.token, data.role);
  } catch (err) {
    loginStatus.textContent = err.message;
    pinInput.value = "";
    pinInput.focus();
  } finally {
    loginInProgress = false;
  }
}

/* Shared success path for both password and passkey login. */
async function finishLoginWithToken(token, role) {
  setToken(token);
  setRole(role);
  pinInput.value = "";
  if (emailInput) emailInput.value = "";
  loginStatus.textContent = "";
  syncAuthUI();
  syncRoleUI();
  await loadOrders();
  setActiveView("dashboard");
  refreshPasskeySetupVisibility();
  refreshMessages();
  refreshPushButtonVisibility();
}

/* =========================
   PASSKEY / FACE ID
========================= */
function isPasskeySupported() {
  return typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials &&
    typeof navigator.credentials.get === "function";
}

function base64UrlToBuf(str) {
  const input = String(str || "");
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signInWithPasskey() {
  if (loginInProgress || !isPasskeySupported()) return;
  loginInProgress = true;
  loginStatus.textContent = "Waiting for Face ID…";

  try {
    const opt = await postJson({ action: "webauthnLoginOptions" });
    if (!opt.hasCredentials) {
      loginStatus.textContent = "No passkey set up yet. Log in with your passcode, then choose “Set up Face ID.”";
      return;
    }

    const o = opt.options;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToBuf(o.challenge),
        rpId: o.rpId,
        timeout: o.timeout,
        userVerification: o.userVerification,
        allowCredentials: (o.allowCredentials || []).map(cred => ({
          id: base64UrlToBuf(cred.id),
          type: "public-key"
        }))
      }
    });

    const res = await postJson({
      action: "webauthnLoginVerify",
      challengeToken: opt.challengeToken,
      credential: {
        id: assertion.id,
        rawId: bufToBase64Url(assertion.rawId),
        response: {
          clientDataJSON: bufToBase64Url(assertion.response.clientDataJSON),
          authenticatorData: bufToBase64Url(assertion.response.authenticatorData),
          signature: bufToBase64Url(assertion.response.signature),
          userHandle: assertion.response.userHandle ? bufToBase64Url(assertion.response.userHandle) : null
        }
      }
    });

    await finishLoginWithToken(res.token, res.role);
  } catch (err) {
    if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) {
      loginStatus.textContent = "";
    } else {
      loginStatus.textContent = err.message || "Face ID sign-in failed.";
    }
  } finally {
    loginInProgress = false;
  }
}

async function enrollPasskey() {
  if (!isPasskeySupported()) return;

  const prevLabel = sideNavPasskeyBtn ? sideNavPasskeyBtn.textContent : "";
  if (sideNavPasskeyBtn) sideNavPasskeyBtn.textContent = "Setting up…";

  try {
    const opt = await postJson({ action: "webauthnRegisterOptions" }, true);
    const o = opt.options;

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: base64UrlToBuf(o.challenge),
        rp: o.rp,
        user: {
          id: base64UrlToBuf(o.user.id),
          name: o.user.name,
          displayName: o.user.displayName
        },
        pubKeyCredParams: o.pubKeyCredParams,
        authenticatorSelection: o.authenticatorSelection,
        timeout: o.timeout,
        attestation: o.attestation,
        excludeCredentials: (o.excludeCredentials || []).map(c => ({
          id: base64UrlToBuf(c.id),
          type: "public-key"
        }))
      }
    });

    await postJson({
      action: "webauthnRegisterVerify",
      challengeToken: opt.challengeToken,
      label: "Face ID",
      credential: {
        id: cred.id,
        rawId: bufToBase64Url(cred.rawId),
        transports: cred.response.getTransports ? cred.response.getTransports() : [],
        response: {
          clientDataJSON: bufToBase64Url(cred.response.clientDataJSON),
          attestationObject: bufToBase64Url(cred.response.attestationObject)
        }
      }
    }, true);

    if (sideNavPasskeyBtn) sideNavPasskeyBtn.textContent = "Face ID is set up ✓";
    /* It's registered now — retire the setup entry after a brief confirmation. */
    setTimeout(() => {
      if (sideNavPasskeyBtn) {
        sideNavPasskeyBtn.textContent = prevLabel;
        sideNavPasskeyBtn.hidden = true;
      }
    }, 2000);
  } catch (err) {
    if (sideNavPasskeyBtn) sideNavPasskeyBtn.textContent = prevLabel;
    if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) {
      return; // user dismissed the prompt
    }
    if (err && err.name === "InvalidStateError") {
      /* The device already holds a passkey for this site (it's the one
         that's registered), so it won't create a duplicate — hide the entry. */
      if (sideNavPasskeyBtn) sideNavPasskeyBtn.hidden = true;
      alert("Face ID is already set up on this device. Just use “Sign in with Face ID” on the login screen.");
      return;
    }
    alert(err && err.message ? err.message : "Could not set up Face ID.");
  }
}

/* Show the "Set up Face ID" menu entry only when WebAuthn is supported and
   no passkey is registered yet. Once one exists (they sync across the
   owner's Apple devices via iCloud), the entry stays hidden. */
async function refreshPasskeySetupVisibility() {
  if (!sideNavPasskeyBtn) return;

  if (!isPasskeySupported()) {
    sideNavPasskeyBtn.hidden = true;
    return;
  }

  try {
    const opt = await postJson({ action: "webauthnLoginOptions" });
    sideNavPasskeyBtn.hidden = !!opt.hasCredentials;
  } catch {
    /* If we can't tell, keep it hidden rather than clutter the menu. */
    sideNavPasskeyBtn.hidden = true;
  }
}

/* =========================
   USERS / ROLES (client)
========================= */
/* Show admin-only nav (Users) only for admins; demo users get a reduced
   menu. Called after login and on boot. */
function syncRoleUI() {
  const role = getCurrentRole();
  const isAdmin = role === "admin";
  document.querySelectorAll(".nav-admin-only").forEach(el => { el.hidden = !isAdmin; });
  document.body.classList.toggle("is-demo", role === "demo");
}

async function renderUsersView() {
  if (!usersPanel) return;
  usersPanel.innerHTML = `<div class="dashboard-shell"><div class="dashboard-card users-loading muted">Loading users…</div></div>`;

  let users = [];
  try {
    const data = await postJson({ action: "listUsers" }, true);
    users = data.users || [];
  } catch (err) {
    usersPanel.innerHTML = `<div class="dashboard-shell"><div class="dashboard-card users-loading muted">${escapeHtml(err.message || "Could not load users.")}</div></div>`;
    return;
  }

  const countEl = document.getElementById("usersCount");
  if (countEl) countEl.textContent = `${users.length} ${users.length === 1 ? "account" : "accounts"}`;

  usersPanel.innerHTML = renderUsersContent(users);
  wireUsersPanel();
}

function renderUsersContent(users) {
  const rows = users.map(u => {
    const flags = [];
    if (!u.active) flags.push(`<span class="user-flag user-flag--off">disabled</span>`);
    if (u.invitePending) flags.push(`<span class="user-flag">invite pending</span>`);
    else if (!u.hasPassword) flags.push(`<span class="user-flag">no password</span>`);

    return `
      <div class="user-row"
        data-user-id="${escapeAttr(u.id)}"
        data-user-email="${escapeAttr(u.email)}"
        data-user-role="${escapeAttr(u.role)}"
        data-user-active="${u.active ? "true" : "false"}">
        <div class="user-row-main">
          <div class="user-row-title">
            <span class="user-row-name">${escapeHtml(u.displayName || u.email)}</span>
            <span class="user-role-badge user-role-${escapeAttr(u.role)}">${escapeHtml(u.role)}</span>
            ${flags.join("")}
          </div>
          <div class="user-row-meta"><span>${escapeHtml(u.email)}</span></div>
        </div>
        <div class="user-row-actions user-menu-wrap">
          <button type="button" class="user-action-btn user-menu-btn" data-user-menu aria-haspopup="menu" aria-label="Account actions">&#8943;</button>
          <div class="dashboard-timer-popover user-menu-pop" hidden>
            <button type="button" class="dashboard-timer-phase-option" data-user-action="role">${u.role === "admin" ? "Make demo" : "Make admin"}</button>
            <button type="button" class="dashboard-timer-phase-option" data-user-action="password">Set password</button>
            <button type="button" class="dashboard-timer-phase-option" data-user-action="toggle">${u.active ? "Disable" : "Enable"}</button>
            <button type="button" class="dashboard-timer-phase-option dashboard-timer-stop-option" data-user-action="remove">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="dashboard-shell users-shell">
      <section class="dashboard-section">
        <h2 class="dashboard-section-title">Invite a user</h2>
        <div class="dashboard-card user-invite-card">
          <input id="userInviteEmail" type="email" placeholder="Email" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <input id="userInviteName" type="text" placeholder="Name (optional)" autocomplete="off" />
          <select id="userInviteRole">
            <option value="demo">Demo — sandbox, can't touch real data</option>
            <option value="admin">Admin — full access</option>
          </select>
          <button id="userInviteBtn" type="button" class="user-invite-btn">Send invite</button>
          <p id="userInviteStatus" class="status muted"></p>
        </div>
      </section>
      <section class="dashboard-section">
        <h2 class="dashboard-section-title">Accounts</h2>
        <div class="dashboard-card user-list">${rows || `<p class="dashboard-empty muted">No accounts yet.</p>`}</div>
      </section>
    </div>
  `;
}

function wireUsersPanel() {
  if (!usersPanel || usersPanel.dataset.wired === "true") return;
  usersPanel.dataset.wired = "true";

  usersPanel.addEventListener("click", async (e) => {
    if (e.target.closest("#userInviteBtn")) {
      await handleUserInvite();
      return;
    }
    const menuBtn = e.target.closest("[data-user-menu]");
    if (menuBtn) {
      const pop = menuBtn.parentElement.querySelector(".user-menu-pop");
      const wasHidden = pop.hidden;
      usersPanel.querySelectorAll(".user-menu-pop").forEach(el => { el.hidden = true; });
      pop.hidden = !wasHidden;
      return;
    }
    const actionBtn = e.target.closest("[data-user-action]");
    if (!actionBtn) return;
    const row = actionBtn.closest("[data-user-id]");
    if (!row) return;
    await handleUserRowAction(actionBtn.dataset.userAction, {
      userId: row.dataset.userId,
      email: row.dataset.userEmail,
      role: row.dataset.userRole,
      active: row.dataset.userActive === "true"
    });
  });
}

document.addEventListener("click", (e) => {
  if (e.target.closest?.(".user-menu-wrap")) return;
  usersPanel?.querySelectorAll(".user-menu-pop").forEach(el => { el.hidden = true; });
});

async function handleUserInvite() {
  const emailEl = document.getElementById("userInviteEmail");
  const nameEl = document.getElementById("userInviteName");
  const roleEl = document.getElementById("userInviteRole");
  const statusEl = document.getElementById("userInviteStatus");
  const email = (emailEl?.value || "").trim();

  if (!email) {
    if (statusEl) statusEl.textContent = "Enter an email address.";
    return;
  }

  if (statusEl) statusEl.textContent = "Sending invite…";
  try {
    const data = await postJson({
      action: "createUserInvite",
      email,
      displayName: nameEl?.value || "",
      role: roleEl?.value || "demo"
    }, true);

    if (data.emailed) {
      if (statusEl) statusEl.textContent = `Invite emailed to ${email}.`;
    } else if (data.inviteLink) {
      prompt("Email wasn't sent — copy this invite link:", data.inviteLink);
      if (statusEl) statusEl.textContent = "Invite created — link shown above.";
    }
    if (emailEl) emailEl.value = "";
    if (nameEl) nameEl.value = "";
    renderUsersView();
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || "Could not send the invite.";
  }
}

async function handleUserRowAction(action, { userId, email, role, active }) {
  try {
    if (action === "role") {
      const nextRole = role === "admin" ? "demo" : "admin";
      if (!confirm(`Change ${email} to ${nextRole}?`)) return;
      await postJson({ action: "updateUser", userId, role: nextRole }, true);
    } else if (action === "toggle") {
      await postJson({ action: "updateUser", userId, active: !active }, true);
    } else if (action === "password") {
      const pw = prompt(`Set a password for ${email} (at least 8 characters):`);
      if (!pw) return;
      await postJson({ action: "setUserPassword", userId, password: pw.trim() }, true);
    } else if (action === "remove") {
      if (!confirm(`Remove ${email}? This deletes their account.`)) return;
      await postJson({ action: "deleteUser", userId }, true);
    }
    renderUsersView();
  } catch (err) {
    alert(err.message || "That action didn't work.");
  }
}

/* Invite acceptance: when the URL carries ?invite=TOKEN, show the
   set-password screen instead of the normal login/app. */
function getInviteTokenFromUrl() {
  try {
    return new URL(window.location.href).searchParams.get("invite") || "";
  } catch {
    return "";
  }
}

function clearInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url);
  } catch {
    /* non-fatal */
  }
}

async function startInviteFlow(token) {
  const intro = document.getElementById("inviteIntro");
  const form = document.getElementById("inviteForm");
  const status = document.getElementById("inviteStatus");
  const pw1 = document.getElementById("invitePassword");
  const pw2 = document.getElementById("invitePassword2");
  const submitBtn = document.getElementById("inviteSubmitBtn");

  showView(inviteView);

  let invite;
  try {
    invite = await postJson({ action: "getInvite", token });
  } catch (err) {
    if (intro) intro.textContent = err.message || "This invite is invalid or expired.";
    return;
  }

  if (intro) intro.textContent = `Welcome${invite.displayName ? `, ${invite.displayName}` : ""}! Set a password for ${invite.email} (${invite.role}).`;
  if (form) form.hidden = false;

  const submit = async () => {
    const p1 = (pw1?.value || "").trim();
    const p2 = (pw2?.value || "").trim();
    if (p1.length < 8) { if (status) status.textContent = "Password must be at least 8 characters."; return; }
    if (p1 !== p2) { if (status) status.textContent = "Passwords don't match."; return; }
    if (status) status.textContent = "Creating your account…";
    try {
      const data = await postJson({ action: "acceptInvite", token, password: p1 });
      clearInviteFromUrl();
      await finishLoginWithToken(data.token, data.role);
    } catch (err) {
      if (status) status.textContent = err.message || "Could not set your password.";
    }
  };

  submitBtn?.addEventListener("click", submit);
  pw2?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
}

/* =========================
   MESSAGES / TWILIO INBOX + NOTIFICATIONS
========================= */
let allMessages = [];
let openThreadKey = null;
let pendingMsgPhoto = "";
const ORDERS_SEEN_KEY = "mm_orders_seen_ts";

function msgThreadKey(m) {
  const d = String(m.phoneNumber || "").replace(/\D/g, "").slice(-10);
  return d || String(m.phoneNumber || "");
}

function formatPhone(v) {
  const d = String(v || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(v || "");
}

function formatMessageTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function groupMessageThreads(messages) {
  const map = new Map();
  messages.forEach(m => {
    const key = msgThreadKey(m);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  });

  const threads = [];
  for (const [key, msgs] of map.entries()) {
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const last = msgs[msgs.length - 1];
    const named = [...msgs].reverse().find(x => x.customerName);
    const ordered = [...msgs].reverse().find(x => x.orderNumber);
    threads.push({
      key,
      phoneNumber: last.phoneNumber,
      customerName: named ? named.customerName : "",
      orderNumber: ordered ? ordered.orderNumber : "",
      messages: msgs,
      last,
      unread: msgs.filter(x => x.direction === "in" && !x.read).length
    });
  }
  threads.sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
  return threads;
}

async function refreshMessages({ rerender = false } = {}) {
  try {
    const data = await postJson({ action: "listMessages" }, true);
    allMessages = data.messages || [];
    syncNotificationBadges();
    if (rerender && messagesView && messagesView.classList.contains("active")) {
      /* Never yank the DOM out from under an active draft/keyboard. */
      if (document.activeElement && document.activeElement.id === "msgReplyInput") return;
      if (openThreadKey) openMessageThread(openThreadKey);
      else renderMessagesView();
    }
  } catch {
    /* Inbox is a background extra — never block the app. */
  }
}

async function renderMessagesView() {
  if (!messagesPanel) return;
  if (!allMessages.length) {
    messagesPanel.innerHTML = `<div class="dashboard-shell messages-shell"><div class="dashboard-card msg-empty muted">Loading messages…</div></div>`;
    await refreshMessages();
  }

  const threads = groupMessageThreads(allMessages);
  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);
  const countEl = document.getElementById("messagesCount");
  if (countEl) {
    countEl.textContent = totalUnread
      ? `${totalUnread} unread`
      : `${threads.length} ${threads.length === 1 ? "conversation" : "conversations"}`;
  }

  openThreadKey = null;
  releaseConvoViewport();
  messagesPanel.innerHTML = `
    <div class="dashboard-shell messages-shell">
      <div class="dashboard-card msg-inbox-card">
        ${threads.length
          ? threads.map(renderThreadRow).join("")
          : `<div class="msg-empty muted">No text messages yet. Incoming texts to your Twilio number will show up here.</div>`}
      </div>
    </div>`;
  wireMessagesPanel();
}

function renderThreadRow(t) {
  const title = t.customerName || formatPhone(t.phoneNumber);
  const preview = (t.last.direction === "out" ? "You: " : "") +
    (t.last.body || (t.last.mediaUrls.length ? "[Photo]" : ""));
  const initials = (t.customerName || "")
    .split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "#";
  return `
    <div class="msg-swipe">
      <button type="button" class="msg-swipe-del" data-del-thread="${escapeAttr(t.key)}">Delete</button>
    <button type="button" class="msg-thread" data-thread="${escapeAttr(t.key)}">
      <span class="msg-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <div class="msg-thread-main">
        <div class="msg-thread-title">${escapeHtml(title)}${t.orderNumber ? ` <span class="msg-thread-order">#${escapeHtml(t.orderNumber)}</span>` : ""}</div>
        <div class="msg-thread-preview muted">${escapeHtml(preview.slice(0, 70))}</div>
      </div>
      <div class="msg-thread-meta">
        <span class="msg-thread-time muted">${escapeHtml(formatMessageTime(t.last.createdAt))}</span>
        ${t.unread ? `<span class="msg-unread-dot" aria-label="${t.unread} unread"></span>` : ""}
      </div>
    </button>
    </div>`;
}

function openMessageThread(key) {
  const t = groupMessageThreads(allMessages).find(x => x.key === key);
  if (!t || !messagesPanel) return;
  const prevDraft = (openThreadKey === key && document.getElementById("msgReplyInput")?.value) || "";
  openThreadKey = key;

  let prevDay = "";
  let bubbles = "";
  t.messages.forEach((m, i) => {
    const dir = m.direction === "out" ? "out" : "in";
    const d = new Date(m.createdAt);
    const day = d.toDateString();
    if (day !== prevDay) {
      prevDay = day;
      const label = day === new Date().toDateString()
        ? "Today"
        : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      bubbles += `<div class="msg-day"><strong>${escapeHtml(label)}</strong> ${escapeHtml(time)}</div>`;
    }
    /* Tail only on the last bubble of a same-direction run (iMessage-style). */
    const next = t.messages[i + 1];
    const tail = !next || (next.direction === "out" ? "out" : "in") !== dir ||
      new Date(next.createdAt).toDateString() !== day;
    const media = m.mediaUrls.map(u => `<a href="${escapeAttr(u)}" target="_blank" rel="noopener"><img class="msg-media-img" src="${escapeAttr(u)}" alt="Photo" loading="lazy"></a>`).join("");
    const mediaOnly = !m.body && m.mediaUrls.length ? " msg-media-only" : "";
    bubbles += `
    <div class="msg-line msg-line-${dir}${tail ? " msg-tail" : ""}" data-mid="${escapeAttr(m.id)}">
      <div class="msg-bubble msg-${dir}${mediaOnly}">${m.body ? escapeHtml(m.body) : ""}${media}</div>
    </div>`;
  });

  messagesPanel.innerHTML = `
    <div class="dashboard-shell messages-shell msg-convo-shell">
      <div class="msg-convo-head">
        <button type="button" class="msg-back" data-msg-back>‹ Inbox</button>
        <div class="msg-convo-who">
          <div class="msg-thread-title">${escapeHtml(t.customerName || formatPhone(t.phoneNumber))}</div>
          ${(() => {
            const parts = [];
            if (t.customerName) parts.push(formatPhone(t.phoneNumber));
            if (t.orderNumber) parts.push(`Order #${t.orderNumber}`);
            return parts.length ? `<div class="muted msg-convo-sub">${escapeHtml(parts.join(" · "))}</div>` : "";
          })()}
        </div>
        <button type="button" class="msg-del-btn" data-del-thread="${escapeAttr(key)}" aria-label="Delete conversation">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>
        </button>
      </div>
      <div class="msg-convo">${bubbles}</div>
      ${t.phoneNumber ? `
        <div id="msgAttachPreview" class="msg-attach-preview" hidden></div>
        <div class="msg-reply msg-replybar" data-photo-drop="msgAttachInput">
          <button type="button" id="msgAttachBtn" class="msg-attach-btn" aria-label="Attach photo">
            <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="3"></rect><circle cx="12" cy="13" r="4"></circle><path d="M9 6l1.2-2h3.6L15 6"></path></svg>
          </button>
          <input type="file" id="msgAttachInput" accept="image/*" hidden>
          <textarea id="msgReplyInput" rows="1" placeholder="Text Message"></textarea>
          <button type="button" id="msgReplyBtn" class="msg-send-btn" aria-label="Send"
            data-thread="${escapeAttr(key)}" data-phone="${escapeAttr(t.phoneNumber)}"
            data-order="${escapeAttr(t.orderNumber)}" data-name="${escapeAttr(t.customerName)}">↑</button>
        </div>
        <p id="msgReplyStatus" class="status muted"></p>` : ""}
    </div>`;

  if (t.unread) markThreadRead(t.phoneNumber);
  if (prevDraft) {
    const input = document.getElementById("msgReplyInput");
    if (input) input.value = prevDraft;
  }
  const convo = messagesPanel.querySelector(".msg-convo");
  if (convo) convo.scrollTop = convo.scrollHeight;
  requestAnimationFrame(fitConvoToViewport);
}

async function markThreadRead(phoneNumber) {
  const key = String(phoneNumber || "").replace(/\D/g, "").slice(-10);
  allMessages.forEach(m => {
    if (m.direction === "in" && msgThreadKey(m) === key) m.read = true;
  });
  syncNotificationBadges();
  try { await postJson({ action: "markMessagesRead", phoneNumber }, true); } catch {}
}

function renderComposeView() {
  if (!messagesPanel) return;
  showView(messagesView);
  messagesPanel.innerHTML = `
    <div class="dashboard-shell messages-shell">
      <div class="msg-convo-head">
        <button type="button" class="msg-back" data-msg-back>‹ Inbox</button>
        <div class="msg-thread-title">New message</div>
      </div>
      <div class="msg-reply msg-compose">
        <input id="msgComposeTo" type="tel" inputmode="tel" placeholder="Phone number" autocomplete="off">
        <textarea id="msgReplyInput" rows="3" placeholder="Message…"></textarea>
        <button type="button" id="msgReplyBtn" class="msg-reply-btn" data-compose="1">Send</button>
        <p id="msgReplyStatus" class="status muted"></p>
      </div>
    </div>`;
  wireMessagesPanel();
  document.getElementById("msgComposeTo")?.focus();
}

async function handleMessageReply(btn) {
  const input = document.getElementById("msgReplyInput");
  const statusEl = document.getElementById("msgReplyStatus");
  const text = (input?.value || "").trim();
  const isCompose = btn.dataset.compose === "1";
  const phone = isCompose ? (document.getElementById("msgComposeTo")?.value || "").trim() : btn.dataset.phone;
  if (!text && !pendingMsgPhoto) return;
  if (!phone) { if (statusEl) statusEl.textContent = "Enter a phone number."; return; }

  btn.disabled = true;
  if (statusEl) statusEl.textContent = "Sending…";
  try {
    await postJson({
      action: "sendMessageReply",
      phoneNumber: phone,
      body: text,
      mediaDataUrl: pendingMsgPhoto || "",
      orderNumber: btn.dataset.order || "",
      customerName: btn.dataset.name || ""
    }, true);
    clearPendingMsgPhoto();
    if (input) input.value = "";
    await refreshMessages();
    if (isCompose) renderMessagesView();
    else openMessageThread(btn.dataset.thread);
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || "Could not send the message.";
    btn.disabled = false;
  }
}

function wireMessagesPanel() {
  if (!messagesPanel || messagesPanel.dataset.wired === "true") return;
  messagesPanel.dataset.wired = "true";
  messagesPanel.addEventListener("click", async (e) => {
    if (e.target.closest("[data-msg-back]")) { renderMessagesView(); return; }
    const del = e.target.closest("[data-del-thread]");
    if (del) { await deleteMessageThread(del.dataset.delThread); return; }
    if (e.target.closest("#msgAttachBtn")) {
      document.getElementById("msgAttachInput")?.click();
      return;
    }
    if (e.target.closest("[data-attach-remove]")) {
      clearPendingMsgPhoto();
      return;
    }
    const sendBtn = e.target.closest("#msgReplyBtn");
    if (sendBtn) { await handleMessageReply(sendBtn); return; }
    const thread = e.target.closest("[data-thread]");
    if (thread) {
      const wrap = thread.closest(".msg-swipe");
      if (wrap && wrap.classList.contains("is-open")) { wrap.classList.remove("is-open"); return; }
      openMessageThread(thread.dataset.thread);
      return;
    }
  });

  /* Apple-style swipe-to-delete on inbox rows. */
  let swipeEl = null, swipeX = 0, swipeY = 0, swiping = false;
  armMessageDelete(messagesPanel);

  messagesPanel.addEventListener("change", (e) => {
    if (e.target?.id !== "msgAttachInput") return;
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingMsgPhoto = String(reader.result || "");
      const prev = document.getElementById("msgAttachPreview");
      if (prev) {
        prev.hidden = false;
        prev.innerHTML = `<span class="msg-attach-thumb"><img src="${pendingMsgPhoto}" alt="Attached photo"><button type="button" class="msg-attach-remove" data-attach-remove aria-label="Remove photo">&#10005;</button></span>`;
      }
      fitConvoToViewport();
    };
    reader.readAsDataURL(file);
  });

  messagesPanel.addEventListener("touchstart", (e) => {
    const wrap = e.target.closest?.(".msg-swipe");
    if (!wrap) return;
    swipeEl = wrap; swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; swiping = false;
    messagesPanel.querySelectorAll(".msg-swipe.is-open").forEach(el => { if (el !== wrap) el.classList.remove("is-open"); });
  }, { passive: true });
  messagesPanel.addEventListener("touchmove", (e) => {
    if (!swipeEl) return;
    const dx = e.touches[0].clientX - swipeX;
    const dy = e.touches[0].clientY - swipeY;
    if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) swiping = true;
    if (swiping && dx < -30) swipeEl.classList.add("is-open");
    if (swiping && dx > 30) swipeEl.classList.remove("is-open");
  }, { passive: true });
  messagesPanel.addEventListener("touchend", () => { swipeEl = null; swiping = false; });
}

function clearPendingMsgPhoto() {
  pendingMsgPhoto = "";
  const prev = document.getElementById("msgAttachPreview");
  if (prev) { prev.hidden = true; prev.innerHTML = ""; }
  const fileInput = document.getElementById("msgAttachInput");
  if (fileInput) fileInput.value = "";
  fitConvoToViewport();
}

/* Long-press (or right-click) a bubble to delete it, iOS-style. */
let msgPressTimer = null;
function armMessageDelete(panel) {
  const start = (e, mid) => {
    msgPressTimer = setTimeout(() => confirmDeleteMessage(mid), 550);
  };
  panel.addEventListener("touchstart", (e) => {
    const line = e.target.closest?.(".msg-line[data-mid]");
    if (line) start(e, line.dataset.mid);
  }, { passive: true });
  ["touchmove", "touchend", "touchcancel"].forEach(ev =>
    panel.addEventListener(ev, () => clearTimeout(msgPressTimer), { passive: true }));
  panel.addEventListener("contextmenu", (e) => {
    const line = e.target.closest?.(".msg-line[data-mid]");
    if (!line) return;
    e.preventDefault();
    confirmDeleteMessage(line.dataset.mid);
  });
}

async function confirmDeleteMessage(mid) {
  if (!mid) return;
  if (!confirm("Delete this message?")) return;
  try {
    await postJson({ action: "deleteMessage", id: mid }, true);
    allMessages = allMessages.filter(m => String(m.id) !== String(mid));
    if (openThreadKey) openMessageThread(openThreadKey);
    syncNotificationBadges();
  } catch (err) {
    alert(err.message || "Could not delete the message.");
  }
}

async function deleteMessageThread(key) {
  const t = groupMessageThreads(allMessages).find(x => x.key === key);
  if (!t) return;
  const who = t.customerName || formatPhone(t.phoneNumber);
  if (!confirm(`Delete the conversation with ${who}? This can't be undone.`)) return;
  const phones = [...new Set(t.messages.map(m => m.phoneNumber).filter(Boolean))];
  try {
    await postJson({ action: "deleteMessageThread", phoneNumbers: phones }, true);
    allMessages = allMessages.filter(m => msgThreadKey(m) !== key);
    syncNotificationBadges();
    renderMessagesView();
  } catch (err) {
    alert(err.message || "Could not delete the conversation.");
  }
}

/* Size the open conversation to the visual viewport so the keyboard never
   scrolls the page: header/reply bar stay put, only messages scroll.

   Browser mode: iOS scrolls the layout viewport — pin it back with
   window.scrollTo(0,0).
   Standalone PWA: the body is fixed, so iOS instead PANS the visual
   viewport (vv.offsetTop) — fixed/sticky chrome slides out of view. Follow
   the pan by translating the app shell and capping its height to vv.height,
   which keeps header + reply bar glued to the visible screen. */
function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function convoIsOpen() {
  return !!openThreadKey && !!messagesView?.classList.contains("active");
}

function fitConvoToViewport() {
  const convo = messagesPanel?.querySelector(".msg-convo");
  if (!convo || !openThreadKey) return;
  const vv = window.visualViewport;
  const vvH = vv ? vv.height : window.innerHeight;

  const shell = document.querySelector(".app-shell");
  if (shell && isStandaloneMode()) {
    const offset = vv ? vv.offsetTop : 0;
    if (offset > 2 || (vv && vvH < window.innerHeight - 40)) {
      shell.style.transform = `translateY(${offset}px)`;
      shell.style.height = vvH + "px";
    } else {
      shell.style.transform = "";
      shell.style.height = "";
    }
  } else {
    window.scrollTo(0, 0);
  }

  /* Flex layout: size only the screen shell; the convo flex-fills whatever
     is left after header/reply bar/status — no per-element math to drift. */
  const topbar = messagesView?.querySelector(".topbar");
  const shellEl = messagesPanel.querySelector(".msg-convo-shell");
  if (shellEl) {
    shellEl.style.height = Math.max(220, vvH - (topbar?.offsetHeight || 0) - 24) + "px";
  }
  convo.scrollTop = convo.scrollHeight;
}

function releaseConvoViewport() {
  const shell = document.querySelector(".app-shell");
  if (shell) { shell.style.transform = ""; shell.style.height = ""; }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (convoIsOpen()) fitConvoToViewport();
    else releaseConvoViewport();
  });
  /* iOS fires vv "scroll" (pan) without resize while the keyboard is up. */
  window.visualViewport.addEventListener("scroll", () => {
    if (convoIsOpen()) fitConvoToViewport();
  });
}

/* Focus/blur settle after iOS animations — refit on both edges. */
document.addEventListener("focusin", (e) => {
  if (e.target?.id === "msgReplyInput") setTimeout(fitConvoToViewport, 350);
});
document.addEventListener("focusout", (e) => {
  if (e.target?.id === "msgReplyInput") setTimeout(() => {
    if (convoIsOpen()) fitConvoToViewport();
    else releaseConvoViewport();
  }, 350);
});

/* ---- In-app notification badges (unread texts + new orders) ---- */
function getUnreadMessageCount() {
  return (allMessages || []).filter(m => m.direction === "in" && !m.read).length;
}

function getNewOrdersCount() {
  const seen = Number(localStorage.getItem(ORDERS_SEEN_KEY) || 0);
  if (!seen) return 0;
  return (allOrders || []).filter(o => {
    if (!isCurrentOrder(o)) return false;
    const t = new Date(o.createdAt || o.dateReceived || 0).getTime();
    return t && t > seen;
  }).length;
}

function markOrdersSeen() {
  localStorage.setItem(ORDERS_SEEN_KEY, String(Date.now()));
  syncNotificationBadges();
}

function setNavBadge(el, count) {
  if (!el) return;
  if (count > 0) {
    el.textContent = count > 99 ? "99+" : String(count);
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function syncNotificationBadges() {
  const unread = getUnreadMessageCount();
  const newOrders = getNewOrdersCount();
  setNavBadge(document.getElementById("messagesNavBadge"), unread);
  setNavBadge(document.getElementById("clubhouseNavBadge"), newOrders);
  document.body.classList.toggle("has-notifications", (unread + newOrders) > 0);
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

  if (activeView === "dashboard") {
    renderHomeDashboard();
    refreshDashboardLaborSessions();
    refreshDashboardActivityIndex();
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

             <label class="upload-drop" for="saleGlovePhotoInput" data-photo-drop="saleGlovePhotoInput">
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

  /* Linking to an order that already has gallery photos inherits their
     section — the folder picker is easy to forget mid-batch. */
  function sectionForLinkedOrder(orderNumber) {
    const n = String(orderNumber || "").trim();
    if (!n) return "";
    return galleryPhotos.find(p => p.linkedOrder === n)?.section || "";
  }

  const uploadOrderInput = document.getElementById("galleryUploadOrderInput");
  uploadOrderInput?.addEventListener("input", () => {
    const section = sectionForLinkedOrder(uploadOrderInput.value);
    if (section && sectionSelect && sectionSelect.value !== section) {
      sectionSelect.value = section;
    }
  });

  uploadBtn.addEventListener("click", async () => {
    const files = stagedFiles;
    const orderInput = document.getElementById("galleryUploadOrderInput");
    const linkOrderNumber = orderInput?.value.trim() || "";
    const section = sectionForLinkedOrder(linkOrderNumber) || sectionSelect?.value || "fielding-gloves";

    if (!files.length) {
      status.textContent = "Choose photos before uploading.";
      return;
    }

    uploadBtn.disabled = true;
    clearBtn.disabled = true;
    status.textContent = `Uploading ${files.length} photo${files.length === 1 ? "" : "s"}...`;

    let uploaded = 0;
    let linked = 0;
    let linkError = "";
    const failed = [];

    for (const file of files) {
      try {
        const type = file.type || "image/jpeg";

        if (!type.startsWith("image/")) {
          throw new Error("Not an image file.");
        }

        const dataUrl = await fileToDataUrl(file);

        const result = await postJson({
          action: "uploadGalleryPhoto",
          section,
          filename: file.name,
          contentType: type,
          dataUrl
        }, true);

        uploaded++;

        /* Upload-with-link: every photo in the batch joins the same glove's
           album. One failed link (e.g. bad order #) stops further attempts
           but never blocks the uploads themselves. */
        if (linkOrderNumber && !linkError && result?.url) {
          try {
            await postJson({
              action: "setGalleryPhotoOrder",
              url: result.url,
              path: result.path,
              orderNumber: linkOrderNumber
            }, true);
            linked++;
          } catch (err) {
            linkError = err.message || "Could not link to that order.";
          }
        }

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
    if (orderInput) orderInput.value = "";
    const linkNote = linkOrderNumber
      ? (linkError ? ` Link failed: ${linkError}` : ` Linked ${linked} to order #${linkOrderNumber}.`)
      : "";
    status.textContent = `Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"} to the website gallery.${linkNote}`;
    await loadGalleryManagerPhotos();
  });

  refreshBtn?.addEventListener("click", loadGalleryManagerPhotos);
  managerFilter?.addEventListener("change", () => {
    galleryManagerFilter = managerFilter.value || "all";
    renderGalleryManagerPhotos();
  });
  const managerSearch = document.getElementById("galleryManagerSearch");
  managerSearch?.addEventListener("input", () => {
    galleryManagerSearch = managerSearch.value.trim().toLowerCase();
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
    const glinks = data.photoLinks || {};
    const gmeta = data.photoGloveMeta || {};
    const gcovers = data.photoCovers || {};
    galleryPhotos.forEach(ph => {
      ph.linkedOrder = glinks[ph.url] || "";
      ph.gloveMeta = gmeta[ph.url] || null;
      ph.isCover = !!gcovers[ph.url];
    });
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
            ${photo.isCover ? `<span class="gallery-cover-star" aria-label="Album cover">★</span>` : ""}
          </button>
          <div class="gallery-manager-meta">
            <div class="gallery-manager-subrow">
              <span>${escapeHtml(photo.sectionLabel)}</span>
              ${photo.hidden ? `<span class="gallery-manager-pill">Hidden</span>` : ""}
              ${photo.linkedOrder ? `<span class="gallery-manager-pill gallery-linked-pill">#${escapeHtml(photo.linkedOrder)}</span>` : ""}
              ${photo.gloveMeta ? `<span class="gallery-manager-pill gallery-linked-pill">Shop glove</span>` : ""}
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
    .filter(({ photo }) => activeFilter === "all" || photo.section === activeFilter)
    .filter(({ photo }) => {
      if (!galleryManagerSearch) return true;
      const hay = [photo.linkedOrder, photo.name, photo.sectionLabel, photo.gloveMeta?.brandModel]
        .map(v => String(v || "").toLowerCase()).join(" ");
      return hay.includes(galleryManagerSearch);
    })
    /* Keep each glove's album together: unlinked photos first (they need
       attention), then orders newest-first, cover photo leading its album. */
    .sort((a, b) => {
      const ao = a.photo.linkedOrder ? parseInt(a.photo.linkedOrder, 10) : null;
      const bo = b.photo.linkedOrder ? parseInt(b.photo.linkedOrder, 10) : null;
      if (ao === null && bo !== null) return -1;
      if (bo === null && ao !== null) return 1;
      if (ao !== null && bo !== null && ao !== bo) return bo - ao;
      if (!!a.photo.isCover !== !!b.photo.isCover) return a.photo.isCover ? -1 : 1;
      return a.index - b.index;
    });
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

/* Shop-glove describe dialog: descriptors make a gallery photo searchable
   on the public site without an order number. Saving replaces any order link. */
let galleryDescribeDialogEl = null;

function openGalleryDescribeDialog(photo) {
  if (!photo) return;
  closeGalleryDescribeDialog();

  const meta = photo.gloveMeta || {};
  const overlay = document.createElement("div");
  overlay.className = "gallery-describe-overlay";
  overlay.innerHTML = `
    <div class="gallery-describe-card" role="dialog" aria-modal="true" aria-label="Describe glove">
      <h3>Shop glove details</h3>
      <p>Makes this photo searchable without an order (your gloves, sold gloves). Saving replaces any order link on this photo.</p>
      <label>Brand / Model<span class="gallery-describe-suggest-wrap"><input type="text" data-describe-field="brandModel" value="${escapeHtml(meta.brandModel || "")}" placeholder="Wilson A2000 1786" autocomplete="off"><div class="gallery-describe-suggest" data-describe-suggest hidden></div></span></label>
      <label>Glove Type<select data-describe-field="gloveType">${renderSelectOptions(meta.gloveType || "", GLOVE_TYPE_OPTIONS, "Select glove type")}</select></label>
      <label>Web Type<select data-describe-field="webType">${renderSelectOptions(meta.webType || "", WEB_TYPE_OPTIONS, "Select web type")}</select></label>
      <label>Primary Lace<select data-describe-field="primaryLaceColor" data-lace-color-select data-allow-custom data-current="${escapeAttr(meta.primaryLaceColor || "")}" data-placeholder="Choose">${adminLaceOptionMarkup(meta.primaryLaceColor || "", "Choose")}<option value="__custom__">Custom color…</option></select></label>
      <label>Secondary Lace<select data-describe-field="secondaryLaceColor" data-lace-color-select data-allow-custom data-current="${escapeAttr(meta.secondaryLaceColor || "")}" data-placeholder="None">${adminLaceOptionMarkup(meta.secondaryLaceColor || "", "None")}<option value="__custom__">Custom color…</option></select></label>
      <div class="gallery-describe-actions">
        ${photo.gloveMeta ? `<button type="button" class="gallery-describe-remove" data-describe-remove>Remove</button>` : ""}
        <span class="gallery-describe-spacer"></span>
        <button type="button" data-describe-cancel>Cancel</button>
        <button type="button" class="gallery-describe-save" data-describe-save>Save</button>
      </div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-describe-cancel]")) {
      closeGalleryDescribeDialog();
      return;
    }
    if (e.target.closest("[data-describe-remove]")) {
      saveGalleryDescribe(photo, null);
      return;
    }
    if (e.target.closest("[data-describe-save]")) {
      const descriptors = {};
      overlay.querySelectorAll("[data-describe-field]").forEach(input => {
        descriptors[input.dataset.describeField] = input.value.trim();
      });
      saveGalleryDescribe(photo, descriptors);
    }
  });

  /* Autofill from past work: typing in Brand/Model suggests glove combos
     already in the database (orders + described shop gloves); picking one
     fills the whole form. */
  const brandInput = overlay.querySelector('[data-describe-field="brandModel"]');
  const suggestEl = overlay.querySelector("[data-describe-suggest]");
  const suggestionPool = buildDescribeSuggestionPool();

  function hideDescribeSuggest() {
    if (!suggestEl) return;
    suggestEl.hidden = true;
    suggestEl.innerHTML = "";
  }

  brandInput?.addEventListener("input", () => {
    const q = brandInput.value.trim().toLowerCase();
    if (q.length < 2) { hideDescribeSuggest(); return; }
    const terms = q.split(/\s+/).filter(Boolean);
    const matches = suggestionPool.filter(g => terms.every(t => g.hay.includes(t))).slice(0, 6);
    if (!matches.length) { hideDescribeSuggest(); return; }

    suggestEl.innerHTML = matches.map((g, i) => `
      <button type="button" data-suggest-index="${i}">
        <strong>${escapeHtml(g.brandModel)}</strong>
        <span>${escapeHtml([g.gloveType, g.webType, [g.primaryLaceColor, g.secondaryLaceColor].filter(Boolean).join("/")].filter(Boolean).join(" · "))}</span>
      </button>
    `).join("");
    suggestEl.hidden = false;
    suggestEl.querySelectorAll("[data-suggest-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        applyDescribeSuggestion(overlay, matches[Number(btn.dataset.suggestIndex)]);
        hideDescribeSuggest();
      });
    });
  });

  /* Any click outside the suggestion list dismisses it. */
  overlay.addEventListener("click", (e) => {
    if (!e.target.closest(".gallery-describe-suggest-wrap")) hideDescribeSuggest();
  });

  /* One-off colors bought per order and never stocked: "Custom color…"
     swaps the dropdown for a free-text field. */
  overlay.addEventListener("change", (e) => {
    const select = e.target.closest("select[data-describe-field]");
    if (!select || select.value !== "__custom__") return;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.describeField = select.dataset.describeField;
    input.placeholder = "Type the color";
    select.replaceWith(input);
    input.focus();
  });

  document.body.appendChild(overlay);
  galleryDescribeDialogEl = overlay;
  document.addEventListener("keydown", handleGalleryDescribeKeydown);
  loadAdminLaceOptions();
  overlay.querySelector("[data-describe-field]")?.focus();
}

/* Section move chooser — same quiet dialog pattern as the describe card. */
function openGalleryMoveDialog(photo) {
  if (!photo) return;
  closeGalleryDescribeDialog();

  const overlay = document.createElement("div");
  overlay.className = "gallery-describe-overlay";
  overlay.innerHTML = `
    <div class="gallery-describe-card" role="dialog" aria-modal="true" aria-label="Move photo">
      <h3>Move to section</h3>
      <p>Currently in ${escapeHtml(photo.sectionLabel || photo.section || "")}. The photo keeps its order link and cover flag.</p>
      <div class="gallery-move-options">
        ${Object.keys(GALLERY_SECTION_LABELS)
          .filter(section => section !== photo.section)
          .map(section => `<button type="button" data-move-section="${escapeAttr(section)}">${escapeHtml(getGallerySectionLabel(section))}</button>`)
          .join("")}
      </div>
      <div class="gallery-describe-actions">
        <span class="gallery-describe-spacer"></span>
        <button type="button" data-describe-cancel>Cancel</button>
      </div>
    </div>
  `;

  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay || e.target.closest("[data-describe-cancel]")) {
      closeGalleryDescribeDialog();
      return;
    }
    const pick = e.target.closest("[data-move-section]");
    if (!pick) return;
    const section = pick.dataset.moveSection;
    const status = document.getElementById("galleryManagerStatus");
    try {
      const result = await postJson({
        action: "moveGalleryPhoto",
        path: photo.path,
        url: photo.url,
        section
      }, true);
      closeGalleryDescribeDialog();
      const target = galleryPhotos.find(p => p.url === photo.url) || photo;
      if (result?.photo) {
        target.url = result.photo.url || target.url;
        target.path = result.photo.path || target.path;
      }
      target.section = section;
      target.sectionLabel = getGallerySectionLabel(section);
      if (status) status.textContent = `Moved to ${getGallerySectionLabel(section)}.`;
      renderGalleryManagerPhotos();
    } catch (err) {
      if (status) status.textContent = err.message || "Could not move the photo.";
    }
  });

  document.body.appendChild(overlay);
  galleryDescribeDialogEl = overlay;
  document.addEventListener("keydown", handleGalleryDescribeKeydown);
}

function buildDescribeSuggestionPool() {
  const seen = new Set();
  const pool = [];
  const addCombo = (source) => {
    const brandModel = String(source.brandModel || "").trim();
    if (!brandModel) return;
    const combo = {
      brandModel,
      gloveType: String(source.gloveType || "").trim(),
      webType: String(source.webType || "").trim(),
      primaryLaceColor: String(source.primaryLaceColor || "").trim(),
      secondaryLaceColor: String(source.secondaryLaceColor || "").trim()
    };
    const key = [combo.brandModel, combo.gloveType, combo.webType, combo.primaryLaceColor, combo.secondaryLaceColor]
      .join("|").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    combo.hay = key.replace(/\|/g, " ");
    pool.push(combo);
  };
  (Array.isArray(allOrders) ? allOrders : []).forEach(addCombo);
  (Array.isArray(galleryPhotos) ? galleryPhotos : []).forEach(ph => { if (ph.gloveMeta) addCombo(ph.gloveMeta); });
  return pool;
}

function setDescribeFieldValue(overlay, field, value) {
  const el = overlay.querySelector(`[data-describe-field="${field}"]`);
  if (!el) return;
  const v = String(value || "").trim();
  if (el.tagName === "INPUT") { el.value = v; return; }
  if (!v) { el.value = ""; return; }
  if (!Array.from(el.options).some(o => o.value === v)) {
    el.insertAdjacentHTML("afterbegin", `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`);
  }
  el.value = v;
}

function applyDescribeSuggestion(overlay, combo) {
  setDescribeFieldValue(overlay, "brandModel", combo.brandModel);
  setDescribeFieldValue(overlay, "gloveType", combo.gloveType);
  setDescribeFieldValue(overlay, "webType", combo.webType);
  setDescribeFieldValue(overlay, "primaryLaceColor", combo.primaryLaceColor);
  setDescribeFieldValue(overlay, "secondaryLaceColor", combo.secondaryLaceColor);
}

function closeGalleryDescribeDialog() {
  if (!galleryDescribeDialogEl) return;
  galleryDescribeDialogEl.remove();
  galleryDescribeDialogEl = null;
  document.removeEventListener("keydown", handleGalleryDescribeKeydown);
}

function handleGalleryDescribeKeydown(e) {
  if (e.key !== "Escape") return;
  closeGalleryDescribeDialog();
}

async function saveGalleryDescribe(photo, descriptors) {
  const status = document.getElementById("galleryManagerStatus");
  const clearing = !descriptors || !Object.values(descriptors).some(Boolean);
  try {
    await postJson({
      action: "setGalleryPhotoOrder",
      url: photo.url,
      path: photo.path,
      orderNumber: "",
      descriptors: clearing ? null : descriptors
    }, true);
    closeGalleryDescribeDialog();
    if (status) status.textContent = clearing ? "Shop glove details removed." : "Shop glove details saved.";
    const target = galleryPhotos.find(p => p.url === photo.url) || photo;
    target.gloveMeta = clearing ? null : { ...descriptors };
    target.linkedOrder = "";
    renderGalleryManagerPhotos();
  } catch (err) {
    if (status) status.textContent = err.message || "Could not save glove details.";
  }
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
    <button class="workflow-action-btn" type="button" data-gallery-menu-action="link">${photo.linkedOrder ? `Linked to #${escapeHtml(photo.linkedOrder)} — change…` : "Link to Order…"}</button>
    <button class="workflow-action-btn" type="button" data-gallery-menu-action="describe">${photo.gloveMeta ? "Shop glove details — edit…" : "Describe Glove (no order)…"}</button>
    ${photo.linkedOrder ? `<button class="workflow-action-btn" type="button" data-gallery-menu-action="cover">${photo.isCover ? "Album Cover ✓" : "Make Album Cover"}</button>` : ""}
    <button class="workflow-action-btn" type="button" data-gallery-menu-action="move">Move to Section…</button>
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

  if (action === "describe") {
    openGalleryDescribeDialog(photo);
    return;
  }

  if (action === "move") {
    openGalleryMoveDialog(photo);
    return;
  }

  if (action === "cover") {
    try {
      await postJson({ action: "setGalleryPhotoCover", url: photo.url }, true);
      galleryPhotos.forEach(p => {
        if (p.linkedOrder && p.linkedOrder === photo.linkedOrder) p.isCover = false;
      });
      const target = galleryPhotos.find(p => p.url === photo.url) || photo;
      target.isCover = true;
      if (status) status.textContent = `Set as the album cover for #${photo.linkedOrder}.`;
      renderGalleryManagerPhotos();
    } catch (err) {
      if (status) status.textContent = err.message || "Could not set the cover.";
    }
    return;
  }

  if (action === "link") {
    const entered = prompt(
      "Link this gallery photo to an order number (blank to remove the link):",
      photo.linkedOrder || ""
    );
    if (entered === null) return;
    const orderNumber = entered.trim();
    try {
      await postJson({ action: "setGalleryPhotoOrder", url: photo.url, path: photo.path, orderNumber }, true);
      if (status) status.textContent = orderNumber ? `Linked to order #${orderNumber}.` : "Link removed.";
      /* Update in place — a full reload wipes and refetches the whole grid,
         which reads as a page refresh and loses the scroll position. */
      const target = galleryPhotos.find(p => p.url === photo.url) || photo;
      target.linkedOrder = orderNumber;
      if (orderNumber) target.gloveMeta = null;
      renderGalleryManagerPhotos();
    } catch (err) {
      if (status) status.textContent = err.message || "Could not save the link.";
    }
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

function closeOrderDetail() {
  clearSaveStatus();
  detailMode = "edit";
  if (saveOrderBtn) {
    saveOrderBtn.textContent = "Save";
  }

  const returnView = normalizeAdminView(orderDetailReturnView || "current");
  setActiveView(returnView);

  if (isOrderFilterView(returnView)) {
    requestAnimationFrame(() => {
      setAdminScrollTop(listScrollY);
    });
  }
}

function openOrder(orderNumber, { returnView } = {}) {
  listScrollY = getAdminScrollTop();
  orderDetailReturnView = returnView || activeView || "current";

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
/* Submit on Enter or the Log In button. Email + password; the owner can
   also leave email blank and enter the owner PIN as the password. */
function submitPasscodeLogin() {
  const email = emailInput ? emailInput.value.trim() : "";
  const password = pinInput.value.trim();
  if (!password) {
    pinInput.focus();
    return;
  }
  login(email, password);
}

pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitPasscodeLogin();
  }
});

emailInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (pinInput.value.trim()) submitPasscodeLogin();
    else pinInput.focus();
  }
});

passwordLoginBtn?.addEventListener("click", () => {
  submitPasscodeLogin();
});

/* The "Sign in with Face ID" login button always shows where WebAuthn is
   supported. The "Set up Face ID" menu entry only appears once we've
   confirmed no passkey is registered yet (see refreshPasskeySetupVisibility). */
if (isPasskeySupported() && passkeyLoginBtn) {
  passkeyLoginBtn.hidden = false;
}

passkeyLoginBtn?.addEventListener("click", () => {
  signInWithPasskey();
});

sideNavPasskeyBtn?.addEventListener("click", () => {
  closeMenu();
  enrollPasskey();
});

/* Single logout entry point (side nav). Consolidates the six former
   per-view topbar logout buttons. Gloves For Sale previously logged
   out via location.reload() — preserved below to keep per-view
   behavior identical. */
sideNavLogoutBtn?.addEventListener("click", () => {
  clearToken();

  if (activeView === "gloves-sale") {
    location.reload();
    return;
  }

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
  orderDetailReturnView = activeView || "current";
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
  fitDetailTitle();
});

window.addEventListener("scroll", closeDesktopOrderActionMenus, { passive: true, capture: true });
window.addEventListener("scroll", closeInventorySheet, { passive: true, capture: true });
window.addEventListener("scroll", closeOrderPhotoActionMenu, { passive: true, capture: true });
window.addEventListener("scroll", closeAdminFilterPopovers, { passive: true, capture: true });

backBtn.addEventListener("click", closeOrderDetail);

saleGlovesMenuBtn?.addEventListener("click", openMenu);

saleGlovesRefreshBtn?.addEventListener("click", loadSaleGloves);

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
  openOrder(btn.dataset.mapOrder, { returnView: "map" });
});

moneyMenuBtn?.addEventListener("click", openMenu);

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
homeMenuBtn?.addEventListener("click", openMenu);
document.getElementById("usersMenuBtn")?.addEventListener("click", openMenu);
document.getElementById("customersMenuBtn")?.addEventListener("click", openMenu);
document.getElementById("calendarMenuBtn")?.addEventListener("click", openMenu);
document.getElementById("messagesMenuBtn")?.addEventListener("click", openMenu);
document.getElementById("msgComposeBtn")?.addEventListener("click", renderComposeView);

/* Poll the Twilio inbox so new-text and new-order badges stay live. */
setInterval(() => { if (getToken()) refreshMessages({ rerender: true }); }, 30000);

/* Instant inbox update: the service worker pings us when a push arrives. */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "push" && getToken()) refreshMessages({ rerender: true });
  });
}
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
  wireHomeDashboardActions();
  searchExpanded = false;
  syncSearchUI();
  syncAuthUI();
  resetAdminScroll();

  const inviteToken = getInviteTokenFromUrl();
  if (inviteToken) {
    startInviteFlow(inviteToken);
    return;
  }

  if (!getToken()) {
    showView(loginView);
    return;
  }

  syncRoleUI();

  try {
    await loadOrders();
    const deepLinkView = readAdminDeepLink();
    setActiveView(deepLinkView || "dashboard");
    refreshPasskeySetupVisibility();
    refreshMessages();
  } catch (err) {
    clearToken();
    closeMenu();
    syncAuthUI();
    showView(loginView);
  }
})();

/* =========================
   WEB PUSH (PWA notifications)
========================= */
const sideNavPushBtn = document.getElementById("sideNavPushBtn");

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function pushKeyToBytes(s) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b), c => c.charCodeAt(0));
}

async function getPushRegistration() {
  return navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
}

async function refreshPushButtonVisibility() {
  if (!sideNavPushBtn) return;
  if (!isPushSupported() || !getToken() || isDemoRole()) { sideNavPushBtn.hidden = true; return; }
  try {
    const reg = await getPushRegistration();
    const sub = await reg.pushManager.getSubscription();
    sideNavPushBtn.hidden = !!sub && Notification.permission === "granted";
  } catch {
    sideNavPushBtn.hidden = true;
  }
}

async function enablePushNotifications() {
  const prev = sideNavPushBtn ? sideNavPushBtn.textContent : "";
  try {
    if (sideNavPushBtn) sideNavPushBtn.textContent = "Enabling…";
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications were not allowed.");

    const cfg = await postJson({ action: "getPushPublicKey" });
    if (!cfg.publicKey) throw new Error("Push is not configured on the server.");

    const reg = await getPushRegistration();
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: pushKeyToBytes(cfg.publicKey)
    });

    await postJson({ action: "savePushSubscription", subscription: sub.toJSON(), label: navigator.userAgent.slice(0, 80) }, true);
    await postJson({ action: "sendTestPush" }, true);

    if (sideNavPushBtn) {
      sideNavPushBtn.textContent = "Notifications on ✓";
      setTimeout(() => { sideNavPushBtn.textContent = prev; sideNavPushBtn.hidden = true; }, 2000);
    }
  } catch (err) {
    if (sideNavPushBtn) sideNavPushBtn.textContent = prev;
    alert(err && err.message ? err.message : "Could not enable notifications.");
  }
}

sideNavPushBtn?.addEventListener("click", () => { closeMenu(); enablePushNotifications(); });
if (isPushSupported() && getToken()) refreshPushButtonVisibility();

/* =========================
   AUTO-UPDATE (PWA)
   iOS keeps the installed app's HTML/JS cached across cold launches, so
   deploys weren't picked up without a delete/re-add. Compare a hash of the
   live index.html on launch and when returning to the app; when it changes,
   reload once to pull the new build.
========================= */
const BUILD_HASH_KEY = "mm_build_hash";
let lastBuildCheck = 0;

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

async function checkForNewBuild() {
  const now = Date.now();
  if (now - lastBuildCheck < 5 * 60 * 1000) return;
  lastBuildCheck = now;
  try {
    /* Watch the deployed assets' ETags, not index.html (which rarely
       changes) — JS/CSS-only deploys must trigger the refresh too. */
    const heads = await Promise.all(
      ["/admin/index.html", "/admin/admin.js", "/admin/admin.css"].map(u =>
        fetch(u, { method: "HEAD", cache: "no-store" })
      )
    );
    if (heads.some(r => !r.ok)) return;
    const sig = heads.map(r =>
      (r.headers.get("etag") || "") + (r.headers.get("last-modified") || "")
    ).join("|");
    const hash = hashStr(sig);
    const stored = localStorage.getItem(BUILD_HASH_KEY);
    localStorage.setItem(BUILD_HASH_KEY, hash);
    if (stored && stored !== hash) location.reload();
  } catch { /* offline — try again later */ }
}

checkForNewBuild();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForNewBuild();
});

/* =========================
   EDGE SWIPE -> OPEN MENU (mobile)
   Right-swipe from the left screen edge pulls the side menu out, like
   native apps. Edge-start only (≤20px) so it never fights the order-card
   or message swipe gestures, the map, or pull-to-refresh.
========================= */
(function initEdgeSwipeMenu() {
  let tracking = false, startX = 0, startY = 0;

  document.addEventListener("touchstart", (e) => {
    tracking = false;
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    if (!isAuthenticated() || sideMenu.classList.contains("open")) return;
    if (e.touches.length !== 1 || e.touches[0].clientX > 20) return;
    if (e.target.closest?.(".swipe-row, .msg-swipe, .leaflet-container, input, textarea, select")) return;
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
    if (dx > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      tracking = false;
      openMenu();
    }
  }, { passive: true });

  document.addEventListener("touchend", () => { tracking = false; });
})();

// =========================
// Drag & drop onto photo uploaders
// Zones carry data-photo-drop="<input id>". A drop assigns the files to that
// input and fires its change event, so every existing upload flow (preview,
// validation, upload button) runs exactly as if the files were picked.
// =========================
(function initAdminPhotoDrops() {
  function zoneInput(zone) {
    return document.getElementById(zone.dataset.photoDrop || "");
  }

  function clearActive(except) {
    document.querySelectorAll(".photo-drop-active").forEach(el => {
      if (el !== except) el.classList.remove("photo-drop-active");
    });
  }

  document.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    const zone = e.target.closest?.("[data-photo-drop]") || null;
    clearActive(zone);
    if (zone) {
      e.dataTransfer.dropEffect = "copy";
      zone.classList.add("photo-drop-active");
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  });

  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget) clearActive(null);
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault(); // never let the browser navigate to a dropped image
    clearActive(null);

    const zone = e.target.closest?.("[data-photo-drop]");
    if (!zone) return;

    const input = zoneInput(zone);
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
    if (!input || !files.length) return;

    const dt = new DataTransfer();
    (input.multiple ? files : files.slice(0, 1)).forEach(f => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();

/* =========================
   CUSTOMER PROFILES (Phase 1.2)
   Customers are DERIVED from orders — no new table. Orders sharing a phone
   or email belong to one customer; orders with neither (the pre-system
   backfill) fold in by exact name match.
========================= */

let customersSearch = "";
let activeCustomerKey = null;

function normalizeCustomerPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function customerDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function buildCustomerIndex() {
  const customers = [];
  const byContact = new Map();
  const byName = new Map();

  const orders = [...allOrders].sort(
    (a, b) => (parseInt(b.orderNumber, 10) || 0) - (parseInt(a.orderNumber, 10) || 0)
  );

  for (const order of orders) {
    const phoneKey = normalizeCustomerPhone(order.phoneNumber);
    const emailKey = String(order.emailAddress || "").trim().toLowerCase();
    const nameKey = String(order.customerName || "").trim().toLowerCase();
    if (!phoneKey && !emailKey && !nameKey) continue;

    let customer =
      (phoneKey && byContact.get(`p:${phoneKey}`)) ||
      (emailKey && byContact.get(`e:${emailKey}`)) ||
      (nameKey && byName.get(nameKey)) ||
      null;

    if (!customer) {
      customer = {
        key: phoneKey ? `p:${phoneKey}` : emailKey ? `e:${emailKey}` : `n:${nameKey}`,
        name: String(order.customerName || "").trim() || "Unknown",
        phones: new Map(),
        emails: new Map(),
        socialTags: new Set(),
        orders: []
      };
      customers.push(customer);
    }

    if (phoneKey) byContact.set(`p:${phoneKey}`, customer);
    if (emailKey) byContact.set(`e:${emailKey}`, customer);
    if (nameKey) byName.set(nameKey, customer);

    if (phoneKey && !customer.phones.has(phoneKey)) {
      customer.phones.set(phoneKey, formatPhoneForInput(order.phoneNumber) || String(order.phoneNumber).trim());
    }
    if (emailKey && !customer.emails.has(emailKey)) {
      customer.emails.set(emailKey, String(order.emailAddress).trim());
    }
    if (order.socialTag) customer.socialTags.add(String(order.socialTag).trim());
    customer.orders.push(order);
  }

  for (const c of customers) {
    c.orderCount = c.orders.length;
    c.lifetimePaid = c.orders
      .filter(o => String(o.paid || "").toLowerCase() === "paid")
      .reduce((sum, o) => sum + (Number(o.priceQuoted) || 0), 0);
    c.pendingCount = c.orders.filter(o => String(o.paid || "").toLowerCase() !== "paid").length;
    c.lastOrder = c.orders[0];
    c.lastDate = c.lastOrder?.timestampSubmitted || c.lastOrder?.dateCompleted || "";

    const laceCounts = new Map();
    for (const o of c.orders) {
      const lace = normalizeAdminLaceColor(o.primaryLaceColor);
      if (!lace) continue;
      laceCounts.set(lace, (laceCounts.get(lace) || 0) + 1);
    }
    let fav = "";
    let favCount = 0;
    for (const [lace, count] of laceCounts) {
      if (count > favCount) { fav = lace; favCount = count; }
    }
    /* Only claim a "go-to" when a color actually repeats — with all-distinct
       colors there is no preference to report. */
    c.favoriteLace = fav && favCount >= 2 ? adminLaceLabel(fav) : "";
  }

  customers.sort((a, b) => new Date(b.lastDate || 0) - new Date(a.lastDate || 0));
  return customers;
}

function findCustomerForOrder(orderNumber) {
  const num = String(orderNumber || "");
  return buildCustomerIndex().find(c => c.orders.some(o => String(o.orderNumber) === num)) || null;
}

function renderCustomersView() {
  const panel = document.getElementById("customersPanel");
  const count = document.getElementById("customersCount");
  if (!panel) return;

  const customers = buildCustomerIndex();

  if (activeCustomerKey) {
    const customer = customers.find(c => c.key === activeCustomerKey);
    if (customer) {
      renderCustomerProfile(panel, count, customer);
      wireCustomersPanel(panel);
      return;
    }
    activeCustomerKey = null;
  }

  const q = customersSearch.trim().toLowerCase();
  const filtered = q
    ? customers.filter(c => {
        const hay = [
          c.name,
          ...c.phones.values(),
          ...c.phones.keys(),
          ...c.emails.values(),
          ...c.orders.map(o => `${o.orderNumber} ${o.brandModel || ""}`)
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
    : customers;

  if (count) count.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;

  panel.innerHTML = `
    <div class="dashboard-shell">
    <div class="dashboard-card customers-card">
      <input id="customersSearchInput" class="customers-search" type="search"
        placeholder="Name, phone, order #" autocomplete="off" value="${escapeAttr(customersSearch)}">
      <div class="customers-list">
        ${filtered.length ? filtered.map(c => `
          <button class="customer-row" type="button" data-customer-key="${escapeAttr(c.key)}">
            <span class="customer-row-main">
              <span class="customer-row-name">${escapeHtml(c.name)}</span>
              <span class="customer-row-sub">${c.orderCount} order${c.orderCount === 1 ? "" : "s"}${c.lastDate ? ` · ${customerDisplayDate(c.lastDate)}` : ""}</span>
            </span>
            <span class="customer-row-side">
              ${c.lifetimePaid ? `<span class="customer-row-spend">$${c.lifetimePaid.toLocaleString()}</span>` : ""}
              <span class="customer-row-chevron" aria-hidden="true">›</span>
            </span>
          </button>
        `).join("") : `<p class="muted customers-empty">No customers match.</p>`}
      </div>
    </div>
    </div>
  `;
  wireCustomersPanel(panel);
}

function renderCustomerProfile(panel, count, c) {
  if (count) count.textContent = c.name;

  const contactBits = [
    ...[...c.phones.values()].map(p => `<a class="customer-contact-link" href="tel:${escapeAttr(p.replace(/[^+\d]/g, ""))}">${escapeHtml(p)}</a>`),
    ...[...c.emails.values()].map(e => `<a class="customer-contact-link" href="mailto:${escapeAttr(e)}">${escapeHtml(e)}</a>`),
    ...[...c.socialTags].map(t => `<span>${escapeHtml(t)}</span>`)
  ];
  const contactChips = contactBits.length
    ? `<p class="customer-contact">${contactBits.join(`<span class="customer-contact-sep"> · </span>`)}</p>`
    : "";

  const photos = c.orders
    .flatMap(o => (Array.isArray(o.glovePhotos) ? o.glovePhotos : []).map(url => ({ url, orderNumber: o.orderNumber })))
    .slice(0, 12);

  panel.innerHTML = `
    <div class="dashboard-shell">
    <div class="dashboard-card customers-card">
      <button class="customer-back" type="button" data-customer-back>&#8249; Customers</button>
      <div class="customer-profile-head">
        <h2 class="customer-profile-name">${escapeHtml(c.name)}</h2>
        ${contactChips || `<p class="muted customer-no-contact">No contact info on file.</p>`}
      </div>
      <div class="customer-stats">
        <div class="customer-stat"><span class="customer-stat-value">${c.orderCount}</span><span class="customer-stat-label">Orders</span></div>
        <div class="customer-stat"><span class="customer-stat-value">$${c.lifetimePaid.toLocaleString()}</span><span class="customer-stat-label">Lifetime</span></div>
        ${c.pendingCount ? `<div class="customer-stat"><span class="customer-stat-value">${c.pendingCount}</span><span class="customer-stat-label">Unpaid</span></div>` : ""}
        ${c.favoriteLace ? `<div class="customer-stat"><span class="customer-stat-value customer-stat-lace">${escapeHtml(c.favoriteLace)}</span><span class="customer-stat-label">Go-to lace</span></div>` : ""}
      </div>
      ${photos.length ? `
        <div class="customer-photo-strip">
          ${photos.map(p => `
            <button class="customer-photo" type="button" data-customer-order="${escapeAttr(String(p.orderNumber))}" aria-label="Open order ${escapeAttr(String(p.orderNumber))}">
              <img src="${escapeAttr(p.url)}" alt="Glove photo" loading="lazy">
            </button>
          `).join("")}
        </div>
      ` : ""}
      <div class="customer-orders">
        ${c.orders.map(o => `
          <button class="customer-order-row" type="button" data-customer-order="${escapeAttr(String(o.orderNumber))}">
            <span class="customer-row-main">
              <span class="customer-row-name">#${escapeHtml(String(o.orderNumber))} · ${escapeHtml(o.brandModel || o.gloveType || "Glove")}</span>
              <span class="customer-row-sub">${escapeHtml([customerDisplayDate(o.timestampSubmitted || o.dateCompleted), o.primaryLaceColor ? adminLaceLabel(o.primaryLaceColor) : "", o.status].filter(Boolean).join(" · "))}</span>
            </span>
            <span class="customer-row-side">
              ${o.priceQuoted ? `<span class="customer-row-spend">$${Number(o.priceQuoted).toLocaleString()}</span>` : ""}
              <span class="customer-row-chevron" aria-hidden="true">›</span>
            </span>
          </button>
        `).join("")}
      </div>
    </div>
    </div>
  `;
}

function wireCustomersPanel(panel) {
  if (panel.dataset.customersBound === "true") return;
  panel.dataset.customersBound = "true";

  panel.addEventListener("click", (e) => {
    const back = e.target.closest("[data-customer-back]");
    if (back) {
      activeCustomerKey = null;
      renderCustomersView();
      return;
    }
    const row = e.target.closest("[data-customer-key]");
    if (row) {
      activeCustomerKey = row.dataset.customerKey;
      renderCustomersView();
      return;
    }
    const orderBtn = e.target.closest("[data-customer-order]");
    if (orderBtn) {
      openOrder(orderBtn.dataset.customerOrder, { returnView: "customers" });
    }
  });

  panel.addEventListener("input", (e) => {
    if (e.target.id !== "customersSearchInput") return;
    customersSearch = e.target.value;
    const pos = e.target.selectionStart;
    renderCustomersView();
    const input = document.getElementById("customersSearchInput");
    if (input) {
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch {}
    }
  });
}

/* Order Detail -> customer profile entry point (delegated; the detail body
   re-renders per order, so no per-render wiring). */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#detailViewCustomerBtn");
  if (!btn || !currentOrder) return;
  const customer = findCustomerForOrder(currentOrder.orderNumber);
  if (!customer) return;
  activeCustomerKey = customer.key;
  setActiveView("customers");
});

/* =========================
   CALENDAR VIEW (Phase 1.3)
   Month grid driven by order dates + status — the promise engine's UI in
   Phase 2, so everything renders from data, nothing hardcoded.
   Buckets: due (active orders on estimated_completion; overdue when past),
   arriving (In Transit to Me), done (Completed/Picked Up on date_completed).
========================= */

let calendarMonth = null;        // Date pinned to the 1st of the shown month
let calendarSelectedKey = "";    // YYYY-MM-DD
let calendarShowUnscheduled = false;

const CALENDAR_DONE_STATUSES = new Set(["Completed", "Picked Up"]);

function calDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calKeyFromValue(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function calTodayKey() {
  return calDateKey(new Date());
}

function calOrderKind(order, dateKey, todayKey) {
  const status = String(order.status || "");
  if (CALENDAR_DONE_STATUSES.has(status)) return "done";
  /* Work's finished, waiting on pickup/shipping — never overdue. */
  if (status === "Ready to Go") return "ready";
  if (status === "In Transit to Me") return "arriving";
  return dateKey < todayKey ? "overdue" : "due";
}

/* dateKey -> [{ order, kind }] for every order that lands on a calendar day. */
function buildCalendarEvents() {
  const events = new Map();
  const todayKey = calTodayKey();
  const unscheduledOrders = [];

  for (const order of allOrders) {
    const status = String(order.status || "");
    const isDone = CALENDAR_DONE_STATUSES.has(status) || status === "Ready to Go";
    const dateKey = isDone
      ? calKeyFromValue(order.dateCompleted || order.estimatedCompletion)
      : calKeyFromValue(order.estimatedCompletion);

    if (!dateKey) {
      if (!isDone) unscheduledOrders.push(order);
      continue;
    }

    if (!events.has(dateKey)) events.set(dateKey, []);
    events.get(dateKey).push({ order, kind: calOrderKind(order, dateKey, todayKey) });
  }

  unscheduledOrders.sort((a, b) => (parseInt(b.orderNumber, 10) || 0) - (parseInt(a.orderNumber, 10) || 0));
  return { events, unscheduledOrders };
}

function renderCalendarView() {
  const panel = document.getElementById("calendarPanel");
  const count = document.getElementById("calendarCount");
  if (!panel) return;

  if (!calendarMonth) {
    const now = new Date();
    calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!calendarSelectedKey) calendarSelectedKey = calTodayKey();

  const { events, unscheduledOrders } = buildCalendarEvents();
  const unscheduled = unscheduledOrders.length;
  const todayKey = calTodayKey();
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthLabel = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  let activeThisMonth = 0;
  for (const [key, list] of events) {
    if (key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
      activeThisMonth += list.filter(e => e.kind !== "done" && e.kind !== "ready").length;
    }
  }
  if (count) {
    count.innerHTML = `${activeThisMonth} due this month${unscheduled
      ? ` · <button type="button" class="cal-undated-link" data-cal-undated>${unscheduled} active without a date</button>`
      : ""}`;
  }

  const firstDow = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - firstDow);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = calDateKey(d);
    const dayEvents = events.get(key) || [];
    const kinds = [...new Set(dayEvents.map(e => e.kind))];
    cells.push(`
      <button type="button" class="cal-day${d.getMonth() !== month ? " is-other" : ""}${key === todayKey ? " is-today" : ""}${key === calendarSelectedKey ? " is-selected" : ""}" data-cal-day="${key}">
        <span class="cal-day-num">${d.getDate()}</span>
        ${kinds.length ? `<span class="cal-dots">${kinds.map(k => `<span class="cal-dot cal-dot-${k}"></span>`).join("")}</span>` : ""}
      </button>
    `);
  }

  const selectedEvents = (events.get(calendarSelectedKey) || [])
    .sort((a, b) => (a.kind === "done") - (b.kind === "done"));
  const selectedDate = calKeyFromValue(calendarSelectedKey);
  const selectedLabel = selectedDate
    ? new Date(...calendarSelectedKey.split("-").map((v, i) => i === 1 ? Number(v) - 1 : Number(v)))
        .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  const kindLabel = { due: "Due", overdue: "Overdue", arriving: "In Transit", ready: "Ready", done: "Done" };

  panel.innerHTML = `
    <div class="dashboard-shell">
    <div class="dashboard-card cal-card">
      <div class="cal-header">
        <button type="button" class="cal-nav-btn" data-cal-nav="-1" aria-label="Previous month">&#8249;</button>
        <div class="cal-title">${escapeHtml(monthLabel)}</div>
        <div class="cal-header-right">
          <button type="button" class="cal-today-btn" data-cal-today>Today</button>
          <button type="button" class="cal-nav-btn" data-cal-nav="1" aria-label="Next month">&#8250;</button>
        </div>
      </div>
      <div class="cal-weekdays">${["S","M","T","W","T","F","S"].map(d => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
      <div class="cal-legend">
        <span><span class="cal-dot cal-dot-due"></span> Due</span>
        <span><span class="cal-dot cal-dot-overdue"></span> Overdue</span>
        <span><span class="cal-dot cal-dot-arriving"></span> In Transit</span>
        <span><span class="cal-dot cal-dot-ready"></span> Ready</span>
        <span><span class="cal-dot cal-dot-done"></span> Done</span>
      </div>
    </div>
    <div class="dashboard-card cal-agenda-card">
      ${calendarShowUnscheduled ? `
        <div class="cal-agenda-title">Active without a date · set estimated completions to put them on the calendar</div>
        ${unscheduledOrders.map(order => `
          <button class="customer-order-row" type="button" data-cal-order="${escapeAttr(String(order.orderNumber))}">
            <span class="customer-row-main">
              <span class="customer-row-name">#${escapeHtml(String(order.orderNumber))} · ${escapeHtml(order.customerName || "Customer")}</span>
              <span class="customer-row-sub">${escapeHtml([order.brandModel || order.gloveType || "", order.status || ""].filter(Boolean).join(" · "))}</span>
            </span>
            <span class="customer-row-side">
              <span class="cal-tag cal-tag-undated">No date</span>
              <span class="customer-row-chevron" aria-hidden="true">&#8250;</span>
            </span>
          </button>
        `).join("") || `<p class="muted cal-agenda-empty">Every active order has a date.</p>`}
      ` : `
      <div class="cal-agenda-title">${escapeHtml(selectedLabel)}</div>
      ${selectedEvents.length ? selectedEvents.map(({ order, kind }) => `
        <button class="customer-order-row" type="button" data-cal-order="${escapeAttr(String(order.orderNumber))}">
          <span class="customer-row-main">
            <span class="customer-row-name">#${escapeHtml(String(order.orderNumber))} · ${escapeHtml(order.customerName || "Customer")}</span>
            <span class="customer-row-sub">${escapeHtml([order.brandModel || order.gloveType || "", order.status || ""].filter(Boolean).join(" · "))}</span>
          </span>
          <span class="customer-row-side">
            <span class="cal-tag cal-tag-${kind}">${kindLabel[kind] || kind}</span>
            <span class="customer-row-chevron" aria-hidden="true">&#8250;</span>
          </span>
        </button>
      `).join("") : `<p class="muted cal-agenda-empty">Nothing on this day.</p>`}
      `}
    </div>
    </div>
  `;

  wireCalendarPanel(panel);
}

function wireCalendarPanel(panel) {
  const count = document.getElementById("calendarCount");
  if (count && count.dataset.calBound !== "true") {
    count.dataset.calBound = "true";
    count.addEventListener("click", (e) => {
      if (!e.target.closest("[data-cal-undated]")) return;
      calendarShowUnscheduled = true;
      renderCalendarView();
    });
  }

  if (panel.dataset.calendarBound === "true") return;
  panel.dataset.calendarBound = "true";

  panel.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-cal-nav]");
    if (nav) {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(nav.dataset.calNav), 1);
      renderCalendarView();
      return;
    }
    if (e.target.closest("[data-cal-today]")) {
      const now = new Date();
      calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      calendarSelectedKey = calTodayKey();
      renderCalendarView();
      return;
    }
    const day = e.target.closest("[data-cal-day]");
    if (day) {
      calendarSelectedKey = day.dataset.calDay;
      calendarShowUnscheduled = false;
      renderCalendarView();
      return;
    }
    const orderBtn = e.target.closest("[data-cal-order]");
    if (orderBtn) {
      openOrder(orderBtn.dataset.calOrder, { returnView: "calendar" });
    }
  });
}

/* =========================
   ORDER TEMPLATES (Phase 1.4) — admin New Order only.
   Prefills the typical job shapes from the real price list (SHOP_PRICING /
   services page tiers). Templates never touch customer fields or lace color,
   and everything stays editable after applying.
========================= */

const ORDER_TEMPLATES = [
  { label: "Standard Full Service — Fielders ($80)", gloveType: "Fielders Glove",
    services: ["Cleaning + Conditioning + Relacing"], price: 80, turnaroundDays: 14 },
  { label: "Standard Full Service — Catchers Mitt ($100)", gloveType: "Catchers Mitt",
    services: ["Cleaning + Conditioning + Relacing"], price: 100, turnaroundDays: 14 },
  { label: "Standard Full Service — First Base Mitt ($100)", gloveType: "First Base Mitt",
    services: ["Cleaning + Conditioning + Relacing"], price: 100, turnaroundDays: 14 },
  { label: "Full Service + Palm Pad — Fielders ($100)", gloveType: "Fielders Glove",
    services: ["Cleaning + Conditioning + Relacing", "ShockTec Air2Gel Palm Pad"], price: 100, turnaroundDays: 14 },
  { label: "Full Relace — Fielders ($60)", gloveType: "Fielders Glove",
    services: ["Relacing"], price: 60, turnaroundDays: 10 },
  { label: "Full Relace — Catchers Mitt ($80)", gloveType: "Catchers Mitt",
    services: ["Relacing"], price: 80, turnaroundDays: 10 },
  { label: "Full Relace — First Base Mitt ($80)", gloveType: "First Base Mitt",
    services: ["Relacing"], price: 80, turnaroundDays: 10 },
  { label: "Clean & Condition ($50)",
    services: ["Cleaning + Conditioning"], price: 50, turnaroundDays: 7 }
];

function applyOrderTemplate(index) {
  const template = ORDER_TEMPLATES[index];
  if (!template) return;

  if (template.gloveType) {
    const gloveType = document.getElementById("editGloveType");
    if (gloveType) {
      gloveType.value = template.gloveType;
      gloveType.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  document.querySelectorAll('input[name="editServicesRequested"]').forEach(box => {
    box.checked = template.services.includes(box.value);
  });

  const price = document.getElementById("editPriceQuoted");
  if (price) price.value = String(template.price);

  const received = document.getElementById("editDateReceived");
  const est = document.getElementById("editEstimatedCompletion");
  const today = new Date();
  if (received && !received.value) received.value = calDateKey(today);
  if (est) {
    const done = new Date(today.getFullYear(), today.getMonth(), today.getDate() + template.turnaroundDays);
    est.value = calDateKey(done);
  }
}

document.addEventListener("change", (e) => {
  if (e.target?.id !== "orderTemplateSelect") return;
  const value = e.target.value;
  if (value === "") return;
  applyOrderTemplate(Number(value));
});

/* =========================
   MEASURED PRICING ENGINE (Phase 2.1)
   Suggested prices from YOUR measured job times, per-bucket honesty:
   a bucket (glove type [+trapeze] + service set) with 3+ jobs of 15+
   logged minutes uses its median; thinner buckets fall back to the
   SHOP_PRICING rules and say so. Self-improves with every timer session.
========================= */

const MEASURED_MIN_JOB_MINUTES = 15;
const MEASURED_MIN_BUCKET_JOBS = 3;

function orderHasCustomWork(order) {
  const parsed = parseServicesValue(order?.servicesRequested || "");
  return !!(parsed.otherChecked || String(parsed.otherText || "").trim());
}

function measuredBucketKey(order) {
  const services = getOrderSelectedServices(order).slice().sort().join(" + ") || "Other";
  const glove = String(order?.gloveType || "Unknown");
  const trapeze = glove === "Fielders Glove" && orderHasTrapezeWeb(order) ? " (Trapeze)" : "";
  return `${glove}${trapeze} · ${services}`;
}

const LABOR_CUSTOM_PHASE = "Custom Work";

function buildMeasuredJobStats(sessions) {
  const perOrder = new Map(); // orderNumber -> { standard, custom } minutes
  (Array.isArray(sessions) ? sessions : []).forEach(s => {
    const key = String(s.orderNumber || "");
    if (!key) return;
    if (!perOrder.has(key)) perOrder.set(key, { standard: 0, custom: 0 });
    const slot = perOrder.get(key);
    if (String(s.phase || "") === LABOR_CUSTOM_PHASE) slot.custom += Number(s.durationMinutes) || 0;
    else slot.standard += Number(s.durationMinutes) || 0;
  });

  const buckets = new Map();
  for (const [orderNumber, mins] of perOrder) {
    if (mins.standard < MEASURED_MIN_JOB_MINUTES) continue;
    const order = allOrders.find(o => String(o.orderNumber) === orderNumber);
    if (!order) continue;
    /* Custom ("Other") jobs feed the medians ONLY when their bespoke time
       was timed under the Custom Work phase — then the standard minutes are
       clean data. Untagged custom jobs stay out entirely. */
    if (orderHasCustomWork(order) && mins.custom <= 0) continue;
    const minutes = mins.standard;
    const key = measuredBucketKey(order);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(minutes);
  }

  const stats = new Map();
  for (const [key, list] of buckets) {
    list.sort((a, b) => a - b);
    const mid = Math.floor(list.length / 2);
    const median = list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
    stats.set(key, { medianMinutes: median, n: list.length });
  }
  return stats;
}

function getMeasuredSuggestion(order) {
  if (!Array.isArray(moneyLaborSummaryCache)) return null;
  const stats = buildMeasuredJobStats(moneyLaborSummaryCache).get(measuredBucketKey(order));
  if (!stats || stats.n < MEASURED_MIN_BUCKET_JOBS) return null;
  const materials = getOrderMaterialsCost(order).total;
  const raw = materials + (stats.medianMinutes / 60) * SHOP_ECONOMICS.targetHourlyRate;
  return { ...stats, price: Math.round(raw / 5) * 5 };
}

/* Money view: the engine's dashboard — every bucket, its median, and
   whether it's measured yet. */
function renderMeasuredTimesTable(sessions) {
  const stats = buildMeasuredJobStats(sessions);
  if (!stats.size) return "";
  const rows = [...stats.entries()].sort((a, b) => b[1].n - a[1].n);
  return `
    <div class="dashboard-card money-card">
      <h3 class="money-card-title">Measured Job Times</h3>
      <div class="money-table-wrap">
        <table class="money-table">
          <thead>
            <tr><th>Job type</th><th>Jobs</th><th>Median time</th><th>Pricing basis</th></tr>
          </thead>
          <tbody>
            ${rows.map(([key, s]) => `
              <tr>
                <td>${escapeHtml(key)}</td>
                <td>${s.n}</td>
                <td>${escapeHtml(formatLaborDuration(s.medianMinutes))}</td>
                <td>${s.n >= MEASURED_MIN_BUCKET_JOBS
                  ? `<span class="measured-tag measured-tag-live">Measured</span>`
                  : `<span class="measured-tag">${MEASURED_MIN_BUCKET_JOBS - s.n} more to go live</span>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* Warm the labor cache so Order Detail suggestions can be measured on
   first open, not just after visiting the Money view. */
async function warmLaborSummaryCache() {
  if (Array.isArray(moneyLaborSummaryCache)) return;
  if (!isAuthenticated()) return;
  try {
    const data = await postJson({ action: "listLaborSummary" }, true);
    moneyLaborSummaryCache = data.sessions || [];
  } catch {}
}
setTimeout(warmLaborSummaryCache, 2500);

function orderCustomPhaseMinutes(orderNumber) {
  if (!Array.isArray(moneyLaborSummaryCache)) return 0;
  return moneyLaborSummaryCache
    .filter(s => String(s.orderNumber) === String(orderNumber) && String(s.phase || "") === LABOR_CUSTOM_PHASE)
    .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
}

/* =========================
   PROMISE ENGINE (Phase 2.2)
   Proposes a completion date from: measured hours for THIS job type +
   remaining hours queued ahead of it, paced by your MEASURED daily bench
   output (last 28 days of timer logs). Falls back honestly at every level:
   bucket median -> global median -> 2h default; measured pace -> 2h/day.
========================= */

const PROMISE_QUEUE_STATUSES = new Set([
  "Received", "Estimate Sent", "Customer Approved",
  "In Transit to Me", "In Progress", "Waiting on Lace/Parts"
]);
const PROMISE_FALLBACK_JOB_MINUTES = 120;
const PROMISE_FALLBACK_PACE_MINUTES_PER_DAY = 120;
const PROMISE_PACE_WINDOW_DAYS = 28;

function getEstimatedJobMinutes(order, stats) {
  const bucket = stats.get(measuredBucketKey(order));
  if (bucket && bucket.n >= MEASURED_MIN_BUCKET_JOBS) {
    return { minutes: bucket.medianMinutes, basis: `measured (${bucket.n} jobs)` };
  }
  const all = [...stats.values()].map(s => s.medianMinutes).sort((a, b) => a - b);
  if (all.length) {
    const mid = Math.floor(all.length / 2);
    const median = all.length % 2 ? all[mid] : (all[mid - 1] + all[mid]) / 2;
    return { minutes: median, basis: "shop median" };
  }
  return { minutes: PROMISE_FALLBACK_JOB_MINUTES, basis: "default estimate" };
}

/* Measured pace: how many bench minutes you actually log per day lately. */
function getMeasuredDailyPace() {
  if (!Array.isArray(moneyLaborSummaryCache)) return null;
  const sessions = laborSessionsWithDates();
  const cutoff = Date.now() - PROMISE_PACE_WINDOW_DAYS * 86400000;
  const recent = sessions.filter(s => s.endedMs && s.endedMs >= cutoff);
  const total = recent.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  if (total < 300) return null; // under 5 recent hours: not enough signal
  return total / PROMISE_PACE_WINDOW_DAYS;
}

function getPromiseProposal(order) {
  if (!Array.isArray(moneyLaborSummaryCache)) return null;

  const stats = buildMeasuredJobStats(moneyLaborSummaryCache);
  const loggedByOrder = new Map();
  moneyLaborSummaryCache.forEach(s => {
    const key = String(s.orderNumber || "");
    if (!key) return;
    loggedByOrder.set(key, (loggedByOrder.get(key) || 0) + (Number(s.durationMinutes) || 0));
  });

  const thisNum = parseInt(order.orderNumber, 10) || 0;
  const thisJob = getEstimatedJobMinutes(order, stats);
  const thisRemaining = Math.max(0, thisJob.minutes - (loggedByOrder.get(String(order.orderNumber)) || 0));

  let queueMinutes = 0;
  let queueJobs = 0;
  for (const other of allOrders) {
    if (!PROMISE_QUEUE_STATUSES.has(String(other.status || ""))) continue;
    const num = parseInt(other.orderNumber, 10) || 0;
    if (num >= thisNum) continue; // FIFO: only work ahead of this order
    const est = getEstimatedJobMinutes(other, stats).minutes;
    const remaining = Math.max(0, est - (loggedByOrder.get(String(other.orderNumber)) || 0));
    if (remaining <= 0) continue;
    queueMinutes += remaining;
    queueJobs += 1;
  }

  const measuredPace = getMeasuredDailyPace();
  const pace = measuredPace || PROMISE_FALLBACK_PACE_MINUTES_PER_DAY;
  const days = Math.max(1, Math.ceil((queueMinutes + thisRemaining) / pace) + 1); // +1 buffer day
  const target = new Date();
  target.setDate(target.getDate() + days);

  return {
    dateKey: calDateKey(target),
    dateLabel: target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    queueHours: queueMinutes / 60,
    queueJobs,
    jobHours: thisRemaining / 60,
    jobBasis: thisJob.basis,
    paceHours: pace / 60,
    paceMeasured: !!measuredPace
  };
}

function renderPromiseProposal() {
  const el = document.getElementById("promiseProposal");
  if (!el) return;
  const order = detailMode === "new" ? getBlankAdminOrder() : currentOrder;
  if (!order) { el.hidden = true; return; }

  const fill = () => {
    const p = getPromiseProposal(order);
    const target = document.getElementById("promiseProposal");
    if (!target || !p) return;
    target.hidden = false;
    target.innerHTML = `
      <span class="promise-text">MurphOS proposes <strong>${escapeHtml(p.dateLabel)}</strong> —
        ${p.queueJobs ? `${p.queueHours.toFixed(1)}h queued (${p.queueJobs} job${p.queueJobs === 1 ? "" : "s"}) + ` : ""}this job ~${p.jobHours.toFixed(1)}h (${escapeHtml(p.jobBasis)}), at ${p.paceHours.toFixed(1)}h/day ${p.paceMeasured ? "measured pace" : "default pace"} + 1 buffer day</span>
      <button type="button" class="promise-apply-btn" data-promise-date="${escapeAttr(p.dateKey)}">Use</button>
    `;
  };

  if (Array.isArray(moneyLaborSummaryCache)) {
    fill();
  } else {
    warmLaborSummaryCache().then(fill);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-promise-date]");
  if (!btn) return;
  const input = document.getElementById("editEstimatedCompletion");
  if (!input) return;
  input.value = btn.dataset.promiseDate;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

/* Sessions with end timestamps for pace math — summary lacks dates, so we
   derive from durations attributed to the summary fetch time window via the
   endedMs field when present; fall back to counting everything. */
function laborSessionsWithDates() {
  return (moneyLaborSummaryCache || []).map(s => ({
    ...s,
    endedMs: s.endedAt ? new Date(s.endedAt).getTime() : null
  }));
}
