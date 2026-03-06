// =========================
// Gallery lightbox (slider)
// =========================
function initGalleryLightbox() {
  const thumbs = Array.from(document.querySelectorAll(".gallery-grid img, .gallery-strip img"));
  if (!thumbs.length) return;

  const lb = document.querySelector(".lightbox");
  if (!lb || lb.dataset.bound === "true") return;

  const track = lb.querySelector(".lb-track");
  const viewport = lb.querySelector(".lb-viewport");
  const prevBtn = lb.querySelector(".lb-prev");
  const nextBtn = lb.querySelector(".lb-next");
  const closeBtn = lb.querySelector(".lb-close");
  const counter = lb.querySelector(".lb-counter");

  if (!track || !viewport || !prevBtn || !nextBtn || !closeBtn) return;

  let index = 0;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let dx = 0;

  thumbs.forEach(img => {
    img.draggable = false;
    img.addEventListener("dragstart", (e) => e.preventDefault());
  });

  track.innerHTML = "";
  const slides = thumbs.map(img => {
    const slideImg = document.createElement("img");
    slideImg.src = img.currentSrc || img.src;
    slideImg.alt = img.alt || "Gallery image";
    slideImg.draggable = false;
    track.appendChild(slideImg);
    return slideImg;
  });

  function updateCounter() {
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
  }

  function goTo(i, animate = true) {
    index = (i + slides.length) % slides.length;
    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transition = animate ? "transform .28s ease" : "none";
    track.style.transform = `translateX(${-index * w}px)`;
    updateCounter();
  }

  function open(i) {
    index = i;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    goTo(index, false);
    requestAnimationFrame(() => goTo(index, true));
  }

  function close() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  thumbs.forEach((img, i) => {
    let moved = false;
    let downX = 0;
    let downY = 0;

    img.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    });

    img.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) {
        moved = true;
      }
    });

    img.addEventListener("pointerup", () => {
      if (!moved) open(i);
    });
  });

  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); next(); });
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });

  lb.addEventListener("click", (e) => {
    if (!viewport.contains(e.target)) close();
  });

  window.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  lb.addEventListener("touchstart", (e) => {
    if (!lb.classList.contains("open")) return;
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    track.style.transition = "none";
  }, { passive: false });

  lb.addEventListener("touchmove", (e) => {
    if (!dragging) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dx = x - startX;
    const dy = y - startY;

    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      const w = viewport.getBoundingClientRect().width || 1;
      track.style.transform = `translateX(${(-index * w) + dx}px)`;
    }
  }, { passive: false });

  lb.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;

    const w = viewport.getBoundingClientRect().width || 1;
    const threshold = w * 0.18;

    if (dx < -threshold) next();
    else if (dx > threshold) prev();
    else goTo(index);
  });

  updateCounter();
  lb.dataset.bound = "true";
}

function bootGalleryLightbox() {
  initGalleryLightbox();
  window.setTimeout(initGalleryLightbox, 150);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGalleryLightbox);
} else {
  bootGalleryLightbox();
}

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

// =========================
// Lace tap toggle (mobile)
// =========================
(() => {
  const laceItems = document.querySelectorAll(".lace-item");
  if (!laceItems.length) return;

  laceItems.forEach(item => {
    item.addEventListener("click", () => {

      // If already open, close it
      if (item.classList.contains("show-label")) {
        item.classList.remove("show-label");
        return;
      }

      // Close others
      laceItems.forEach(i => i.classList.remove("show-label"));

      // Open this one
      item.classList.add("show-label");
    });
  });

  // Tap outside closes any open label
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lace-item")) {
      laceItems.forEach(i => i.classList.remove("show-label"));
    }
  });
})();

// =========================
// Disable right-click on protected images
// =========================
(() => {
  document.querySelectorAll(".no-save").forEach(img => {
    img.addEventListener("contextmenu", e => e.preventDefault());
  });
})();
