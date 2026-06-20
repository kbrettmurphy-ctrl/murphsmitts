async function loadGloves() {

  const grid =
    document.getElementById("saleGloveGrid");

  try {

    const resp = await fetch(
      "/api/gloves-for-sale"
    );

    const data = await resp.json();

    if (!data.ok) {
      throw new Error(
        data.error || "Load failed"
      );
    }

    if (!data.gloves?.length) {

      grid.innerHTML =
        "<p>No gloves available.</p>";

      return;
    }

    grid.innerHTML =
      data.gloves.map(glove => `
        <article
          class="sale-card ${glove.status === 'Sold' ? 'sold' : ''}"
          onclick="location.href='/for-sale/glove?slug=${glove.slug}'"
        >
        
        ${glove.status === "Sold"
          ? '<div class="sale-badge">SOLD</div>'
          : ""}
          <img
            class="sale-card-img"
            src="${glove.primaryPhoto || ""}"
            alt="${glove.title || "Glove for sale"}"
          >
    
          <div class="sale-card-body">
            <h2>${glove.title || ""}</h2>
    
            <p class="sale-price">
              $${Number(glove.price || 0).toFixed(2)}
            </p>
    
            <p class="sale-meta">
              ${[glove.brand, glove.model].filter(Boolean).join(" ")}
            </p>
    
            <p class="sale-condition">
              ${glove.condition || ""}
            </p>
          </div>
        </article>
      `).join("");

  } catch (err) {

    grid.innerHTML =
      `<p>${err.message}</p>`;

  }
}

loadGloves();
