// =========================
// Gallery lightbox
// =========================
(() => {
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
    menu.classList.add("open");
    document.body.classList.add("menu-open");
  };

  const closeMenu = () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  };

  openBtn.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);

  // Close if you tap a link
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", closeMenu);
  });

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
})();

// =========================
// Pre-select contact tab via URL (?tab=service)
// =========================
(() => {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab !== "service") return;

  const serviceRadio = document.getElementById("tab-service");
  if (serviceRadio) serviceRadio.checked = true;
})();
