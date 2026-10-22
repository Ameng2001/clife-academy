# Plugin Brief: workshop-resource

> Created: 2026-03-28

## Business Context

PBL 活动资源管理插件——自动匹配和校验每个活动所需的材料资源，按华美标准分类为 PBL Box（统一配送）、探索足迹袋（My Journal）、自备材料和多媒体资源。解决资源遗漏导致开课延误的问题。

## Plugin Candidates

2 个 skills：resource-planner（资源匹配+分类）、resource-check（完整性校验）

## Success Criteria

- 资源清单遗漏率从 20%+ 降至 5% 以下
- 每个活动的资源自动分类，无需手工标注
- PBL Box 订单汇总自动生成

## Notes

- 需要维护 PBL Box 物料目录作为 references
- 资源分类规则：PBL Box（供应商配送）、探索足迹袋（孩子个人材料包）、自备材料（教师本地准备）、多媒体（视频/歌曲）
- 依赖 workshop-core 的工作区
