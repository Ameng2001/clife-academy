# Course Workshop Plugins — Planning Pipeline 执行全记录

> 执行时间：2026-03-28
> 执行环境：astra-studio-plugins (作为插件开发平台)
> 目标项目：courses-workshop-plugins
> 输入材料：IM-PreK.3-Nov果汁-PBL.pdf + 三维项目阶段图-en.xlsx

---

## 0. 前置准备：输入材料分析

### 0.1 读取 PDF — PBL 项目活动预案

```
Read /Users/liuyameng/Desktop/好奇贝果/PBL 课程设计/IM-PreK.3-Nov果汁-PBL.pdf
  → PDF pages extracted: 20 page(s) (9.3MB)
```

**提取到的预案结构（华美 PBL 项目路径图 5 段式）：**

- 01 项目概览 Project Overview — 主题背景 + 教育价值阐述
- 02 项目标准 Project Standard — 先前经验 + 4C能力映射 + 学习目标
- 03 项目启动 Project Launch — 驱动性问题 + 主题网络图
- 04 项目探究 Project Inquiry — 3条递进探究线索，每条含多个活动
- 05 项目展示 Project Products — 成果展示方案

**提取到的活动编码规范：** `PBL-C{线索号}-{序号}`

**案例主题：** "我周围的人 / People Around Me"
**驱动性问题：** "如何开一家果汁店？ / How to open a juice shop?"

**3 条探究线索：**
- Clue 1: 果汁店要做什么口味的果汁？(3-5 days)
- Clue 2: 如何经营果汁店？(3-5 days)
- Clue 3: 开业前需要做哪些准备？(3-5 days)

**活动详情提取（每条线索 4-9 个活动）：**

Clue 1 Activities:
| Code | Name | Key Question |
|------|------|-------------|
| PBL-C1-01 | 我喜欢的果汁 / My Favorite Juice | 要做什么口味的果汁？ |
| PBL-C1-02 | 你喜欢什么果汁？ / What Juice Do You Like? | |
| PBL-C1-03 | 应季的水果 / Fruits In Season | |
| PBL-C1-04 | 营养搭配 / Nutritional Matching | |

Clue 2 Activities:
| Code | Name | Key Question |
|------|------|-------------|
| PBL-C2-01 | 果汁制作工具 / Juice Making Tools | 如何制作果汁？ |
| PBL-C2-02 | 果汁制作步骤 / Juice Making Steps | |
| PBL-C2-03 | 果汁店海报 / Juice Shop Poster | 如何售卖果汁？ |
| PBL-C2-04 | 优惠券 / Coupons | |
| PBL-C2-05 | 热果汁 / Hot Fruit Juice | |
| PBL-C2-06 | 自制保温瓶 / Homemade Thermos Bottle | |
| PBL-C2-07 | 市场调研 / Market Research | 如何让果汁店赚钱？ |
| PBL-C2-08 | 计算利润 / Calculating Profits | |
| PBL-C2-09 | 果汁定价 / Juice Price | |

### 0.2 读取 Excel — 三维项目阶段图

```python
openpyxl.load_workbook('三维项目阶段图-en.xlsx')
Sheet1 Dimensions: A1:I20
```

**提取到的三阶段九要素框架：**

| 阶段 | 旅行类比 | 项目课程阶段 | 案例 |
|------|---------|-----------|------|
| 项目开始 | 1.1 目的需求 | 2.1 孩子发展的需要(目标) | 3.1 引发讨论 |
| | 1.2 计划+网络图 | 2.2 列出网络主题图 | 3.2 网络图 |
| | 1.3 验证(想象) | 2.3 小组活动、经验 | 3.3 提出概念 |
| | 1.4 团讨确定 | 2.4 师生共绘网络图 | 3.4 已知和未知 |
| 项目发展 | 1.5 专家采访 | 2.5 专家、实地参观 | 3.5 兽医图书馆 |
| | 1.6 实际开展 | 2.6 扮演、绘画、书写 | 3.6 建构兽医诊所 |
| | 1.7 调整计划 | 2.7 重新检视、调整 | 3.7 检查调整 |
| 项目结束 | 1.8 攻略展示 | 2.8 报告、展示活动 | 3.8 记录书展示 |
| | 1.9 总结反思 | 2.9 评估、反思 | 3.9 评估反思 |

---

## 1. 逆向分析与插件架构提案

### 1.1 从产出物逆向推导课研工作流程

```
月度主题确定 → 主题背景撰写 → 儿童先前经验评估
     ↓
4C能力映射 → 学习目标制定
     ↓
驱动性问题设计 → 主题网络图构建
     ↓
探究线索拆分(3条递进) → 每条线索的活动设计
     ↓                        ↓
每个活动: 关键问题 + 内容步骤 + 资源清单 + 教师提示
     ↓
项目展示方案 → 评估标准 → 预案定稿
```

### 1.2 建议的插件架构

```
course-workshop-plugins/
├── workshop-core/          # 课研工作台（初始化、状态管理）
├── workshop-insight/       # 课程分析工具包
├── workshop-pbl/      # 课程设计流水线
├── workshop-quality/       # 质量保障
└── workshop-resource/      # 资源管理
```

### 1.3 核心设计流水线映射

