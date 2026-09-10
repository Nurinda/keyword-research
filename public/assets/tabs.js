// public/assets/tabs.js
// Logika switch antar tab. File terpisah dari app.js supaya tidak ada
// risiko mengubah perilaku fitur "Riset Keyword AI" yang sudah berjalan.

(function () {
  "use strict";

  const buttons = document.querySelectorAll(".tabs__btn");
  const pages = document.querySelectorAll("[data-tab-page]");

  if (!buttons.length || !pages.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
      pages.forEach((page) => {
        page.hidden = page.dataset.tabPage !== target;
      });
    });
  });
})();
