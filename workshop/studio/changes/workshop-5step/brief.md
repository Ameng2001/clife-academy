# Plugin Brief: workshop-5step

> Created: 2026-03-29

## Business Context

五步法教案设计插件——帮助一线教师从教学目标到完整教案的全流程设计。以《指南》为标准，按五步教学法（导入→探究→操作→总结→延伸）结构化输出课堂教案。

## Plugin Candidates

4 个 skills：lesson-objective（教学目标生成）、lesson-scaffold（五步环节设计）、lesson-detail（详细话术与材料）、lesson-generate（教案编译输出）

## Success Criteria

- 一线教师 20 分钟内完成一节课教案设计
- 教案自动对标《3-6岁儿童学习与发展指南》
- 每个环节有具体话术和分层指导

## Notes

- 依赖 workshop-core（工作区管理）和 workshop-pipelines（五步法管线）
- 五步法管线定义在 workshop-pipelines/references/templates/five-step/
- 与 workshop-pbl 的 PBL 流水线互补，面向不同教学方法论