```
theme-analysis → prior-knowledge + competency-mapping + driving-question
       ↓
inquiry-scaffold → 拆分出 3 条探究线索
       ↓
activity-design × 3 → 每条线索下的活动序列
       ↓
resource-planner → 资源清单匹配
       ↓
proposal-generate → 完整 PBL 预案文档
```

### 1.4 与 astra-studio 的对应关系

| astra-studio 概念 | course-workshop 对应 |
|-----------------|-------------------|
| 领域(domain) | 月度主题（如"我周围的人"） |
| 事件风暴 | 主题分析 + 儿童兴趣点发散 |
| Persona | 课研主任 / 一线教师 / 园长 |
| Journey Map | 课研主任"从选题到定稿"的全流程 |
| Process Flow | 三阶段九要素的标准化流程 |
| Hotspot | 活动设计耗时最长、资源匹配最易出错 |
| Skill Map | 15 个 skills |
| SKILL.md 骨架 | 每个 skill 的输入/输出/工作流定义 |

---

## 2. 工作区初始化

### 2.1 /studio-core:init 执行（此前已完成）

```
Studio initialized at studio/

  studio/config.yaml   — configuration
  studio/changes/      — active plugin development
  studio/agents/       — custom domain expert definitions
  studio/archive/      — shipped plugin records
```

---

## 3. 阶段一：Event Storm（发现阶段）

### 3.1 创建领域专家

3 个领域专家写入 `studio/agents/`：

```
Write studio/agents/early-childhood-curriculum-expert.md
  → File created successfully

Write studio/agents/child-development-psychologist.md
  → File created successfully

Write studio/agents/instructional-designer.md
  → File created successfully
```

**专家角色说明：**

| 角色 | 为什么需要 | 带来的独特视角 |
|------|-----------|---------------|
| 产品经理 | 确保从课研主任的实际痛点出发 | 用户工作流分析、优先级排序 |
| 架构师 | 评估插件拆分和数据流可行性 | 技能边界、产出物依赖关系 |
| 幼儿教育课程专家 | 确保 PBL 方法论正确性 | 三阶段九要素、课标对齐、年龄适配 |
| 儿童发展心理学家 | 确保活动设计符合发展规律 | 4C能力映射准确性、先前经验评估 |
| 教学设计师 | 确保预案可落地执行 | 活动序列编排、资源清单完整性、教师可操作性 |

### 3.2 领域描述（Step 1: Set the Stage）

> **幼儿园 PBL 课程研发** — 帮助课研主任系统化地设计月度 PBL 项目活动预案。目前课研主任凭经验手工编写，从选题、标准制定、驱动性问题设计、探究线索拆分到活动编排全流程依赖个人能力，缺乏结构化工具支撑，产出质量参差不齐。

**执行模式选择：⚡ 快速模式**（3 个确认点）

### 3.3 创建 Domain Workspace

```
mkdir -p studio/changes/course-workshop/{personas,journeys,processes}

Write studio/changes/course-workshop/status.json
  → { "type": "domain", "domain": "course-workshop", "phase": "planning", "plugins": [] }
```

### 3.4 Step 2-6 合并执行（快速模式）

#### Persona 1: 张主任（课研主任）

```
Write studio/changes/course-workshop/personas/curriculum-director.md
  → File created successfully
```

**核心信息：**
```
┌─────────────────────────────────────────────────┐
│  张主任                                          │
│  "我希望有一套标准化的流程，让每个课研老师都能      │
│   产出质量一致的预案"                             │
├─────────────────────────────────────────────────┤
│  Role:        课研主任 / 教研组长                 │
│  Age range:   30-45                             │
│  Tech level:  中                                │
│                                                 │
│  Pain points:                                   │
│  1. 选题到定稿全流程无工具支撑 — severity: 高      │
│  2. 驱动性问题设计耗时最长，反复修改 3-5 轮 — 高   │
│  3. 4C 能力映射凭感觉 — severity: 中              │
│  4. 资源清单经常遗漏 — severity: 高               │
│  5. 新课研老师上手慢 — severity: 中               │
│                                                 │
│  Success looks like:                            │
│  "30分钟内拿到结构完整的预案草稿，只需做最终审核"  │
└─────────────────────────────────────────────────┘

Pain: 质量依赖个人经验，无法规模化复制
Gain: 一套标准化流程 + 工具，让任何课研老师都能产出合格预案
```

#### Persona 2: 王老师（一线带班教师）

```
Write studio/changes/course-workshop/personas/classroom-teacher.md
  → File created successfully
```

**核心痛点：** "预案写得很好看，但到了教室里我不知道第一句话该说什么。"

#### Persona 3: 李园长

```
Write studio/changes/course-workshop/personas/principal.md
  → File created successfully
```

**核心痛点：** "我要在 10 分钟内判断一份预案是否合格"

#### Journey Map: 张主任的月度预案研发流程

```
Write studio/changes/course-workshop/journeys/curriculum-director-monthly-proposal.md
  → File created successfully
```

**6 阶段旅程：**

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Stage    │ 选题研究  │ 标准制定  │ 问题设计  │ 活动编排  │ 资源匹配  │ 审核定稿  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Emotion  │ 😐 平静  │ 😕 困惑  │ 😩 焦虑  │ 😤 疲惫  │ 😕 繁琐  │ 😌 释然  │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Pain Point × Opportunity (8 个机会点)：**

