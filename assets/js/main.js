// =========================
// Gallery lightbox (slider)
// =========================
function initGalleryLightbox() {
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
  let slides = [];
  let touchStartX = 0;
  let dragging = false;
  let dx = 0;

  function updateCounter() {
    counter.textContent = slides.length ? `${index + 1} / ${slides.length}` : "";
  }

  function goTo(i, animate = true) {
    if (!slides.length) return;

    index = (i + slides.length) % slides.length;
    const w = viewport.getBoundingClientRect().width || 1;

    track.style.transition = animate ? "transform .28s ease" : "none";
    track.style.transform = `translateX(${-index * w}px)`;

    updateCounter();
  }

  function buildSlides(thumbButtons) {
    track.innerHTML = "";

    slides = thumbButtons.map((btn) => {
      const sourceImg = btn.querySelector("img");
      const slideImg = document.createElement("img");
      slideImg.src = sourceImg.currentSrc || sourceImg.src;
      slideImg.alt = sourceImg.alt || "Gallery image";
      slideImg.draggable = false;
      track.appendChild(slideImg);
      return slideImg;
    });
  }

  function openFromButton(button) {
    const group = button.dataset.galleryGroup;
    if (!group) return;

    const thumbs = Array.from(
      document.querySelectorAll(`.gallery-thumb[data-gallery-group="${group}"]`)
    );
    const clickedIndex = thumbs.indexOf(button);
    if (clickedIndex === -1) return;

    buildSlides(thumbs);

    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    goTo(clickedIndex, false);
  }

  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-thumb");
    if (!btn) return;
    e.preventDefault();
    openFromButton(btn);
  });

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    prev();
  });

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    next();
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeLightbox();
  });

  // close when clicking anywhere outside the current image
  lb.addEventListener("click", (e) => {
    const activeImg = track.children[index];
    if (!activeImg) return;

    if (e.target === lb || e.target === track || !activeImg.contains(e.target)) {
      closeLightbox();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;

    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  viewport.addEventListener("touchstart", (e) => {
    if (!lb.classList.contains("open")) return;
    dragging = true;
    touchStartX = e.touches[0].clientX;
    dx = 0;
    track.style.transition = "none";
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (!dragging) return;

    dx = e.touches[0].clientX - touchStartX;
    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transform = `translateX(${(-index * w) + dx}px)`;
  }, { passive: true });

  viewport.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;

    const w = viewport.getBoundingClientRect().width || 1;
    const threshold = w * 0.18;

    if (dx < -threshold) next();
    else if (dx > threshold) prev();
    else goTo(index);
  });

  window.addEventListener("resize", () => {
    if (lb.classList.contains("open")) goTo(index, false);
  });

  updateCounter();
  lb.dataset.bound = "true";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGalleryLightbox);
} else {
  initGalleryLightbox();
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
