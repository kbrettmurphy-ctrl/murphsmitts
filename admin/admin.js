const API_BASE_URL = window.MM_ADMIN_CONFIG.API_BASE_URL;
const TOKEN_KEY = "mm_admin_token";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const detailView = document.getElementById("detailView");

const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");
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
  if (isCompletedOrder(order)) {
    return order.dateCompleted || "";
  }
  return order.dateReceived || "";
}

function quickActionsForOrder(order) {
  const status = String(order.status || "").trim().toLowerCase();
  const actions = [];

  if (status !== "in progress") {
    actions.push({ label: "In Progress", status: "In Progress" });
  }
  if (status !== "ready to go") {
    actions.push({ label: "Ready to Go", status: "Ready to Go" });
  }
  if (status !== "completed") {
    actions.push({ label: "Completed", status: "Completed" });
  }

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
    ordersList.innerHTML = `<div class="card" style="padding:16px;">No matching orders.</div>`;
    return;
  }

  list.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card clickable-card";
    card.tabIndex = 0;

    const dateLabel = getCardDateLabel(order);
    const dateValue = getCardDateValue(order);

    card.innerHTML = `
      <div class="order-top">
        <div>
          <strong>Order #${escapeHtml(order.orderNumber)}</strong><br>
          <div>${escapeHtml(order.customerName || "")}</div>
          <div class="muted">${escapeHtml(order.emailAddress || "")}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>${escapeHtml(order.status || "")}</strong></div>
          <div class="muted">${escapeHtml(dateLabel)}: ${escapeHtml(formatDate(dateValue))}</div>
        </div>
      </div>

      <div class="badges">
        <span class="badge">${escapeHtml(order.paid || "Unknown")}</span>
        <span class="badge">${escapeHtml(order.dropOffMethod || "No delivery method")}</span>
        ${order.estimatedCompletion ? `<span class="badge">Est: ${escapeHtml(formatDate(order.estimatedCompletion))}</span>` : ""}
      </div>

      <div class="quick-actions"></div>
    `;

    const quickWrap = card.querySelector(".quick-actions");
    quickActionsForOrder(order).forEach(action => {
      const btn = document.createElement("button");
      btn.className = "secondary quick-btn";
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const updates = {};
          if (action.status) updates.status = action.status;
          if (action.paid) updates.paid = action.paid;
          await saveOrderUpdate(order.orderNumber, updates, false);
        } catch (err) {
          alert(err.message);
        }
      });
      quickWrap.appendChild(btn);
    });

    card.addEventListener("click", () => openOrder(order.orderNumber));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOrder(order.orderNumber);
      }
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
        <textarea id="editInternalNotes" rows="5"></textarea>
      </div>

      <div class="detail-block">
        <div class="label">Brand / Model</div>
        <div class="value">${escapeHtml(order.brandModel || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Glove Type</div>
        <div class="value">${escapeHtml(order.gloveType || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Web Type</div>
        <div class="value">${escapeHtml(order.webType || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Services Requested</div>
        <div class="value">${escapeHtml(order.servicesRequested || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Drop-Off Method</div>
        <div class="value">${escapeHtml(order.dropOffMethod || "")}</div>
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
        <div class="value">${escapeHtml(order.gloveNotes || "")}</div>
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
    internalNotes: document.getElementById("editInternalNotes").value
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

  applyFilters();

  if (currentOrder && currentOrder.orderNumber === updatedOrder.orderNumber) {
    currentOrder = updatedOrder;
  }

  if (stayOnDetail) {
    return updatedOrder;
  }

  return updatedOrder;
}

async function login() {
  loginStatus.textContent = "Logging in...";
  try {
    const data = await postJson({
      action: "login",
      pin: pinInput.value.trim()
    });

    setToken(data.token);
    pinInput.value = "";
    loginStatus.textContent = "";
    await loadOrders();
    showView(dashboardView);
  } catch (err) {
    loginStatus.textContent = err.message;
  }
}

async function loadOrders() {
  const data = await postJson({ action: "listOrders" }, true);
  allOrders = data.orders || [];
  applyFilters();
}

async function openOrder(orderNumber) {
  try {
    const data = await postJson({
      action: "getOrder",
      orderNumber
    }, true);

    renderOrderDetail(data.order);
    showView(detailView);
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

loginBtn.addEventListener("click", login);
pinInput.addEventListener("keydown", e => {
  if (e.key === "Enter") login();
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
