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
  if (useAuth) {
    body._token = getToken();
  }

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

function renderOrders(list) {
  orderCount.textContent = `${list.length} order${list.length === 1 ? "" : "s"}`;
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = `<div class="card" style="padding:16px;">No matching orders.</div>`;
    return;
  }

  list.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-top">
        <div>
          <strong>Order #${escapeHtml(order.orderNumber)}</strong><br>
          <div>${escapeHtml(order.customerName || "")}</div>
          <div class="muted">${escapeHtml(order.emailAddress || "")}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>${escapeHtml(order.status || "")}</strong></div>
          <div class="muted">${formatDate(order.dateReceived)}</div>
        </div>
      </div>

      <div class="badges">
        <span class="badge">${escapeHtml(order.paid || "Unknown")}</span>
        <span class="badge">${escapeHtml(order.dropOffMethod || "No delivery method")}</span>
        ${order.estimatedCompletion ? `<span class="badge">Est: ${escapeHtml(formatDate(order.estimatedCompletion))}</span>` : ""}
      </div>

      <button data-order="${escapeHtml(order.orderNumber)}">Open</button>
    `;
    card.querySelector("button").addEventListener("click", () => openOrder(order.orderNumber));
    ordersList.appendChild(card);
  });
}

function renderOrderDetail(order) {
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
        <div class="value">${escapeHtml(order.status || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Paid</div>
        <div class="value">${escapeHtml(order.paid || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Price Quoted</div>
        <div class="value">${escapeHtml(String(order.priceQuoted || ""))}</div>
      </div>

      <div class="detail-block">
        <div class="label">Estimated Completion</div>
        <div class="value">${escapeHtml(formatDate(order.estimatedCompletion))}</div>
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
        <div class="label">Tracking Number</div>
        <div class="value">${escapeHtml(order.trackingNumber || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Carrier</div>
        <div class="value">${escapeHtml(order.carrier || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Internal Notes</div>
        <div class="value">${escapeHtml(order.internalNotes || "")}</div>
      </div>

      <div class="detail-block">
        <div class="label">Customer Notes</div>
        <div class="value">${escapeHtml(order.gloveNotes || "")}</div>
      </div>
    </div>
  `;
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
