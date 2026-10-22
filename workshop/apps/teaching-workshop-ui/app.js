document.querySelectorAll("[data-page]").forEach((link) => {
  const current = document.body.dataset.page;
  if (link.dataset.page === current) {
    link.classList.add("active");
  }
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
  });
});
