# Course Workshop Plugins

AI 驱动的幼儿园课程设计平台插件集合，面向课研主任、一线教师和客户交付团队。

它当前支持三类核心工作：

- `workshop-pbl`
  - 月度 PBL 预案
- `workshop-5step` + `workshop-activity`
  - 主题式课程中的教学活动、区域活动、户外游戏、生活渗透、家园互动
- `workshop-planner`
  - 学期 / 月 / 周规划

平台的主工作对象是 **project workspace**，运行时根目录是 `.workshop/`，不是 `studio/`。

## 插件组成

| 插件 | 职责 |
|------|------|
| `workshop-core` | `.workshop/` 初始化、状态、审批、发布；`share` 把用过的课分享到幼师学坊 |
| `workshop-pipelines` | 方法论 pipeline 选择 |
| `workshop-insight` | 主题分析、主题解读、主题网络 |
| `workshop-pbl` | PBL 预案设计 |
| `workshop-5step` | 五步法教学活动稿 |
| `workshop-activity` | 区域 / 户外 / 生活 / 家园活动稿 |
| `workshop-planner` | 学期 / 月 / 周规划 |
| `workshop-quality` | 质量检查与评审 |
| `workshop-resource` | 资源规划与核验 |
| `workshop-kb` | 校本知识库 |
| `workshop-format` | 格式整理与导出包准备 |

## 3 步开始

1. 初始化运行时

```bash
/workshop-core:init
```

2. 查看推荐入口

```bash
/workshop-core:onboarding
```

3. 选择一条主路径

- PBL 预案
  - `/workshop-pipelines:pipeline-select pbl-huamei`
- 五步法教学活动
  - `/workshop-pipelines:pipeline-select five-step`
- 主题式课程包
  - `/workshop-pipelines:pipeline-select thematic-curriculum`

## 文档入口

- [docs/index.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/index.md)
  - 完整文档导航
- [docs/product/whitepaper.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/product/whitepaper.md)
  - 产品全景
- [docs/product/how-it-works.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/product/how-it-works.md)
  - 用户视角工作机理
- [docs/architecture/runtime-architecture.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/architecture/runtime-architecture.md)
  - 当前生效的运行时规范
- [docs/architecture/execution-model.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/architecture/execution-model.md)
  - experts / roles / scripts / skills 边界

## 仓库结构

```text
workshop-*/              # 插件实现
.workshop/               # 课程运行时
courses/                 # 最终 release bundles
experts/                 # 共享领域专家
studio/                  # Astra Studio 插件研发目录
docs/                    # 产品、架构、交付、示例与历史文档
```

## 开发说明

本仓库基于开放的 `SKILL.md` 插件规范构建，并使用 [Astra Studio](https://github.com/VanLengs/astra-studio-plugins) 工具链开发。

## 许可证

Apache-2.0
