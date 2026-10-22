# Course Workshop Plugins — Astra Studio 规划流水线过程产出汇总

> 迭代一：2026-03-28 | 迭代二：2026-03-29
> 执行工具：[Astra Studio Plugins](https://github.com/VanLengs/astra-studio-plugins)
> 目标项目：courses-workshop-plugins（幼儿园 PBL 课程研发工具集）
> 输入材料：IM-PreK.3-Nov果汁-PBL.pdf + 三维项目阶段图-en.xlsx

---

## 目录

1. [规划流水线总览](#1-规划流水线总览)
2. [Phase 1：事件风暴 (Event Storm)](#2-phase-1事件风暴-event-storm)
3. [Phase 2：领域建模 (Domain Model)](#3-phase-2领域建模-domain-model)
   - 2a. Persona 用户画像
   - 2b. User Journey 用户旅程
   - 2c. Process Flow 业务流程
   - 2d. Domain Canvas 领域画布
   - 2e. Behavior Matrix 行为矩阵
   - 2f. Opportunity Brief 机会评估
   - 2g. Domain Map 领域地图
4. [Phase 3：技能设计 (Skill Design)](#4-phase-3技能设计-skill-design)
5. [Phase 4：规格生成 (Spec Generate)](#5-phase-4规格生成-spec-generate)
6. [领域专家定义](#6-领域专家定义)

---

## 1. 规划流水线总览

Astra Studio 的 `/studio-planner:plan` 规划流水线包含 4 个阶段：

```
Event Storm → Domain Model → Skill Design → Spec Generate
   (发现)      (建模+分析)     (拆分技能)     (生成规格)
```

本次执行产出了 **9 个插件候选**、**27 个技能定义**、**3 位领域专家**，以及完整的分析制品。

### 产出物清单

| Phase | 产出物 | 文件 |
|-------|--------|------|
| Event Storm | 事件列表 + 热点 + 决策点 + 专家修正 | `event-storm.md` |
| Domain Model | 3 个 Persona 用户画像 | `personas/*.md` |
| Domain Model | 1 条 User Journey | `journeys/*.md` |
| Domain Model | 2 个 Process Flow | `processes/*.md` |
| Domain Model | 领域画布 | `domain-canvas.md` |
| Domain Model | 行为矩阵 | `behavior-matrix.md` |
| Domain Model | 机会评估 | `opportunity-brief.md` |
| Domain Model | 领域地图（插件划分） | `domain-map.md` |
| Skill Design | 5 份 skill-map | `workshop-*/skill-map.md` |
| Skill Design | 5 份 plugin brief | `workshop-*/brief.md` |
| Spec Generate | 15 个 SKILL.md 技能规格 | `workshop-*/skills/*/SKILL.md` |
| Spec Generate | 5 个 plugin.json.draft | `workshop-*/plugin.json.draft` |
| Spec Generate | 7 个 reference 知识文件 | `workshop-*/references/*.md` |
| — | 3 个领域专家 agent 定义 | `studio/agents/*.md` |
| **Iter 2 — Domain Model** | 1 条 User Journey (Classroom Teacher) | `journeys/classroom-teacher-daily-lesson-prep.md` |
| **Iter 2 — Domain Model** | 1 个 Persona 更新 (Classroom Teacher) | `personas/classroom-teacher.md` (updated) |
| **Iter 2 — Skill Design** | 4 份 skill-map (新插件) | `workshop-{lesson,kb,planner,templates}/skill-map.md` |
| **Iter 2 — Skill Design** | 4 份 plugin brief (新插件) | `workshop-{lesson,kb,planner,templates}/brief.md` |
| **Iter 2 — Spec Generate** | 12 个 SKILL.md 技能规格 (新) | `workshop-{lesson,kb,planner,templates}/skills/*/SKILL.md` |
| **Iter 2 — Spec Generate** | 4 个 plugin.json.draft (新) | `workshop-{lesson,kb,planner,templates}/plugin.json.draft` |
| **Iter 2 — Spec Generate** | 6+ 个 reference 知识文件 (新) | templates/* + planner refs + kb refs + lesson refs |
| **Iter 2 — Spec Generate** | 16 个 command 文件 (新) | `workshop-{lesson,kb,planner,templates}/commands/*.md` |

---

## 2. Phase 1：事件风暴 (Event Storm)

> 来源：`studio/changes/course-workshop/event-storm.md`
> 参与角色：产品经理, 架构师, 幼儿教育课程专家, 儿童发展心理学家, 教学设计师

### 领域上下文

**幼儿园 PBL 课程研发** — 帮助课研主任系统化地设计月度 PBL 项目活动预案。目前课研主任凭经验手工编写，从选题、标准制定、驱动性问题设计、探究线索拆分到活动编排全流程依赖个人能力，缺乏结构化工具支撑，产出质量参差不齐。

- **方法论基础**：华美 PBL 项目路径图（5 步）+ 三阶段九要素框架
- **最终产出物**：PBL 项目活动预案（PDF），包含项目概览、项目标准、项目启动、项目探究（3 条线索 × 3-9 个活动）、项目展示

### 事件清单（25 个）

#### 选题与规划
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E1 | 月度主题已确定 | 学期课程日历分配 | 课研主任开始查阅课标 |
| E2 | 主题与课标已对齐 | 课研主任查阅《指南》 | 确认主题的教育价值 |
| E3 | 项目概览已撰写 | 主题背景和教育价值梳理完成 | 为后续设计提供方向 |

#### 标准制定
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E4 | 儿童先前经验已评估 | 课研主任观察和记录 | 确定教学起点 |
| E5 | 4C 能力已映射 | 主题分析完成 | 每条线索的成功素养确定 |
| E6 | 学习目标已制定 | 4C 映射 + 先前经验 | 活动设计的基准 |

#### 问题与网络图设计
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E7 | 驱动性问题已生成 | 主题和目标确定 | 整个项目探究的方向 |
| E8 | 驱动问题开放性已验证 | 课程专家审核 | 通过后构建网络图 |
| E9 | 主题网络图已构建 | 驱动问题确定 | 子问题和探究方向明确 |

#### 探究线索与活动设计
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E10 | 探究线索已拆分 | 网络图完成 | 3 条递进线索确定 |
| E11 | 线索递进性已验证 | 课程专家检查 | 通过后开始活动设计 |
| E12 | 活动序列已编排 | 线索确定 | 每条线索 3-5 个活动 |
| E13 | 活动编码已分配 | 活动编排完成 | PBL-C{x}-{y} 编号 |
| E14 | 活动内容步骤已编写 | 活动主题确定 | 教师可执行的步骤 |
| E15 | 教师提示已编写 | 活动内容完成 | 帮助教师灵活调整 |

#### 资源与交付
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E16 | 资源清单已匹配 | 活动设计完成 | 每个活动的材料列表 |
| E17 | 资源已分类 | 清单编写 | PBL Box / 足迹袋 / 自备 / 多媒体 |
| E18 | 资源完整性已验证 | 分类完成 | 确认无遗漏 |
| E19 | 双语内容已编写 | 活动设计完成 | 中英文平行内容 |
| E20 | 预案文档已组装 | 所有内容就绪 | 完整的 PDF 输出 |

#### 质量保障
| # | Event | Trigger | Downstream |
|---|-------|---------|------------|
| E21 | 年龄段适配已检查 | 活动设计完成 | 确认活动符合目标年龄发展水平 |
| E22 | 4C 映射准确性已验证 | 心理学家审核 | 纠正不合理的能力声明 |
| E23 | 预案已内部评审 | 文档组装完成 | 课研组互审 |
| E24 | 预案已园长审批 | 内部评审通过 | 最终审批 |
| E25 | 预案已发放 | 园长审批通过 | 教师接收并执行 |

### 热点排名

| 排名 | ID | 热点 | 严重度 | 类型 |
|------|-----|------|--------|------|
| 1 | HS-1 | 驱动性问题设计是最大瓶颈，反复修改 3-5 轮 | 高 | 知识 |
| 2 | HS-2 | 活动设计占整体 70% 时间（9-15 个活动逐个编写） | 高 | 效率 |
| 3 | HS-3 | 资源清单遗漏导致开课延误 | 高 | 准确 |
| 4 | HS-4 | 4C 能力映射无标准化参照，凭感觉分配 | 中 | 知识 |
| 5 | HS-5 | 新课研老师上手慢，培训周期 3-6 个月 | 中 | 效率 |
| 6 | HS-6 | 双语内容编写工作量大 | 中 | 效率 |
| 7 | HS-7 | 课标对齐靠人工逐条比对 | 中 | 准确 |
| 8 | HS-8 | 预案格式不统一（不同课研老师风格差异大） | 低 | 效率 |

### 决策点

| Source | ID | Decision | 技能边界信号 |
|--------|-----|---------|-----------|
| monthly-proposal | D1 | 驱动问题是否足够开放且可探究？ | driving-question skill 的输出校验 |
| monthly-proposal | D2 | 3 条线索是否递进且均衡？ | inquiry-scaffold skill 的输出校验 |
| monthly-proposal | D3 | 资源清单是否完整且可获取？ | resource-planner skill 的输出校验 |
| monthly-proposal | D4 | 内部评审是否通过？ | standards-check skill 的触发点 |
| monthly-proposal | D5 | 园长是否批准？ | 人工决策，工具提供检查报告 |
| activity-design | D1 | 活动时长是否在 20-30 分钟？ | activity-design skill 的内置约束 |
| activity-design | D2 | 活动间是否有逻辑递进？ | activity-design skill 的序列校验 |
| activity-design | D3 | 活动是否覆盖学习目标？ | activity-design skill 的覆盖度检查 |

### 专家修正

#### 幼儿教育课程专家
- **驱动问题设计**: "不是所有'如何'问题都是好的驱动问题 — '如何开一家果汁店'之所以好，是因为它允许孩子从多个维度探究（口味、制作、经营），而不是只有一个正确答案"
- **线索递进**: "递进不是'从简单到复杂'，而是'从具象体验到抽象理解' — 先动手做（C1:口味），再解决问题（C2:经营），最后整合展示（C3:准备开业）"
- **课标覆盖**: "预案必须覆盖《指南》五大领域中的至少 3 个：健康、语言、社会、科学、艺术 — 很多预案只覆盖了科学和艺术"

#### 儿童发展心理学家
- **4C 映射纠正**: "PDF 里 PBL-C1-01（我喜欢的果汁）标注为 Communication + Critical Thinking，但实际上制作纸筒果汁杯主要发展的是 Creativity + Fine Motor，不是 Critical Thinking"
- **先前经验评估**: "先前经验不应该只列'知道什么'，还应该列'能做什么'和'感受过什么' — 认知、技能、情感三个维度"
- **学习目标动词**: "PreK-3 (2-3岁) 的目标应该用'感受/尝试/体验'，PreK-4 (3-4岁) 用'认识/了解/能够'，K (5-6岁) 才能用'理解/分析/比较'"

#### 教学设计师
- **资源清单规范**: "PDF 里的资源写'水果'不够具体 — 应该写'苹果 × 5个、橙子 × 5个（按班级人数调整）'，并标注是 PBL Box 配送还是自备"
- **活动时长**: "PBL-C2-05（热果汁保温实验）实际需要 40+ 分钟（倒水 + 等待 15 分钟 + 测温 + 讨论），应该拆成 2 个课时"
- **教师提示价值**: "Tips 不是可有可无的 — 它是区分新手教师能不能上好这节课的关键。每个活动至少 1 条 Tip，覆盖最常见的失败场景"

---

## 3. Phase 2：领域建模 (Domain Model)

### 2a. Persona 用户画像

> 来源：`studio/changes/course-workshop/personas/`

#### Persona 1：张主任（课研主任）— 核心用户

> "每个月要出 4-6 套预案，我最怕的不是写不出来，而是写出来的东西老师用不了。"

```
┌─────────────────────────────────────────────────┐
│  张主任                                          │
│  "我希望有一套标准化的流程，让每个课研老师都能      │
│   产出质量一致的预案"                             │
├─────────────────────────────────────────────────┤
│  Role:        课研主任 / 教研组长                 │
│  Age range:   30-45                             │
│  Tech level:  中（熟练使用 Office，不熟悉编程）    │
│  Context:     管理 3-5 名课研老师，负责全园        │
│               PreK-K 各年龄段的月度 PBL 预案      │
│                                                 │
│  Goals:                                         │
│  1. 高效产出：每月按时交付 4-6 套高质量预案        │
│  2. 质量一致：不同课研老师写出的预案水平齐平       │
│  3. 标准对齐：确保每套预案符合《指南》和园本课标    │
│                                                 │
│  Pain points:                                   │
│  1. 选题到定稿全流程无工具支撑，靠个人经验(高)     │
│  2. 驱动性问题设计耗时最长，反复修改 3-5 轮(高)    │
│  3. 4C 能力映射凭感觉，缺乏系统化对照标准(中)     │
│  4. 资源清单经常遗漏，开课后才发现材料不够(高)      │
│  5. 新课研老师上手慢，培训周期长达 3-6 个月(中)    │
│                                                 │
│  Success looks like:                            │
│  "课研老师输入主题和年龄段，30分钟内拿到一份       │
│   结构完整、标准对齐、资源齐全的预案草稿，         │
│   我只需要做最终审核和微调"                       │
└─────────────────────────────────────────────────┘
```

**Empathy Map:**

```
            ┌─────────────┐
            │   Thinks     │
            │ "这个驱动问题│
            │  够不够开放？│
            │  老师能引导  │
            │  得了吗？"   │
┌───────────┼─────────────┼───────────┐
│   Sees    │             │   Hears   │
│ 不同老师  │   张主任     │ 园长要求  │
│ 写的预案  │             │ 国际化、  │
│ 质量差距  │             │ 双语并重  │
│ 很大      │             │ 家长关注  │
│           │             │ 学了什么  │
└───────────┼─────────────┼───────────┘
            │   Does      │
            │ 手工逐条审  │
            │ 核预案，反  │
            │ 复修改活动  │
            │ 内容和资源  │
            └─────────────┘
```

- **Pain**: 质量依赖个人经验，无法规模化复制
- **Gain**: 一套标准化流程 + 工具，让任何课研老师都能产出合格预案

---

#### Persona 2：王老师（一线带班教师）— 预案消费者

> "预案写得很好看，但到了教室里我不知道第一句话该说什么。"

```
┌─────────────────────────────────────────────────┐
│  王老师                                          │
│  "给我具体的提问话术和材料清单，别让我猜"         │
├─────────────────────────────────────────────────┤
│  Role:        带班教师（PreK-4 班）               │
│  Age range:   23-35                             │
│  Tech level:  中                                │
│  Context:     独立带 20-25 个孩子，配 1 名保育员  │
│               每天有 30 分钟 PBL 活动时间         │
│                                                 │
│  Goals:                                         │
│  1. 快速理解预案意图，知道每个活动怎么做          │
│  2. 提前准备好所有材料，不在课上手忙脚乱          │
│  3. 灵活调整活动难度，适配不同发展水平的孩子       │
│                                                 │
│  Pain points:                                   │
│  1. 活动内容描述太笼统，缺乏具体话术(高)          │
│  2. 资源清单不够具体（只写"水果"不写数量种类）(高) │
│  3. 不知道如何评估孩子是否达到了学习目标(中)       │
│                                                 │
│  Success looks like:                            │
│  "预案里有分步骤的活动指引、教师提问话术示例、     │
│   完整的材料清单（含数量），我照着做就行"          │
└─────────────────────────────────────────────────┘
```

**Empathy Map:**

```
            ┌─────────────┐
            │   Thinks     │
            │ "这个活动    │
            │  30分钟够吗？│
            │  材料够分吗？│
            │  孩子听得懂  │
            │  吗？"       │
┌───────────┼─────────────┼───────────┐
│   Sees    │             │   Hears   │
│ 隔壁班做  │   王老师     │ 课研主任  │
│ 得很好，  │             │ 说要创新  │
│ 自己班    │             │ 家长问    │
│ 冷场了    │             │ 今天学了  │
│           │             │ 什么      │
└───────────┼─────────────┼───────────┘
            │   Does      │
            │ 提前一晚    │
            │ 准备材料，  │
            │ 反复读预案  │
            │ 猜测意图    │
            └─────────────┘
```

- **Pain**: 预案与实操之间有鸿沟，需要二次翻译
- **Gain**: 拿到手就能用的活动指南，像菜谱一样精确

---

#### Persona 3：李园长 — 审批者

> "家长花了高学费，我需要确保每个班的课程质量都对得起这个价格。"

```
┌─────────────────────────────────────────────────┐
│  李园长                                          │
│  "我要在 10 分钟内判断一份预案是否合格"            │
├─────────────────────────────────────────────────┤
│  Role:        园长 / 教学副园长                   │
│  Age range:   35-50                             │
│  Tech level:  低-中                              │
│  Context:     管理 3-4 个年级、20+ 个班           │
│               每月审批 12-20 套预案               │
│                                                 │
│  Goals:                                         │
│  1. 快速审核预案质量，确保课标对齐                │
│  2. 保证全园课程品质一致性                        │
│  3. 向家长和教育主管部门展示课程专业性             │
│                                                 │
│  Pain points:                                   │
│  1. 每月审批量大，没有标准化的审核清单(中)         │
│  2. 难以快速判断预案是否真正符合 PBL 方法论(中)    │
│  3. 不同年级组的预案格式不统一(低)                │
│                                                 │
│  Success looks like:                            │
│  "预案有清晰的质量评分，课标覆盖度一目了然，      │
│   我只需要关注红色标记的问题项"                   │
└─────────────────────────────────────────────────┘
```

**Empathy Map:**

```
            ┌─────────────┐
            │   Thinks     │
            │ "这个月的    │
            │  预案按时    │
            │  出得来吗？  │
            │  质量够吗？" │
┌───────────┼─────────────┼───────────┐
│   Sees    │             │   Hears   │
│ 有的预案  │   李园长     │ 家长问    │
│ 很专业    │             │ 你们用的  │
│ 有的像    │             │ 什么课程  │
│ 应付交差  │             │ 体系      │
└───────────┼─────────────┼───────────┘
            │   Does      │
            │ 周末加班    │
            │ 审阅预案    │
            │ 逐条批注    │
            └─────────────┘
```

- **Pain**: 审核效率低，标准全在脑子里无法传递
- **Gain**: 自动化的质量检查报告，聚焦异常项

---

### 2b. User Journey 用户旅程

> 来源：`studio/changes/course-workshop/journeys/curriculum-director-monthly-proposal.md`

**张主任的月度预案研发流程**
- Persona：张主任（课研主任）
- 场景：从接到月度主题到交付完整 PBL 预案
- 触发：学期初课程日历确定，本月主题分配到手
- 终态：4-6 套预案通过园长审批，发放给带班教师
- 时间跨度：2-3 周

#### 旅程阶段

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Stage    │ 选题研究  │ 标准制定  │ 问题设计  │ 活动编排  │ 资源匹配  │ 审核定稿  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Actions  │ 查课标   │ 写先前   │ 构思驱动 │ 拆分3条  │ 列资源   │ 内部评审  │
│          │ 翻往年   │ 经验     │ 性问题   │ 探究线索 │ 清单     │ 修改反馈  │
│          │ 预案参考 │ 映射4C   │ 画网络图 │ 设计活动 │ 下PBL    │ 排版输出  │
│          │ 上网搜索 │ 定目标   │ 反复推敲 │ 写步骤   │ Box订单  │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Touch-   │ 《指南》 │ 4C框架   │ 白板/    │ Word/PPT│ 供应商   │ 微信群   │
│ points   │ 往年档案 │ 文档     │ 思维导图 │          │ 目录     │ 面对面   │
│          │ 小红书   │          │ 软件     │          │ Excel   │ 会议     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Emotion  │ 平静     │ 困惑     │ 焦虑     │ 疲惫     │ 繁琐     │ 释然     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Pain     │ 重复劳动 │ 4C映射  │ 驱动问题 │ 活动设计 │ 资源分类 │ 反馈碎片 │
│ points   │ 每年重找 │ 无标准   │ 设计是整 │ 最耗时   │ 不清晰   │ 化，修改 │
│          │ 参考资料 │ 参照     │ 个流程的 │ 占70%    │ 经常遗漏 │ 轮次多   │
│          │          │          │ 瓶颈     │ 时间     │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 情绪曲线

```
高  ·                                                            ·····
    ·                                                      ·····
    · ·····                                          ·····
中  ·      ····                                ·····
    ·          ····                       ·····
    ·              ····             ·····
低  ·                  ·····  ·····
    ├────────┼────────┼────────┼────────┼────────┼────────┤
    选题研究   标准制定   问题设计   活动编排   资源匹配   审核定稿
```

#### 痛点 × 机会

| # | Stage | Pain Point | Severity | Opportunity |
|---|-------|-----------|----------|-------------|
| 1 | 选题研究 | 每月重复查找课标和参考资料 | 中 | 主题知识库 + 往年预案索引 |
| 2 | 标准制定 | 4C 能力映射无标准化参照 | 中 | 自动 4C 映射 + 学习目标生成 |
| 3 | 问题设计 | 驱动性问题设计是最大瓶颈，反复修改 3-5 轮 | 高 | AI 辅助驱动问题生成 + 开放性验证 |
| 4 | 问题设计 | 网络图构建耗时，子问题覆盖度难判断 | 高 | 自动网络图生成 + 覆盖度检查 |
| 5 | 活动编排 | 活动设计占整体 70% 时间 | 高 | 活动序列自动编排 + 模板化 |
| 6 | 活动编排 | 探究线索递进性难以把握 | 中 | 递进性检查 + 线索平衡分析 |
| 7 | 资源匹配 | 资源清单遗漏、分类混乱 | 高 | 资源自动匹配 + 完整性校验 |
| 8 | 审核定稿 | 评审反馈碎片化，修改轮次多 | 中 | 自动质量检查报告 |

**关键洞察**：
1. **问题设计和活动编排**是情绪最低点，也是时间消耗最大的阶段 — 插件最大的价值区间
2. 课研主任需要的是"结构化引导 + 快速迭代" — 给骨架让她填肉
3. 资源匹配出错率最高 — 涉及 PBL Box 供应链，漏了就延误开课

---

### 2c. Process Flow 业务流程

> 来源：`studio/changes/course-workshop/processes/`

#### 流程 1：月度 PBL 预案研发流程

- 触发：学期课程日历分配月度主题
- 终态：预案通过审批并发放给教师 / 预案被打回重做
- 频率：每月 1 次，产出 4-6 套预案（按年龄段）

```
[Trigger: 月度主题已分配]
    │
    ▼
[课研主任查阅课标和往年参考]
    │
    ▼
[撰写项目概览（主题背景 + 教育价值）]
    │
    ▼
[评估儿童先前经验]
    │
    ▼
[映射 4C 能力 + 制定学习目标]
    │
    ▼
[设计驱动性问题]
    │
    ▼
◇ D1: 驱动问题是否足够开放且可探究？
    ├─ 否 → [修改驱动问题] → (回到 ◇)     ← 可能循环 3-5 次
    │
    └─ 是 ↓
        [构建主题网络图]
            │
            ▼
        [拆分 3 条递进探究线索]
            │
            ▼
        ◇ D2: 3 条线索是否递进且均衡？
            ├─ 否 → [调整线索划分] → (回到 ◇)
            │
            └─ 是 ↓
                [为每条线索设计活动序列]
                    │
                    ▼
                [匹配资源清单]
                    │
                    ▼
                ◇ D3: 资源清单是否完整且可获取？
                    ├─ 否 → [补充/替换资源]
                    │
                    └─ 是 ↓
                        [编写双语内容] → [组装预案文档]
                            │
                            ▼
                        ◇ D4: 内部评审是否通过？
                            ├─ 否 → [修改] → (回到评审)
                            │
                            └─ 是 ↓
                                ◇ D5: 园长是否批准？
                                    ├─ 否 → [修改]
                                    │
                                    └─ 是 → [发放给教师 + 下单 PBL Box] → END
```

**角色泳道：**

```
课研主任:  [查课标] → [写概览] → [评估经验] → [映射4C] → [设计问题] → [画网络图]
                → [拆线索] → [设计活动] → [匹配资源] → [写双语] → [组装文档] ──┐
课研组:                                                              [互审] ──┤
园长:                                                                [审批] ──┤
供应链:                                                              [PBL Box 下单] → [配送]
教师:                                                                [接收预案] → [执行]
```

**关键观察：**
- D1（驱动问题验证）是最大瓶颈 — 平均循环 3-5 次
- 活动设计到资源匹配可并行处理
- PBL Box 订单有前置期约束（开课前 2-4 周确定）

---

#### 流程 2：单个探究线索的活动设计流程

- 触发：探究线索已确定（含关键问题、成功素养、学习目标）
- 终态：线索下所有活动（3-9个）设计完成
- 频率：每条线索 1 次，每套预案 3 条线索

```
[Trigger: 探究线索已确定]
    │
    ▼
[确定活动数量和主题] (通常 3-5 个，每个 20-30min)
    │
    ▼
┌──────── 循环: 对每个活动 ────────┐
│  [确定关键问题]                  │
│      ▼                          │
│  [分配活动编码 PBL-C{x}-{y}]    │
│      ▼                          │
│  [编写活动内容（3-4 步骤）]      │
│      ▼                          │
│  ◇ 活动时长 20-30 分钟？        │
│      ├─ 太长 → [拆分为 2 个活动] │
│      ├─ 太短 → [合并或扩展]      │
│      └─ 是 → [写 Tips] → [标注资源] │
└─────────────────────────────────┘
    │
    ▼
◇ 活动间逻辑递进？ ── 否 → [调整顺序]
    └─ 是 ↓
◇ 覆盖学习目标？ ── 否 → [补充活动]
    └─ 是 → [线索活动设计完成]
```

---

### 2d. Domain Canvas 领域画布

> 来源：`studio/changes/course-workshop/domain-canvas.md`

#### 事件聚类 → 领域

| Domain | Events | Core Data | Primary Actor |
|--------|--------|-----------|---------------|
| **主题分析** (Theme Analysis) | E1-E3 | 月度主题、课标引用、项目概览 | 课研主任 |
| **标准制定** (Standards Design) | E4-E6 | 先前经验、4C映射、学习目标 | 课研主任 + 心理学家 |
| **问题与结构设计** (Question & Structure) | E7-E11 | 驱动性问题、网络图、探究线索 | 课研主任 + 课程专家 |
| **活动设计** (Activity Design) | E12-E15 | 活动序列、编码、内容步骤、教师提示 | 课研主任 + 教学设计师 |
| **资源管理** (Resource Management) | E16-E18 | 资源清单、分类、PBL Box订单 | 课研主任 + 供应链 |
| **内容输出** (Content Output) | E19-E20 | 双语内容、预案文档 | 课研主任 |
| **质量保障** (Quality Assurance) | E21-E25 | 适配检查、审核记录、审批状态 | 课程专家 + 园长 |

#### 领域分类

**Core Domains（自建插件）：**
| Domain | Why Core |
|--------|----------|
| 问题与结构设计 | 核心创造性环节，驱动问题质量决定预案质量。高知识密度，无现成工具可替代 |
| 活动设计 | 占 70% 工作时间，效率提升最大杠杆。涉及编码规范、时长约束、递进性等领域特定规则 |
| 质量保障 | 需要内置课标数据库、4C映射标准、年龄适配规则。通用检查工具无法覆盖 |

**Supporting Domains（自建，但可复用通用能力）：**
| Domain | Why Supporting |
|--------|---------------|
| 主题分析 | 主题背景撰写可借助通用写作能力，但课标对齐需要领域知识 |
| 标准制定 | 4C 映射和学习目标有标准化框架，可半自动化 |
| 资源管理 | 资源匹配是结构化任务，但分类规则(PBL Box/足迹袋/自备)是领域特定的 |

**Generic Domains（无需自建）：**
| Domain | Why Generic | Existing Solution |
|--------|-------------|-------------------|
| 内容输出 | 双语翻译 + 文档排版是通用能力 | Claude 内置翻译 + Markdown→PDF 工具 |

#### 关系图

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

**数据流方向**：主题 → 标准 → 问题/结构 → 活动 → 资源 → 文档 → 审核

**关键依赖**：
- 活动设计 **强依赖** 问题与结构设计
- 资源管理 **强依赖** 活动设计
- 质量保障 **横切所有域**

---

### 2e. Behavior Matrix 行为矩阵

> 来源：`studio/changes/course-workshop/behavior-matrix.md`

#### Actor × Action × Event × Data

| Actor | Action | Event | Input Data | Output Data | Frequency |
|-------|--------|-------|------------|-------------|-----------|
| 课研主任 | 查阅课标 | E2 | 月度主题, 《指南》 | 课标引用列表 | 每月 |
| 课研主任 | 撰写概览 | E3 | 主题, 课标引用 | 项目概览文本(中英) | 每月 |
| 课研主任 | 评估经验 | E4 | 观察记录, 年龄段 | 先前经验清单 | 每月 |
| 课研主任 | 映射4C | E5 | 主题, 学习领域 | 4C×活动映射表 | 每月 |
| 课研主任 | 制定目标 | E6 | 4C映射, 先前经验, 年龄段 | 学习目标列表 | 每月 |
| 课研主任 | 设计问题 | E7 | 主题, 目标, 儿童兴趣 | 驱动性问题 | 每月(3-5轮) |
| 课程专家 | 验证问题 | E8 | 驱动性问题 | 通过/修改建议 | 每月 |
| 课研主任 | 画网络图 | E9 | 驱动问题 | 主题网络图 | 每月 |
| 课研主任 | 拆线索 | E10 | 网络图, 目标 | 3条探究线索 | 每月 |
| 课程专家 | 检查递进 | E11 | 3条线索 | 通过/调整建议 | 每月 |
| 课研主任 | 设计活动 | E12-E15 | 线索, 目标 | 活动表 | 每月(×3线索) |
| 课研主任 | 匹配资源 | E16-E18 | 活动列表 | 分类资源清单 | 每月 |
| 课研主任 | 写双语 | E19 | 中文活动内容 | 英文平行内容 | 每月 |
| 课研主任 | 组装文档 | E20 | 所有组件 | PBL预案PDF | 每月 |
| 课研组 | 互审 | E23 | 预案草稿 | 评审意见 | 每月 |
| 园长 | 审批 | E24 | 预案+评审结果 | 批准/打回 | 每月 |

#### 数据实体归属

| Entity | Owner Domain | Consumers |
|--------|-------------|-----------|
| 月度主题 | 主题分析 | 所有域 |
| 课标引用 | 主题分析 | 标准制定, 质量保障 |
| 先前经验清单 | 标准制定 | 活动设计 |
| 4C×活动映射表 | 标准制定 | 活动设计, 质量保障 |
| 学习目标列表 | 标准制定 | 问题设计, 活动设计, 质量保障 |
| 驱动性问题 | 问题与结构设计 | 活动设计 |
| 主题网络图 | 问题与结构设计 | 活动设计 |
| 探究线索(×3) | 问题与结构设计 | 活动设计 |
| 活动表(PBL-Cx-y) | 活动设计 | 资源管理, 内容输出, 质量保障 |
| 资源清单 | 资源管理 | 内容输出, 供应链 |
| PBL预案文档 | 内容输出 | 质量保障, 教师 |

#### Gap 分析

| Gap | Impact | Opportunity |
|-----|--------|-------------|
| 无课标知识库 | 重复劳动, 遗漏风险 | 内置课标索引 + 自动匹配 |
| 无4C标准参照表 | 映射不准确 | 内置年龄段×4C能力矩阵 |
| 无驱动问题质量标准 | 反复修改, 效率低 | 开放性/可探究性自动评分 |
| 无活动时长估算模型 | 课堂超时或不足 | 基于步骤数和年龄的时长预估 |
| 无资源数据库 | 遗漏, 分类错误 | PBL Box 物料数据库 + 自动匹配 |
| 无网络图生成工具 | 格式不统一, 耗时 | 结构化网络图自动生成 |

#### 自动化机会 → 技能映射

| Opportunity | Automation Level | Candidate Skill |
|-------------|-----------------|-----------------|
| 课标自动匹配 | 全自动 | theme-analysis |
| 项目概览生成 | 半自动 | theme-analysis |
| 先前经验模板填充 | 半自动 | prior-knowledge |
| 4C映射 + 目标生成 | 半自动 | competency-mapping |
| 驱动问题生成 + 评分 | 半自动 | driving-question |
| 网络图自动构建 | 全自动 | network-map |
| 线索拆分 + 递进检查 | 半自动 | inquiry-scaffold |
| 活动序列编排 | 半自动 | activity-design |
| 资源自动匹配 | 全自动 | resource-planner |
| 预案文档组装 | 全自动 | proposal-generate |
| 课标覆盖度检查 | 全自动 | standards-check |
| 年龄适配检查 | 全自动 | standards-check |
| 4C映射准确性检查 | 半自动 | proposal-review |

---

### 2f. Opportunity Brief 机会评估

> 来源：`studio/changes/course-workshop/opportunity-brief.md`

#### Impact × Feasibility 矩阵

| Plugin Candidate | Impact (1-5) | Feasibility (1-5) | Priority Score | Rationale |
|-----------------|-------------|-------------------|---------------|-----------|
| workshop-pbl | 5 | 4 | **20** | 覆盖 HS-1(驱动问题) + HS-2(活动设计) — 两个最大痛点 |
| workshop-quality | 4 | 5 | **20** | 覆盖 HS-4(4C映射) + HS-7(课标对齐)。规则明确，自动化程度高 |
| workshop-insight | 4 | 4 | **16** | 覆盖 HS-5(新人上手)。标准化前期准备流程 |
| workshop-resource | 5 | 3 | **15** | 覆盖 HS-3(资源遗漏)。高影响但需要维护 PBL Box 数据库 |
| workshop-core | 3 | 5 | **15** | 基础设施。必须有但影响感知低 |

#### 优先级排序与建设路线图

| Rank | Plugin | Phase | Effort | Dependencies |
|------|--------|-------|--------|--------------|
| 1 | workshop-core | 先建 | 小（3 skills） | 无 |
| 2 | workshop-pbl | 紧跟 | 大（5 skills） | workshop-core |
| 3 | workshop-insight | 同步 | 中（3 skills） | 无 |
| 4 | workshop-quality | 并行 | 中（2 skills） | 无 |
| 5 | workshop-resource | 后续 | 中（2 skills）+ 数据维护 | workshop-core |

#### 风险与缓解

| Plugin | Key Risk | Mitigation |
|--------|----------|------------|
| workshop-pbl | 驱动问题生成质量 — AI 可能生成看似开放但实际封闭的问题 | 内置开放性评分 + 课程专家 agent 自动审核 |
| workshop-pbl | 活动内容生成可能过于模板化 | 生成骨架而非完整内容，让课研主任填充创意部分 |
| workshop-resource | PBL Box 物料数据库需要持续维护 | 先用参考文档，后续可接 MCP 对接供应链系统 |
| workshop-quality | 课标数据库需要定期更新 | 作为 references/ 内置，版本化管理 |

#### 分阶段建设路线

```
Phase 1 (MVP):
  workshop-core (init, status, promote)
  workshop-pbl (driving-question, inquiry-scaffold, activity-design, proposal-generate)

Phase 2 (Enhancement):
  workshop-insight (theme-analysis, prior-knowledge, competency-mapping)
  workshop-quality (standards-check, proposal-review)

Phase 3 (Advanced):
  workshop-resource (resource-planner, resource-check)
  workshop-pbl += network-map
```

---

### 2g. Domain Map 领域地图

> 来源：`studio/changes/course-workshop/domain-map.md`

#### 插件候选

| Plugin | Domain | Role | Description | Dependencies | Priority |
|--------|--------|------|-------------|-------------|----------|
| workshop-core | 工作台管理 | core | 课研工作区初始化、状态管理、预案归档 | — | 1 |
| workshop-pbl | 问题设计 + 活动设计 | core | 驱动性问题生成、网络图构建、探究线索拆分、活动序列编排、预案文档生成 | workshop-core | 2 |
| workshop-insight | 主题分析 + 标准制定 | add-on | 主题教育价值分析、先前经验评估、4C能力映射、学习目标生成 | — | 3 |
| workshop-quality | 质量保障 | add-on | 课标覆盖度检查、年龄适配检查、4C映射验证、预案完整性审核 | — | 4 |
| workshop-resource | 资源管理 | add-on | 资源自动匹配(PBL Box/足迹袋/自备)、资源完整性校验 | workshop-core | 5 |

#### 通用能力（不建插件）
- **双语翻译** → Claude 内置翻译能力
- **文档排版** → Markdown → PDF 通用工具
- **文本润色** → Claude 内置写作能力

#### 集合架构 — Core + Add-ons

```
course-workshop-plugins/               ← marketplace collection
├── workshop-core/                     ← 工作台管理 (zero deps)
│   └── skills: init, status, promote
├── workshop-pbl/                 ← 课程设计流水线 (depends: core)
│   ├── skills: driving-question, network-map, inquiry-scaffold,
│   │          activity-design, proposal-generate
│   ├── agents: 课程专家, 心理学家, 教学设计师
│   └── references: pbl-methodology-guide, activity-coding-spec
├── workshop-insight/                  ← 前期分析 (zero deps)
│   ├── skills: theme-analysis, prior-knowledge, competency-mapping
│   └── references: guidelines-3-6, 4c-framework
├── workshop-quality/                  ← 质量保障 (zero deps)
│   ├── skills: standards-check, proposal-review
│   └── references: guidelines-3-6, age-ability-matrix
└── workshop-resource/                 ← 资源管理 (depends: core)
    ├── skills: resource-planner, resource-check
    └── references: pbl-box-catalog, resource-categories
```

#### 依赖图

```
workshop-core (zero deps)
    ↑
    ├── workshop-pbl (depends: core)
    └── workshop-resource (depends: core)

workshop-insight  (zero deps)
workshop-quality  (zero deps)
```

#### 设计流水线（workshop-pbl）

```
driving-question → network-map → inquiry-scaffold → activity-design × 3 → proposal-generate
      ↑                                                      ↑
  (workshop-insight                                  (workshop-resource
   提供主题分析和标准)                                  提供资源匹配)
```

---

## 4. Phase 3：技能设计 (Skill Design)

### workshop-core — 工作区管理（3 skills）

> 来源：`studio/changes/workshop-core/brief.md` + `skill-map.md`

**业务目标**：新项目 30 秒内完成工作区初始化，课研主任一眼看到所有在研预案的进度。

| Skill | Description | Inputs | Outputs | Complexity |
|-------|-------------|--------|---------|------------|
| **init** | 初始化课研工作区 | (none) | studio/ 目录结构 | Simple |
| **status** | 查看所有在研预案状态 | status.json files | Terminal summary | Simple |
| **promote** | 归档已完成预案 | plugin name | Files archived | Simple |

```
[init] → creates workspace
[status] → reads workspace (independent)
[promote] → moves workspace to archive
```

---

### workshop-pbl — 课程设计流水线（5 skills）

> 来源：`studio/changes/workshop-pbl/brief.md` + `skill-map.md`

**业务目标**：驱动问题设计从 3-5 轮降至 1-2 轮，活动设计时间从 70% 占比降至 40% 以下。

| Skill | Description | Inputs | Outputs | Complexity | Agent |
|-------|-------------|--------|---------|------------|-------|
| **driving-question** | 驱动性问题生成 + 开放性验证 | 主题, 年龄段 | driving-question.md | Simple | 课程专家 |
| **network-map** | 主题网络图构建 | driving-question.md | network-map.md | Simple | — |
| **inquiry-scaffold** | 3 条递进探究线索拆分 | driving-question + network-map | inquiry-clues.md | Simple | 课程专家 + 心理学家 |
| **activity-design** | 活动序列编排（每条线索） | inquiry-clues.md, 年龄段 | activities/clue-{N}.md | Moderate | 教学设计师 + 心理学家 |
| **proposal-generate** | 预案文档组装（华美5段式） | 所有前序产出 | proposal.md | Moderate | — |

**数据流（串行流水线）：**

```
[driving-question] → driving-question.md
    ▼
[network-map] → network-map.md
    ▼
[inquiry-scaffold] → inquiry-clues.md
    ▼
[activity-design] ×3 → activities/clue-1.md, clue-2.md, clue-3.md
    ▼
[proposal-generate] → proposal.md
    ├── optional ← workshop-insight
    └── optional ← workshop-resource
```

---

### workshop-insight — 前期分析（3 skills）

> 来源：`studio/changes/workshop-insight/brief.md` + `skill-map.md`

**业务目标**：4C 映射有标准化参照，学习目标动词自动匹配年龄段，前期准备从 2 天降至 30 分钟。

| Skill | Description | Inputs | Outputs | Complexity | Agent |
|-------|-------------|--------|---------|------------|-------|
| **theme-analysis** | 主题教育价值分析 + 课标对齐 | 主题, 年龄段 | theme-analysis.md | Simple | 课程专家 |
| **prior-knowledge** | 儿童先前经验评估（认知/技能/情感） | 主题, 年龄段 | prior-knowledge.md | Simple | 心理学家 |
| **competency-mapping** | 4C 能力映射 + 学习目标生成 | 主题, 年龄段 | competency-mapping.md | Simple | 心理学家 |

**数据流**：theme-analysis 和 prior-knowledge **可并行**，competency-mapping 可选依赖前两者。

---

### workshop-quality — 质量保障（2 skills）

> 来源：`studio/changes/workshop-quality/brief.md` + `skill-map.md`

**业务目标**：自动检查覆盖 8+ 条质量规则，园长审批前置检查通过率提升至 90%+。

| Skill | Description | Inputs | Outputs | Complexity | Agent |
|-------|-------------|--------|---------|------------|-------|
| **standards-check** | 自动规则检查（7 项） | proposal.md 或 artifacts | quality-report.md | Moderate | 年龄适配 |
| **proposal-review** | 多专家并行评审 | proposal.md | review-comments.md | Moderate | 3 专家并行 |

**standards-check 检查项：**
1. 课标覆盖度（五大领域至少覆盖 3 个）
2. 学习目标动词适切性（年龄段×动词矩阵）
3. 4C 映射准确性
4. 活动时长合理性（20-30 分钟）
5. 探究线索递进性
6. 活动编码连续性（PBL-C{x}-{y} 无跳号）
7. 资源清单完整性

---

### workshop-resource — 资源管理（2 skills）

> 来源：`studio/changes/workshop-resource/brief.md` + `skill-map.md`

**业务目标**：资源遗漏率从 20%+ 降至 5% 以下，PBL Box 订单汇总自动生成。

| Skill | Description | Inputs | Outputs | Complexity |
|-------|-------------|--------|---------|------------|
| **resource-planner** | 资源匹配 + 分类 + 数量估算 | activities/*.md | resource-plan.md | Simple |
| **resource-check** | 完整性校验 + PBL Box 可用性 | resource-plan.md | resource-check-report.md | Simple |

**resource-check 检查项：**
1. 每个活动至少 1 项资源
2. 资源分类正确（PBL Box 物料不应标为自备）
3. 数量是否标注（不允许"水果"）
4. PBL Box 物料是否在目录中

---

### workshop-5step — 五步法教案设计（4 skills）

> 来源：`studio/changes/workshop-5step/brief.md` + `skill-map.md`
> 迭代：Iteration 2 (2026-03-29)

**业务目标**：一线教师 20 分钟内完成教案设计，教学目标自动对标《指南》，每个环节有具体话术和分层指导。

| Skill | Description | Inputs | Outputs | Complexity | Agent |
|-------|-------------|--------|---------|------------|-------|
| **lesson-objective** | 三维度教学目标生成 + 《指南》对标 | 课题, 年龄段 | lesson-objective.md | Medium | 心理学家 + 课程专家 |
| **lesson-scaffold** | 五步教学环节设计 + 时间分配 | lesson-objective.md | lesson-scaffold.md | Medium | 教学设计师 + 课程专家 |
| **lesson-detail** | 教师话术 + 材料清单 + 分层指导 | lesson-scaffold.md | lesson-detail.md | High | 教学设计师 + 心理学家 |
| **lesson-generate** | 标准教案文档编译 | 所有前序产出 | lesson-plan.md | Simple | — |

**数据流（串行流水线）：**

```
[lesson-objective] → lesson-objective.md
    ▼
[lesson-scaffold] → lesson-scaffold.md
    ▼
[lesson-detail] → lesson-detail.md
    ▼
[lesson-generate] → lesson-plan.md
    ├── optional ← workshop-kb (历年教案参考)
    └── optional ← workshop-quality (质量检查)
```

---

### workshop-planner — 课程规划（3 skills）

> 来源：`studio/changes/workshop-planner/brief.md` + `skill-map.md`
> 迭代：Iteration 2 (2026-03-29)

**业务目标**：学期规划覆盖所有月份且领域均衡，月度计划与学期主题对齐，周计划包含每日活动安排。

| Skill | Description | Inputs | Outputs | Complexity | Agent |
|-------|-------------|--------|---------|------------|-------|
| **semester-plan** | 学期主题日历 + 领域均衡 | 学期, 年龄段 | semester-plan.md | High | 课程专家 + 心理学家 |
| **month-plan** | 月度子主题拆分 + 每日活动 | semester-plan.md, 月份 | month-plan.md | Medium | 课程专家 |
| **week-plan** | 周日程表 + 教师分工 | month-plan.md, 周次 | week-plan.md | Medium | — |

**数据流：**

```
[semester-plan] → semester-plan.md
    ▼
[month-plan] → month-plan.md
    ▼
[week-plan] → week-plan.md
    └── feeds into → workshop-5step or workshop-pbl
```

---

### workshop-kb — 知识库管理（3 skills）

> 来源：`studio/changes/workshop-kb/brief.md` + `skill-map.md`
> 迭代：Iteration 2 (2026-03-29)

**业务目标**：教师能快速导入已有教案和教材，其他插件设计时能自动引用本校历史资料。

| Skill | Description | Inputs | Outputs | Complexity |
|-------|-------------|--------|---------|------------|
| **kb-import** | 文档导入 + 元数据提取 | 文件路径 | .workshop/kb/{category}/*.md | Medium |
| **kb-index** | 知识库索引构建/刷新 | .workshop/kb/**/*.md | .workshop/kb/index.yaml | Medium |
| **kb-query** | 知识库检索 | 查询条件 | 匹配文档列表 | Simple |

**数据流：**

```
[kb-import] → .workshop/kb/ documents
    ▼
[kb-index] → .workshop/kb/index.yaml
    ▼
[kb-query] → search results
    └── consumed by → workshop-5step, workshop-pbl, workshop-planner
```

---

### workshop-pipelines — 方法论管线（2 skills）

> 来源：`studio/changes/workshop-pipelines/brief.md` + `skill-map.md`
> 迭代：Iteration 2 (2026-03-29)

**业务目标**：支持多种教学方法论（PBL、五步法等），切换模板后设计流水线自动适配。

| Skill | Description | Inputs | Outputs | Complexity |
|-------|-------------|--------|---------|------------|
| **pipeline-list** | 列出所有可用管线 | (none) | Terminal summary | Simple |
| **pipeline-select** | 激活管线到工作区 | pipeline ID | config.yaml updated | Simple |

**内置模板：**
- `pbl-huamei` — 华美 PBL 五步路径图（workshop-pbl 使用）
- `five-step` — 五步法教学（workshop-5step 使用）

---

## 5. Phase 4：规格生成 (Spec Generate)

Phase 4 根据 skill-map 自动生成了以下文件：

### 生成的 SKILL.md 规格文件（27 个）

| Plugin | Skill | 路径 |
|--------|-------|------|
| workshop-core | init | `skills/init/SKILL.md` |
| workshop-core | status | `skills/status/SKILL.md` |
| workshop-core | promote | `skills/promote/SKILL.md` |
| workshop-pbl | driving-question | `skills/driving-question/SKILL.md` |
| workshop-pbl | network-map | `skills/network-map/SKILL.md` |
| workshop-pbl | inquiry-scaffold | `skills/inquiry-scaffold/SKILL.md` |
| workshop-pbl | activity-design | `skills/activity-design/SKILL.md` |
| workshop-pbl | proposal-generate | `skills/proposal-generate/SKILL.md` |
| workshop-insight | theme-analysis | `skills/theme-analysis/SKILL.md` |
| workshop-insight | prior-knowledge | `skills/prior-knowledge/SKILL.md` |
| workshop-insight | competency-mapping | `skills/competency-mapping/SKILL.md` |
| workshop-quality | standards-check | `skills/standards-check/SKILL.md` |
| workshop-quality | proposal-review | `skills/proposal-review/SKILL.md` |
| workshop-resource | resource-planner | `skills/resource-planner/SKILL.md` |
| workshop-resource | resource-check | `skills/resource-check/SKILL.md` |
| workshop-5step | lesson-objective | `skills/lesson-objective/SKILL.md` |
| workshop-5step | lesson-scaffold | `skills/lesson-scaffold/SKILL.md` |
| workshop-5step | lesson-detail | `skills/lesson-detail/SKILL.md` |
| workshop-5step | lesson-generate | `skills/lesson-generate/SKILL.md` |
| workshop-planner | semester-plan | `skills/semester-plan/SKILL.md` |
| workshop-planner | month-plan | `skills/month-plan/SKILL.md` |
| workshop-planner | week-plan | `skills/week-plan/SKILL.md` |
| workshop-kb | kb-import | `skills/kb-import/SKILL.md` |
| workshop-kb | kb-index | `skills/kb-index/SKILL.md` |
| workshop-kb | kb-query | `skills/kb-query/SKILL.md` |
| workshop-pipelines | pipeline-list | `skills/pipeline-list/SKILL.md` |
| workshop-pipelines | pipeline-select | `skills/pipeline-select/SKILL.md` |

### 生成的 plugin.json.draft（9 个）

每个插件生成了 `plugin.json.draft` 包含 name, version, description, keywords, dependencies, skills, commands 字段。

### 生成的 Reference 知识文件（18 个）

| Plugin | Reference | 内容 |
|--------|-----------|------|
| workshop-pbl | pbl-methodology-guide.md | 华美 PBL 五步路径图、三阶段九要素、驱动问题六原则 |
| workshop-pbl | activity-coding-spec.md | PBL-C{x}-{y} 活动编码规范 |
| workshop-insight | guidelines-3-6.md | 《3-6岁儿童学习与发展指南》摘要 |
| workshop-insight | 4c-framework.md | 4C 能力框架（年龄段×能力矩阵） |
| workshop-quality | age-ability-matrix.md | 年龄段×能力适切性矩阵 |
| workshop-resource | pbl-box-catalog.md | PBL Box 可供应物料目录 |
| workshop-resource | resource-categories.md | 资源四分类规则 |
| workshop-5step | guidelines-3-6.md | 《指南》五大领域摘要（lesson 副本） |
| workshop-pipelines | five-step/methodology-guide.md | 五步法方法论指南 |
| workshop-pipelines | five-step/coding-spec.md | FS-Sx-yy 编码规范 |
| workshop-pipelines | five-step/output-format.md | 五步法教案输出格式 |
| workshop-pipelines | pbl-huamei/methodology-guide.md | PBL 华美方法论指南 |
| workshop-pipelines | pbl-huamei/coding-spec.md | PBL 编码规范 |
| workshop-pipelines | pbl-huamei/output-format.md | PBL 预案输出格式 |
| workshop-pipelines | pipeline-schema.md | 管线结构定义 |
| workshop-planner | semester-calendar-template.md | 学期日历模板 |
| workshop-planner | weekly-schedule-template.md | 周日程模板 |
| workshop-kb | kb-schema.md | 知识库文档结构定义 |

### 生成的 Command 文件（30 个）

每个 skill 对应一个 command 文件，映射 `/plugin:skill-name` 命令到对应的 SKILL.md。

---

## 6. 领域专家定义

> 来源：`studio/agents/`

### 儿童发展心理学家 (Child Development Psychologist)

**领域**：0-8 岁儿童认知、社会情感和身体发展。熟悉 Piaget 前运算阶段、Vygotsky 社会建构主义、Gardner 多元智能。

**核心贡献**：
- 4C 技能在早期幼儿阶段的适龄定义
- 先前经验评估方法（观察、绘画、对话）
- 发展适宜的学习目标编写
- 年幼学习者的情绪曲线（注意力跨度、挫折耐受）

**质量标准**：
- 学习目标必须使用年龄适切动词：认识/感受/尝试/体验（非分析/评估/设计）
- 4C 映射必须现实 — 并非每个活动都发展所有 4 种技能
- 活动应为同一教室中不同发展水平的儿童提供多种进入点

**输出格式**：发展适宜性检查、4C 验证、先前经验基线

---

### 幼儿教育课程专家 (Early Childhood Curriculum Expert)

**领域**：2-6 岁学前课程设计，精通 PBL。熟悉中国《指南》、IB PYP、HighScope、Reggio Emilia。

**核心贡献**：
- 三阶段九要素 PBL 框架
- 有效驱动问题的设计方法
- 主题网络图构建
- 探究线索支架设计
- 年龄段区分（PreK-3 vs PreK-4 vs K）

**质量标准**：
- 每个活动必须与驱动问题连接 — 无孤立活动
- 学习目标必须是可观察、可衡量的
- 3 条探究线索必须有清晰的递进
- 资源清单必须区分 PBL Box、探索足迹袋和自备材料

**输出格式**：课程对齐检查、PBL 方法论检查、年龄适宜性评估

---

### 教学设计师 (Instructional Designer)

**领域**：学习体验设计，专注早期幼儿探究式和项目式课程。精通逆向设计(UbD)、支架设计、形成性评价、课堂资源规划。

**核心贡献**：
- 逆向设计：学习目标 → 评估证据 → 活动规划
- 活动排序：热身 → 探索 → 引导练习 → 反思
- 早期幼儿 PBL 资源分类法（PBL Box / 足迹袋 / 自备 / 多媒体）
- 活动编码规范：`PBL-C{线索}-{序号}`
- 时间预算：每个活动 = 1 课时(20-30min)，每条线索 = 3-5 天

**质量标准**：
- 每个活动必须包含：关键问题、活动名称（编码）、内容（编号步骤）、资源（分类）
- 资源清单必须完整分类 — 无"等"或"各种材料"
- 教师提示应覆盖最常见的失败模式
- 3 条线索应有大致均衡的时长

**输出格式**：可行性检查、资源审计、序列验证

---

> 本文档由 Astra Studio 规划流水线生成。迭代一(2026-03-28)完成 5 插件/15 技能的基础架构；迭代二(2026-03-29)扩展至 9 插件/27 技能，新增五步法教案、课程规划、知识库和模板管理能力。