| # | Stage | Pain Point | Severity | Opportunity |
|---|-------|-----------|----------|-------------|
| 1 | 选题研究 | 每月重复查找课标 | 中 | 主题知识库 + 往年预案索引 |
| 2 | 标准制定 | 4C 映射无标准化参照 | 中 | 自动 4C 映射 + 学习目标生成 |
| 3 | 问题设计 | 驱动性问题设计是最大瓶颈 | 高 | AI 辅助驱动问题生成 + 开放性验证 |
| 4 | 问题设计 | 网络图构建耗时 | 高 | 自动网络图生成 + 覆盖度检查 |
| 5 | 活动编排 | 活动设计占整体 70% 时间 | 高 | 活动序列自动编排 + 模板化 |
| 6 | 活动编排 | 探究线索递进性难以把握 | 中 | 递进性检查 + 线索平衡分析 |
| 7 | 资源匹配 | 资源清单遗漏 | 高 | 资源自动匹配 + 完整性校验 |
| 8 | 审核定稿 | 评审反馈碎片化 | 中 | 自动质量检查报告 |

#### Process Flow 1: 月度 PBL 预案研发流程

```
Write studio/changes/course-workshop/processes/monthly-proposal-creation.md
  → File created successfully
```

**5 个决策点：**

| ID | Decision | Condition |
|----|----------|-----------|
| D1 | 驱动问题是否足够开放且可探究？ | 问题允许多种答案 + 儿童可动手探索 |
| D2 | 3 条线索是否递进且均衡？ | 每条 3-5 天 + 逻辑递进 |
| D3 | 资源清单是否完整且可获取？ | 每个活动都有资源 + PBL Box 可供应 |
| D4 | 评审是否通过？ | 课标对齐 + 活动可执行 + 资源齐全 |
| D5 | 园长是否批准？ | 整体质量合格 + 格式规范 |

#### Process Flow 2: 单个探究线索的活动设计流程

```
Write studio/changes/course-workshop/processes/activity-design.md
  → File created successfully
```

**3 个决策点（嵌套循环）：**
- D1: 活动时长 20-30 min？
- D2: 活动间逻辑递进？
- D3: 覆盖学习目标？

#### Event Storm 总结 + Hotspot 排名

```
Write studio/changes/course-workshop/event-storm.md
  → File created successfully
```

**25 个业务事件，分 6 个事件簇：**

| 事件簇 | 事件数 | 关键事件 |
|--------|--------|---------|
| 选题与规划 | 3 | E1 月度主题已确定, E2 课标已对齐, E3 概览已撰写 |
| 标准制定 | 3 | E4 先前经验已评估, E5 4C已映射, E6 目标已制定 |
| 问题与网络图 | 3 | E7 驱动问题已生成, E8 开放性已验证, E9 网络图已构建 |
| 探究线索与活动 | 6 | E10-E15 线索拆分到活动编写 |
| 资源与交付 | 5 | E16-E20 资源匹配到文档组装 |
| 质量保障 | 5 | E21-E25 检查到审批发放 |

**Hotspot 排名（8 个热点）：**

| 排名 | 热点 | 严重度 | 类型 | 判断依据 |
|------|------|--------|------|---------|
| 1 | HS-1 驱动性问题设计是最大瓶颈 | 高 | 知识 | Persona 痛点 #2 + Journey 情绪最低点 + Process D1 循环 |
| 2 | HS-2 活动设计占 70% 时间 | 高 | 效率 | Journey "活动编排" + Process 嵌套循环 |
| 3 | HS-3 资源清单遗漏导致开课延误 | 高 | 准确 | Persona 痛点 #4 + PBL Box 供应链约束 |
| 4 | HS-4 4C 映射无标准化参照 | 中 | 知识 | Persona 痛点 #3 |
| 5 | HS-5 新课研老师上手慢 | 中 | 效率 | Persona 痛点 #5 |
| 6 | HS-6 双语内容工作量大 | 中 | 效率 | Process 独立工作流 |
| 7 | HS-7 课标对齐靠人工逐条比对 | 中 | 准确 | 课程专家指出 |
| 8 | HS-8 预案格式不统一 | 低 | 效率 | 园长痛点 #3 |

**专家修正亮点：**

- **课程专家**：递进不是"简单→复杂"，而是"具象体验→抽象理解"
- **心理学家**：PDF 中的 4C 映射有误 — PBL-C1-01 标注了 Critical Thinking，实际发展的是 Creativity
- **教学设计师**：PBL-C2-05（保温实验）实际需 40+ 分钟，应拆为 2 课时

### 3.5 阶段一产出文件清单

```
studio/changes/course-workshop/
├── event-storm.md                              ← 25 个事件 + 8 个热点 + 专家修正
├── status.json                                 ← type: domain, phase: planning
├── personas/
│   ├── curriculum-director.md                  ← 张主任（核心用户）
│   ├── classroom-teacher.md                    ← 王老师（预案消费者）
│   └── principal.md                            ← 李园长（审批者）
├── journeys/
│   └── curriculum-director-monthly-proposal.md ← 6 阶段旅程 + 8 个机会点
└── processes/
    ├── monthly-proposal-creation.md            ← 主流程（5 决策点、4 角色）
    └── activity-design.md                      ← 活动设计子流程（嵌套循环）
```

