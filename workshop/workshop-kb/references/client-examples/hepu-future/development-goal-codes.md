---
title: "禾璞未来：发展目标编码参考"
category: lesson-plan
source_file: "/Users/liuyameng/Desktop/教案参考模板.pdf"
import_date: "2026-03-30"
themes: ["多样的服饰"]
age_groups: ["prek-4"]
domains: ["健康", "语言", "社会", "科学", "艺术"]
methodology: "thematic-curriculum"
tags: ["client-sample", "goal-codes", "hepu-future"]
local_goal_system: "HEPU-SE"
goal_codes: ["SE-4", "SE-8"]
---

# 禾璞未来发展目标编码参考

## 用途

用于说明客户在教学活动模板中出现的本地发展目标编码应如何接入平台。

## 当前已知规则

- 客户会在单次教学活动稿中显式给出 `SE-*` 形式的目标编码
- 这些编码属于客户本地发展目标体系
- 它们应作为**并列字段**保留，而不是替换平台的活动编码或《指南》映射

## 平台接入原则

1. **活动编码**仍使用平台编码
   - 例如 `FS-S2-01`
   - 或 `TC-TA-W2-01`

2. **客户发展目标编码**作为单独字段记录
   - 例如：
     - `SE-4`
     - `SE-8`

3. **《指南》映射**继续保留
   - 客户编码不替代《3-6 岁儿童学习与发展指南》对齐关系

## 推荐字段

在教学活动或主题活动稿中，优先使用：

- `local_goal_system`: `HEPU-SE`
- `goal_codes`:
  - `SE-4`
  - `SE-8`

在面向教师阅读的正文中，优先展示为：

```markdown
## 核心发展目标
- SE-4: ...
- SE-8: ...
```

## 未决事项

- `SE-*` 各编码的完整官方释义尚未从客户材料中完全提取
- 当前阶段先支持“编码保留 + 文本说明 + 与《指南》并列”
- 后续如客户提供完整编码手册，可继续补为正式映射表
