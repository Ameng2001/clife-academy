---
name: semester-plan
description: Create a semester-level global theme calendar with monthly topic allocation, domain balance checking, and cross-month progression logic. Use at the start of a new semester, when a teacher needs to plan the whole term, or when someone says "help me plan next semester".
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Semester Plan

Generate a structured semester theme calendar that allocates monthly themes, balances learning domains, and establishes cross-month progression. This is a global planning asset that later project workspaces may reference.

## Expert Discovery

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-planner/agents/`
2. **Required expert**: Resolve `child-development-psychologist.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-planner/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Check `.workshop/kb/` for existing materials:
   - Glob `.workshop/kb/calendars/*.md` for past semester calendars
   - Glob `.workshop/kb/textbooks/*.md` for district textbook content
   - If found, read them as reference for theme selection
3. Read `.workshop/config.yaml` for default methodology

## Step 1: Gather Context

Ask the user for:

> **请提供以下信息：**
> 1. **学期**: 哪个学期？（如"2026 春季学期"、"2026 秋季学期"）
> 2. **年龄段**: 小班 (3-4岁) / 中班 (4-5岁) / 大班 (5-6岁)
> 3. **学期周数**: 通常 18-20 周（含开学适应周和期末总结周）
> 4. **园本特色**: 是否有特定的课程主题偏好？（如自然教育、国际理解、传统文化）
> 5. **已定主题**: 是否有学校已确定的月度主题？

If knowledge base has relevant calendars or textbooks, present them as reference:
> **📚 知识库参考**: 找到 {N} 个相关文档（往年日历/区编教材），已纳入参考。

## Step 2: Generate Theme Calendar

Based on the context, generate a semester theme calendar:

1. **Allocate 4-6 monthly themes** following seasonal/contextual logic
2. For each month:
   - Theme name (Chinese + English)
   - Recommended methodology (pbl-huamei or five-step, based on theme complexity)
   - Duration in weeks
   - Core learning domains (primary + secondary)
   - Theme keywords (5-8 per month)
3. **Reserve 1-2 buffer weeks** for adaptation and review

## Step 3: Domain Balance Check

Validate domain coverage across the semester:

| 检查项 | 标准 | 判定 |
|--------|------|------|
| 每个领域至少覆盖 2 个月 | 五大领域均出现 ≥2 次 | PASS/FAIL |
| 核心领域不重复堆积 | 同一领域不连续 3 个月为核心 | PASS/FAIL |
| 教学法交替 | PBL 和五步法至少各出现 2 次 | PASS/WARNING |

If any check fails, adjust the calendar and re-present.

## Step 4: Cross-Month Progression

For each adjacent month pair, describe:
- What experience from month N prepares children for month N+1
- Vocabulary/concept bridges between themes
- Skill progression across the semester (e.g., observation → comparison → classification)

## Step 5: Expert Review

Invoke curriculum expert to validate:
- Theme selection age-appropriateness
- Domain balance
- Alignment with 《指南》 semester expectations
- Seasonal relevance

## Step 6: User Confirmation

Present the complete semester calendar (following the format in `references/semester-calendar-template.md`).

Wait for user approval. If the user requests changes, adjust and re-present.

## Step 7: Write Output

Before writing the plan, initialize the planning workspace:

```bash
python3 workshop-core/scripts/runtime_setup.py prepare-plan \
  {workspace} \
  --plan-level semester
```

Write the approved calendar to `.workshop/plans/{workspace}/semester-plan.md`.

Treat this workspace as a shared planning record, not as the canonical home for project deliverables.

Update planning status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-planning \
  {workspace} \
  --plan-level semester
```

Suggest next steps:
> **下一步:**
> - `/workshop-planner:month-plan {月份}` — 将某个月展开为周计划
> - 基于某个月度主题创建 project workspace，再进入 `/workshop-pbl:design` 或 `/workshop-5step:lesson`

## Out of Scope

- This skill does NOT design individual lessons or PBL projects
- This skill does NOT modify the knowledge base
