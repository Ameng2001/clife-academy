#!/usr/bin/env python3
"""Formatting and export helpers for course-workshop-plugins."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def runtime_dir(root: Path) -> Path:
    return root / ".workshop"


def find_root(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if runtime_dir(root).is_dir():
            return root
        raise SystemExit(f".workshop/ not found under: {root}")
    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        if runtime_dir(candidate).is_dir():
            return candidate
    raise SystemExit("Could not find project root containing .workshop/")


def project_dir(root: Path, name: str) -> Path:
    return runtime_dir(root) / "projects" / name


def archive_match(root: Path, name: str) -> Path | None:
    archive_root = runtime_dir(root) / "archive"
    if not archive_root.exists():
        return None
    exact = archive_root / name
    if exact.exists():
        return exact
    matches = sorted(
        [entry for entry in archive_root.iterdir() if entry.is_dir() and (entry.name == name or entry.name.endswith(f"-{name}"))],
        reverse=True,
    )
    return matches[0] if matches else None


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def dump_yaml_like(data: Any, indent: int = 0) -> list[str]:
    lines: list[str] = []
    prefix = " " * indent
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(dump_yaml_like(value, indent + 2))
            else:
                if isinstance(value, bool):
                    rendered = "true" if value else "false"
                elif value is None:
                    rendered = '""'
                else:
                    rendered = str(value)
                lines.append(f"{prefix}{key}: {rendered}")
    elif isinstance(data, list):
        for value in data:
            if isinstance(value, (dict, list)):
                lines.append(f"{prefix}-")
                lines.extend(dump_yaml_like(value, indent + 2))
            else:
                if isinstance(value, bool):
                    rendered = "true" if value else "false"
                elif value is None:
                    rendered = '""'
                else:
                    rendered = str(value)
                lines.append(f"{prefix}- {rendered}")
    return lines


def parse_layout_profile(profile: str | None) -> str:
    return profile or "teaching-activity-dual-column"


def infer_layout_profile(source_dir: Path) -> str:
    formatted = source_dir / "lesson-plan.formatted.md"
    if formatted.exists():
        for line in formatted.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("layout_profile:"):
                return stripped.split(":", 1)[1].strip()
    return "standard-markdown"


def normalize_content(profile: str, content: str) -> str:
    body = content.lstrip()
    if body.startswith("---"):
        return content
    frontmatter = [
        "---",
        f"layout_profile: {profile}",
        "export_ready: true",
        "source_file: lesson-plan.md",
        "---",
        "",
    ]
    return "\n".join(frontmatter) + content


def format_lesson(root: Path, workspace: str, profile: str | None) -> dict[str, Any]:
    ws = project_dir(root, workspace)
    source = ws / "lesson-plan.md"
    if not source.exists():
        raise SystemExit(f"Missing lesson source: {source}")
    chosen = parse_layout_profile(profile)
    content = source.read_text(encoding="utf-8")
    formatted = normalize_content(chosen, content)
    output = ws / "lesson-plan.formatted.md"
    write_text(output, formatted)
    return {
        "workspace": workspace,
        "layout_profile": chosen,
        "source": str(source.relative_to(root)),
        "output": str(output.relative_to(root)),
        "export_ready": True,
    }


def export_profile(target: str, layout_profile: str) -> dict[str, Any]:
    profile: dict[str, Any] = {
        "layout_profile": layout_profile,
        "include_assets_dir": target in {"word-ready-bundle", "pdf-ready-bundle", "remote-bundle-placeholder"},
        "naming": {
            "bundle_dir": "{workspace}/{target}",
            "primary_lesson_file": "lesson-plan.formatted.md",
            "primary_proposal_file": "proposal.md",
        },
    }
    if target == "word-ready-bundle":
        profile["renderer"] = "docx-placeholder"
        profile["page"] = {
            "size": "A4",
            "orientation": "portrait",
            "margin": "normal",
        }
        profile["cover"] = {
            "enabled": True,
            "title_source": "document-title",
            "subtitle_source": "workspace-and-methodology",
        }
        profile["header_footer"] = {
            "enabled": True,
            "header": "course-workshop client delivery",
            "footer": "page-number",
        }
        profile["typography"] = {
            "body_font": "Noto Serif SC",
            "heading_font": "Noto Sans SC",
        }
        profile["table_mapping"] = {
            "teaching_activity_process": "table-with-support-column",
            "allow_cell_linebreaks": True,
        }
    elif target == "pdf-ready-bundle":
        profile["renderer"] = "pdf-placeholder"
        profile["page"] = {
            "size": "A4",
            "orientation": "portrait",
            "margin": "normal",
        }
        profile["cover"] = {
            "enabled": True,
            "title_source": "document-title",
            "subtitle_source": "workspace-and-methodology",
        }
        profile["header_footer"] = {
            "enabled": True,
            "header": "course-workshop client delivery",
            "footer": "page-number",
        }
        profile["layout"] = {
            "teaching_activity_process": "dual-column-ready" if layout_profile == "teaching-activity-dual-column" else "single-column",
            "header_footer": True,
            "support_notes_column": layout_profile == "teaching-activity-dual-column",
            "allow_page_break_inside_process_table": False,
        }
    elif target == "remote-bundle-placeholder":
        profile["renderer"] = "remote-placeholder"
        profile["remote_hint"] = {
            "packaging": "bundle-manifest-plus-assets",
            "binary_exports_included": False,
        }
    else:
        profile["renderer"] = "markdown-only"
    return profile


def manifest_data(
    name: str,
    target: str,
    files: list[str],
    source_dir: Path,
    source_status: dict[str, Any],
) -> dict[str, Any]:
    layout_profile = infer_layout_profile(source_dir)
    return {
        "workspace": name,
        "export_target": target,
        "source": {
            "path": str(source_dir),
            "phase": source_status.get("phase", "unknown"),
            "type": source_status.get("type", "project"),
        },
        "deliverables": files,
        "profile": export_profile(target, layout_profile),
        "render_order": [
            "cover",
            "main-deliverable",
            "supporting-deliverables",
            "assets",
        ],
    }


def export_bundle(root: Path, workspace: str, target: str | None) -> dict[str, Any]:
    active = project_dir(root, workspace)
    archive = archive_match(root, workspace)
    if active.exists():
        source_dir = active
    elif archive is not None:
        source_dir = archive
    else:
        raise SystemExit(f"Could not find active or archived workspace: {workspace}")

    export_target = target or "local-markdown-bundle"
    export_root = runtime_dir(root) / "exports" / workspace / export_target
    if export_root.exists():
        shutil.rmtree(export_root)
    export_root.mkdir(parents=True, exist_ok=True)

    preferred = [
        "lesson-plan.formatted.md",
        "lesson-plan.md",
        "proposal.md",
        "resource-plan.md",
        "quality-report.md",
        "review-comments.md",
        "resource-check-report.md",
    ]
    copied: list[str] = []
    for filename in preferred:
        src = source_dir / filename
        if not src.exists():
            continue
        shutil.copy2(src, export_root / filename)
        copied.append(filename)

    profile = export_profile(export_target, infer_layout_profile(source_dir))
    assets_dir = export_root / "assets"
    if profile["include_assets_dir"]:
        assets_dir.mkdir(parents=True, exist_ok=True)
        (assets_dir / ".gitkeep").write_text("", encoding="utf-8")

    source_status = load_json(source_dir / "status.json")
    write_json(
        export_root / "manifest.json",
        manifest_data(workspace, export_target, copied, source_dir, source_status),
    )
    write_text(
        export_root / "manifest.yaml",
        "\n".join(dump_yaml_like(manifest_data(workspace, export_target, copied, source_dir, source_status))) + "\n",
    )

    return {
        "workspace": workspace,
        "source": str(source_dir.relative_to(root)),
        "export_target": export_target,
        "output": str(export_root.relative_to(root)),
        "files": copied,
        "layout_profile": profile["layout_profile"],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Formatting and export helpers")
    parser.add_argument("--root", help="Repository root containing .workshop/")
    sub = parser.add_subparsers(dest="command", required=True)

    fmt = sub.add_parser("format-lesson")
    fmt.add_argument("workspace")
    fmt.add_argument("--profile", default="teaching-activity-dual-column")

    exp = sub.add_parser("export-bundle")
    exp.add_argument("workspace")
    exp.add_argument("--target", default="local-markdown-bundle")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    root = find_root(args.root)

    if args.command == "format-lesson":
        result = format_lesson(root, args.workspace, args.profile)
    elif args.command == "export-bundle":
        result = export_bundle(root, args.workspace, args.target)
    else:
        raise SystemExit(f"Unknown command: {args.command}")

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
