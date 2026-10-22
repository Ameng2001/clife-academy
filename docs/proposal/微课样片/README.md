# 微课样片 · 第 6 关「全日观察与疾病登记」

验证「逐字稿 → 白板微课」这条流水线是否能跑通、每关要多少工时。2026-10-17 做。

## 产物

| 文件 | 说明 |
|---|---|
| `第6关-全日观察与疾病登记/第6关-全日观察与疾病登记-白板微课.mp4` | 成片，1920×1080，1 分 21 秒，含旁白与字幕 |
| `第6关-全日观察与疾病登记/逐字稿.md` | 四幕 16 句，一句一条字幕 |
| `第6关-全日观察与疾病登记/第6关-字幕.srt` | 由旁白音频反推的字幕时间轴 |
| `第6关-全日观察与疾病登记/scenes/` | 四幕线稿 PNG ＋ 同名 annotation.json（白板动画 Skill 的输入） |
| `tools/build_scenes.py` | 画线稿、按字幕时间轴生成标注；改画面改这里 |

## 流水线（实测）

1. **逐字稿**：按「一幕一意、一句一条字幕」写，四幕 16 句。
2. **旁白与字幕**：macOS `say -v Tingting -r 178` 逐句合成，ffprobe 取时长，句间留 0.7 秒给画笔，幕间留 1.7 秒；由此生成 SRT 与整条旁白 WAV。样片用的是系统语音，正式版换配音或商用 TTS，流程不变。
3. **线稿**：`build_scenes.py` 用 PIL 画，按 Skill 的视觉规范（1672×941、#F5EBD7 纸底、深灰线、红橙蓝点缀、画面无文字）。每条字幕对应一个元素，脚本记录元素包围盒直接写成标注的 `region`，`startMs` 对齐该句字幕。
4. **渲染**：`srt-whiteboard-animation`（geeklee，MIT）的 `render_stream_whiteboard.py`，`--ink-path skeleton --cap-long-edge 1920 --fps 30`，四幕共 127 秒；`merge_scenes.py` 无损拼接。
5. **合成**：ffmpeg 混入旁白；本机 ffmpeg 无 libass，字幕用 PIL（冬青黑体 44 像素、白底圆角条）逐条画成透明 PNG，按 SRT 时间轴 overlay 叠加。

Skill 与它的 venv 放在会话临时目录（`scratchpad/wbskill/`），不进仓库。重跑要重新下载：`curl` 逐文件取 `raw.githubusercontent.com/geeklee/srt-whiteboard-animation/main/{SKILL.md,scripts/*.py,assets/drawing-hand.png}`，`prepare_env.py` 建 venv 后装 `opencv-python-headless numpy Pillow`（PyPI 的 `opencv-python` 本次下载失败，headless 版渲染功能相同）。

## 两处改动

- Skill 自带的 `drawing-hand.png` 笔杆上印着作者标识，按 Skill 自己的规范「未经说明按无文字画面处理」，用 OpenCV inpaint 抹掉后另存为 `drawing-hand-clean.png` 使用。
- Skill 规定线稿由 AI 生图模型生成，样片改为脚本绘制：元素位置可控、标注无需人工框选，而且画风能跨关卡保持一致。代价是画面更简，没有生图那种插画感。

## 工时结论

| 环节 | 样片实际 | 方案估计 |
|---|---|---|
| 逐字稿 | 约 0.3 小时 | 0.5 人日（含审定） |
| 旁白、字幕 | 脚本自动，分钟级 | 计入上一行 |
| 线稿与标注 | 约 1.5 小时（含画风调试） | 0.5 人日 |
| 渲染合成 | 机器 4 分钟 | 计入上一行 |

熟手按本样片的脚本改画面，一关线稿约 1 小时。方案里「每关 1.5 人日」的估计偏保守，成立。瓶颈在线稿：每关要画 12—16 个元素，画风要统一；可把常用元素（人、记录卡、时间轴、看板、体温计）做成元件库，后续关卡复用。

## 合规

画面不出现幼儿面部，只有成人保健医与园长的简笔人形；旁白与字幕里没有真实园所、幼儿姓名。
