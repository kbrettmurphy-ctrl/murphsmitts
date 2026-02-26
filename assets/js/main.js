
// Active nav highlight + simple lightbox for gallery
(function () {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    if (a.getAttribute("data-page") === path) a.classList.add("active");
  });

  const lb = document.querySelector(".lightbox");
  if (!lb) return;

  const lbImg = lb.querySelector("img");
  document.querySelectorAll(".gallery-grid img").forEach(img => {
    img.addEventListener("click", () => {
      lbImg.src = img.src;
      lb.classList.add("open");
    });
  });

  lb.addEventListener("click", () => lb.classList.remove("open"));
})();
