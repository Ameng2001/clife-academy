# 迭代三：客户主题式课程交付对齐

## 背景

本轮迭代面向“教研工坊”客户交付。客户提供了两份关键材料：

1. **教案参考模板**：定义单次集体教学活动的目标输出格式。
2. **中班上学期第二个月主题教案《多样的服饰》**：体现客户真实交付物形态，是一个完整的月度主题课程包，而不是单一教案。

因此，平台需要对齐的不是“单课时生成器”，而是“月主题课程生产系统”。

## 客户材料的本质

### 1. 教案参考模板

这是一个**单次集体教学活动模板**，核心要素包括：

- 核心发展目标编码
- 活动目标
- 活动准备
- 重难点
- 活动过程
- 活动延伸
- 教师观察与支持要点

它更接近平台中的：

- 单产物输出格式规范
- 教学活动模板

### 2. 《多样的服饰》终版主题教案

这是一个**整个月度主题课程交付包**，至少包含：

- 主题解读
- 主题网络图
- 月度主题活动列表
- 一周活动安排计划表
- 多种活动类型的具体活动稿

其活动类型不止“教学活动”，还包括：

- 区域活动
- 户外游戏
- 生活渗透
- 家园互动

## 对平台能力的需求分层

### 主题层

- 主题解读
- 主题目标
- 主题网络图
- 分主题递进逻辑

### 月规划层

- 月度主题活动矩阵
- 各周子主题与活动类型分布

### 周编排层

- 一周 17 项活动安排
- 多活动类型混排
- 材料准备与教师提示

### 单活动层

- 教学活动
- 区域活动
- 户外游戏
- 生活渗透
- 家园互动

### 模板适配层

- 客户发展目标编码
- 双栏“教师观察与支持要点”
- 客户栏目命名与交付格式

## 当前平台能力判断

### 已有基础

- `.workshop/projects` / `.workshop/plans` 的 project-first 运行时
- `workshop-pipelines` 的 pipeline 注册能力
- `workshop-5step` 的教学活动设计链路
- `workshop-insight` 的主题分析基础
- `workshop-pbl` 的主题网络图结构基础
- `workshop-planner` 的月 / 周规划基础
- `workshop-quality` / `workshop-resource` / HIL / release bundle 等底座能力

### 关键 gap

- 缺少 `thematic-curriculum` 主题式课程 pipeline
- 缺少 4 类非教学活动能力：
  - 区域活动
  - 户外游戏
  - 生活渗透
  - 家园互动
- `month-plan` / `week-plan` 的输出结构尚未对齐客户交付物
- `workshop-5step` 的教学活动输出格式尚未对齐客户模板
- 客户自有发展目标编码未接入

## 迭代三目标

本轮不做所有技能的完整编码实现，而是先完成三个锚点：

1. **新增 `thematic-curriculum` pipeline**
2. **引入客户结构化样例**
3. **增强 planner 输出契约**

## 实施范围

### P0

- 新增 `workshop-pipelines/references/templates/thematic-curriculum/`
- 增加客户结构化样例参考
- 增强 `month-plan`
- 增强 `week-plan`
- 修正 `kb-import` / `kb-schema` 中仍残留的旧 `studio/kb` 语义

### P1（后续迭代）

- 为教学活动适配客户双栏输出格式
- 新增 4 类非教学活动技能
- 新增主题解读 / 主题网络图专属生成技能

> 当前进度：上述两类专属技能已补充为 `theme-narrative` 与 `theme-network`。

### P2（后续迭代）

- 接入客户发展目标编码体系
- 支持更强的导出格式（Word / PDF / 双栏版式）

## 关键设计判断

- `workshop-5step` 仅对应客户体系中的“教学活动”子能力
- 客户的主方法论应被建模为 `thematic-curriculum`
- 月主题与周编排是客户交付的核心层，不应只被视为 planning 备注

## 客户编码体系接入

本轮进一步明确了客户本地发展目标编码的接入方式：

- 平台活动编码继续使用 `FS-*` 或 `TC-*`
- 客户编码作为并列字段接入：
  - `local_goal_system`
  - `goal_codes`

当前先支持“编码保留 + 文本说明 + 与《指南》并列”，暂不假定客户已提供完整编码手册。

## 导出层设计

为了接住客户的双栏模板和 Word/PDF 交付需求，新增了独立导出层模型：

- [runtime-architecture.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/architecture/runtime-architecture.md)

原则是：

- 运行时仍以 Markdown 语义源为准
- `courses/` 仍是 release bundle
- 客户特定版式和 Word/PDF 输入统一进入 `.workshop/exports/`

## 端到端样例

为了避免只停留在规范层，仓库内补充了一组可审阅的示例项目产物：

- [docs/examples/thematic-curriculum-hepu-clothing/README.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/examples/thematic-curriculum-hepu-clothing/README.md)

这组样例串起了：

- 主题分析
- 月度活动矩阵
- 周活动安排
- 教学活动
- 区域活动
- 户外游戏
- 生活渗透
- 家园互动