---

## 4. 阶段二：Domain Model（领域建模）

### 4.1 Step 1: Event Clusters → Domains

```
Write studio/changes/course-workshop/domain-canvas.md
  → File created successfully
```

**7 个域分类：**

| Domain | Events | Classification |
|--------|--------|---------------|
| 主题分析 | E1-E3 | Supporting |
| 标准制定 | E4-E6 | Supporting |
| 问题与结构设计 | E7-E11 | **Core** |
| 活动设计 | E12-E15 | **Core** |
| 资源管理 | E16-E18 | Supporting |
| 内容输出 | E19-E20 | Generic（不建插件） |
| 质量保障 | E21-E25 | **Core** |

**域间关系图：**
```
[主题分析] ──→ [标准制定] ──→ [问题与结构设计]
                                    │
                                    ▼
                              [活动设计] ──→ [资源管理]
                                    │              │
                                    ▼              ▼
                              [内容输出] ←────────┘
                                    │
                                    ▼
                              [质量保障]
```

### 4.2 Step 3: Behavior Matrix

```
Write studio/changes/course-workshop/behavior-matrix.md
  → File created successfully
```

**6 个 Gap 识别：**

| Gap | Opportunity |
|-----|-------------|
| 无课标知识库 | 内置课标索引 + 自动匹配 |
| 无4C标准参照表 | 内置年龄段×4C能力矩阵 |
| 无驱动问题质量标准 | 开放性/可探究性自动评分 |
| 无活动时长估算模型 | 基于步骤数和年龄的时长预估 |
| 无资源数据库 | PBL Box 物料数据库 + 自动匹配 |
| 无网络图生成工具 | 结构化网络图自动生成 |

### 4.3 Step 5: Opportunity Assessment

```
Write studio/changes/course-workshop/opportunity-brief.md
  → File created successfully
```

**Impact × Feasibility 评分：**

| Plugin | Impact | Feasibility | Score | Priority |
|--------|--------|-------------|-------|----------|
| workshop-pbl | 5 | 4 | **20** | 2 |
| workshop-quality | 4 | 5 | **20** | 4 |
| workshop-insight | 4 | 4 | **16** | 3 |
| workshop-resource | 5 | 3 | **15** | 5 |
| workshop-core | 3 | 5 | **15** | 1 (基础设施) |

**Build Roadmap：**
```
Phase 1 (MVP):   workshop-core + workshop-pbl
Phase 2:         workshop-insight + workshop-quality
Phase 3:         workshop-resource + network-map enhancement
```

### 4.4 Step 6: Domain Map + Plugin Workspaces

```
Write studio/changes/course-workshop/domain-map.md
  → File created successfully
```

**确定的 5 个插件：**

| Plugin | Role | Description | Dependencies |
|--------|------|-------------|-------------|
| workshop-core | core | 工作区初始化、状态管理、预案归档 | — |
| workshop-pbl | core | 驱动问题→网络图→线索→活动→预案 | workshop-core |
| workshop-insight | add-on | 主题分析、先前经验、4C映射 | — |
| workshop-quality | add-on | 课标检查、预案审核 | — |
| workshop-resource | add-on | 资源匹配、资源校验 | workshop-core |

**Collection Pattern: Core + Add-ons**
```
workshop-core (zero deps)
    ↑
    ├── workshop-pbl (depends: core)
    └── workshop-resource (depends: core)

workshop-insight  (zero deps)
workshop-quality  (zero deps)
```

**创建 Plugin Workspaces：**
```
mkdir studio/changes/workshop-core/
mkdir studio/changes/workshop-pbl/
mkdir studio/changes/workshop-insight/
mkdir studio/changes/workshop-quality/
mkdir studio/changes/workshop-resource/

Write studio/changes/workshop-core/status.json        → { type: "plugin", phase: "planning", skills: {} }
Write studio/changes/workshop-pbl/status.json     → { type: "plugin", phase: "planning", skills: {} }
Write studio/changes/workshop-insight/status.json      → { type: "plugin", phase: "planning", skills: {} }
Write studio/changes/workshop-quality/status.json      → { type: "plugin", phase: "planning", skills: {} }
Write studio/changes/workshop-resource/status.json     → { type: "plugin", phase: "planning", skills: {} }

Write studio/changes/course-workshop/status.json       → plugins: ["workshop-core", "workshop-pbl", "workshop-insight", "workshop-quality", "workshop-resource"]
```

### 4.5 阶段二新增产出

```
studio/changes/course-workshop/
├── domain-canvas.md          ← 7 个域分类
├── behavior-matrix.md        ← Actor×Action×Event×Data 矩阵 + 6 个 Gap
├── opportunity-brief.md      ← Impact×Feasibility 评分 + 路线图
├── domain-map.md             ← 插件架构 + 依赖图

studio/changes/workshop-core/status.json
studio/changes/workshop-pbl/status.json
studio/changes/workshop-insight/status.json
studio/changes/workshop-quality/status.json
studio/changes/workshop-resource/status.json
```

---

## 5. 阶段三：Skill Design（技能设计）

### 5.1 workshop-pbl (5 skills)

