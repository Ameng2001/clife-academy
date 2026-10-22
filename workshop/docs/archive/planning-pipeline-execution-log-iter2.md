# Course Workshop Plugins — Planning Pipeline 执行全记录（迭代二）

> 执行时间：2026-03-29
> 执行环境：astra-studio-plugins (作为插件开发平台)
> 目标项目：courses-workshop-plugins
> 基准：迭代一产出 (5 plugins, 15 skills, 7 references)
> 目标：扩展至 9 plugins, 27 skills — 新增五步法教案、课程规划、知识库、模板管理

---

## 0. 迭代二背景

### 0.1 迭代一回顾

迭代一（2026-03-28）完成了核心 PBL 课程设计工具集的构建：

- 5 个插件：workshop-core, workshop-pbl, workshop-insight, workshop-quality, workshop-resource
- 15 个技能：覆盖从工作区管理到 PBL 预案生成的完整流程
- 7 个参考文件：PBL 方法论、编码规范、《指南》摘要、4C 框架、年龄矩阵、资源目录
- 3 位领域专家：课程专家、心理学家、教学设计师

### 0.2 迭代二目标

基于迭代一的 Persona 分析和 Journey Map，识别出以下扩展需求：

1. **一线教师 (Classroom Teacher)** 是被低估的用户群 — 她们不仅执行预案，还需要设计单节课教案
2. **五步法** (导入→探究→操作→总结→延伸) 是幼儿园最普遍的教学结构，与 PBL 互补
3. **学期/月/周规划** 是课研主任的上游需求 — 先有学期计划，才有月度课题
4. **园本知识库** 是所有设计的本地化基础 — 历年教案、区编教材、教研记录
5. **方法论模板** 需要解耦 — PBL 和五步法共享基础设施但使用不同设计流程

### 0.3 新增插件规划

| Plugin | Skills | 定位 | 面向用户 |
|--------|--------|------|---------|
| workshop-5step | 4 | 五步法教案设计流水线 | 一线教师 |
| workshop-planner | 3 | 分层课程规划 | 课研主任 |
| workshop-kb | 3 | 园本知识库管理 | 课研主任 + 一线教师 |
| workshop-pipelines | 2 | 教学方法论管线注册 | 所有用户 |

---

## 1. 阶段一：用户洞察补充

### 1.1 更新 Classroom Teacher Persona

```
Read studio/changes/course-workshop/personas/classroom-teacher.md
  → 原 persona 定位为"预案执行者"
  → 更新为"课堂教学的设计者和执行者"
  → 新增需求：自主设计教案、需要话术模板、需要分层指导
```

写入更新后的 persona：
- 新增"直接使用 Course Workshop"能力（不再仅是预案消费者）
- 新增痛点：教案编写耗时、教学目标不规范、缺乏分层指导
- 新增场景：`/workshop-5step:lesson` 全流程教案设计

### 1.2 新增 Classroom Teacher Journey Map

```
Write studio/changes/course-workshop/journeys/classroom-teacher-daily-lesson-prep.md
```

**旅程：一线教师日常备课流程**

| 阶段 | 行动 | 触点 | 情绪 | 痛点 |
|------|------|------|------|------|
| 接收任务 | 从课研主任处获取课题和年龄段 | 教研会/微信群 | 中性 | 课题描述模糊 |
| 目标设定 | 编写教学目标 | 纸笔/Word | 焦虑 | 不确定动词是否适切 |
| 环节设计 | 设计教学流程 | 参考过往教案 | 吃力 | 时间分配凭经验 |
| 话术编写 | 写教师提问和引导语 | Word | 耗时 | 开放性提问难设计 |
| 材料准备 | 列写材料清单 | Excel/纸笔 | 繁琐 | 容易遗漏 |
| 审核修改 | 提交教研组审核 | 打印稿 | 忐忑 | 返工率高 |

**机会点：** 每个痛点都对应一个 workshop-5step 技能。

