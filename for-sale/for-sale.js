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

        <div class="sale-card">

          <img
            src="${glove.primaryPhoto || ""}"
            alt="${glove.title}"
          >

          <h2>${glove.title}</h2>

          <p class="sale-price">
            $${Number(glove.price || 0).toFixed(2)}
          </p>

          <p>
            ${glove.brand}
            ${glove.model}
          </p>

          <p>
            ${glove.condition}
          </p>

        </div>

      `).join("");

  } catch (err) {

    grid.innerHTML =
      `<p>${err.message}</p>`;

  }
}

loadGloves();
