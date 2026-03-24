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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function formatDateForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function renderFieldLikeFull(label, value) {
  return `
    <div class="detail-block full">
      <div class="label">${escapeHtml(label)}</div>
      <div class="field-like readonly">${escapeHtml(value || "")}</div>
    </div>
  `;
}

function renderLaceInput(label, id, value) {
  return `
    <div class="detail-block">
      <div class="label">${escapeHtml(label)}</div>
      <input id="${escapeAttr(id)}" type="text" value="${escapeAttr(value || "")}" />
    </div>
  `;
}

function renderSelectOptions(current, options, placeholder = "") {
  const values = placeholder ? ["", ...options] : options;
  return values.map(v => {
    const label = v || placeholder;
    return `<option value="${escapeAttr(v)}" ${String(v) === String(current || "") ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function gloveTypeOptions(current) {
  return renderSelectOptions(
    current,
    ["Fielders Glove", "Catchers Mitt", "First Base Mitt"],
    "Select glove type"
  );
}

function webTypeOptions(current) {
  return renderSelectOptions(
    current,
    [
      "I-Web",
      "H-Web",
      "Single Post Web",
      "Trapeze Web",
      "Modified Trapeze Web",
      "Basket (Fully Closed) Web"
    ],
    "Select web type"
  );
}

function carrierOptions(current) {
  return renderSelectOptions(
    current,
    ["USPS", "UPS", "FedEx"],
    "Select carrier"
  );
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
       <div class="label">Tracking Number</div>
       <input id="editTrackingNumber" type="text" />
    </div>

    <div class="detail-block">
       <div class="label">Carrier</div>
       <select id="editCarrier">${carrierOptions(order.carrier)}</select>
    </div>

    <div class="detail-block">
       <div class="label">Allow Ship Without Payment</div>
       <select id="editAllowShipWithoutPayment">
         <option value="false">No</option>
         <option value="true">Yes</option>
       </select>
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
      ${renderFieldLike("Date Completed", formatDate(order.dateCompleted))}

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
  document.getElementById("editTrackingNumber").value = order.trackingNumber || "";
  document.getElementById("editCarrier").value = order.carrier || "";
  document.getElementById("editAllowShipWithoutPayment").value = order.allowShipWithoutPayment ? "true" : "false";
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

  const primaryLaceColor = val("editPrimaryLaceColor");
  const secondaryLaceColor = val("editSecondaryLaceColor");
  const customLaceNotes = val("editCustomLaceNotes");

  const updates = {
    status: val("editStatus"),
    paid: val("editPaid"),
    priceQuoted: parseMoneyInput(val("editPriceQuoted")),
    estimatedCompletion: val("editEstimatedCompletion"),
    trackingNumber: val("editTrackingNumber"),
    carrier: val("editCarrier"),
    allowShipWithoutPayment: val("editAllowShipWithoutPayment") === "true",
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