```
Write studio/changes/workshop-pbl/skill-map.md
  → File created successfully
```

**Skills:**

| Skill | Description | Inputs | Outputs | Complexity |
|-------|-------------|--------|---------|------------|
| driving-question | 驱动性问题生成+开放性验证 | 月度主题, 年龄段 | driving-question.md | Simple+Agent |
| network-map | 主题网络图构建 | driving-question.md | network-map.md | Simple |
| inquiry-scaffold | 探究线索拆分(3条递进) | driving-question.md + network-map.md | inquiry-clues.md | Simple+Agent |
| activity-design | 活动序列编排 | inquiry-clues.md | activities/clue-{N}.md | Moderate+Agent |
| proposal-generate | 预案文档组装(华美5段式) | 所有前序产出 | proposal.md | Moderate |

**Data Flow:**
```
[driving-question] → [network-map] → [inquiry-scaffold] → [activity-design] ×3 → [proposal-generate]
```

### 5.2 workshop-core (3 skills)

```
Write studio/changes/workshop-core/skill-map.md
  → File created successfully
```

| Skill | Description | Complexity |
|-------|-------------|------------|
| init | 工作区初始化 | Simple |
| status | 状态查看 | Simple |
| promote | 预案归档 | Simple |

### 5.3 workshop-insight (3 skills)

```
Write studio/changes/workshop-insight/skill-map.md
  → File created successfully
```

| Skill | Description | Complexity |
|-------|-------------|------------|
| theme-analysis | 主题教育价值分析 | Simple+Agent |
| prior-knowledge | 先前经验评估(认知/技能/情感) | Simple+Agent |
| competency-mapping | 4C映射+学习目标生成 | Simple+Agent |

### 5.4 workshop-quality (2 skills)

```
Write studio/changes/workshop-quality/skill-map.md
  → File created successfully
```

| Skill | Description | Complexity |
|-------|-------------|------------|
| standards-check | 自动规则检查(8条) | Moderate+Agent |
| proposal-review | 多专家评审(3专家并行) | Moderate+Agent |

### 5.5 workshop-resource (2 skills)

```
Write studio/changes/workshop-resource/skill-map.md
  → File created successfully
```

| Skill | Description | Complexity |
|-------|-------------|------------|
| resource-planner | 资源匹配+分类 | Simple |
| resource-check | 完整性校验 | Simple |

### 5.6 更新所有 status.json（添加 skills）

```
Write workshop-pbl/status.json → skills: { driving-question: "draft", network-map: "draft", ... }
Write workshop-core/status.json     → skills: { init: "draft", status: "draft", promote: "draft" }
Write workshop-insight/status.json  → skills: { theme-analysis: "draft", prior-knowledge: "draft", competency-mapping: "draft" }
Write workshop-quality/status.json  → skills: { standards-check: "draft", proposal-review: "draft" }
Write workshop-resource/status.json → skills: { resource-planner: "draft", resource-check: "draft" }
```

---

## 6. 阶段四：Spec Generate（规格生成）

### 6.1 workshop-pbl — briefs + manifests + SKILL.md skeletons + commands

```
Write studio/changes/workshop-pbl/brief.md           → File created
Write studio/changes/workshop-pbl/plugin.json.draft   → File created

mkdir -p studio/changes/workshop-pbl/skills/{driving-question,network-map,inquiry-scaffold,activity-design,proposal-generate}
mkdir -p studio/changes/workshop-pbl/commands/

Write skills/driving-question/SKILL.md     → 46 lines (skeleton)
Write skills/network-map/SKILL.md          → 46 lines (skeleton)
Write skills/inquiry-scaffold/SKILL.md     → 45 lines (skeleton)
Write skills/activity-design/SKILL.md      → 46 lines (skeleton)
Write skills/proposal-generate/SKILL.md    → 45 lines (skeleton)

Write commands/driving-question.md         → File created
Write commands/network-map.md              → File created
Write commands/inquiry-scaffold.md         → File created
Write commands/activity-design.md          → File created
Write commands/proposal-generate.md        → File created
Write commands/design.md                   → 流水线命令（串联 5 个 skills）
```

### 6.2 workshop-core — via background Agent

```
Agent "Generate workshop-core specs" launched
  → 9 tool uses · 33s

Output:
  Write brief.md, plugin.json.draft
  Write skills/init/SKILL.md, skills/status/SKILL.md, skills/promote/SKILL.md
  Write commands/init.md, commands/status.md, commands/promote.md
  → 8 files created
```

### 6.3 workshop-insight — via background Agent

```
Agent "Generate workshop-insight specs" launched
  → 9 tool uses · 32s

Output:
  Write brief.md, plugin.json.draft
  Write skills/theme-analysis/SKILL.md, skills/prior-knowledge/SKILL.md, skills/competency-mapping/SKILL.md
  Write commands/theme-analysis.md, commands/prior-knowledge.md, commands/competency-mapping.md
  → 8 files created
```

### 6.4 workshop-quality + workshop-resource — via background Agent

