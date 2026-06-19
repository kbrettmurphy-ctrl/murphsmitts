const slug =
  new URLSearchParams(location.search)
    .get("slug");

async function loadGlove() {

  const wrap =
    document.getElementById("gloveDetail");

  try {

    const resp = await fetch(
      "/api/gloves-for-sale"
    );

    const data = await resp.json();

    const glove =
      data.gloves.find(
        g => g.slug === slug
      );

    if (!glove) {
      wrap.innerHTML =
        "<p>Glove not found.</p>";
      return;
    }

    wrap.innerHTML = `
      <div class="sale-detail">

        <img
          class="sale-detail-img"
          src="${glove.primaryPhoto || ""}"
          alt="${glove.title}"
        >

        <div class="sale-detail-info">

          <h1>${glove.title}</h1>

          <div class="sale-detail-price">
            $${Number(glove.price || 0)
              .toFixed(2)}
          </div>

          <p>
            <strong>Brand:</strong>
            ${glove.brand || ""}
          </p>

          <p>
            <strong>Model:</strong>
            ${glove.model || ""}
          </p>

          <p>
            <strong>Size:</strong>
            ${glove.gloveSize || ""}
          </p>

          <p>
            <strong>Position:</strong>
            ${glove.position || ""}
          </p>

          <p>
            <strong>Web:</strong>
            ${glove.web || ""}
          </p>

          <p>
            <strong>Throw Hand:</strong>
            ${glove.throwHand || ""}
          </p>

          <p>
            <strong>Condition:</strong>
            ${glove.condition || ""}
          </p>

          <p>
            ${glove.description || ""}
          </p>

        </div>

      </div>
    `;

  } catch (err) {

    wrap.innerHTML =
      `<p>${err.message}</p>`;

  }
}

loadGlove();
