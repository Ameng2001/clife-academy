# Plugin Brief: workshop-pipelines

> Created: 2026-03-29

## Business Context

教学法管线注册中心——管理可插拔的教学方法论管线（PBL、五步法等），每条管线定义自己的设计流水线、编码规范和输出格式。使系统支持多种教学方法论而无需修改核心插件。

## Plugin Candidates

2 个 skills：pipeline-list（列出可用管线）、pipeline-select（选择/切换管线）

## Success Criteria

- 教师能快速查看支持的教学方法论
- 切换管线后，整个设计流水线自动适配
- 新管线可通过添加目录扩展，无需修改代码

## Notes

- 管线存储在 references/templates/{pipeline-id}/ 下
- 每条管线包含 manifest.yaml、methodology-guide.md、coding-spec.md、output-format.md
- 当前内置管线：pbl-huamei（华美 PBL）、five-step（五步法）
- 被 workshop-pbl、workshop-5step 引用
