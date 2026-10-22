#!/usr/bin/env python3
"""分享到幼师学坊（docs/design/教研工坊-分享到幼师学坊.md；契约在幼师学坊仓库 docs/WORKSHOP-SHARE.md）。

一门课在班里用过以后，教师把它作为「课程成果」分享到幼师学坊。工坊这边做三件事：
  prepare  从 status.json / brief.md 预填标题、管线、年龄班、周数、领域、简介、文件，打印成 JSON 给 skill 展示；
  submit   教师补了「在起草稿上改了什么」与两个开关后，POST /api/works（或 --draft 走 /api/works/draft），
           把学坊给的 work.id 记回 status.json 的 academy 段；退回后再改再交带同一个 id；
  message  提交成功那一屏问的「给同行留一句话」，带 id 再交一次只改 message；
  state    看这门课分享到哪一步了。

不替教师写「改了什么」：这一栏空着 submit 直接拒绝（草稿除外）。不替教师建学坊账号：令牌是教师在学坊
「设置 → 接口令牌 → 新建一枚投稿令牌」建的，粘到 .workshop/config.yaml 的 academy.token（或环境变量 ACADEMY_TOKEN）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PIPELINE_OF_METHODOLOGY = {
    # 工坊方法论 → 学坊管线（theme 主题式 / pbl 项目式 / activity 单节活动）
    "pbl-huamei": "pbl",
    "pbl": "pbl",
    "thematic-curriculum": "theme",
    "five-step": "activity",
}
AGES = ("小班", "中班", "大班", "混龄")
DOMAIN_WORDS = {
    # 学坊五大领域 ← brief / status 里可能出现的写法
    "lang": ("语言", "lang", "language"),
    "social": ("社会", "social"),
    "health": ("健康", "health", "运动", "体育"),
    "art": ("艺术", "art", "美术", "音乐"),
    "sci": ("科学", "sci", "science", "数学", "探究"),
}
FILE_CANDIDATES = (
    ("proposal.md", "项目预案"),
    ("lesson-plan.md", "教学活动稿"),
    ("resource-plan.md", "资源准备说明"),
    ("network-map.md", "主题网络图"),
    ("week-plan.md", "周计划"),
)
SHAREABLE_PHASES = {"approved", "shipped"}


# ---------- 工作区 ----------

def root_dir() -> Path:
    return Path(os.environ.get("WORKSHOP_ROOT", ".")).resolve()


def workspace_dir(root: Path, name: str) -> Path:
    for base in ("projects", "archive"):
        d = root / ".workshop" / base / name
        if (d / "status.json").exists():
            return d
    # archive 目录是 {YYYY-MM-DD}-{name}
    archive = root / ".workshop" / "archive"
    if archive.exists():
        for d in sorted(archive.iterdir(), reverse=True):
            if d.is_dir() and d.name.endswith("-" + name) and (d / "status.json").exists():
                return d
    raise SystemExit(f"没有找到项目工作区 {name}（.workshop/projects/ 或 .workshop/archive/ 下）")


def load_json(p: Path) -> dict[str, Any]:
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def save_json(p: Path, data: dict[str, Any]) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_config(root: Path) -> dict[str, str]:
    """只读 academy: 段的两行（url / token），不依赖 yaml 库。环境变量 ACADEMY_URL / ACADEMY_TOKEN 优先。"""
    out = {"url": "", "token": ""}
    cfg = root / ".workshop" / "config.yaml"
    if cfg.exists():
        in_block = False
        for line in cfg.read_text(encoding="utf-8").splitlines():
            if re.match(r"^academy:\s*$", line):
                in_block = True
                continue
            if in_block:
                if line and not line.startswith(" "):
                    in_block = False
                    continue
                m = re.match(r"^\s+(url|token):\s*(.*?)\s*$", line)
                if m:
                    v = m.group(2).strip().strip('"').strip("'")
                    out[m.group(1)] = "" if v.startswith("#") else v.split(" #")[0].strip()
    if os.environ.get("ACADEMY_URL"):
        out["url"] = os.environ["ACADEMY_URL"]
    if os.environ.get("ACADEMY_TOKEN"):
        out["token"] = os.environ["ACADEMY_TOKEN"]
    out["url"] = out["url"].rstrip("/")
    return out


# ---------- 预填 ----------

def first_section(md: str, *titles: str) -> str:
    """取 brief.md 里某个标题下的第一段。"""
    lines = md.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("#") and any(t in line for t in titles):
            buf: list[str] = []
            for nxt in lines[i + 1:]:
                if nxt.startswith("#"):
                    break
                if nxt.strip():
                    buf.append(nxt.strip())
                elif buf:
                    break
            return " ".join(buf)
    return ""


def guess_age(text: str) -> str | None:
    for a in AGES:
        if a in text:
            return a
    return None


def guess_weeks(text: str, status: dict[str, Any]) -> int | None:
    for k in ("weeks", "duration_weeks"):
        v = status.get(k)
        if isinstance(v, int) and 1 <= v <= 20:
            return v
    m = re.search(r"(\d{1,2})\s*周", text)
    if m and 1 <= int(m.group(1)) <= 20:
        return int(m.group(1))
    return None


def guess_domains(text: str, status: dict[str, Any]) -> list[str]:
    found: list[str] = []
    listed = status.get("domains")
    if isinstance(listed, list):
        for item in listed:
            for key, words in DOMAIN_WORDS.items():
                if str(item).strip().lower() in [w.lower() for w in words] and key not in found:
                    found.append(key)
    if found:
        return found
    for key, words in DOMAIN_WORDS.items():
        if any(w in text for w in words):
            found.append(key)
    return found


def prepare(ws: Path, status: dict[str, Any]) -> dict[str, Any]:
    brief = (ws / "brief.md").read_text(encoding="utf-8") if (ws / "brief.md").exists() else ""
    text = brief + "\n" + json.dumps(status, ensure_ascii=False)
    methodology = status.get("methodology") or status.get("pipeline") or ""
    title = status.get("theme") or status.get("title") or status.get("name") or ws.name.split("-", 3)[-1]
    summary = first_section(brief, "主题由来", "项目导览", "课程简介", "背景", "简介", "Overview")
    files = [{"name": label, "path": str(ws / fn), "url": ""} for fn, label in FILE_CANDIDATES if (ws / fn).exists()]
    return {
        "title": title,
        "pipeline": PIPELINE_OF_METHODOLOGY.get(methodology, "theme"),
        "age": guess_age(text),
        "weeks": guess_weeks(text, status),
        "domains": guess_domains(text, status),
        "summary": summary,
        "summaryOk": len(summary) >= 50,
        "files": files,
        "changes": [],
        "message": "",
        "allowAdapt": True,
        "filesScope": "all",
        "source": {"courseId": status.get("course_id") or ws.name, "url": status.get("course_url") or ""},
    }


def shareable(status: dict[str, Any]) -> tuple[bool, str]:
    phase = status.get("phase")
    if phase in SHAREABLE_PHASES or status.get("used_in_class") is True:
        return True, ""
    return False, f"这门课还在「{phase or '未知'}」阶段。用过再分享：审核通过（approved / shipped），或教师自己标过已在班里用过（status.json 的 used_in_class: true）。"


# ---------- 调学坊 ----------

def call(cfg: dict[str, str], path: str, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    if not cfg["url"]:
        raise SystemExit("没有配幼师学坊地址：.workshop/config.yaml 的 academy.url，或环境变量 ACADEMY_URL")
    if not cfg["token"]:
        raise SystemExit("没有投稿令牌。到幼师学坊「设置 → 接口令牌 → 新建一枚投稿令牌」，标签写「教研工坊」，粘到 .workshop/config.yaml 的 academy.token（或环境变量 ACADEMY_TOKEN）。工坊不替教师建学坊账号。")
    req = urllib.request.Request(cfg["url"] + path, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + cfg["token"]})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {"error": str(e)}


def clean_body(body: dict[str, Any], draft: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in ("title", "pipeline", "age", "weeks", "domains", "summary", "message", "allowAdapt", "filesScope", "adaptedFrom"):
        if body.get(k) not in (None, "", []):
            out[k] = body[k]
    files = [{"name": f.get("name", ""), "url": f.get("url", "")} for f in body.get("files", []) if str(f.get("url", "")).startswith("https://")]
    if files:
        out["files"] = files
    src = body.get("source") or {}
    if src.get("courseId") or src.get("url"):
        out["source"] = {k: v for k, v in src.items() if v}
    changes = [str(c).strip()[:120] for c in body.get("changes", []) if str(c).strip()]
    if draft:
        # 草稿不带 changes：这一栏只能教师在学坊里写；带了学坊也会丢
        pass
    else:
        if not changes:
            raise SystemExit("「在起草稿上改了什么」是空的。至少一条，每条 ≤ 120 字，教师自己写；工坊不生成、不从修改记录里摘。")
        out["changes"] = changes
    return out


def record(status_path: Path, status: dict[str, Any], resp: dict[str, Any], cfg: dict[str, str], draft: bool) -> dict[str, Any]:
    work = resp.get("work") or {}
    entry = status.setdefault("academy", {})
    entry.update({
        "work_id": work.get("id"),
        "status": work.get("status"),
        "url": f"{cfg['url']}/#/works?tab=mine&id={work.get('id')}",
        "shared_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "draft": bool(draft),
    })
    save_json(status_path, status)
    return entry


# ---------- 命令 ----------

def cmd_prepare(args: argparse.Namespace) -> int:
    ws = workspace_dir(root_dir(), args.workspace)
    status = load_json(ws / "status.json")
    ok, why = shareable(status)
    out = {"workspace": str(ws), "shareable": ok, "why": why, "academy": status.get("academy"), "prefill": prepare(ws, status)}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


def cmd_submit(args: argparse.Namespace) -> int:
    root = root_dir()
    ws = workspace_dir(root, args.workspace)
    status_path = ws / "status.json"
    status = load_json(status_path)
    if not args.draft:
        ok, why = shareable(status)
        if not ok:
            raise SystemExit(why)
    body = json.loads(Path(args.body).read_text(encoding="utf-8"))
    payload = clean_body(body, args.draft)
    prev = (status.get("academy") or {}).get("work_id")
    if prev and not args.new:
        payload["id"] = prev
    cfg = read_config(root)
    code, resp = call(cfg, "/api/works/draft" if args.draft else "/api/works", payload)
    if code != 200:
        print(json.dumps({"ok": False, "status": code, "response": resp}, ensure_ascii=False, indent=2))
        return 1
    entry = record(status_path, status, resp, cfg, args.draft)
    print(json.dumps({"ok": True, "academy": entry, "next": resp.get("next") or ("已交，等园长同意" if entry["status"] == "consent" else "已交，等审核" if entry["status"] == "pending" else entry["status"])}, ensure_ascii=False, indent=2))
    return 0


def cmd_message(args: argparse.Namespace) -> int:
    root = root_dir()
    ws = workspace_dir(root, args.workspace)
    status_path = ws / "status.json"
    status = load_json(status_path)
    entry = status.get("academy") or {}
    if not entry.get("work_id"):
        raise SystemExit("还没分享过，先 submit。")
    if entry.get("status") == "approved":
        raise SystemExit("已经入库，不能再改。")
    body = json.loads(Path(args.body).read_text(encoding="utf-8"))
    payload = clean_body(body, False)
    payload["id"] = entry["work_id"]
    payload["message"] = (args.message or "").strip()[:80]
    cfg = read_config(root)
    code, resp = call(cfg, "/api/works", payload)
    if code != 200:
        print(json.dumps({"ok": False, "status": code, "response": resp}, ensure_ascii=False, indent=2))
        return 1
    record(status_path, status, resp, cfg, False)
    print(json.dumps({"ok": True, "message": payload["message"]}, ensure_ascii=False))
    return 0


def cmd_state(args: argparse.Namespace) -> int:
    ws = workspace_dir(root_dir(), args.workspace)
    status = load_json(ws / "status.json")
    ok, why = shareable(status)
    print(json.dumps({"workspace": str(ws), "phase": status.get("phase"), "shareable": ok, "why": why, "academy": status.get("academy")}, ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="分享到幼师学坊")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("prepare", help="预填四栏的前三栏，打印 JSON"); a.add_argument("workspace"); a.set_defaults(fn=cmd_prepare)
    a = sub.add_parser("submit", help="交到学坊（教师已补好「改了什么」）"); a.add_argument("workspace"); a.add_argument("--body", required=True, help="表单 JSON 文件")
    a.add_argument("--draft", action="store_true", help="落草稿（POST /api/works/draft），不带 changes"); a.add_argument("--new", action="store_true", help="不带上次的 id，另起一条"); a.set_defaults(fn=cmd_submit)
    a = sub.add_parser("message", help="署名仪式：给同行留一句话（≤ 80 字）"); a.add_argument("workspace"); a.add_argument("--body", required=True); a.add_argument("--message", required=True); a.set_defaults(fn=cmd_message)
    a = sub.add_parser("state", help="分享到哪一步了"); a.add_argument("workspace"); a.set_defaults(fn=cmd_state)
    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
