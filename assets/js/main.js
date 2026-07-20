// =========================
// Gallery lightbox (photo viewer)
// Native-feel viewer, no chrome: focal pinch / trackpad / double-tap zoom,
// drag or two-finger scroll to pan while zoomed, swipe / edge-tap / arrow
// keys to move between photos, click or tap outside the photo to close.
// =========================
function initGalleryLightbox() {
  const lb = document.querySelector(".lightbox");
  if (!lb || lb.dataset.bound === "true") return;

  const track = lb.querySelector(".lb-track");
  const viewport = lb.querySelector(".lb-viewport");
  const counter = lb.querySelector(".lb-counter");
  if (!track || !viewport) return;

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const DOUBLE_TAP_SCALE = 2.5;
  const ZOOM_EPSILON = 0.02;
  const TAP_DELAY_MS = 260;
  const TAP_MOVE_TOLERANCE = 14;
  const SWIPE_AXIS_RATIO = 1.15;
  const WHEEL_NAV_THRESHOLD = 90;

  const state = {
    index: 0,
    slides: [],
    scale: MIN_SCALE,
    tx: 0,
    ty: 0,
    mode: "idle", // idle | tap | swipe | pan | pinch | drag
    moved: false,
    startX: 0,
    startY: 0,
    swipeDx: 0,
    startTx: 0,
    startTy: 0,
    pinchDist: 0,
    pinchScale: MIN_SCALE,
    focalX: 0,
    focalY: 0,
    gestureScale: MIN_SCALE, // Safari desktop trackpad pinch
    wheelNavAmount: 0,
    wheelNavLockUntil: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    tapTimer: 0,
    suppressClickUntil: 0
  };

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const isOpen = () => lb.classList.contains("open");
  const isZoomed = () => state.scale > MIN_SCALE + ZOOM_EPSILON;
  const activeImg = () => state.slides[state.index]?.querySelector("img") || null;

  function suppressClick(ms = 400) {
    state.suppressClickUntil = Date.now() + ms;
  }

  function viewportCenter() {
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
  }

  function panBounds() {
    const img = activeImg();
    if (!img) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: Math.max(0, ((img.offsetWidth * state.scale) - rect.width) / 2),
      y: Math.max(0, ((img.offsetHeight * state.scale) - rect.height) / 2)
    };
  }

  function clampPan() {
    const b = panBounds();
    state.tx = clamp(state.tx, -b.x, b.x);
    state.ty = clamp(state.ty, -b.y, b.y);
  }

  let animateClearTimer = 0;
  function animateNextTransform(img) {
    img.style.transition = "transform .3s cubic-bezier(.2,.7,.3,1)";
    window.clearTimeout(animateClearTimer);
    animateClearTimer = window.setTimeout(() => { img.style.transition = ""; }, 320);
  }

  function applyTransform(animate = false) {
    const img = activeImg();
    if (!img) return;

    if (!isZoomed()) {
      state.scale = MIN_SCALE;
      state.tx = 0;
      state.ty = 0;
      if (animate) animateNextTransform(img); else img.style.transition = "";
      img.style.transform = "";
      img.classList.remove("is-zoomed", "is-panning");
      return;
    }

    clampPan();
    if (animate) animateNextTransform(img); else img.style.transition = "";
    img.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) scale(${state.scale})`;
    img.classList.add("is-zoomed");
    img.classList.toggle("is-panning", state.mode === "pan" || state.mode === "drag");
  }

  /* Zoom keeping the content point under (px, py) pinned — computed from the
     CURRENT scale/offset, so it stays anchored to the cursor or fingers
     instead of jumping toward the image center or edges. */
  function zoomAtPoint(nextScale, px, py, animate = false) {
    if (!activeImg()) return;

    const target = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const c = viewportCenter();
    const ux = (px - c.x - state.tx) / state.scale;
    const uy = (py - c.y - state.ty) / state.scale;

    state.scale = target;
    state.tx = px - c.x - (ux * target);
    state.ty = py - c.y - (uy * target);
    applyTransform(animate);
  }

  function resetZoom(animate = false) {
    state.scale = MIN_SCALE;
    state.tx = 0;
    state.ty = 0;
    applyTransform(animate);
  }

  function resetAllImages() {
    state.scale = MIN_SCALE;
    state.tx = 0;
    state.ty = 0;
    state.slides.forEach((slide) => {
      const img = slide.querySelector("img");
      if (!img) return;
      img.style.transform = "";
      img.style.transition = "";
      img.classList.remove("is-zoomed", "is-panning");
    });
  }

  function clearTapTimer() {
    if (!state.tapTimer) return;
    window.clearTimeout(state.tapTimer);
    state.tapTimer = 0;
  }

  function resetTapState() {
    clearTapTimer();
    state.lastTapTime = 0;
  }

  function updateCounter() {
    if (!counter) return;
    if (!state.slides.length) {
      counter.textContent = "";
      return;
    }
    const slide = state.slides[state.index];
    const albumSize = Number(slide?.dataset.albumSize || 1);
    counter.textContent = albumSize > 1
      ? `${slide.dataset.albumPos} / ${albumSize}`
      : `${state.index + 1} / ${state.slides.length}`;
  }

  function goTo(i, animate = true) {
    if (!state.slides.length) return;
    resetTapState();
    resetAllImages();
    state.mode = "idle";
    state.index = (i + state.slides.length) % state.slides.length;
    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transition = animate ? "transform .3s ease" : "none";
    track.style.transform = `translateX(${-state.index * w}px)`;
    updateCounter();
  }

  const next = () => goTo(state.index + 1);
  const prev = () => goTo(state.index - 1);

  /* A thumb can carry a whole glove album via data-photos (JSON array of
     URLs); swiping flows through the album and on into the next glove. */
  function buildSlides(thumbButtons) {
    track.innerHTML = "";
    state.slides = [];
    state.slideStartByThumb = [];

    thumbButtons.forEach((btn) => {
      const sourceImg = btn.querySelector("img");
      let photos = [];
      try {
        photos = JSON.parse(btn.dataset.photos || "null") || [];
      } catch {
        photos = [];
      }
      if (!photos.length && sourceImg) photos = [sourceImg.currentSrc || sourceImg.src];

      state.slideStartByThumb.push(state.slides.length);
      photos.forEach((src, i) => {
        const slide = document.createElement("div");
        const slideImg = document.createElement("img");
        slide.className = "lb-slide";
        slide.dataset.albumPos = String(i + 1);
        slide.dataset.albumSize = String(photos.length);
        slideImg.src = src;
        slideImg.alt = sourceImg?.alt || "Gallery image";
        slideImg.draggable = false;
        slide.appendChild(slideImg);
        track.appendChild(slide);
        state.slides.push(slide);
      });
    });
  }

  function insideActiveImage(px, py) {
    const img = activeImg();
    if (!img) return false;
    const rect = img.getBoundingClientRect();
    return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
  }

  function navigateFromPoint(px) {
    const img = activeImg();
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (px < rect.left + (rect.width / 2)) prev();
    else next();
  }

  /* Shared tap/click brain: double = zoom toggle at the point,
     single (after the double-tap window) = edge navigation. */
  function handleTap(px, py) {
    const now = Date.now();
    const isDouble =
      now - state.lastTapTime <= TAP_DELAY_MS &&
      Math.abs(px - state.lastTapX) <= TAP_MOVE_TOLERANCE * 2 &&
      Math.abs(py - state.lastTapY) <= TAP_MOVE_TOLERANCE * 2;

    if (isDouble) {
      resetTapState();
      if (isZoomed()) resetZoom(true);
      else zoomAtPoint(DOUBLE_TAP_SCALE, px, py, true);
      return;
    }

    state.lastTapTime = now;
    state.lastTapX = px;
    state.lastTapY = py;
    clearTapTimer();
    state.tapTimer = window.setTimeout(() => {
      state.tapTimer = 0;
      state.lastTapTime = 0;
      if (!isOpen() || isZoomed()) return;
      navigateFromPoint(px);
    }, TAP_DELAY_MS);
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
    resetAllImages();
    resetTapState();
    state.mode = "idle";

    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    goTo(state.slideStartByThumb[clickedIndex] || 0, false);
  }

  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    resetTapState();
    resetAllImages();
    state.mode = "idle";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-thumb");
    if (!btn) return;
    e.preventDefault();
    openFromButton(btn);
  });

  /* ---- Mouse / desktop ---- */

  lb.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (Date.now() < state.suppressClickUntil) return;

    if (insideActiveImage(e.clientX, e.clientY)) {
      e.preventDefault();
      handleTap(e.clientX, e.clientY);
      return;
    }
    closeLightbox();
  });

  lb.addEventListener("dblclick", (e) => {
    e.preventDefault();
  });

  /* Drag to pan while zoomed. */
  viewport.addEventListener("mousedown", (e) => {
    if (!isOpen() || !isZoomed() || e.button !== 0) return;
    e.preventDefault();
    state.mode = "drag";
    state.moved = false;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startTx = state.tx;
    state.startTy = state.ty;
  });

  window.addEventListener("mousemove", (e) => {
    if (state.mode !== "drag") return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      state.moved = true;
      suppressClick();
    }
    state.tx = state.startTx + dx;
    state.ty = state.startTy + dy;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (state.mode !== "drag") return;
    state.mode = "idle";
    applyTransform();
  });

  /* Trackpad + mouse wheel: pinch (ctrl+wheel) zooms at the cursor,
     two-finger scroll pans while zoomed and flips photos when not. */
  viewport.addEventListener("wheel", (e) => {
    if (!isOpen()) return;
    e.preventDefault();

    if (e.ctrlKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAtPoint(state.scale * factor, e.clientX, e.clientY);
      return;
    }

    if (isZoomed()) {
      state.tx -= e.deltaX;
      state.ty -= e.deltaY;
      applyTransform();
      return;
    }

    const now = Date.now();
    if (now < state.wheelNavLockUntil) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    state.wheelNavAmount += e.deltaX;
    if (Math.abs(state.wheelNavAmount) >= WHEEL_NAV_THRESHOLD) {
      if (state.wheelNavAmount > 0) next(); else prev();
      state.wheelNavAmount = 0;
      state.wheelNavLockUntil = now + 450;
    }
  }, { passive: false });

  /* Safari desktop trackpad pinch (GestureEvent). Touch devices fire these
     too, so bail if a touch gesture already owns the interaction. */
  viewport.addEventListener("gesturestart", (e) => {
    if (!isOpen()) return;
    e.preventDefault();
    if (state.mode !== "idle") return;
    state.gestureScale = state.scale;
  });
  viewport.addEventListener("gesturechange", (e) => {
    if (!isOpen()) return;
    e.preventDefault();
    if (state.mode !== "idle") return;
    zoomAtPoint(state.gestureScale * e.scale, e.clientX, e.clientY);
  });
  viewport.addEventListener("gestureend", (e) => {
    if (!isOpen()) return;
    e.preventDefault();
    if (state.mode !== "idle") return;
    if (!isZoomed()) resetZoom(true);
  });

  window.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  /* ---- Touch ---- */

  const touchDistance = (touches) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const touchMidpoint = (touches) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  });

  function beginPinch(touches) {
    const mid = touchMidpoint(touches);
    const c = viewportCenter();
    state.mode = "pinch";
    state.pinchDist = touchDistance(touches);
    state.pinchScale = state.scale;
    state.focalX = (mid.x - c.x - state.tx) / state.scale;
    state.focalY = (mid.y - c.y - state.ty) / state.scale;
  }

  viewport.addEventListener("touchstart", (e) => {
    if (!isOpen()) return;
    clearTapTimer();
    state.moved = false;
    state.swipeDx = 0;

    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      beginPinch(e.touches);
      suppressClick();
      return;
    }

    const t = e.touches[0];
    state.startX = t.clientX;
    state.startY = t.clientY;

    if (isZoomed()) {
      state.mode = "pan";
      state.startTx = state.tx;
      state.startTy = state.ty;
      return;
    }

    state.mode = "tap";
    track.style.transition = "none";
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!isOpen()) return;

    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      if (state.mode !== "pinch") beginPinch(e.touches);
      state.moved = true;
      suppressClick();

      const dist = touchDistance(e.touches);
      if (!state.pinchDist || !dist) return;
      const mid = touchMidpoint(e.touches);
      const c = viewportCenter();
      state.scale = clamp(state.pinchScale * (dist / state.pinchDist), MIN_SCALE, MAX_SCALE);
      state.tx = mid.x - c.x - (state.focalX * state.scale);
      state.ty = mid.y - c.y - (state.focalY * state.scale);
      applyTransform();
      return;
    }

    if (state.mode === "pinch") {
      if (e.cancelable) e.preventDefault();
      return;
    }

    const t = e.touches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (Math.abs(dx) > TAP_MOVE_TOLERANCE || Math.abs(dy) > TAP_MOVE_TOLERANCE) {
      state.moved = true;
      clearTapTimer();
      suppressClick();
    }

    if (state.mode === "pan") {
      if (!state.moved) return;
      if (e.cancelable) e.preventDefault();
      state.tx = state.startTx + dx;
      state.ty = state.startTy + dy;
      applyTransform();
      return;
    }

    if (!state.moved) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_AXIS_RATIO) return;

    if (e.cancelable) e.preventDefault();
    state.mode = "swipe";
    state.swipeDx = dx;
    const w = viewport.getBoundingClientRect().width || 1;
    track.style.transform = `translateX(${(-state.index * w) + dx}px)`;
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (!isOpen()) return;

    if (state.mode === "pinch") {
      if (e.touches.length) return;
      state.mode = "idle";
      if (!isZoomed()) resetZoom(true);
      else applyTransform();
      suppressClick();
      return;
    }

    if (state.mode === "pan") {
      if (e.touches.length) return;
      state.mode = "idle";
      if (!isZoomed()) resetZoom(true);
      else applyTransform();
      if (state.moved) {
        suppressClick();
        return;
      }
      /* A still tap while zoomed can still be half of a double-tap (zoom out). */
      const t = e.changedTouches[0];
      if (t && insideActiveImage(t.clientX, t.clientY)) {
        if (e.cancelable) e.preventDefault();
        suppressClick();
        handleTap(t.clientX, t.clientY);
      }
      return;
    }

    if (state.mode === "swipe") {
      if (e.cancelable) e.preventDefault();
      state.mode = "idle";
      const w = viewport.getBoundingClientRect().width || 1;
      if (state.swipeDx < -w * 0.18) next();
      else if (state.swipeDx > w * 0.18) prev();
      else goTo(state.index);
      suppressClick();
      return;
    }

    state.mode = "idle";
    const t = e.changedTouches[0];
    if (!t || state.moved) {
      goTo(state.index);
      return;
    }
    if (e.cancelable) e.preventDefault();
    suppressClick();
    if (insideActiveImage(t.clientX, t.clientY)) handleTap(t.clientX, t.clientY);
    else closeLightbox();
  }, { passive: false });

  viewport.addEventListener("touchcancel", () => {
    state.mode = "idle";
    if (!isZoomed()) {
      resetAllImages();
      goTo(state.index, false);
    } else {
      applyTransform();
    }
    suppressClick();
  });

  window.addEventListener("resize", () => {
    if (!isOpen()) return;
    resetAllImages();
    goTo(state.index, false);
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
  const PHOTO_EXTENSIONS = [".webp", ".png", ".jpeg", ".jpg"];
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
