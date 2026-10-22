# 教研工坊 UI Prototype V3

这一版不是 V2 的继续拼接，而是新的方向：

- 左侧保留 `Project / Thread`
- 中间主工作区改成 **结构画布优先**
- Copilot 不再占据固定结果栏，而是作为 **附着式 Drawer**
- `Month Matrix` 和 `Week Arrangement` 回到主舞台
- `Confirm` 改成附着在阶段上的 gate 状态，不再与内容阶段同权

页面入口：

- `index.html`：Studio / 课程结构总览
- `theme-framing.html`：主题结构画布
- `month-matrix.html`：月度活动矩阵主画布
- `week-arrangement.html`：周节奏与缺项主画布
- `activity-editor.html`：单活动结构编辑
- `hil-confirm.html`：阶段确认 gate
- `export-bundle.html`：导出包视图；右上「分享到幼师学坊」按钮与四栏分享表（docs/design/教研工坊-分享到幼师学坊.md）
