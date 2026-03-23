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

const sideMenu = document.getElementById("sideMenu");
const menuBackdrop = document.getElementById("menuBackdrop");
const menuBtn = document.getElementById("menuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));

let allOrders = [];
let activeView = "current";
let currentOrder = null;
let loginInProgress = false;

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

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString();
}

function formatDateForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isCompletedOrder(order) {
  const status = String(order.status || "").trim().toLowerCase();
  return status === "completed" || status === "picked up";
}

function getViewOrders() {
  if (activeView === "completed") {
    return allOrders.filter(isCompletedOrder);
  }
  return allOrders.filter(order => !isCompletedOrder(order));
}

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
  viewTitle.textContent = viewName === "completed" ? "Completed" : "Current Orders";

  navLinks.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  closeMenu();
  applyFilters();
}

function getCardDateLabel(order) {
  return isCompletedOrder(order) ? "Completed" : "Received";
}

function getCardDateValue(order) {
  return isCompletedOrder(order) ? (order.dateCompleted || "") : (order.dateReceived || "");
}

function quickActionsForOrder(order) {
  const status = String(order.status || "").trim().toLowerCase();
  const actions = [];

  if (status !== "in progress") actions.push({ label: "In Progress", status: "In Progress" });
  if (status !== "ready to go") actions.push({ label: "Ready to Go", status: "Ready to Go" });
  if (status !== "completed") actions.push({ label: "Completed", status: "Completed" });

  actions.push({
    label: String(order.paid || "").trim().toLowerCase() === "paid" ? "Mark Unpaid" : "Mark Paid",
    paid: String(order.paid || "").trim().toLowerCase() === "paid" ? "Unpaid" : "Paid"
  });

  return actions.slice(0, 4);
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

    const paidClass = String(order.paid || "").trim().toLowerCase() === "paid" ? "paid" : "unpaid";

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
        <button class="action-btn action-note" type="button" aria-label="Notes">
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

    card.querySelector(".action-note").addEventListener("click", (e) => {
      e.stopPropagation();
      openOrder(order.orderNumber);
      setTimeout(() => {
        const notesField = document.getElementById("editInternalNotes");
        if (notesField) notesField.focus();
      }, 50);
    });

    ordersList.appendChild(card);
  });
}

