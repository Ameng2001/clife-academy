---
name: share
description: Share a course that has been used in class to 幼师学坊 (the teacher-development platform) as a 课程成果. Use when a teacher wants to publish, share, or submit a finished course to 幼师学坊 / the academy. Pre-fills title, pipeline, age group, weeks, domains, summary and files; the teacher must write "what I changed on the draft" themselves.
allowed-tools: Read, Write, Bash, Glob
user-invocable: true
---

# 分享到幼师学坊

一门课在班里用过以后，教师把它作为**课程成果**分享到幼师学坊（契约：幼师学坊仓库 `docs/WORKSHOP-SHARE.md`；工坊侧设计：`docs/design/教研工坊-分享到幼师学坊.md`）。工坊起草不算成果，用过并改过才算。

脚本：`python3 workshop-core/scripts/share_academy.py`（`prepare` / `submit` / `message` / `state`）。

## 前提

1. 项目工作区：`$ARGUMENTS` 是项目名。空的就列 `.workshop/projects/` 与 `.workshop/archive/` 里 phase 为 `approved` / `shipped` 的项目，只有一个就用它，多个问教师。
2. **用过再分享**。运行 `state`：`shareable` 为 false 就把 `why` 原样告诉教师，停。教师说「已经在班里用过了」就在 `status.json` 加 `"used_in_class": true` 再继续。
3. **令牌**。`.workshop/config.yaml` 的 `academy.url` 与 `academy.token`（或环境变量 `ACADEMY_URL` / `ACADEMY_TOKEN`）。没有令牌就给教师这一步说明，停：

   > 到幼师学坊 **设置 → 接口令牌 → 新建一枚投稿令牌**，标签写「教研工坊」，把 `cla_` 开头的令牌粘到 `.workshop/config.yaml` 的 `academy.token`。令牌只显示一次。

   不替教师建学坊账号，不替教师粘令牌到别处。

## 四栏表

运行 `prepare {project}`，把 `prefill` 按下面四栏展示给教师：

1. **标题、管线、年龄班、周数、领域** —— 预填，教师可改。管线：`theme` 主题式 / `pbl` 项目式 / `activity` 单节活动；领域至少一个（`lang` 语言 / `social` 社会 / `health` 健康 / `art` 艺术 / `sci` 科学）。
2. **简介**（≥ 50 字）—— 预填自 brief.md 的「主题由来」或项目导览第一段，教师可改。`summaryOk` 为 false 就请教师补到 50 字以上：主题怎么来的、几周、每周做什么、班里用下来怎样。
3. **文件** —— `prefill.files` 列出工作区里的产物，每个要一个**可长期访问的 https 下载地址**（学坊不存文件，只存链接；没有地址的不带）。默认建议带网络图 / 预案与周计划，教案包太大默认不带。
4. **在起草稿上改了什么**（至少一条，每条 ≤ 120 字）—— **必须教师自己说**。三个提示词帮教师起头：「幼儿应答」「材料」「环节数」，每个都是一句「把 ___ 改成 ___，因为 ___」。**不替教师写，不从课程的修改记录、评审意见、活动反思里摘。** 这一栏空的不交。

然后两个开关：

- 允许改编（默认开）：别的教师能点「改编这门课」，带来源链；关了只能看。
- 文件对谁可见（默认全平台 `all`）：`all` 全平台 / `community` 本共同体 / `org` 本园。简介与「改了什么」始终全平台可见。

## 提交

把教师确认后的表写成 JSON 文件（结构同 `prefill`，`files` 只留有 `url` 的，`changes` 是教师的原话），运行：

```bash
python3 workshop-core/scripts/share_academy.py submit {project} --body {json 文件}
```

- 成功：脚本把学坊给的 `work.id` 记到 `status.json` 的 `academy` 段，并打印 `academy.url`。告诉教师：「已分享 · 在幼师学坊里看：{url}」，以及现在是等园长同意（`consent`）还是等审核（`pending`）。
- 学坊退回后教师改了再交：直接再 `submit`，脚本自动带上同一个 `id`。想另起一条用 `--new`。
- `400 changes`：回到第四栏。`401`：令牌无效或已撤，回「前提」第 3 步。`403 scope`：令牌不是投稿令牌。

教师只想先落草稿、回学坊再补「改了什么」：`submit --draft`（不带 changes，学坊里显示为草稿，七天没动自动删）。

## 署名仪式（可跳过）

提交成功后问一句：「给同行留一句话？80 字内。不是评价、不是总结，是你对同行说的一句，比如『第二周换成本班儿歌以后，幼儿自己会唱着做了』。」教师给了就：

```bash
python3 workshop-core/scripts/share_academy.py message {project} --body {同一份 json} --message "{那句话}"
```

教师说跳过就跳过，不追问。

## 不做的

- 不替教师写「改了什么」。
- 不带工坊的课程评分、送审次数、评审意见。
- 不带幼儿姓名与正脸；教案里预设的幼儿应答是剧本，不算效果。
- 不自动把每门课都推到学坊：教师自己点，而且得先用过。
