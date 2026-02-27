// =========================
// Gallery lightbox
// =========================
(function () {
  const images = Array.from(document.querySelectorAll(".gallery-grid img"));
  const lb = document.querySelector(".lightbox");
  if (!lb || !images.length) return;

  const lbImg = lb.querySelector("img");
  const prevBtn = lb.querySelector(".lb-prev");
  const nextBtn = lb.querySelector(".lb-next");

  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    lbImg.src = images[currentIndex].src;
    lb.classList.add("open");
  }

  function closeLightbox() {
    lb.classList.remove("open");
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % images.length;
    lbImg.src = images[currentIndex].src;
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    lbImg.src = images[currentIndex].src;
  }

  images.forEach((img, index) => {
    img.addEventListener("click", () => openLightbox(index));
  });

  nextBtn.addEventListener("click", showNext);
  prevBtn.addEventListener("click", showPrev);

  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") showNext();
    if (e.key === "ArrowLeft") showPrev();
  });

  // Swipe support (mobile)
  let startX = 0;
  lb.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });

  lb.addEventListener("touchend", e => {
    let endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) showNext();
    if (endX - startX > 50) showPrev();
  });
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