```
Agent "Generate quality+resource specs" launched
  → 13 tool uses · 54s

Output:
  workshop-quality: brief.md, plugin.json.draft, skills/standards-check/SKILL.md, skills/proposal-review/SKILL.md, commands/standards-check.md, commands/proposal-review.md
  workshop-resource: brief.md, plugin.json.draft, skills/resource-planner/SKILL.md, skills/resource-check/SKILL.md, commands/resource-planner.md, commands/resource-check.md
  → 12 files created
```

### 6.5 阶段四产出统计

```
=== Total files === 70

=== By plugin ===
course-workshop:  12 files
workshop-core:    10 files
workshop-pbl: 15 files
workshop-insight: 10 files
workshop-quality:  8 files
workshop-resource: 8 files

agents: 3 files
```

### 6.6 Git Commit

```
git add studio/agents/ studio/changes/
git commit -m "feat: complete 4-phase planning pipeline for course-workshop-plugins"
  → [main bb54fe1] 66 files changed, 5307 insertions(+)
```

---

## 7. SKILL.md 充实（从骨架到完整指令）

### 7.1 workshop-pbl（5 个 skills，手动充实）

#### driving-question (46 → 245 lines)
```
Write skills/driving-question/SKILL.md
  → File updated successfully
```

**新增内容：**
- Expert Discovery（动态专家加载）
- Pre-check（工作区检测 + 可选 enrichment 文件读取）
- Step 1: 引导式上下文收集（三要素引导 prompt）
- Step 2: 生成 5 个候选问题 + 6 条设计规则表 + 年龄语言指南
- Step 3: 4 维度评分矩阵（开放性/可探究性/年龄适切/多维度，each 1-5）+ 详细 rubric
- Step 4: Expert Review（课程专家自动审核 + 常见修正模式）
- Step 5: 结构化呈现（推荐问题 + 评分 + 备选 + 确认交互）
- Step 6: 输出格式模板 + status.json 更新

#### network-map (46 → 166 lines)
```
Write skills/network-map/SKILL.md
  → File updated successfully
```

**新增内容：**
- Pre-check（读取 driving-question.md）
- Step 1-2: 从探究维度生成子问题（2-4 per dimension）
- Step 3: 叶节点生成（2-4 per sub-question，action-oriented）
- Step 4: 五大领域覆盖标注（≥ 3/5 必须覆盖）
- Step 5: 文本 mind map 图格式
- Step 6-7: 验证 + 输出模板

#### inquiry-scaffold (45 → 174 lines)
```
Write skills/inquiry-scaffold/SKILL.md
  → File updated successfully
```

**新增内容：**
- Expert Discovery（课程专家 + 心理学家双角色）
- Step 1: 网络图分析（concrete → abstract 光谱排序）
- Step 2: 3 条线索设计（具象体验 → 问题解决 → 整合展示）+ 设计规则
- Step 3: 4C 分配（年龄×4C 定义矩阵 + 常见映射错误表）
- Step 4: 学习目标（年龄×动词指南）
- Step 5: 关键词提取
- Step 6: 双专家并行审核
- Step 7-8: 呈现 + 输出模板

#### activity-design (46 → 220 lines)
```
Write skills/activity-design/SKILL.md
  → File updated successfully
```

**新增内容：**
- Expert Discovery（教学设计师 + 心理学家）
- Step 1: 活动数量规划
- Step 2: 活动设计（编码规范 PBL-Cx-y + 5 种活动类型步骤模板 + Tips 编写规则 + 资源标注规则）
- Step 3: 时长检查（步骤数×分钟估算公式，按年龄段）
- Step 4: 序列检查（逻辑递进 + 类型多样性）
- Step 5: 目标覆盖检查
- Step 6: 双专家审核
- Step 7-8: 验证 + 输出模板

#### proposal-generate (45 → 135 lines)
```
Write skills/proposal-generate/SKILL.md
  → File updated successfully
```

**新增内容：**
- Pre-check（必需/可选输入文件清单）
- Step 1-5: 华美 5 段式逐段组装指令
  - 01 项目概览: theme-analysis.md or auto-generate
  - 02 项目标准: competency-mapping.md + prior-knowledge.md or extract from inquiry-clues
  - 03 项目启动: driving-question + network-map
  - 04 项目探究: inquiry-clues + activities (bilingual activity table)
  - 05 项目展示: auto-generate from Clue 3
- Step 6-7: 格式化 + 输出

### 7.2 workshop-core（3 个 skills，via background Agent）

```
Agent "Flesh out workshop-core skills" launched
  → 9 tool uses · 65s

Results:
  init/SKILL.md:    92 lines (was skeleton)
    → Pre-check, inline config.yaml, directory structure, summary + next steps
  status/SKILL.md:  74 lines
    → Scan changes + archives, domain vs plugin distinction, dashboard table, next-action suggestions
  promote/SKILL.md: 93 lines
    → Phase validation, production structure build, archive with timestamp, domain workspace update
```

### 7.3 workshop-insight（3 个 skills，via background Agent）

```
Agent "Flesh out workshop-insight skills" launched
  → 10 tool uses · 283s

Results:
  theme-analysis/SKILL.md:      317 lines
    → Expert discovery, bilingual narrative rules, 5-domain coverage, curriculum standard entries, expert review
  prior-knowledge/SKILL.md:     354 lines
    → 3-dimensional assessment (cognitive/skills/emotional), age-band differentiation, entry format rules, 8 validation checks
  competency-mapping/SKILL.md:  373 lines
    → 4C behavioral manifestation table, 6 common misclassification errors, age-appropriate verb guide, 10 validation checks
```