function renderOrderDetail(order) {
  currentOrder = order;

  orderDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-block">
        <div class="label">Order #</div>
        <div class="value">${escapeHtml(order.orderNumber || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Customer</div>
        <div class="value">${escapeHtml(order.customerName || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Phone</div>
        <div class="value">${escapeHtml(order.phoneNumber || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Email</div>
        <div class="value">${escapeHtml(order.emailAddress || "")}</div>
      </div>

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
        <input id="editPriceQuoted" type="number" step="0.01" />
      </div>

      <div class="detail-block">
        <div class="label">Estimated Completion</div>
        <input id="editEstimatedCompletion" type="date" />
      </div>

      <div class="detail-block">
        <div class="label">Tracking Number</div>
        <input id="editTrackingNumber" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Carrier</div>
        <input id="editCarrier" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Allow Ship Without Payment</div>
        <select id="editAllowShipWithoutPayment">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>

      <div class="detail-block">
        <div class="label">Internal Notes</div>
        <textarea id="editInternalNotes" rows="4"></textarea>
      </div>

      <div class="detail-block">
        <div class="label">Brand / Model</div>
        <input id="editBrandModel" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Glove Type</div>
        <input id="editGloveType" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Web Type</div>
        <input id="editWebType" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Services Requested</div>
        <textarea id="editServicesRequested" rows="4"></textarea>
      </div>

      <div class="detail-block">
        <div class="label">Drop-Off Method</div>
        <input id="editDropOffMethod" type="text" />
      </div>

      <div class="detail-block">
        <div class="label">Date Received</div>
        <div class="value">${escapeHtml(formatDate(order.dateReceived))}</div>
      </div>

      <div class="detail-block">
        <div class="label">Date Completed</div>
        <div class="value">${escapeHtml(formatDate(order.dateCompleted))}</div>
      </div>

      <div class="detail-block">
        <div class="label">Customer Notes</div>
        <textarea id="editGloveNotes" rows="5"></textarea>
      </div>

      <div class="detail-block">
        <button id="saveOrderBtn" type="button">Save Changes</button>
        <p id="saveStatus" class="status"></p>
      </div>
    </div>
  `;

  document.getElementById("editStatus").value = order.status || "Received";
  document.getElementById("editPaid").value = (String(order.paid || "").trim().toLowerCase() === "paid") ? "Paid" : "Unpaid";
  document.getElementById("editPriceQuoted").value = order.priceQuoted ?? "";
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
  document.getElementById("editGloveNotes").value = order.gloveNotes || "";

  document.getElementById("saveOrderBtn").addEventListener("click", async () => {
    try {
      await saveCurrentOrderFromForm();
    } catch (err) {
      const saveStatus = document.getElementById("saveStatus");
      if (saveStatus) saveStatus.textContent = err.message;
    }
  });
}

async function saveCurrentOrderFromForm() {
  if (!currentOrder) return;

  const saveStatus = document.getElementById("saveStatus");
  saveStatus.textContent = "Saving...";

  const updates = {
    status: document.getElementById("editStatus").value,
    paid: document.getElementById("editPaid").value,
    priceQuoted: document.getElementById("editPriceQuoted").value,
    estimatedCompletion: document.getElementById("editEstimatedCompletion").value,
    trackingNumber: document.getElementById("editTrackingNumber").value,
    carrier: document.getElementById("editCarrier").value,
    allowShipWithoutPayment: document.getElementById("editAllowShipWithoutPayment").value === "true",
    internalNotes: document.getElementById("editInternalNotes").value,
    brandModel: document.getElementById("editBrandModel").value,
    gloveType: document.getElementById("editGloveType").value,
    webType: document.getElementById("editWebType").value,
    servicesRequested: document.getElementById("editServicesRequested").value,
    dropOffMethod: document.getElementById("editDropOffMethod").value,
    gloveNotes: document.getElementById("editGloveNotes").value
  };

  const updated = await saveOrderUpdate(currentOrder.orderNumber, updates, true);
  currentOrder = updated;
  renderOrderDetail(updated);
  document.getElementById("saveStatus").textContent = "Saved.";
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

  if (currentOrder && currentOrder.orderNumber === updatedOrder.orderNumber) {
    currentOrder = updatedOrder;
  }

  applyFilters();
  return updatedOrder;
}

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
    await loadOrders();
    showView(dashboardView);
  } catch (err) {
    loginStatus.textContent = err.message;
    pinInput.value = "";
    pinInput.focus();
  } finally {
    loginInProgress = false;
  }
}

async function loadOrders() {
  const data = await postJson({ action: "listOrders" }, true);
  allOrders = data.orders || [];
  applyFilters();
}

function openOrder(orderNumber) {
  const order = allOrders.find(o => String(o.orderNumber) === String(orderNumber));
  if (!order) {
    alert("Order not found.");
    return;
  }

  renderOrderDetail(order);
  showView(detailView);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

pinInput.addEventListener("input", () => {
  const digits = pinInput.value.replace(/\D/g, "").slice(0, 6);
  pinInput.value = digits;

  if (digits.length === 6) {
    login(digits);
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  showView(loginView);
});

searchInput.addEventListener("input", applyFilters);
backBtn.addEventListener("click", () => showView(dashboardView));

menuBtn.addEventListener("click", openMenu);
closeMenuBtn.addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);

navLinks.forEach(btn => {
  btn.addEventListener("click", () => {
    setActiveView(btn.dataset.view);
  });
});

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
