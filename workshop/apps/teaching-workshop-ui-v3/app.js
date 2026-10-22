document.querySelectorAll("[data-page]").forEach((link) => {
  if (document.body.dataset.page === link.dataset.page) {
    link.classList.add("active");
  }
});

// 分享到幼师学坊（export-bundle.html）：开关弹层；第四栏空着提交不亮；提示词起一行；提交后署名一句
(() => {
  const open = document.getElementById("share-open");
  const overlay = document.getElementById("share-overlay");
  if (!open || !overlay) return;
  // 用过再分享：课程未完成 / 待提交时按钮灰
  if (!["approved", "used"].includes(open.dataset.courseState)) { open.disabled = true; open.title = "用过再分享：审核通过或标过「已在班里用过」才能分享"; }
  const changes = document.getElementById("share-changes");
  const submit = document.getElementById("share-submit");
  const note = document.getElementById("share-foot-note");
  const refresh = () => {
    const filled = [...changes.querySelectorAll("input")].some((i) => i.value.trim());
    submit.disabled = !filled;
    note.textContent = filled ? "交了以后园长同意、审核人入库，入库记积分" : "写一条「改了什么」提交按钮才亮";
  };
  const addRow = (value = "") => {
    const i = document.createElement("input");
    i.placeholder = "再写一条（≤ 120 字）"; i.maxLength = 120; i.value = value;
    changes.appendChild(i); i.addEventListener("input", refresh); i.focus(); refresh();
  };
  changes.addEventListener("input", refresh);
  document.getElementById("share-add").addEventListener("click", () => addRow());
  document.querySelectorAll(".share-hint").forEach((b) => b.addEventListener("click", () => {
    const empty = [...changes.querySelectorAll("input")].find((i) => !i.value.trim());
    if (empty) { empty.value = b.dataset.hint; empty.focus(); refresh(); } else addRow(b.dataset.hint);
  }));
  const show = (on) => { overlay.hidden = !on; document.body.style.overflow = on ? "hidden" : ""; };
  open.addEventListener("click", () => show(true));
  ["share-close", "share-cancel"].forEach((id) => document.getElementById(id).addEventListener("click", () => show(false)));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) show(false); });
  submit.addEventListener("click", () => {
    overlay.querySelectorAll(".share-step, .share-switches, .share-foot, .share-lead").forEach((el) => el.hidden = true);
    document.getElementById("share-done").hidden = false;
    open.textContent = "已分享 · 在幼师学坊里看"; open.classList.remove("button-primary");
  });
  ["share-skip", "share-say"].forEach((id) => document.getElementById(id).addEventListener("click", () => show(false)));
  overlay.querySelectorAll(".share-chips").forEach((g) => g.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
    const single = g.closest(".share-switch");
    if (single) g.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
    c.classList.toggle("on", single ? true : !c.classList.contains("on"));
  })));
})();