### 7.4 workshop-quality + workshop-resource（4 个 skills，via background Agent）

```
Agent "Flesh out quality+resource skills" launched
  → 18 tool uses · 295s

Results:
  standards-check/SKILL.md:   393 lines
    → 8 quality rules with procedures: keyword scanning, age-verb matrix, 4C content indicators, step-count duration formula, progression keywords, regex code extraction, per-activity resource count, CJK/Latin scanning
  proposal-review/SKILL.md:   364 lines
    → 3 parallel expert invocations, 9 sub-scores, consensus/conflict resolution, top 5 recommendations
  resource-planner/SKILL.md:  268 lines
    → 4 categories with heuristics, quantity estimation formulas, specificity rules, PBL Box order summary
  resource-check/SKILL.md:    267 lines
    → 5 validation checks, catalog lookup chain, duplicate detection, category correctness rules
```

### 7.5 充实结果统计

```
=== SKILL.md Line Counts ===
  74 workshop-core/skills/status/SKILL.md
  92 workshop-core/skills/init/SKILL.md
  93 workshop-core/skills/promote/SKILL.md
 135 workshop-pbl/skills/proposal-generate/SKILL.md
 166 workshop-pbl/skills/network-map/SKILL.md
 174 workshop-pbl/skills/inquiry-scaffold/SKILL.md
 220 workshop-pbl/skills/activity-design/SKILL.md
 245 workshop-pbl/skills/driving-question/SKILL.md
 267 workshop-resource/skills/resource-check/SKILL.md
 268 workshop-resource/skills/resource-planner/SKILL.md
 317 workshop-insight/skills/theme-analysis/SKILL.md
 354 workshop-insight/skills/prior-knowledge/SKILL.md
 364 workshop-quality/skills/proposal-review/SKILL.md
 373 workshop-insight/skills/competency-mapping/SKILL.md
 393 workshop-quality/skills/standards-check/SKILL.md

=== Total === 3,535 lines
```

---

## 8. References 编写（7 个领域知识文件）

### 8.1 workshop-pbl references（via background Agent）

```
Agent "Write designer references" launched
  → 3 tool uses · 111s

Files created:
  references/pbl-methodology-guide.md   (194 lines)
    → PBL overview, 华美 5-step path, 三阶段九要素, driving question principles, inquiry progression, activity best practices

  references/activity-coding-spec.md    (109 lines)
    → PBL-C{x}-{y} format, 4 rules, naming convention, activity table format, juice shop worked example
```

### 8.2 workshop-insight + workshop-quality references（via background Agent）

```
Agent "Write insight+quality references" launched
  → 4 tool uses · 237s

Files created:
  workshop-insight/references/guidelines-3-6.md   (197 lines)
    → 5 developmental domains (Health/Language/Social/Science/Art), each with 2-3 goals + 3 age-band expectations

  workshop-insight/references/4c-framework.md      (193 lines)
    → 4C definition matrix, age-specific manifestations, observable indicators, 6 misclassification errors, verb guide

  workshop-quality/references/age-ability-matrix.md (140 lines)
    → Cognitive/motor/social/language/emotional abilities × 4 age bands, activity feasibility matrix (15 activity types), time recommendations, 7 validation rules
```

### 8.3 workshop-resource references（via background Agent）

```
Agent "Write resource references" launched
  → 3 tool uses · 65s

Files created:
  references/pbl-box-catalog.md     (65 lines)
    → 4 categories (Art & Craft / Science / Print / Media), each item with CN/EN name, quantity, notes

  references/resource-categories.md (130 lines)
    → 4 resource categories with definitions/characteristics/examples, classification decision tree, specificity rules
```

### 8.4 References Git Commit

```
git add studio/changes/*/references/
git commit -m "docs: add 7 reference files for domain knowledge"
  → [main 1ee4ba0] 7 files changed, 1028 insertions(+)
```

---

## 9. Promote（推进到正式插件目录）

### 9.1 创建目录结构

```
mkdir -p .claude-plugin/
mkdir -p workshop-{core,designer,insight,quality,resource}/.claude-plugin
mkdir -p workshop-{core,designer,insight,quality,resource}/{skills,commands,references,agents,templates}
```

### 9.2 写入 Marketplace Manifest

```
Write .claude-plugin/marketplace.json
  → 注册 5 个插件

Write .claude-plugin/plugin.json
  → marketplace 元数据
```

### 9.3 写入 Per-Plugin Manifests

```
Write workshop-core/.claude-plugin/plugin.json        → name, version, description, keywords
Write workshop-pbl/.claude-plugin/plugin.json     → + dependencies: ["workshop-core"]
Write workshop-insight/.claude-plugin/plugin.json      → no deps
Write workshop-quality/.claude-plugin/plugin.json      → no deps
Write workshop-resource/.claude-plugin/plugin.json     → + dependencies: ["workshop-core"]
```

### 9.4 复制文件到正式目录