---

## 2. 阶段二：领域建模扩展

### 2.1 Domain Canvas 更新

原有 5 个核心域 + 2 个支撑域，现扩展为：

| 域 | 分类 | 迭代 | 插件 |
|----|------|------|------|
| 工作区管理 | 支撑 | v1 | workshop-core |
| PBL 课程设计 | 核心 | v1 | workshop-pbl |
| 前期分析 | 核心 | v1 | workshop-insight |
| 质量保障 | 核心 | v1 | workshop-quality |
| 资源管理 | 支撑 | v1 | workshop-resource |
| **五步法教案** | **核心** | **v2** | **workshop-5step** |
| **课程规划** | **核心** | **v2** | **workshop-planner** |
| **知识库管理** | **支撑** | **v2** | **workshop-kb** |
| **方法论管线** | **通用** | **v2** | **workshop-pipelines** |

### 2.2 依赖关系更新

```
workshop-core       (零依赖)
workshop-insight    (零依赖)
workshop-quality    (零依赖)
workshop-pipelines  (零依赖)
workshop-kb         → workshop-core
workshop-pbl   → workshop-core, workshop-pipelines
workshop-5step     → workshop-core, workshop-pipelines
workshop-planner    → workshop-core, workshop-pipelines
workshop-resource   → workshop-core
```

---

## 3. 阶段三：技能设计（4 个新插件）

### 3.1 workshop-5step — Skill Map

```
Read/Write studio/changes/workshop-5step/skill-map.md
  → 4 skills designed
```

| Skill | Complexity | Agent | Pipeline Position |
|-------|-----------|-------|-------------------|
| lesson-objective | Medium | 心理学家 + 课程专家 | Entry point |
| lesson-scaffold | Medium | 教学设计师 + 课程专家 | Depends on objective |
| lesson-detail | High | 教学设计师 + 心理学家 | Depends on scaffold |
| lesson-generate | Simple | — | Assembly (depends on all) |

数据流：
```
lesson-objective → lesson-scaffold → lesson-detail → lesson-generate
      ↑                  ↑                                  ↑
  (workshop-kb)    (workshop-pipelines              (workshop-quality
                    five-step pipeline)              optional check)
```

### 3.2 workshop-planner — Skill Map

```
Read/Write studio/changes/workshop-planner/skill-map.md
  → 3 skills designed
```

| Skill | Complexity | Agent | Pipeline Position |
|-------|-----------|-------|-------------------|
| semester-plan | High | 课程专家 + 心理学家 | Entry point |
| month-plan | Medium | 课程专家 | Depends on semester |
| week-plan | Medium | — | Depends on month |

### 3.3 workshop-kb — Skill Map

```
Read/Write studio/changes/workshop-kb/skill-map.md
  → 3 skills designed
```

| Skill | Complexity | Agent | Pipeline Position |
|-------|-----------|-------|-------------------|
| kb-import | Medium | 课程专家 | Entry point |
| kb-index | Medium | — | Depends on import |
| kb-query | Simple | — | Depends on index |

### 3.4 workshop-pipelines — Skill Map

```
Read/Write studio/changes/workshop-pipelines/skill-map.md
  → 2 skills designed
```

| Skill | Complexity | Agent | Pipeline Position |
|-------|-----------|-------|-------------------|
| pipeline-list | Simple | — | Independent |
| pipeline-select | Simple | — | Independent |

---

## 4. 阶段四：规格生成

### 4.1 workshop-5step — SKILL.md + Commands + Agents + References

