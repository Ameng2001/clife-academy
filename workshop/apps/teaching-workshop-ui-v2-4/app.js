document.querySelectorAll("[data-page-link]").forEach((link) => {
  if (document.body.dataset.page === link.dataset.pageLink) {
    link.classList.add("active");
  }
});
