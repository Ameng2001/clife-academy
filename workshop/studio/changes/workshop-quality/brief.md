# Plugin Brief: workshop-quality

> Created: 2026-03-28

## Business Context

PBL 预案质量保障插件——自动检查课标覆盖度、年龄适配性、4C映射准确性、活动设计规范等，并提供多角色专家评审。替代课研主任的人工逐条审核，标准化质量把关。

## Plugin Candidates

2 个 skills：standards-check（自动规则检查）、proposal-review（多专家评审）

## Success Criteria

- 自动检查覆盖 8+ 条质量规则
- 评审意见从碎片化微信群讨论变为结构化报告
- 园长审批前置检查通过率提升至 90%+

## Notes

- 需要内置《指南》课标数据和年龄×能力矩阵作为 references
- standards-check 只报告问题不做修改
- proposal-review 调用 3 个专家 agent 并行评审