```bash
# Skills, commands, references for each plugin
cp -r studio/changes/$plugin/skills/*     → $plugin/skills/
cp -r studio/changes/$plugin/commands/*   → $plugin/commands/
cp -r studio/changes/$plugin/references/* → $plugin/references/

# Agents to plugins that use expert discovery
cp studio/agents/*.md → workshop-pbl/agents/
cp studio/agents/*.md → workshop-insight/agents/
cp studio/agents/*.md → workshop-quality/agents/

# Shared reference
cp workshop-insight/references/guidelines-3-6.md → workshop-quality/references/

# Config template
cp studio/config.yaml → workshop-core/templates/config.yaml
```

### 9.5 写入 CLAUDE.md

```
Write CLAUDE.md
  → 项目说明 + 结构 + 依赖 + 流水线 + 专家 + 测试命令 + references 索引
```

### 9.6 最终目录结构验证

```
--- workshop-core ---
.claude-plugin/plugin.json
commands/init.md, promote.md, status.md
skills/init/SKILL.md, promote/SKILL.md, status/SKILL.md
templates/config.yaml

--- workshop-pbl ---
.claude-plugin/plugin.json
agents/child-development-psychologist.md, early-childhood-curriculum-expert.md, instructional-designer.md
commands/activity-design.md, design.md, driving-question.md, inquiry-scaffold.md, network-map.md, proposal-generate.md
references/activity-coding-spec.md, pbl-methodology-guide.md
skills/activity-design/SKILL.md, driving-question/SKILL.md, inquiry-scaffold/SKILL.md, network-map/SKILL.md, proposal-generate/SKILL.md

--- workshop-insight ---
.claude-plugin/plugin.json
agents/child-development-psychologist.md, early-childhood-curriculum-expert.md, instructional-designer.md
commands/competency-mapping.md, prior-knowledge.md, theme-analysis.md
references/4c-framework.md, guidelines-3-6.md
skills/competency-mapping/SKILL.md, prior-knowledge/SKILL.md, theme-analysis/SKILL.md

--- workshop-quality ---
.claude-plugin/plugin.json
agents/child-development-psychologist.md, early-childhood-curriculum-expert.md, instructional-designer.md
commands/proposal-review.md, standards-check.md
references/age-ability-matrix.md, guidelines-3-6.md
skills/proposal-review/SKILL.md, standards-check/SKILL.md

--- workshop-resource ---
.claude-plugin/plugin.json
commands/resource-check.md, resource-planner.md
references/pbl-box-catalog.md, resource-categories.md
skills/resource-check/SKILL.md, resource-planner/SKILL.md

=== Total plugin files === 54
```

### 9.7 Promote Git Commit

```
git add .claude-plugin/ workshop-core/ workshop-pbl/ workshop-insight/ workshop-quality/ workshop-resource/ CLAUDE.md
git commit -m "feat: promote plugins to production directory structure"
  → [main 9dd76f6] 57 files changed, 5590 insertions(+)
```

---

## 10. 总量统计

### Git History

```
14dbb84  Initialize studio workspace for plugin development
bb54fe1  feat: complete 4-phase planning pipeline for course-workshop-plugins
1ee4ba0  docs: add 7 reference files for domain knowledge
9dd76f6  feat: promote plugins to production directory structure
```

### File Counts

| Category | Count | Lines |
|----------|-------|-------|
| SKILL.md files | 15 | 3,535 |
| Reference files | 7 | 1,028 |
| Command files | 16 | ~160 |
| Agent files | 3 (×3 copies = 9) | ~450 |
| Plugin manifests | 7 | ~85 |
| Design artifacts (studio/) | 12 | ~1,200 |
| Skill maps | 5 | ~350 |
| Briefs + drafts | 10 | ~200 |
| Other (CLAUDE.md, config, status) | ~15 | ~150 |
| **Total** | **~100 unique files** | **~7,000+ lines** |

### Pipeline Phases Summary

| Phase | Technique | Key Output | Files |
|-------|-----------|------------|-------|
| 0. 输入分析 | PDF/Excel 逆向拆解 | 预案结构 + 方法论框架 | 0 (analysis only) |
| 1. Event Storm | 5 角色头脑风暴 | 25 事件 + 3 Personas + 1 Journey + 2 Processes + 8 Hotspots | 7 |
| 2. Domain Model | 域划分 + Canvas + Matrix + Opportunity | 7 域 → 5 插件 + 依赖图 + 路线图 | 5 |
| 3. Skill Design | 技能拆分 + 接口定义 + 数据流 | 15 skills 设计 + 实现顺序 | 5 |
| 4. Spec Generate | 骨架生成 + 命令文件 | 15 SKILL.md + 16 commands + 5 briefs + 5 manifests | 46 |
| 5. SKILL.md 充实 | 逐技能详细编写 | 3,535 行完整指令 | 15 (覆盖写入) |
| 6. References | 领域知识编写 | 7 个参考文档 (1,028 lines) | 7 |
| 7. Promote | 目录重组 + manifests | 正式插件结构 (54 files) | 57 |

### 实测命令

```bash
cd /Users/liuyameng/Codes/Plugins/courses-workshop-plugins

claude --plugin-dir ./workshop-core \
       --plugin-dir ./workshop-pbl \
       --plugin-dir ./workshop-insight \
       --plugin-dir ./workshop-quality \
       --plugin-dir ./workshop-resource

# 然后输入：
/workshop-pbl:design 我周围的人
```