```
Write workshop-5step/skills/lesson-objective/SKILL.md (97 lines)
Write workshop-5step/skills/lesson-scaffold/SKILL.md (~120 lines)
Write workshop-5step/skills/lesson-detail/SKILL.md (~130 lines)
Write workshop-5step/skills/lesson-generate/SKILL.md (~100 lines)
Write workshop-5step/commands/lesson-objective.md
Write workshop-5step/commands/lesson-scaffold.md
Write workshop-5step/commands/lesson-detail.md
Write workshop-5step/commands/lesson-generate.md
Write workshop-5step/commands/lesson.md (pipeline command)
Copy  workshop-5step/agents/ (3 files from workshop-pbl)
Copy  workshop-5step/references/guidelines-3-6.md
```

### 4.2 workshop-planner — SKILL.md + Commands + Agents

```
Write workshop-planner/skills/semester-plan/SKILL.md
Write workshop-planner/skills/month-plan/SKILL.md
Write workshop-planner/skills/week-plan/SKILL.md
Write workshop-planner/commands/semester-plan.md
Write workshop-planner/commands/month-plan.md
Write workshop-planner/commands/week-plan.md
Write workshop-planner/commands/plan.md (pipeline command)
Copy  workshop-planner/agents/ (3 files from workshop-pbl)
Pre-existing: references/semester-calendar-template.md, weekly-schedule-template.md
```

### 4.3 workshop-kb — SKILL.md + Commands + References

```
Write workshop-kb/skills/kb-import/SKILL.md
Write workshop-kb/skills/kb-index/SKILL.md
Write workshop-kb/skills/kb-query/SKILL.md
Pre-existing: commands/kb-import.md, kb-index.md, kb-query.md
Pre-existing: references/kb-schema.md
```

### 4.4 workshop-pipelines — SKILL.md + Commands + References

```
Write workshop-pipelines/skills/pipeline-list/SKILL.md
Write workshop-pipelines/skills/pipeline-select/SKILL.md
Pre-existing: commands/pipeline-list.md, pipeline-select.md
Pre-existing: references/pipeline-schema.md
Pre-existing: references/templates/five-step/* (4 files)
Pre-existing: references/templates/pbl-huamei/* (4 files)
```

### 4.5 已有插件更新

```
Edit workshop-core/skills/init/SKILL.md
  → 新增 studio/kb/ 目录结构（textbooks, philosophy, lesson-plans, research-records, calendars）
  → 新增 config.yaml methodology 配置（defaults.methodology: pbl-huamei）
  → 新增 next steps 引导到 pipeline-list, kb-import, planner, designer

Edit workshop-core/skills/status/SKILL.md
  → 新增知识库状态显示（文档分类计数）
  → 新增多方法论支持（读取 config.yaml 获取活跃模板）
  → 新增规划状态显示（semester-plan.md, month-plan.md, week-plan.md）
  → 新增 five-step 类型工作区的 next-step 引导
```

### 4.6 Studio 变更记录

为每个新插件创建 studio/changes/ 记录：
```
Write studio/changes/workshop-5step/{brief.md, skill-map.md, status.json, plugin.json.draft}
Write studio/changes/workshop-kb/{brief.md, skill-map.md, status.json, plugin.json.draft}
Write studio/changes/workshop-planner/{brief.md, skill-map.md, status.json, plugin.json.draft}
Write studio/changes/workshop-pipelines/{brief.md, skill-map.md, status.json, plugin.json.draft}
```

### 4.7 CLAUDE.md 更新

```
Edit CLAUDE.md
  → 仓库结构从 5+1 更新为 9+1
  → 依赖关系图扩展到 9 个插件
  → 新增 3 条设计流水线图（PBL, Five-Step, Planning）
  → 参考文件表从 7 行扩展到 13 行
  → 测试命令更新（9 个 --plugin-dir 参数 + 3 条测试流程）
```

### 4.8 文档更新

