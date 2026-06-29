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
  let touchStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let panStartPanX = 0;
  let panStartPanY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let imageScale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let ignoreTouchGesture = false;
  let suppressImageClickUntil = 0;
  let gestureMode = "";
  let dx = 0;
  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const ZOOM_EPSILON = 0.015;

  function suppressImageClick(duration = 1200) {
    suppressImageClickUntil = Date.now() + duration;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getActiveImage() {
    return slides[index]?.querySelector("img") || null;
  }

  function isZoomed() {
    return imageScale > MIN_SCALE + ZOOM_EPSILON;
  }

  function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const x = touches[0].clientX - touches[1].clientX;
    const y = touches[0].clientY - touches[1].clientY;
    return Math.hypot(x, y);
  }

  function getPanBounds() {
    const activeImg = getActiveImage();
    if (!activeImg) return { x: 0, y: 0 };

    const viewportRect = viewport.getBoundingClientRect();
    const imageWidth = activeImg.offsetWidth || activeImg.naturalWidth || 0;
    const imageHeight = activeImg.offsetHeight || activeImg.naturalHeight || 0;

    return {
      x: Math.max(0, ((imageWidth * imageScale) - viewportRect.width) / 2),
      y: Math.max(0, ((imageHeight * imageScale) - viewportRect.height) / 2)
    };
  }

  function clampPan() {
    const bounds = getPanBounds();
    panX = clamp(panX, -bounds.x, bounds.x);
    panY = clamp(panY, -bounds.y, bounds.y);
  }

  function applyImageTransform() {
    const activeImg = getActiveImage();
    if (!activeImg) return;

    if (!isZoomed()) {
      imageScale = MIN_SCALE;
      panX = 0;
      panY = 0;
      activeImg.style.transform = "";
      activeImg.classList.remove("is-zoomed", "is-panning", "is-zooming");
      return;
    }

    clampPan();
    activeImg.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${imageScale})`;
    activeImg.classList.add("is-zoomed");
    activeImg.classList.toggle("is-panning", gestureMode === "pan");
    activeImg.classList.toggle("is-zooming", gestureMode === "pinch");
  }

  function resetImageState() {
    imageScale = MIN_SCALE;
    panX = 0;
    panY = 0;
    gestureMode = "";
    pinchStartDistance = 0;
    pinchStartScale = MIN_SCALE;
    slides.forEach((slide) => {
      const img = slide.querySelector("img");
      if (!img) return;
      img.style.transform = "";
      img.classList.remove("is-zoomed", "is-panning", "is-zooming");
    });
  }

  function resetTouchState() {
    dragging = false;
    ignoreTouchGesture = false;
    gestureMode = "";
    dx = 0;
    pinchStartDistance = 0;
  }

  function updateCounter() {
    counter.textContent = slides.length ? `${index + 1} / ${slides.length}` : "";
  }

  function goTo(i, animate = true) {
    if (!slides.length) return;

    resetImageState();
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
      const slide = document.createElement("div");
      const slideImg = document.createElement("img");
      slide.className = "lb-slide";
      slideImg.src = sourceImg.currentSrc || sourceImg.src;
      slideImg.alt = sourceImg.alt || "Gallery image";
      slideImg.draggable = false;
      slide.appendChild(slideImg);
      track.appendChild(slide);
      return slide;
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
    resetImageState();

    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    goTo(clickedIndex, false);
  }

  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    resetImageState();
    resetTouchState();
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

  track.addEventListener("click", (e) => {
    const activeImg = getActiveImage();
    if (!activeImg || e.target !== activeImg) return;

    e.preventDefault();
    e.stopPropagation();

    if (Date.now() < suppressImageClickUntil) return;
    if (isZoomed()) return;

    const rect = activeImg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) prev();
    else next();
  });

  // close when clicking anywhere outside the current image
  lb.addEventListener("click", (e) => {
    const activeImg = getActiveImage();
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

    if (e.touches.length > 1) {
      dragging = false;
      ignoreTouchGesture = true;
      gestureMode = "pinch";
      pinchStartDistance = getTouchDistance(e.touches);
      pinchStartScale = imageScale;
      suppressImageClick();
      return;
    }

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    ignoreTouchGesture = false;
    dx = 0;

    if (isZoomed()) {
      gestureMode = "pan";
      dragging = false;
      panStartX = touch.clientX;
      panStartY = touch.clientY;
      panStartPanX = panX;
      panStartPanY = panY;
      const activeImg = getActiveImage();
      if (activeImg) activeImg.classList.add("is-panning");
      return;
    }

    gestureMode = "swipe";
    dragging = true;
    track.style.transition = "none";
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (!lb.classList.contains("open")) return;

    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      dragging = false;
      ignoreTouchGesture = true;
      gestureMode = "pinch";
      suppressImageClick();
      dx = 0;

      if (!pinchStartDistance) {
        pinchStartDistance = getTouchDistance(e.touches);
        pinchStartScale = imageScale;
      }

      const currentDistance = getTouchDistance(e.touches);
      if (pinchStartDistance && currentDistance) {
        imageScale = clamp(
          pinchStartScale * (currentDistance / pinchStartDistance),
          MIN_SCALE,
          MAX_SCALE
        );
        applyImageTransform();
      }
      return;
    }

    if (ignoreTouchGesture || gestureMode === "pinch") return;

    if (gestureMode === "pan" || isZoomed()) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      gestureMode = "pan";
      panX = panStartPanX + (touch.clientX - panStartX);
      panY = panStartPanY + (touch.clientY - panStartY);
      suppressImageClick();
      applyImageTransform();
      return;
    }

    if (!dragging || gestureMode !== "swipe") return;

    dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      suppressImageClick();
    }
    if (Math.abs(dy) > Math.abs(dx) * 1.25) return;
    if (e.cancelable) e.preventDefault();

    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transform = `translateX(${(-index * w) + dx}px)`;
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (gestureMode === "pinch" || ignoreTouchGesture) {
      if (e.touches.length) return;
      if (!isZoomed()) resetImageState();
      else {
        gestureMode = "";
        applyImageTransform();
      }
      resetTouchState();
      suppressImageClick();
      return;
    }

    if (gestureMode === "pan") {
      if (e.touches.length) return;
      const activeImg = getActiveImage();
      if (activeImg) activeImg.classList.remove("is-panning");
      gestureMode = "";
      if (!isZoomed()) resetImageState();
      else applyImageTransform();
      resetTouchState();
      suppressImageClick();
      return;
    }

    if (!dragging) {
      dragging = false;
      gestureMode = "";
      return;
    }

    dragging = false;

    const w = viewport.getBoundingClientRect().width || 1;
    const threshold = w * 0.18;

    if (dx < -threshold) next();
    else if (dx > threshold) prev();
    else goTo(index);

    resetTouchState();
  });

  viewport.addEventListener("touchcancel", () => {
    if (gestureMode === "pinch" || gestureMode === "pan" || isZoomed()) {
      gestureMode = "";
      if (!isZoomed()) resetImageState();
      else applyImageTransform();
      resetTouchState();
      suppressImageClick();
      return;
    }

    resetTouchState();
    goTo(index);
  });

  window.addEventListener("resize", () => {
    if (lb.classList.contains("open")) {
      resetImageState();
      goTo(index, false);
    }
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
// Home gallery preview
// =========================
(() => {
  if (!document.body.classList.contains("home")) return;

  const preview = document.getElementById("homeGalleryPreview");
  const status = document.getElementById("homeGalleryStatus");
  if (!preview) return;

  const sections = [
    ["fielding-gloves", "Fielding glove"],
    ["catchers-mitts", "Catcher's mitt"],
    ["first-base-mitts", "First base mitt"],
    ["custom-color-relaces", "Custom color relace"],
    ["vintage", "Vintage glove"]
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function pickPreviewPhotos(gallery) {
    return sections.flatMap(([key, label]) => {
      const photos = Array.isArray(gallery[key]) ? gallery[key] : [];
      return shuffle(photos)
        .slice(0, 2)
        .map(photo => ({ ...photo, label }));
    });
  }

  function renderPreview(photos) {
    preview.innerHTML = photos.map((photo, index) => {
      const alt = `${photo.label} glove work photo ${index + 1}`;
      return `
        <button
          class="gallery-thumb"
          type="button"
          data-gallery-group="home-featured"
          data-gallery-index="${index}"
          aria-label="Open image: ${escapeHtml(alt)}">
          <img
            src="${escapeHtml(photo.url)}"
            alt="${escapeHtml(alt)}"
            loading="lazy"
            decoding="async">
        </button>
      `;
    }).join("");
  }

  async function loadPreview() {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "listGalleryPhotos"
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gallery failed to load.");

      const photos = shuffle(pickPreviewPhotos(data.gallery || {}));
      if (!photos.length) {
        if (status) status.textContent = "Gallery photos are coming soon.";
        return;
      }

      renderPreview(photos);
      if (status) status.textContent = "";
    } catch {
      if (status) status.textContent = "Gallery preview is unavailable right now.";
    }
  }

  loadPreview();
})();

// =========================
// Mobile menu toggle
// =========================
(() => {
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  const menu = document.querySelector('[data-mobile-menu]');

  if (!openBtn || !closeBtn || !menu) return;

  let lastFocused = null;

  const setMenuState = (isOpen, restoreFocus = false) => {
    menu.classList.toggle("open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    menu.setAttribute("aria-hidden", String(!isOpen));
    openBtn.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      lastFocused = document.activeElement;
      requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
      return;
    }

    if (restoreFocus && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
  };

  const openMenu = () => {
    setMenuState(true);
  };

  const closeMenu = (restoreFocus = false) => {
    if (!menu.classList.contains("open")) return;
    setMenuState(false, restoreFocus);
  };

  openBtn.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", () => closeMenu(true));

  menu.addEventListener("click", (e) => {
    if (e.target === menu) closeMenu(true);
  });

  // Close if you tap a link
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => closeMenu(false));
  });

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu(true);
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
// Public lace inventory
// =========================
function initPublicLaceInventory() {
  const servicesGrid = document.querySelector("[data-customer-lace-grid]");
  const contactReference = document.querySelector("[data-customer-lace-reference]");
  const laceSelects = Array.from(document.querySelectorAll("[data-lace-select]"));

  if (!servicesGrid && !contactReference && !laceSelects.length) return;

  const OUT_OF_STOCK_THRESHOLD = 3;
  const PHOTO_BASE_PATH = "/assets/img/lace/";
  const PHOTO_EXTENSIONS = [".png", ".jpeg", ".jpg"];
  const FALLBACK_LACE_VALUE = "Discuss lace color after review";
  const LEGACY_PHOTO_SLUGS = new Map([
    ["blue - carolina", "carolinablue"],
    ["blue - navy", "navyblue"],
    ["blue - royal", "royalblue"],
    ["brown - chocolate", "darkbrown"],
    ["red - dark", "darkred"],
    ["tan - camel", "camel"],
    ["tan - indian", "indiantan"],
    ["tan - japan", "japantan"]
  ]);
  const LABEL_OVERRIDES = new Map([
    ["blue - carolina", "Carolina Blue"],
    ["blue - navy", "Navy Blue"],
    ["blue - royal", "Royal Blue"],
    ["brown - chocolate", "Chocolate"],
    ["red - dark", "Dark Red"],
    ["tan - camel", "Camel"],
    ["tan - indian", "Indian Tan"],
    ["tan - japan", "Japan Tan"]
  ]);
  const SORT_ORDER = new Map([
    ["black", 10],
    ["gray", 20],
    ["tan - camel", 30],
    ["tan - indian", 40],
    ["tan - japan", 50],
    ["brown - chocolate", 60],
    ["blue - carolina", 80],
    ["blue - royal", 90],
    ["blue - navy", 100],
    ["red", 110],
    ["red - dark", 120],
    ["orange", 130],
    ["yellow", 140]
  ]);

  function normalizeColor(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\u2013|\u2014/g, "-")
      .replace(/\s*-\s*/g, " - ")
      .replace(/\s+/g, " ");
  }

  function slugifyColor(value) {
    return normalizeColor(value)
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function titleCase(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ");
  }

  function labelForColor(color) {
    const normalized = normalizeColor(color);
    if (LABEL_OVERRIDES.has(normalized)) return LABEL_OVERRIDES.get(normalized);

    const parts = normalized.split(" - ");
    if (parts.length === 2) return `${titleCase(parts[1])} ${titleCase(parts[0])}`;

    return titleCase(normalized);
  }

  function shouldHideColor(color) {
    const normalized = normalizeColor(color);
    return normalized.includes("pink") || normalized.includes("vintage");
  }

  function photoSlugForColor(color) {
    const normalized = normalizeColor(color);
    return LEGACY_PHOTO_SLUGS.get(normalized) || slugifyColor(color);
  }

  function loadImage(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(src);
      image.onerror = () => resolve("");
      image.src = src;
    });
  }

  async function resolvePhotoSource(color) {
    const slug = photoSlugForColor(color);
    if (!slug) return "";

    for (const extension of PHOTO_EXTENSIONS) {
      const src = `${PHOTO_BASE_PATH}${slug}${extension}`;
      const loaded = await loadImage(src);
      if (loaded) return loaded;
    }

    return "";
  }

  function stockState(item) {
    return item.quantity < OUT_OF_STOCK_THRESHOLD
      ? { state: "out", label: "Out of stock" }
      : { state: "in", label: "In stock" };
  }

  function createStatusMessage(text) {
    const message = document.createElement("div");
    message.className = "mm-status-message lace-loading";
    message.textContent = text;
    return message;
  }

  function createLaceSwatch(item) {
    const status = stockState(item);
    const figure = document.createElement("figure");
    figure.className = "mm-lace-swatch lace-item";
    figure.dataset.laceColor = item.value;
    figure.dataset.stockState = status.state;

    const image = document.createElement("img");
    image.src = item.photo;
    image.alt = `${item.label} lace`;
    image.loading = "lazy";

    const caption = document.createElement("figcaption");
    caption.className = "lace-label";
    caption.textContent = item.label;

    const badge = document.createElement("span");
    badge.className = `mm-availability-badge mm-availability-badge--${status.state}`;
    badge.dataset.laceStatus = "";
    badge.textContent = status.label;

    figure.append(image, caption, badge);
    return figure;
  }

  function renderGrid(container, items) {
    if (!container) return;

    container.innerHTML = "";

    if (!items.length) {
      container.appendChild(createStatusMessage("Lace colors are unavailable right now. Submit the request and we can confirm color after review."));
      return;
    }

    items.forEach(item => {
      container.appendChild(createLaceSwatch(item));
    });
  }

  function renderSelect(select, items) {
    const previousValue = select.value;
    const isSecondary = select.dataset.laceSelect === "secondary";
    const placeholderText = isSecondary
      ? "Only if multi-colors wanted"
      : "Choose";

    select.innerHTML = "";

    if (!items.length) {
      if (isSecondary) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "No accent color selected";
        select.appendChild(placeholder);
      }

      const fallback = document.createElement("option");
      fallback.value = FALLBACK_LACE_VALUE;
      fallback.textContent = FALLBACK_LACE_VALUE;
      select.appendChild(fallback);

      select.value = previousValue === FALLBACK_LACE_VALUE || !isSecondary
        ? FALLBACK_LACE_VALUE
        : "";
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = placeholderText;
    select.appendChild(placeholder);

    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });

    if (previousValue && items.some(item => item.value === previousValue)) {
      select.value = previousValue;
    }
  }

  async function getCustomerLaceColors() {
    const res = await fetch("/api/lace-inventory", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok || !data.ok || !Array.isArray(data.inventory)) {
      throw new Error("Lace inventory unavailable.");
    }

    const seen = new Set();
    const colors = await Promise.all(data.inventory.map(async item => {
      const value = String(item.color || "").trim();
      const normalized = normalizeColor(value);

      if (!value || seen.has(normalized) || item.active === false || shouldHideColor(value)) {
        return null;
      }

      seen.add(normalized);

      const photo = await resolvePhotoSource(value);
      if (!photo) return null;

      return {
        value,
        normalized,
        label: labelForColor(value),
        photo,
        quantity: Number(item.quantity_on_hand ?? 0)
      };
    }));

    return colors
      .filter(Boolean)
      .sort((a, b) => {
        const aOrder = SORT_ORDER.get(a.normalized) ?? 1000;
        const bOrder = SORT_ORDER.get(b.normalized) ?? 1000;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.label.localeCompare(b.label);
      });
  }

  getCustomerLaceColors()
    .then(items => {
      renderGrid(servicesGrid, items);
      renderGrid(contactReference, items);
      laceSelects.forEach(select => renderSelect(select, items));
    })
    .catch(() => {
      renderGrid(servicesGrid, []);
      renderGrid(contactReference, []);
      laceSelects.forEach(select => renderSelect(select, []));
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPublicLaceInventory);
} else {
  initPublicLaceInventory();
}

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

(() => {
  const initHeaderState = () => {
    const header = document.querySelector("[data-site-header]");
    const hero = document.querySelector(".hero");
    const isHome = document.body.classList.contains("home");

    if (!header) return;

    const updateHeaderState = () => {
      document.body.classList.toggle("header-scrolled", window.scrollY > 8);

      if (!isHome || !hero) {
        document.body.classList.remove("header-over-hero");
        return;
      }

      const headerBottom = header.getBoundingClientRect().bottom - 40;
      const heroBottom = hero.getBoundingClientRect().bottom;

      document.body.classList.toggle(
        "header-over-hero",
        heroBottom > headerBottom
      );
    };

    updateHeaderState();

    window.addEventListener("scroll", updateHeaderState, { passive: true });
    window.addEventListener("resize", updateHeaderState);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeaderState);
  } else {
    initHeaderState();
  }
})();
