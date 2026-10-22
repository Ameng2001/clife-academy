# Plugin Brief: workshop-planner

> Created: 2026-03-29

## Business Context

分层课程规划插件——从学期主题日历到月度子主题再到每周日程表的三级规划。帮助课研主任系统地安排整学期的教学内容，确保领域均衡和主题渐进。

## Plugin Candidates

3 个 skills：semester-plan（学期主题日历）、month-plan（月度子主题拆分）、week-plan（周日程生成）

## Success Criteria

- 学期规划覆盖所有月份，领域均衡
- 月度计划与学期主题对齐
- 周计划包含每日活动安排和教师分工

## Notes

- 依赖 workshop-core（工作区管理）和 workshop-pipelines（方法论管线）
- 可引用 workshop-kb 中的历年学期日历作为参考
- 规划产出物存储在 studio/changes/{workspace}/ 中
