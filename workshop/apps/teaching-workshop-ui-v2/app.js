document.querySelectorAll("[data-page]").forEach((link) => {
  if (document.body.dataset.page === link.dataset.page) {
    link.classList.add("active");
  }
});
