
// Active nav highlight + simple lightbox for gallery
(function () {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    if (a.getAttribute("data-page") === path) a.classList.add("active");
  });

  const lb = document.querySelector(".lightbox");
  if (!lb) return;

  const lbImg = lb.querySelector("img");
  document.querySelectorAll(".gallery-grid img").forEach(img => {
    img.addEventListener("click", () => {
      lbImg.src = img.src;
      lb.classList.add("open");
    });
  });

  lb.addEventListener("click", () => lb.classList.remove("open"));
})();

// =========================
// Mobile menu toggle
// =========================
(() => {
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  const menu = document.querySelector('[data-mobile-menu]');

  if (!openBtn || !closeBtn || !menu) return;

  const openMenu = () => {
    menu.classList.add('open');
    document.body.classList.add('menu-open');
  };

  const closeMenu = () => {
    menu.classList.remove('open');
    document.body.classList.remove('menu-open');
  };

  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);

  // Close if you tap a link
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });

  // Close on ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
})();

// Pre-select contact tab via URL
(function () {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (tab === "service") {
    const serviceRadio = document.getElementById("tab-service");
    if (serviceRadio) {
      serviceRadio.checked = true;
    }
  }
})();

// Start fetching immediately (runs as soon as the script loads)
const headerPromise = fetch("/partials/header.html").then(r => r.text());
const footerPromise = fetch("/partials/footer.html").then(r => r.text());

document.addEventListener("DOMContentLoaded", async () => {
  // Inject once DOM is ready
  document.getElementById("site-header").innerHTML = await headerPromise;
  document.getElementById("site-footer").innerHTML = await footerPromise;

  // Set active nav link
  const currentPath = window.location.pathname.replace(/\/$/, "");

  document.querySelectorAll(".site-nav a").forEach(a => {
    const linkPath = new URL(a.href).pathname.replace(/\/$/, "");
    if (linkPath === currentPath) {
      a.classList.add("active");
    }
  });
});
