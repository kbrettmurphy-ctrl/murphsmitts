/* =========================================================
   Murph’s Mitts — admin.js (FIXED)
   ========================================================= */

let _orders = [];
let _activeView = "current";
let _currentOrder = null;

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  wireSidebar_();
  loadOrders_();
});

/* =========================
   SIDEBAR NAV (FIXED)
========================= */
function wireSidebar_() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;

      // FORCE EXIT DETAIL VIEW (this was your main bug)
      closeDetail_();

      _activeView = view;
      renderOrders_();
    });
  });
}

/* =========================
   LOAD ORDERS
========================= */
async function loadOrders_() {
  try {
    const res = await fetch("/api/orders");
    const data = await res.json();
    _orders = data.orders || [];
    renderOrders_();
  } catch (e) {
    console.error("Failed to load orders", e);
  }
}

/* =========================
   FILTERS (NEW STATUS VIEWS)
========================= */
function getFilteredOrders_() {
  switch (_activeView) {
    case "waiting":
      return _orders.filter(o => o.status === "Waiting on Parts");
    case "estimate":
      return _orders.filter(o => o.status === "Estimate Sent");
    case "progress":
      return _orders.filter(o => o.status === "In Progress");
    case "ready":
      return _orders.filter(o => o.status === "Ready to Go");
    case "completed":
      return _orders.filter(o => o.status === "Completed");
    default:
      return _orders.filter(o => o.status !== "Completed");
  }
}

/* =========================
   RENDER LIST
========================= */
function renderOrders_() {
  const list = document.getElementById("ordersList");
  if (!list) return;

  list.innerHTML = "";

  const orders = getFilteredOrders_();

  orders.forEach(order => {
    const row = document.createElement("div");
    row.className = "order-row";
    row.textContent = `${order.orderNumber} — ${order.customerName}`;

    row.addEventListener("click", () => openDetail_(order));

    list.appendChild(row);
  });
}

/* =========================
   OPEN DETAIL (FIXED SCROLL)
========================= */
function openDetail_(order) {
  _currentOrder = order;

  const panel = document.getElementById("detailPanel");
  panel.classList.add("open");

  renderDetail_(order);

  // FORCE TOP SCROLL (fix inconsistent open position)
  panel.scrollTop = 0;
}

/* =========================
   CLOSE DETAIL
========================= */
function closeDetail_() {
  const panel = document.getElementById("detailPanel");
  panel.classList.remove("open");
  _currentOrder = null;
}

/* =========================
   DETAIL RENDER (GROUPED)
========================= */
function renderDetail_(o) {
  const el = document.getElementById("detailContent");

  el.innerHTML = `
    <div class="detail-section">
      <h3>Status</h3>
      <select id="status">
        ${opt_(o.status, [
          "Received",
          "Waiting on Parts",
          "Estimate Sent",
          "In Progress",
          "Ready to Go",
          "Completed"
        ])}
      </select>
    </div>

    <div class="detail-section">
      <h3>Customer</h3>
      <input id="name" value="${o.customerName || ""}">
      <input id="email" value="${o.email || ""}">
      <input id="phone" value="${o.phone || ""}">
    </div>

    <div class="detail-section">
      <h3>Glove</h3>
      <select id="gloveType">
        ${opt_(o.gloveType, [
          "Fielders Glove",
          "Catchers Mitt",
          "First Base Mitt"
        ])}
      </select>

      <select id="webType">
        ${opt_(o.webType, [
          "I-Web",
          "H-Web",
          "Single Post Web",
          "Trapeze Web",
          "Modified Trapeze Web",
          "Basket (Fully Closed) Web"
        ])}
      </select>

      <input id="lacePrimary" value="${o.lacePrimary || ""}">
      <input id="laceAccent" value="${o.laceAccent || ""}">
    </div>

    <div class="detail-section">
      <h3>Shipping</h3>
      <select id="carrier">
        ${opt_(o.carrier, ["USPS", "UPS", "FedEx"])}
      </select>

      <input id="address" value="${o.address || ""}">
      <input id="city" value="${o.city || ""}">
      <input id="state" value="${o.state || ""}">
      <input id="zip" value="${o.zip || ""}">
    </div>

    <div class="detail-section">
      <h3>Pricing</h3>
      <input id="price" value="${formatMoney_(o.price)}">
    </div>
  `;
}

/* =========================
   SAVE (FIXED FIELD LOSS)
========================= */
async function saveChanges_() {
  if (!_currentOrder) return;

  const updated = {
    id: _currentOrder.id,
    status: val_("status"),
    customerName: val_("name"),
    email: val_("email"),
    phone: val_("phone"),
    gloveType: val_("gloveType"),
    webType: val_("webType"),
    lacePrimary: val_("lacePrimary"),
    laceAccent: val_("laceAccent"),
    carrier: val_("carrier"),
    address: val_("address"),
    city: val_("city"),
    state: val_("state"),
    zip: val_("zip"),
    price: parseMoney_(val_("price"))
  };

  try {
    await fetch("/api/update-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

    Object.assign(_currentOrder, updated);
    renderOrders_();
  } catch (e) {
    console.error("Save failed", e);
  }
}

/* =========================
   HELPERS
========================= */
function val_(id) {
  return document.getElementById(id)?.value || "";
}

function opt_(current, arr) {
  return arr.map(v =>
    `<option ${v === current ? "selected" : ""}>${v}</option>`
  ).join("");
}

function formatMoney_(v) {
  if (!v) return "";
  return `$${Number(v).toFixed(2)}`;
}

function parseMoney_(v) {
  return Number(String(v).replace(/[^0-9.]/g, "")) || 0;
}
