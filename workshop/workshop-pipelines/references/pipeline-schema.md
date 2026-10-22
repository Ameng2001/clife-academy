# 教学法管线规范 / Pipeline Pack Schema

本文件定义教学法管线包的结构规范。每个管线包是一个目录，包含以下文件：

## 目录结构

```
templates/{pipeline-id}/
├── manifest.yaml          # 必需 — 管线元数据 + 流水线定义
├── methodology-guide.md   # 必需 — 方法论理论基础与操作指南
├── coding-spec.md         # 必需 — 活动/环节编码规范
└── output-format.md       # 必需 — 最终输出文档的节结构定义
```

## manifest.yaml 字段定义

```yaml
# === 基本信息 ===
id: string                    # 唯一标识，kebab-case（如 pbl-huamei, five-step）
name: string                  # 显示名称（如 "华美 PBL 五步法"）
name_en: string               # 英文名称
description: string           # 一句话描述
version: string               # 语义化版本号

# === 适用场景 ===
target_roles:                 # 目标用户角色（可多选）
  - curriculum-director       # 课研主任
  - classroom-teacher         # 一线教师
target_age_groups:            # 适用年龄段（可多选）
  - prek-3                    # 小班 (3-4岁)
  - prek-4                    # 中班 (4-5岁)
  - k                         # 大班 (5-6岁)
time_scope: string            # 时间跨度：lesson (单课时) | week (周) | month (月)

# === 设计流水线 ===
pipeline:
  plugin: string              # 对应的设计插件名（如 workshop-pbl, workshop-5step）
  stages:                     # 有序的设计阶段列表
    - id: string              # 阶段标识（对应插件中的技能名）
      name: string            # 阶段显示名称
      description: string     # 一句话描述
      optional: boolean       # 是否可跳过（默认 false）

# === 输出格式 ===
output:
  document_type: string       # 输出文档类型：proposal (预案) | lesson-plan (教案)
  sections:                   # 有序的输出节列表
    - id: string              # 节标识
      title: string           # 节标题（中文）
      title_en: string        # 节标题（英文）
      required: boolean       # 是否必需（默认 true）
      substeps: [string]      # 子步骤列表（可选，如五步法的导入/探究/总结/延伸）

# === 编码规范 ===
coding:
  prefix: string              # 编码前缀（如 PBL, FS）
  format: string              # 编码模式（如 "{prefix}-C{clue}-{seq}"）
  unit_name: string           # 分组单元名称（如 "探究线索" / "教学环节"）
  unit_count: integer         # 分组单元数量（如 PBL 3条线索，五步法 4个环节）
  unit_labels: [string]       # 各单元标签（如 ["线索一", "线索二", "线索三"]）
```

## 管线包的使用方式

1. **选择 pipeline**：`/workshop-pipelines:pipeline-select {id}` 将 pipeline ID 写入工作区 config
2. **读取管线**：下游技能在 Pre-check 阶段读取 `.workshop/projects/{workspace}/config.yaml` 中的 `methodology` 字段
3. **加载规则**：技能根据 `methodology` 值定位 `references/templates/{id}/` 目录，读取对应的 pipeline 指南和编码规范
4. **路由设计**：`pipeline.plugin` 字段告诉系统应该调用哪个插件的设计流水线

## 扩展新管线

添加新教学法只需：
1. 在 `references/templates/` 下创建新目录
2. 编写 manifest.yaml + 3 个配套文件
3. 无需修改任何技能代码 — 技能通过读取管线动态适配
