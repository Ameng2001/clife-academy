# Execution Model

这篇文档定义当前执行层的边界：

- 共享领域专家如何组织
- studio 角色和 runtime expert 如何区分
- script 和 skill 各自负责什么

它统一替代旧的分散文档：

- agent scope model
- skill script boundary

## 1. 核心原则

系统分两层：

- scripts 负责确定性运行机制
- skills 负责人类协作、课程判断和内容生成

一句话：

- 路径、状态、校验、发布 = scriptable
- 教学判断、内容设计、评审取舍 = flexible

## 2. experts 与 roles

### 2.1 `experts/`

这是共享领域专家的单一事实源。

适合放在这里的是可跨系统复用的领域专家，例如：

- `early-childhood-curriculum-expert.md`
- `child-development-psychologist.md`
- `instructional-designer.md`

### 2.2 `.workshop/agents/custom/`

这是运行时自定义覆盖层。

适合放在这里的是：

- 园所本地偏好
- 项目定制专家
- 对共享专家的覆盖版本

### 2.3 `workshop-*/agents/`

这是 plugin-local expert 层。

只在插件有明显专属逻辑时才应该使用，不应复制共享专家。

### 2.4 `studio/roles/`

这是 Astra Studio 的流程角色层，不属于课程运行时 expert。

适合放在这里的是：

- 产品经理
- 架构师
- plugin reviewer

## 3. runtime expert 加载顺序

课程运行时只按以下顺序加载 expert：

1. `.workshop/agents/custom/`
2. `experts/`
3. `当前插件/agents/`

如果同名，前者覆盖后者。

`studio/roles/` 不参与 runtime skill 扫描。

## 4. script 与 skill 的分工

### 4.1 应脚本化的部分

这些职责应尽量收敛到 helper / script：

- `.workshop/projects/{name}` / `.workshop/plans/{name}` 定位
- 最小目录与最小 `config.yaml`
- `status.json` 的标准字段写回
- `skills.*`
- `phase`
- `hil.*`
- `plan_refs`
- `linked_projects`
- 校验：
  - 输入文件是否存在
  - workspace 类型是否正确
  - phase 是否允许继续
  - deliverable 是否已具备
- `approve`
- `promote`
- `archive`
- status dashboard / structured summary

### 4.2 必须保留弹性的部分

这些不应写死在脚本里：

- 主题分析
- 先前经验判断
- 4C 或目标映射
- 驱动问题书写
- lesson 目标与环节设计
- 活动内容生成
- 专家评审判断
- 用户在多个可行方向之间的取舍

## 5. 插件级边界

| 插件 | 更适合脚本化 | 必须保留弹性 |
|------|------|------|
| `workshop-core` | init、config、onboarding summary、status、approve、promote | 结果解释、下一步引导 |
| `workshop-pipelines` | pipeline 选择写回、project 初始化、framing HIL 请求 | 推荐哪个 pipeline 更适合 |
| `workshop-planner` | planning 初始化、status 写回、linked project 更新 | 学期/月/周内容生成 |
| `workshop-insight` | 输入检查、status 写回 | 主题分析、主题解读、主题网络内容 |
| `workshop-pbl` | phase/HIL 推进、proposal 校验 | driving question、network、inquiry、proposal 内容 |
| `workshop-5step` | phase/HIL 推进 | objective、scaffold、detail、final wording |
| `workshop-quality` | review 结果写回、approval-gate 准备 | 评审意见与边界判断 |
| `workshop-resource` | 输出路径、核验结果写回 | 资源估算与替代判断 |
| `workshop-format` | 导出 bundle、manifest、target 选择 | 客户版式策略的高层设计 |

## 6. 反模式

以下做法应避免：

- 在很多 skill 里各自手写 `status.json`
- 在多个 skill 中重复实现 HIL 状态逻辑
- 把课程设计判断写死进脚本
- 让 `courses/` 变成完整工作区镜像
- 为每个 plugin 复制一份共享专家

## 7. 当前实现取向

当前仓库已经采用的方向是：

- `workshop-core` 先完成可执行脚本化
- 业务 skill 逐步把公共状态动作下沉到 helper
- runtime expert 与 studio role 已经分层
- 课程设计本身仍保留较高弹性

## 8. 当前生效结论

可以用一句话概括：

**execution model 的目标不是把课程设计变成硬编码流程，而是把确定性基础设施脚本化，把课程判断和人机协作保留在 skill 与 HIL 中。**