```
Edit docs/course-workshop-whitepaper.md
  → 标题从"PBL 课程研发"更新为"课程研发"
  → 版本 0.1.0 → 0.2.0
  → Section 1-5: 全面更新（5→9 插件，15→27 技能，新增流水线图）
  → Section 6: 快速上手新增五步法示例
  → Section 7: 新增 7.6-7.9 五步法流水线详解
  → Section 8: 专家体系扩展参与环节
  → Section 10: 最佳实践新增知识库、规划、模板相关
  → Section 11: 附录新增五步法编码规范和时间分配表

Edit docs/planning-pipeline-artifacts-summary.md
  → 产出物清单新增迭代二行
  → Phase 3 新增 4 个插件技能设计
  → Phase 4 技能表从 15→27，参考文件从 7→18，命令从 14→30
  → 尾部更新迭代说明

Write docs/planning-pipeline-execution-log-iter2.md
  → 本文件
```

---

## 5. 迭代二产出统计

### 新增文件统计

| Category | New Files | Est. Lines |
|----------|-----------|------------|
| SKILL.md (新技能) | 12 | ~1,400 |
| SKILL.md (更新) | 2 | ~80 delta |
| Command files | 16 | ~160 |
| Agent files (copies) | 6 | ~360 |
| Reference files (new) | 1 | ~50 |
| Reference files (pre-existing from iter1 prep) | 17 | — |
| plugin.json | 4 | ~56 |
| Studio records | 16 | ~400 |
| CLAUDE.md (updated) | 1 | ~40 delta |
| Documentation (updated/new) | 3 | ~500 delta |
| **Iteration 2 Total** | **~58 new files** | **~2,500+ lines** |

### 累计统计（迭代一 + 迭代二）

| Category | Iter 1 | Iter 2 | Total |
|----------|--------|--------|-------|
| Plugins | 5 | 4 | 9 |
| Skills (SKILL.md) | 15 | 12 | 27 |
| Reference files | 7 | 18 | 25 |
| Command files | 16 | 16 | 32 |
| Agent files | 9 | 6 | 15 |
| Plugin manifests | 7 | 4 | 11 |
| Studio records | 12 | 16 | 28 |
| **Total unique files** | **~100** | **~58** | **~160** |

### Pipeline Phases Summary (Iteration 2)

| Phase | Technique | Key Output | Files |
|-------|-----------|------------|-------|
| 1. 用户洞察 | Persona 更新 + Journey Map | Classroom Teacher 升级 + 备课旅程 | 2 |
| 2. 领域建模 | Domain Canvas 扩展 + 依赖更新 | 9 域 → 9 插件 | 0 (in-place) |
| 3. 技能设计 | 4 新插件 Skill Map | 12 skills 设计 | 8 |
| 4. 规格生成 | SKILL.md + Commands + Agents + Refs | 完整插件结构 | ~48 |
| 5. 文档更新 | Whitepaper + Artifacts + Log | 3 份文档更新/新增 | 3 |

### 三条设计流水线

```
PBL 流水线: /workshop-pbl:design <主题>
  driving-question → network-map → inquiry-scaffold → activity-design ×3 → proposal-generate

五步法流水线: /workshop-5step:lesson <课题>
  lesson-objective → lesson-scaffold → lesson-detail → lesson-generate

规划流水线: /workshop-planner:plan <学期>
  semester-plan → month-plan → week-plan
```

### 实测命令

```bash
cd /path/to/courses-workshop-plugins

claude --plugin-dir ./workshop-core \
       --plugin-dir ./workshop-pbl \
       --plugin-dir ./workshop-insight \
       --plugin-dir ./workshop-quality \
       --plugin-dir ./workshop-resource \
       --plugin-dir ./workshop-5step \
       --plugin-dir ./workshop-planner \
       --plugin-dir ./workshop-kb \
       --plugin-dir ./workshop-pipelines

# PBL 预案设计：
/workshop-pbl:design 我周围的人

# 五步法教案设计：
/workshop-5step:lesson 认识春天的花

# 学期课程规划：
/workshop-planner:plan 2026春季学期

# 知识库导入：
/workshop-kb:kb-import ~/教案资料/

# 查看可用模板：
/workshop-pipelines:pipeline-list
```
