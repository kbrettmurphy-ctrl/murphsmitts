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

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const DOUBLE_TAP_SCALE = 2.4;
  const ZOOM_EPSILON = 0.015;
  const TAP_DELAY_MS = 250;
  const TAP_MOVE_TOLERANCE = 18;
  const SWIPE_AXIS_RATIO = 1.15;

  // Keep all viewer gestures in one state object so zoom, pan, swipe, and tap timing cannot drift apart.
  const state = {
    index: 0,
    slides: [],
    scale: MIN_SCALE,
    panX: 0,
    panY: 0,
    gesture: "idle",
    startedMultiTouch: false,
    touchMoved: false,
    touchStartX: 0,
    touchStartY: 0,
    swipeDx: 0,
    swipeDy: 0,
    panStartX: 0,
    panStartY: 0,
    panStartPanX: 0,
    panStartPanY: 0,
    pinchStartDistance: 0,
    pinchStartScale: MIN_SCALE,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    singleTapTimer: 0,
    suppressClickUntil: 0
  };

  function isOpen() {
    return lb.classList.contains("open");
  }

  function suppressSyntheticClick(duration = 500) {
    state.suppressClickUntil = Date.now() + duration;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getActiveImage() {
    return state.slides[state.index]?.querySelector("img") || null;
  }

  function isZoomed() {
    return state.scale > MIN_SCALE + ZOOM_EPSILON;
  }

  function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const x = touches[0].clientX - touches[1].clientX;
    const y = touches[0].clientY - touches[1].clientY;
    return Math.hypot(x, y);
  }

  function clearPendingTap() {
    if (!state.singleTapTimer) return;
    window.clearTimeout(state.singleTapTimer);
    state.singleTapTimer = 0;
  }

  function resetTapState() {
    clearPendingTap();
    state.lastTapTime = 0;
    state.lastTapX = 0;
    state.lastTapY = 0;
  }

  function getPanBounds() {
    const activeImg = getActiveImage();
    if (!activeImg) return { x: 0, y: 0 };

    const viewportRect = viewport.getBoundingClientRect();
    const imageWidth = activeImg.offsetWidth || activeImg.naturalWidth || 0;
    const imageHeight = activeImg.offsetHeight || activeImg.naturalHeight || 0;

    return {
      x: Math.max(0, ((imageWidth * state.scale) - viewportRect.width) / 2),
      y: Math.max(0, ((imageHeight * state.scale) - viewportRect.height) / 2)
    };
  }

  function clampPan() {
    const bounds = getPanBounds();
    state.panX = clamp(state.panX, -bounds.x, bounds.x);
    state.panY = clamp(state.panY, -bounds.y, bounds.y);
  }

  function applyImageTransform() {
    const activeImg = getActiveImage();
    if (!activeImg) return;

    if (!isZoomed()) {
      state.scale = MIN_SCALE;
      state.panX = 0;
      state.panY = 0;
      activeImg.style.transform = "";
      activeImg.classList.remove("is-zoomed", "is-panning", "is-zooming");
      return;
    }

    clampPan();
    activeImg.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.scale})`;
    activeImg.classList.add("is-zoomed");
    activeImg.classList.toggle("is-panning", state.gesture === "pan");
    activeImg.classList.toggle("is-zooming", state.gesture === "pinch");
  }

  function resetImageState() {
    state.scale = MIN_SCALE;
    state.panX = 0;
    state.panY = 0;
    state.gesture = "idle";
    state.pinchStartDistance = 0;
    state.pinchStartScale = MIN_SCALE;
    state.slides.forEach((slide) => {
      const img = slide.querySelector("img");
      if (!img) return;
      img.style.transform = "";
      img.classList.remove("is-zoomed", "is-panning", "is-zooming");
    });
  }

  function resetTouchState() {
    state.gesture = "idle";
    state.startedMultiTouch = false;
    state.touchMoved = false;
    state.swipeDx = 0;
    state.swipeDy = 0;
    state.pinchStartDistance = 0;
  }

  function updateCounter() {
    counter.textContent = state.slides.length ? `${state.index + 1} / ${state.slides.length}` : "";
  }

  function goTo(i, animate = true) {
    if (!state.slides.length) return;

    resetTapState();
    resetTouchState();
    resetImageState();
    state.index = (i + state.slides.length) % state.slides.length;
    const w = viewport.getBoundingClientRect().width || 1;

    track.style.transition = animate ? "transform .28s ease" : "none";
    track.style.transform = `translateX(${-state.index * w}px)`;

    updateCounter();
  }

  function buildSlides(thumbButtons) {
    track.innerHTML = "";

    state.slides = thumbButtons.map((btn) => {
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

  function getImageHit(clientX, clientY) {
    const activeImg = getActiveImage();
    if (!activeImg) return null;

    const rect = activeImg.getBoundingClientRect();
    return {
      activeImg,
      rect,
      inside:
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    };
  }

  function zoomToPoint(targetScale, clientX, clientY) {
    const hit = getImageHit(clientX, clientY);
    if (!hit) return;

    const nextScale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
    if (nextScale <= MIN_SCALE + ZOOM_EPSILON) {
      resetImageState();
      return;
    }

    const centerX = hit.rect.left + (hit.rect.width / 2);
    const centerY = hit.rect.top + (hit.rect.height / 2);

    state.scale = nextScale;
    state.panX = (centerX - clientX) * (nextScale - MIN_SCALE);
    state.panY = (centerY - clientY) * (nextScale - MIN_SCALE);
    applyImageTransform();
  }

  function toggleZoomAtPoint(clientX, clientY) {
    clearPendingTap();
    if (isZoomed()) {
      resetImageState();
      return;
    }

    zoomToPoint(DOUBLE_TAP_SCALE, clientX, clientY);
  }

  function navigateFromImagePoint(clientX) {
    if (isZoomed()) return;

    const activeImg = getActiveImage();
    if (!activeImg) return;

    const rect = activeImg.getBoundingClientRect();
    if (clientX < rect.left + (rect.width / 2)) prev();
    else next();
  }

  function handleImageTap(clientX, clientY) {
    const hit = getImageHit(clientX, clientY);
    if (!hit || !hit.inside) return false;

    const now = Date.now();
    const closeEnough =
      Math.abs(clientX - state.lastTapX) <= TAP_MOVE_TOLERANCE &&
      Math.abs(clientY - state.lastTapY) <= TAP_MOVE_TOLERANCE;

    if (now - state.lastTapTime <= TAP_DELAY_MS && closeEnough) {
      resetTapState();
      toggleZoomAtPoint(clientX, clientY);
      return true;
    }

    clearPendingTap();
    state.lastTapTime = now;
    state.lastTapX = clientX;
    state.lastTapY = clientY;
    state.singleTapTimer = window.setTimeout(() => {
      state.singleTapTimer = 0;
      state.lastTapTime = 0;
      if (!isOpen() || isZoomed()) return;
      navigateFromImagePoint(clientX);
    }, TAP_DELAY_MS);

    return true;
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
    resetTouchState();
    resetTapState();

    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    goTo(clickedIndex, false);
  }

  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    resetTapState();
    resetImageState();
    resetTouchState();
  }

  function next() {
    goTo(state.index + 1);
  }

  function prev() {
    goTo(state.index - 1);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-thumb");
    if (!btn) return;
    e.preventDefault();
    openFromButton(btn);
  });

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetTapState();
    prev();
  });

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetTapState();
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

    if (Date.now() < state.suppressClickUntil) return;
    handleImageTap(e.clientX, e.clientY);
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
    if (!isOpen()) return;

    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  viewport.addEventListener("touchstart", (e) => {
    if (!isOpen()) return;

    clearPendingTap();
    state.touchMoved = false;
    state.swipeDx = 0;
    state.swipeDy = 0;

    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      state.startedMultiTouch = true;
      state.gesture = "pinch";
      state.pinchStartDistance = getTouchDistance(e.touches);
      state.pinchStartScale = state.scale;
      suppressSyntheticClick();
      return;
    }

    const touch = e.touches[0];
    state.startedMultiTouch = false;
    state.touchStartX = touch.clientX;
    state.touchStartY = touch.clientY;

    if (isZoomed()) {
      state.gesture = "zoomed-tap";
      state.panStartX = touch.clientX;
      state.panStartY = touch.clientY;
      state.panStartPanX = state.panX;
      state.panStartPanY = state.panY;
      return;
    }

    state.gesture = "tap";
    track.style.transition = "none";
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!isOpen()) return;

    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      clearPendingTap();
      state.startedMultiTouch = true;
      state.touchMoved = true;
      state.gesture = "pinch";
      state.swipeDx = 0;
      suppressSyntheticClick();

      if (!state.pinchStartDistance) {
        state.pinchStartDistance = getTouchDistance(e.touches);
        state.pinchStartScale = state.scale;
      }

      const currentDistance = getTouchDistance(e.touches);
      if (state.pinchStartDistance && currentDistance) {
        state.scale = clamp(
          state.pinchStartScale * (currentDistance / state.pinchStartDistance),
          MIN_SCALE,
          MAX_SCALE
        );
        applyImageTransform();
      }
      return;
    }

    if (state.startedMultiTouch || state.gesture === "pinch") {
      if (e.cancelable) e.preventDefault();
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - state.touchStartX;
    const dy = touch.clientY - state.touchStartY;
    state.swipeDx = dx;
    state.swipeDy = dy;

    if (Math.abs(dx) > TAP_MOVE_TOLERANCE || Math.abs(dy) > TAP_MOVE_TOLERANCE) {
      state.touchMoved = true;
      clearPendingTap();
      suppressSyntheticClick();
    }

    if (state.gesture === "pan" || state.gesture === "zoomed-tap" || isZoomed()) {
      if (!state.touchMoved && state.gesture === "zoomed-tap") return;
      if (e.cancelable) e.preventDefault();
      state.gesture = "pan";
      const activeImg = getActiveImage();
      if (activeImg) activeImg.classList.add("is-panning");
      state.panX = state.panStartPanX + (touch.clientX - state.panStartX);
      state.panY = state.panStartPanY + (touch.clientY - state.panStartY);
      suppressSyntheticClick();
      applyImageTransform();
      return;
    }

    if (!state.touchMoved) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_AXIS_RATIO) return;

    if (e.cancelable) e.preventDefault();
    state.gesture = "swipe";

    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transform = `translateX(${(-state.index * w) + dx}px)`;
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (!isOpen()) return;

    if (state.gesture === "pinch" || state.startedMultiTouch) {
      if (e.touches.length) return;
      if (!isZoomed()) resetImageState();
      else {
        state.gesture = "idle";
        applyImageTransform();
      }
      resetTouchState();
      suppressSyntheticClick();
      return;
    }

    if (state.gesture === "pan") {
      if (e.touches.length) return;
      const activeImg = getActiveImage();
      if (activeImg) activeImg.classList.remove("is-panning");
      state.gesture = "idle";
      if (!isZoomed()) resetImageState();
      else applyImageTransform();
      resetTouchState();
      suppressSyntheticClick();
      return;
    }

    if (state.gesture === "swipe") {
      if (e.cancelable) e.preventDefault();
      const w = viewport.getBoundingClientRect().width || 1;
      const threshold = w * 0.18;

      if (state.swipeDx < -threshold) next();
      else if (state.swipeDx > threshold) prev();
      else goTo(state.index);

      resetTouchState();
      suppressSyntheticClick();
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      resetTouchState();
      return;
    }

    const hit = getImageHit(touch.clientX, touch.clientY);
    if (!state.touchMoved && hit?.inside) {
      if (e.cancelable) e.preventDefault();
      suppressSyntheticClick();
      handleImageTap(touch.clientX, touch.clientY);
    } else if (!state.touchMoved) {
      closeLightbox();
    }

    resetTouchState();
  }, { passive: false });

  viewport.addEventListener("touchcancel", () => {
    if (state.gesture === "pinch" || state.gesture === "pan" || isZoomed()) {
      state.gesture = "idle";
      if (!isZoomed()) resetImageState();
      else applyImageTransform();
      resetTouchState();
      suppressSyntheticClick();
      return;
    }

    resetTouchState();
    goTo(state.index);
  });

  window.addEventListener("resize", () => {
    if (isOpen()) {
      resetImageState();
      goTo(state.index, false);
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
