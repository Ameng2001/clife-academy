# 导出布局配置 / Layout Profiles

## 1. standard-markdown

用途：
- 内部审阅
- release bundle 中的标准 Markdown 交付

特点：
- 保持默认 Markdown 章节结构
- 不额外压缩栏目

## 2. teaching-activity-dual-column

用途：
- 对齐客户“单次教学活动模板”
- 为后续 Word/PDF 双栏排版做准备

特点：
- 教学过程保留 `教师观察与支持要点` 独立列
- 标题和栏目顺序优先贴近客户模板
- 运行时仍是 Markdown，不在此阶段强行模拟视觉双栏
- 在导出 manifest 中应映射为：
  - `table_mapping.teaching_activity_process = table-with-support-column`
  - `layout.support_notes_column = true`

## 3. compact-school-handout

用途：
- 园所内部短版流转

特点：
- 压缩说明文字
- 保留关键信息块
- 适合快速备课或审阅

## 选择原则

1. Markdown 是运行时语义源，不是最终视觉版式。
2. Word/PDF 双栏属于导出层，而不是 lesson 生成层。
3. 客户模板要求的栏目顺序和字段显式性，应在格式层稳定下来。
4. 过程表中的“教师观察与支持要点”是导出层双栏布局的关键锚点，不能在前序生成中丢失。
