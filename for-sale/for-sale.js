(() => {
  const API_URL = "/api/gloves-for-sale";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    try {
      const url = new URL(text, window.location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.href;
      }
    } catch {
      return "";
    }

    return "";
  }

  function formatPrice(value) {
    const price = Number(value);
    return Number.isFinite(price) && price > 0
      ? `$${price.toFixed(2)}`
      : "Price available on request";
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function displayStatus(value) {
    const status = normalizeStatus(value);
    if (!status) return "Available";
    return status
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function glovePhotos(glove) {
    const photos = Array.isArray(glove?.photos) ? glove.photos : [];
    const urls = photos
      .map(photo => safeUrl(photo?.url))
      .filter(Boolean);
    const primary = safeUrl(glove?.primaryPhoto);

    if (!urls.length && primary) {
      urls.push(primary);
    }

    return urls;
  }

  async function fetchGloves() {
    const resp = await fetch(API_URL);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "Gloves failed to load.");
    }

    return Array.isArray(data.gloves) ? data.gloves : [];
  }

  function initSaleCardImages(root) {
    root.querySelectorAll("[data-sale-hover]").forEach(img => {
      const primary = img.dataset.salePrimary || "";
      const hover = img.dataset.saleHover || primary;

      img.addEventListener("mouseenter", () => {
        if (hover) img.src = hover;
      });

      img.addEventListener("mouseleave", () => {
        if (primary) img.src = primary;
      });
    });
  }

  function renderEmptyState(grid) {
    grid.innerHTML = `
      <div class="sale-empty mm-status-message">
        <strong>No gloves are available right now.</strong>
        <span>Check back later, or send a service request if you have a glove that needs work.</span>
      </div>
    `;
  }

  function renderSaleCard(glove) {
    const title = String(glove.title || "Glove for sale").trim();
    const slug = String(glove.slug || "").trim();
    const href = slug ? `/for-sale/glove?slug=${encodeURIComponent(slug)}` : "/for-sale/";
    const primaryPhoto = safeUrl(glove.primaryPhoto);
    const hoverPhoto = safeUrl(glove.hoverPhoto) || primaryPhoto;
    const isSold = normalizeStatus(glove.status) === "sold";
    const meta = [glove.brand, glove.model].filter(Boolean).join(" ");

    return `
      <article class="sale-card ${isSold ? "sold is-sold" : ""}">
        <a class="sale-card-link" href="${escapeHtml(href)}" aria-label="View details for ${escapeHtml(title)}">
          <div class="sale-card-media">
            ${isSold ? '<span class="sale-badge">Sold</span>' : ""}
            ${primaryPhoto
              ? `<img
                  class="sale-card-img"
                  src="${escapeHtml(primaryPhoto)}"
                  data-sale-primary="${escapeHtml(primaryPhoto)}"
                  data-sale-hover="${escapeHtml(hoverPhoto)}"
                  alt="${escapeHtml(title)}"
                  loading="lazy"
                  decoding="async">`
              : '<div class="sale-photo-placeholder">Photo coming soon</div>'}
          </div>

          <div class="sale-card-body">
            <h2>${escapeHtml(title)}</h2>
            <p class="sale-price">${escapeHtml(formatPrice(glove.price))}</p>
            ${meta ? `<p class="sale-meta">${escapeHtml(meta)}</p>` : ""}
            ${glove.condition ? `<p class="sale-condition">${escapeHtml(glove.condition)}</p>` : ""}
          </div>
        </a>
      </article>
    `;
  }

  async function loadGloves() {
    const grid = document.getElementById("saleGloveGrid");
    if (!grid) return;

    try {
      const gloves = await fetchGloves();

      if (!gloves.length) {
        renderEmptyState(grid);
        return;
      }

      grid.innerHTML = gloves.map(renderSaleCard).join("");
      initSaleCardImages(grid);
    } catch (err) {
      grid.innerHTML = `
        <div class="sale-empty mm-status-message">
          ${escapeHtml(err.message || "Gloves failed to load.")}
        </div>
      `;
    }
  }

  function formatDescription(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    return text
      .split(/\n{2,}/)
      .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function renderSpecs(glove) {
    const specs = [
      ["Brand", glove.brand],
      ["Model", glove.model],
      ["Size", glove.gloveSize ? `${glove.gloveSize}"` : ""],
      ["Position", glove.position],
      ["Web", glove.web],
      ["Throw Hand", glove.throwHand],
      ["Condition", glove.condition]
    ].filter(([, value]) => String(value || "").trim());

    if (!specs.length) return "";

    return `
      <dl class="glove-specs">
        ${specs.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join("")}
      </dl>
    `;
  }

  function renderDetailActions(glove, title) {
    const purchaseUrl = safeUrl(glove.purchaseUrl);
    const contactUrl = `/contact/?glove=${encodeURIComponent(title)}`;
    const primaryAction = purchaseUrl
      ? `<a class="btn btn-primary" href="${escapeHtml(purchaseUrl)}" target="_blank" rel="noopener noreferrer">Buy This Glove</a>`
      : `<a class="btn btn-primary" href="${escapeHtml(contactUrl)}">Ask About This Glove</a>`;

    return `
      <div class="sale-detail-actions">
        ${primaryAction}
        <a class="btn btn-secondary" href="/for-sale/">Back to Gloves</a>
      </div>
    `;
  }

  function renderGloveDetail(container, glove) {
    const title = String(glove.title || "Glove listing").trim();
    const photos = glovePhotos(glove);
    const isSold = normalizeStatus(glove.status) === "sold";
    const description = formatDescription(glove.description || glove.shortDescription);

    container.innerHTML = `
      <article class="sale-detail">
        <div class="sale-detail-gallery">
          <div class="sale-slider" id="saleSlider" aria-label="Glove photos">
            <div class="sale-slider-track" id="saleSliderTrack">
              ${photos.length
                ? photos.map((url, index) => `
                    <div class="sale-slide">
                      <img
                        src="${escapeHtml(url)}"
                        alt="${escapeHtml(`${title} photo ${index + 1}`)}"
                        loading="${index === 0 ? "eager" : "lazy"}"
                        decoding="async">
                    </div>
                  `).join("")
                : '<div class="sale-slide"><div class="sale-photo-placeholder">Photo coming soon</div></div>'}
            </div>
          </div>

          ${photos.length > 1
            ? `<div class="sale-slider-dots" id="saleSliderDots">
                ${photos.map((photo, index) => `
                  <button
                    type="button"
                    class="sale-slider-dot ${index === 0 ? "active" : ""}"
                    data-slide="${index}"
                    aria-label="Show photo ${index + 1}">
                  </button>
                `).join("")}
              </div>`
            : ""}
        </div>

        <section class="sale-detail-info">
          <p class="mm-eyebrow">Glove Listing</p>
          <h1 class="mm-section-title">${escapeHtml(title)}</h1>

          <div class="sale-detail-summary">
            <p class="sale-detail-price">${escapeHtml(formatPrice(glove.price))}</p>
            <p class="sale-detail-status ${isSold ? "is-sold" : ""}">${escapeHtml(displayStatus(glove.status))}</p>
          </div>

          ${renderSpecs(glove)}

          ${description ? `<div class="sale-detail-description">${description}</div>` : ""}

          ${renderDetailActions(glove, title)}
        </section>
      </article>
    `;

    initSaleSlider(container);
  }

  async function loadGloveDetail() {
    const container = document.getElementById("gloveDetail");
    if (!container) return;

    const slug = new URLSearchParams(location.search).get("slug");
    if (!slug) {
      container.innerHTML = '<div class="mm-status-message">Glove not found.</div>';
      return;
    }

    try {
      const gloves = await fetchGloves();
      const glove = gloves.find(item => String(item.slug || "") === slug);

      if (!glove) {
        container.innerHTML = '<div class="mm-status-message">Glove not found.</div>';
        return;
      }

      renderGloveDetail(container, glove);
    } catch (err) {
      container.innerHTML = `
        <div class="mm-status-message">
          ${escapeHtml(err.message || "Glove details failed to load.")}
        </div>
      `;
    }
  }

  function initSaleSlider(root) {
    const slider = root.querySelector("#saleSlider");
    const track = root.querySelector("#saleSliderTrack");
    const dots = Array.from(root.querySelectorAll(".sale-slider-dot"));
    const slideCount = track ? track.children.length : 0;

    if (!slider || !track || slideCount <= 1) return;

    let current = 0;
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    let multiTouch = false;
    let lastTouchEndAt = 0;

    function goToSlide(index) {
      current = Math.max(0, Math.min(slideCount - 1, index));
      track.style.transform = `translateX(-${current * 100}%)`;

      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === current);
      });
    }

    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        goToSlide(Number(dot.dataset.slide || 0));
      });
    });

    slider.addEventListener("click", event => {
      if (Date.now() - lastTouchEndAt < 350) return;

      const rect = slider.getBoundingClientRect();
      const x = event.clientX - rect.left;
      goToSlide(x < rect.width / 2 ? current - 1 : current + 1);
    });

    slider.addEventListener("touchstart", event => {
      multiTouch = event.touches.length > 1;
      if (multiTouch) {
        dragging = false;
        return;
      }

      startX = event.touches[0].clientX;
      currentX = startX;
      dragging = true;
    }, { passive: true });

    slider.addEventListener("touchmove", event => {
      if (event.touches.length > 1) {
        multiTouch = true;
        dragging = false;
        return;
      }

      if (!dragging) return;
      currentX = event.touches[0].clientX;
    }, { passive: true });

    slider.addEventListener("touchend", () => {
      lastTouchEndAt = Date.now();

      if (!dragging || multiTouch) {
        dragging = false;
        multiTouch = false;
        return;
      }

      dragging = false;
      const diff = currentX - startX;

      if (Math.abs(diff) < 45) return;
      goToSlide(diff < 0 ? current + 1 : current - 1);
    });

    goToSlide(0);
  }

  loadGloves();
  loadGloveDetail();
})();
