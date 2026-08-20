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
// Past-customer newsletter invitation confirmation
// The link only identifies the invitation. Enrollment requires this explicit click.
// =========================
(() => {
  const card = document.querySelector("[data-newsletter-invite]");
  if (!card) return;

  const loading = card.querySelector("[data-invite-loading]");
  const ready = card.querySelector("[data-invite-ready]");
  const success = card.querySelector("[data-invite-success]");
  const error = card.querySelector("[data-invite-error]");
  const errorMessage = card.querySelector("[data-invite-error-message]");
  const summary = card.querySelector("[data-invite-summary]");
  const button = card.querySelector("[data-invite-confirm]");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const show = section => {
    [loading, ready, success, error].forEach(item => { if (item) item.hidden = item !== section; });
  };

  const fail = message => {
    errorMessage.textContent = message || "This invitation link is invalid or has expired.";
    show(error);
  };

  fetch(`/api/newsletter-invite?token=${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  })
    .then(response => response.json())
    .then(data => {
      if (!data.ok) throw new Error(data.error);
      if (data.state === "confirmed") {
        show(success);
        return;
      }
      const person = data.firstName ? `${data.firstName} (${data.maskedEmail})` : data.maskedEmail;
      summary.textContent = `Join the Murph’s Mitts email list as ${person}.`;
      show(ready);
    })
    .catch(cause => fail(cause.message));

  button?.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Confirming…";
    try {
      const response = await fetch("/api/newsletter-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Signup failed. Please try again.");
      if (data.suppressed) throw new Error("Signup confirmation is disabled on this preview site.");
      window.history.replaceState({}, "", window.location.pathname);
      show(success);
    } catch (cause) {
      fail(cause.message);
    } finally {
      button.disabled = false;
      button.textContent = "Confirm signup";
    }
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
// Pre-select contact tab and optional referral via URL
// Example: ?tab=service&referral=Landon%20Murphy
// =========================
(() => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const referral = (params.get("referral") || "").trim();

  if (tab === "service") {
    const serviceRadio = document.getElementById("tab-service");
    if (serviceRadio) serviceRadio.checked = true;
  }

  if (!referral) return;

  const otherRadio = document.querySelector(
    'input[name="referralSource"][value="Other"]'
  );
  const otherText = document.getElementById("referralOtherText");

  if (otherRadio && otherText) {
    otherRadio.checked = true;
    otherText.value = referral.slice(0, 100);
    otherText.dispatchEvent(new Event("input", { bubbles: true }));
    otherText.dispatchEvent(new Event("change", { bubbles: true }));
  }
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
  /* Group colors by family (the part before "-" in "Tan - Cheyenne"), families
     ordered by this list, plain color before its variants, then A-Z. Mirrors the
     admin sort so a new "Family - Specific" color slots in with no code change. */
  const CATEGORY_ORDER = [
    "black", "gray", "grey", "white",
    "tan", "brown",
    "blue", "green",
    "red", "orange", "yellow", "purple"
  ];

  function categoryRank(normalized) {
    const cat = String(normalized || "").split(" - ")[0].trim();
    const idx = CATEGORY_ORDER.indexOf(cat);
    return { idx: idx === -1 ? CATEGORY_ORDER.length : idx, cat };
  }

  function compareLaceColors(a, b) {
    const ra = categoryRank(a.normalized);
    const rb = categoryRank(b.normalized);
    if (ra.idx !== rb.idx) return ra.idx - rb.idx;
    if (ra.cat !== rb.cat) return ra.cat.localeCompare(rb.cat);
    const aVariant = a.normalized.includes(" - ");
    const bVariant = b.normalized.includes(" - ");
    if (aVariant !== bVariant) return aVariant ? 1 : -1;
    return a.label.localeCompare(b.label);
  }

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

  async function resolvePhotoSource(color, photoUrl) {
    // Prefer the admin-uploaded photo from the inventory; fall back to the
    // legacy bundled files at /assets/img/lace/<slug> for older colors.
    if (photoUrl) {
      const loaded = await loadImage(photoUrl);
      if (loaded) return loaded;
    }

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

      const photo = await resolvePhotoSource(value, item.photo_url);
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
      .sort(compareLaceColors);
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
// Public service pricing (Pricing Management)
// Fallback order:
//   1. Live published pricing from /api/public/service-pricing (render + cache
//      as last-known-good).
//   2. If the API fails or is invalid, the validated last-known-good snapshot
//      from localStorage.
//   3. Only if both are unavailable, the static approved-price markup already
//      in the page.
// Only public, published data from the endpoint is ever cached (never drafts).
// Malformed or outdated-schema storage is ignored, never breaking the page, and
// customers never see a technical error — fallbacks are logged to the console.
// These cache helpers mirror functions/api/_pricing.js (this file is a classic
// script, not a module).
// =========================
var SERVICE_PRICING_CACHE_KEY = "mm.servicePricing.v1";
var SERVICE_PRICING_CACHE_VERSION = 1;

function isValidPublicService(svc) {
  return !!svc &&
    typeof svc.serviceKey === "string" && svc.serviceKey !== "" &&
    typeof svc.name === "string" && svc.name !== "" &&
    typeof svc.price === "string" && svc.price !== "" &&
    Array.isArray(svc.bullets);
}

// Renderable only if a non-empty array of well-formed services — an empty or
// malformed payload must never wipe the page.
function isValidServicesPayload(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every(isValidPublicService);
}

// Reduce a service to exactly the public fields that may be cached — no
// internal notes, raw price columns, draft state, or secrets.
function normalizeServiceForCache(svc) {
  return {
    serviceKey: String(svc && svc.serviceKey || ""),
    name: String(svc && svc.name || ""),
    category: svc && svc.category === "relacing" ? "relacing" : "additional",
    shortDescription: String(svc && svc.shortDescription || ""),
    bullets: svc && Array.isArray(svc.bullets) ? svc.bullets.map(function (b) { return String(b); }) : [],
    pricingType: String(svc && svc.pricingType || "fixed"),
    price: String(svc && svc.price || ""),
    sortOrder: svc && isFinite(Number(svc.sortOrder)) ? Number(svc.sortOrder) : 0
  };
}

function saveServicePricingSnapshot(services) {
  try {
    var payload = {
      version: SERVICE_PRICING_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      services: services.map(normalizeServiceForCache)
    };
    window.localStorage.setItem(SERVICE_PRICING_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Storage may be unavailable (private mode / quota). Non-fatal.
    console.warn("Could not save the pricing snapshot.", err);
  }
}

function readServicePricingSnapshot() {
  try {
    var raw = window.localStorage.getItem(SERVICE_PRICING_CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || obj.version !== SERVICE_PRICING_CACHE_VERSION || !isValidServicesPayload(obj.services)) {
      return null;
    }
    return obj;
  } catch (err) {
    return null;
  }
}

function initPublicServicePricing() {
  var containers = {
    relacing: document.querySelector('[data-service-list="relacing"]'),
    additional: document.querySelector('[data-service-list="additional"]')
  };
  var staticArticles = Array.prototype.slice.call(document.querySelectorAll("[data-service-key]"));
  if (!staticArticles.length && !containers.relacing && !containers.additional) return;

  function escapeServiceHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Bullets are plain text. The only HTML we inject is a controlled anchor for
  // the "lace color or colors" phrase, so the deep link into #lace-colors is
  // preserved without allowing arbitrary markup.
  function bulletToHtml(text) {
    return escapeServiceHtml(text).replace(
      /lace color or colors/i,
      '<a href="#lace-colors" class="content-link">$&</a>'
    );
  }

  function updateServiceArticle(article, service) {
    var heading = article.querySelector("h3");
    var price = article.querySelector(".service-price");
    var list = article.querySelector("ul");
    if (heading) heading.textContent = service.name;
    if (price) price.textContent = service.price;
    if (list && Array.isArray(service.bullets) && service.bullets.length) {
      list.innerHTML = service.bullets.map(function (b) { return "<li>" + bulletToHtml(b) + "</li>"; }).join("");
    }
    article.hidden = false;
  }

  function buildServiceArticle(service) {
    var article = document.createElement("article");
    article.className = "service-item";
    article.setAttribute("data-service-key", service.serviceKey);
    article.innerHTML =
      '<div class="service-item-heading"><h3></h3><p class="service-price"></p></div><ul></ul>';
    return article;
  }

  // Apply a validated services array to the page: update in place, add any
  // newly published service, and hide anything the source no longer includes.
  function renderServices(services) {
    var byKey = {};
    staticArticles.forEach(function (a) { byKey[a.getAttribute("data-service-key")] = a; });
    var present = {};

    services.forEach(function (service) {
      present[service.serviceKey] = true;
      var container = containers[service.category] || containers.additional || containers.relacing;
      var article = byKey[service.serviceKey];
      if (!article) {
        if (!container) return;
        article = buildServiceArticle(service);
      }
      updateServiceArticle(article, service);
      if (container) container.appendChild(article); // reflow to published order
    });

    staticArticles.forEach(function (a) {
      if (!present[a.getAttribute("data-service-key")]) a.hidden = true;
    });
  }

  fetch("/api/public/service-pricing", { cache: "no-store" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || !data.ok || !isValidServicesPayload(data.services)) {
        throw new Error("Malformed or empty pricing response.");
      }
      renderServices(data.services);
      // A successful response always replaces the previous stored snapshot.
      saveServicePricingSnapshot(data.services);
    })
    .catch(function (err) {
      var snapshot = readServicePricingSnapshot();
      if (snapshot) {
        console.warn("Live pricing unavailable; using last-known-good snapshot saved " + snapshot.savedAt + ".", err);
        renderServices(snapshot.services);
        return;
      }
      // Both live and cached pricing unavailable — keep the static approved
      // prices already in the page. Never show customers a technical error.
      console.error("Service pricing unavailable and no valid snapshot; using static fallback prices.", err);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPublicServicePricing);
} else {
  initPublicServicePricing();
}

// =========================
// Curated customer reviews — MurphOS is the only review content source.
// =========================
function initPublicCustomerReviews() {
  var homeGrid = document.querySelector(".home-reviews-grid");
  var servicesGrid = document.querySelector(".reviews#reviews .reviews-grid");
  if (!homeGrid && !servicesGrid) return;

  function validReview(review) {
    return !!review && typeof review.reviewerName === "string" && review.reviewerName.trim() &&
      typeof review.text === "string" && review.text.trim() &&
      Number(review.rating) >= 1 && Number(review.rating) <= 5;
  }

  function renderReviewGrid(grid, reviews) {
    if (!grid || !Array.isArray(reviews) || !reviews.length || !reviews.every(validReview)) return;
    var fragment = document.createDocumentFragment();
    reviews.forEach(function (review) {
      var article = document.createElement("article");
      article.className = "review-card";
      var stars = document.createElement("div");
      stars.className = "review-stars";
      stars.setAttribute("aria-label", review.rating + " out of 5 stars");
      stars.textContent = "★".repeat(Math.round(Number(review.rating)));
      var text = document.createElement("p");
      text.className = "review-text";
      text.textContent = "\u201c" + review.text + "\u201d";
      var meta = document.createElement("div");
      meta.className = "review-meta";
      meta.textContent = "— " + [review.reviewerName, review.reviewerLocation, review.source].filter(Boolean).join(" · ");
      article.appendChild(stars);
      article.appendChild(text);
      article.appendChild(meta);
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
  }

  fetch("/api/public/reviews", { cache: "no-store" })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data || !data.ok) throw new Error("Invalid reviews response.");
      renderReviewGrid(homeGrid, data.homepage);
      renderReviewGrid(servicesGrid, data.services);
    })
    .catch(function (error) {
      console.warn("MurphOS reviews unavailable.", error);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPublicCustomerReviews);
} else {
  initPublicCustomerReviews();
}

// =========================
// Newsletter signup forms
// =========================
(() => {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    const status = form.querySelector("[data-newsletter-status]");
    const button = form.querySelector('button[type="submit"]');
    const startedAt = Date.now();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      button.disabled = true;
      status.className = "newsletter-status is-pending";
      status.textContent = "Joining the list...";

      try {
        const response = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.elements.email.value.trim(),
            firstName: form.elements.firstName?.value.trim() || "",
            website: form.elements.website.value,
            source: form.dataset.newsletterSource,
            startedAt,
            requestKey: crypto.randomUUID()
          })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Signup failed.");

        form.reset();
        status.className = "newsletter-status is-success";
        status.textContent = "You’re on the list. Thanks for signing up!";
      } catch (error) {
        status.className = "newsletter-status is-error";
        status.textContent = error.message || "Signup failed. Please try again.";
      } finally {
        button.disabled = false;
      }
    });
  });
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

// =========================
// Preview environment badge (public site)
// Injected only when /api/env reports a non-production deployment. The signal
// is server-side, so this never appears on the production website.
// =========================
(function () {
  fetch("/api/env", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || d.preview !== true) return;
      if (document.querySelector(".mm-preview-badge")) return;
      var badge = document.createElement("div");
      badge.className = "mm-preview-badge";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-label", "Preview environment");
      badge.textContent = "PREVIEW";
      (document.body || document.documentElement).appendChild(badge);
    })
    .catch(function () { /* no badge if the signal is unavailable */ });
})();
