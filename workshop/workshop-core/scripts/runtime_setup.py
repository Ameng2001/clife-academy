#!/usr/bin/env python3
"""Runtime setup helper for course-workshop-plugins."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "schema": "course-workshop",
    "defaults": {
        "methodology": "pbl-huamei",
        "target_collection": "courses",
        "governance": {
            "approval_required": True,
            "approver_role": "curriculum-director",
        },
    },
    "models": {
        "planning": "gpt-5",
        "review": "gpt-5",
        "resource_check": "gpt-5-mini",
    },
    "publishing": {
        "default_target": {
            "kind": "local",
            "path": "courses",
        }
    },
    "runtime": {
        "projects_dir": ".workshop/projects",
        "plans_dir": ".workshop/plans",
        "kb_dir": ".workshop/kb",
        "archive_dir": ".workshop/archive",
        "exports_dir": ".workshop/exports",
    },
    "experts": {
        "custom_dir": ".workshop/agents/custom",
        "shared_dir": "experts",
    },
    "remote": {
        "cos": {
            "enabled": False,
            "bucket": "",
            "base_path": "",
        }
    },
    "lifecycle": {
        "phases": ["planning", "designing", "reviewing", "approved", "shipped"],
        "initial_phase": "planning",
    },
}


def runtime_dir(root: Path) -> Path:
    return root / ".workshop"


def config_path(root: Path) -> Path:
    return runtime_dir(root) / "config.yaml"


def project_workspace_dir(root: Path, name: str) -> Path:
    return runtime_dir(root) / "projects" / name


def planning_workspace_dir(root: Path, name: str) -> Path:
    return runtime_dir(root) / "plans" / name


def project_status_path(root: Path, name: str) -> Path:
    return project_workspace_dir(root, name) / "status.json"


def planning_status_path(root: Path, name: str) -> Path:
    return planning_workspace_dir(root, name) / "status.json"


def project_config_path(root: Path, name: str) -> Path:
    return project_workspace_dir(root, name) / "config.yaml"


def planning_config_path(root: Path, name: str) -> Path:
    return planning_workspace_dir(root, name) / "config.yaml"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def find_root(explicit: str | None, create: bool = False) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if create or runtime_dir(root).is_dir():
            return root
        raise SystemExit(f".workshop/ not found under: {root}")
    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        if runtime_dir(candidate).is_dir():
            return candidate
    if create:
        return current
    raise SystemExit("Could not find project root containing .workshop/")


def parse_scalar(value: str) -> Any:
    if value == '""' or value == "''":
        return ""
    if value == "true":
        return True
    if value == "false":
        return False
    return value


def dump_scalar(value: Any) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None or value == "":
        return '""'
    return str(value)


def parse_yaml_subset(text: str) -> dict[str, Any]:
    lines: list[tuple[int, str]] = []
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        lines.append((indent, raw.strip()))

    def parse_node(index: int, indent: int) -> tuple[Any, int]:
        if lines[index][1].startswith("- "):
            return parse_list(index, indent)
        return parse_dict(index, indent)

    def parse_dict(index: int, indent: int) -> tuple[dict[str, Any], int]:
        result: dict[str, Any] = {}
        while index < len(lines):
            line_indent, content = lines[index]
            if line_indent < indent:
                break
            if line_indent != indent or content.startswith("- "):
                break
            key, _, rest = content.partition(":")
            if not _:
                raise SystemExit(f"Unsupported config line: {content}")
            rest = rest.strip()
            index += 1
            if rest:
                result[key] = parse_scalar(rest)
            elif index < len(lines) and lines[index][0] > indent:
                child, index = parse_node(index, lines[index][0])
                result[key] = child
            else:
                result[key] = {}
        return result, index

    def parse_list(index: int, indent: int) -> tuple[list[Any], int]:
        result: list[Any] = []
        while index < len(lines):
            line_indent, content = lines[index]
            if line_indent < indent or line_indent != indent or not content.startswith("- "):
                break
            item = content[2:].strip()
            index += 1
            if item:
                result.append(parse_scalar(item))
            elif index < len(lines) and lines[index][0] > indent:
                child, index = parse_node(index, lines[index][0])
                result.append(child)
            else:
                result.append({})
        return result, index

    if not lines:
        return {}
    data, _ = parse_node(0, lines[0][0])
    return data


def dump_yaml_subset(data: Any, indent: int = 0) -> list[str]:
    lines: list[str] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{' ' * indent}{key}:")
                lines.extend(dump_yaml_subset(value, indent + 2))
            else:
                lines.append(f"{' ' * indent}{key}: {dump_scalar(value)}")
    elif isinstance(data, list):
        for value in data:
            if isinstance(value, (dict, list)):
                lines.append(f"{' ' * indent}-")
                lines.extend(dump_yaml_subset(value, indent + 2))
            else:
                lines.append(f"{' ' * indent}- {dump_scalar(value)}")
    return lines


def load_config(root: Path) -> dict[str, Any]:
    path = config_path(root)
    if not path.exists():
        raise SystemExit("Missing .workshop/config.yaml. Run /workshop-core:init first.")
    return parse_yaml_subset(path.read_text(encoding="utf-8"))


def write_config(root: Path, data: dict[str, Any]) -> None:
    path = config_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(dump_yaml_subset(data)) + "\n", encoding="utf-8")


def deep_get(data: dict[str, Any], dotted_key: str) -> Any:
    current: Any = data
    for part in dotted_key.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def deep_set(data: dict[str, Any], dotted_key: str, value: Any) -> Any:
    parts = dotted_key.split(".")
    current: dict[str, Any] = data
    for part in parts[:-1]:
        next_value = current.get(part)
        if not isinstance(next_value, dict):
            next_value = {}
            current[part] = next_value
        current = next_value
    old = current.get(parts[-1])
    current[parts[-1]] = value
    return old


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def manifest_path(pipeline_id: str) -> Path:
    return repo_root() / "workshop-pipelines" / "references" / "templates" / pipeline_id / "manifest.yaml"


def load_manifest(pipeline_id: str) -> dict[str, Any]:
    path = manifest_path(pipeline_id)
    if not path.exists():
        raise SystemExit(f"Unknown pipeline id: {pipeline_id}")
    text = path.read_text(encoding="utf-8")

    top_level: dict[str, str] = {}
    pipeline_plugin: str | None = None
    document_type: str | None = None
    coding_prefix: str | None = None
    stage_ids: list[str] = []
    section: str | None = None
    subsection: str | None = None

    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        stripped = raw.strip()

        if indent == 0:
            section = None
            subsection = None
            if stripped.endswith(":"):
                section = stripped[:-1]
                continue
            key, _, value = stripped.partition(":")
            if _:
                value = value.strip().strip('"')
                top_level[key] = value
            continue

        if indent == 2 and stripped.endswith(":"):
            subsection = stripped[:-1]
            continue

        if section == "pipeline" and indent == 2 and stripped.startswith("plugin:"):
            pipeline_plugin = stripped.split(":", 1)[1].strip().strip('"')
            continue

        if section == "pipeline" and subsection == "stages" and indent == 4 and stripped.startswith("- id:"):
            stage_ids.append(stripped.split(":", 1)[1].strip().strip('"'))
            continue

        if section == "output" and indent == 2 and stripped.startswith("document_type:"):
            document_type = stripped.split(":", 1)[1].strip().strip('"')
            continue

        if section == "coding" and indent == 2 and stripped.startswith("prefix:"):
            coding_prefix = stripped.split(":", 1)[1].strip().strip('"')
            continue

    return {
        "id": top_level.get("id"),
        "name": top_level.get("name"),
        "pipeline": {
            "plugin": pipeline_plugin,
            "stages": [{"id": stage_id} for stage_id in stage_ids],
        },
        "output": {
            "document_type": document_type,
        },
        "coding": {
            "prefix": coding_prefix,
        },
    }


def ensure_project_status(root: Path, workspace: str, theme: str | None) -> dict[str, Any]:
    path = project_status_path(root, workspace)
    data = load_json(path)
    target_collection = data.get("target_collection") or deep_get(load_config(root), "defaults.target_collection") or "courses"
    data.setdefault("type", "project")
    data.setdefault("project", workspace)
    data.setdefault("theme", theme or workspace)
    data.setdefault("target_collection", target_collection)
    data.setdefault("target", {"kind": "local", "path": f"{target_collection}/{workspace}"})
    data.setdefault("phase", "planning")
    data.setdefault("created_at", "")
    if not data["created_at"]:
        from datetime import datetime

        data["created_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    data.setdefault("plan_refs", {"semester": None, "month": None, "week": None})
    data.setdefault("skills", {})
    hil = data.setdefault(
        "hil",
        {
            "checkpoint": "project-framing",
            "status": "not_started",
            "requested_at": None,
            "approved_at": None,
            "approved_by": None,
            "notes": "",
        },
    )
    hil.setdefault("checkpoint", "project-framing")
    hil.setdefault("status", "not_started")
    hil.setdefault("requested_at", None)
    hil.setdefault("approved_at", None)
    hil.setdefault("approved_by", None)
    hil.setdefault("notes", "")
    write_json(path, data)
    return data


def ensure_planning_status(root: Path, workspace: str, plan_level: str) -> dict[str, Any]:
    path = planning_status_path(root, workspace)
    data = load_json(path)
    data.setdefault("type", "planning")
    data.setdefault("plan_level", plan_level)
    data.setdefault("plan_name", workspace)
    data.setdefault("phase", "planning")
    data.setdefault("created_at", "")
    if not data["created_at"]:
        from datetime import datetime

        data["created_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    data.setdefault("linked_projects", [])
    write_json(path, data)
    return data


def init_runtime(root: Path) -> dict[str, Any]:
    rt = runtime_dir(root)
    dirs = [
        rt / "projects",
        rt / "plans",
        rt / "exports",
        rt / "agents" / "custom",
        rt / "kb" / "textbooks",
        rt / "kb" / "philosophy",
        rt / "kb" / "lesson-plans",
        rt / "kb" / "research-records",
        rt / "kb" / "calendars",
        rt / "archive",
    ]
    for directory in dirs:
        directory.mkdir(parents=True, exist_ok=True)
        keep = directory / ".gitkeep"
        if not keep.exists():
            keep.write_text("", encoding="utf-8")
    if not config_path(root).exists():
        write_config(root, DEFAULT_CONFIG)
    return {
        "runtime_root": str(rt.relative_to(root)),
        "config": str(config_path(root).relative_to(root)),
        "default_methodology": DEFAULT_CONFIG["defaults"]["methodology"],
    }


def kb_counts(root: Path) -> dict[str, int]:
    categories = ["textbooks", "philosophy", "lesson-plans", "research-records", "calendars"]
    counts: dict[str, int] = {}
    for category in categories:
        category_dir = runtime_dir(root) / "kb" / category
        counts[category] = len([p for p in category_dir.glob("*.md") if p.name != ".gitkeep"]) if category_dir.exists() else 0
    return counts


def onboarding_summary(
    root: Path,
    role: str | None,
    starting_mode: str | None,
    methodology: str | None,
    import_materials: str | None,
    publishing: str | None,
) -> dict[str, Any]:
    config = load_config(root)
    kb = kb_counts(root)
    plans = len([p for p in (runtime_dir(root) / "plans").iterdir() if p.is_dir() and p.name != ".gitkeep"]) if (runtime_dir(root) / "plans").exists() else 0
    projects = len([p for p in (runtime_dir(root) / "projects").iterdir() if p.is_dir() and p.name != ".gitkeep"]) if (runtime_dir(root) / "projects").exists() else 0
    kb_total = sum(kb.values())
    current_methodology = methodology or deep_get(config, "defaults.methodology")
    current_publishing = publishing or deep_get(config, "publishing.default_target.kind") or "local"
    next_steps: list[str] = []
    pipeline_step = (
        f"/workshop-pipelines:pipeline-select {current_methodology}"
        if current_methodology and current_methodology != "mixed"
        else "/workshop-pipelines:pipeline-select <id>"
    )

    if current_methodology in {None, "", "mixed"}:
        next_steps.append("/workshop-core:config set defaults.methodology pbl-huamei")
    if kb_total == 0 and import_materials in {None, "now", "yes"}:
        next_steps.append("/workshop-kb:kb-import <path>")
    if (starting_mode or "planning-first") == "planning-first":
        next_steps.append("/workshop-planner:semester-plan <semester>")
        next_steps.append(pipeline_step)
        first_hil = "project-framing after the first project is created and linked to a plan"
    elif starting_mode == "project-first":
        next_steps.append(pipeline_step)
        first_hil = "project-framing right after pipeline selection and basic project setup"
    else:
        next_steps.append(pipeline_step)
        next_steps.append("/workshop-planner:semester-plan <semester>")
        first_hil = "project-framing once the pilot project scope is set"

    return {
        "role": role or "mixed team",
        "starting_mode": starting_mode or "planning-first",
        "default_methodology": current_methodology,
        "kb_status": "empty" if kb_total == 0 else "populated",
        "kb_counts": kb,
        "publishing": current_publishing,
        "existing_plans": plans,
        "existing_projects": projects,
        "first_hil": first_hil,
        "recommended_next_steps": next_steps,
    }


def render_onboarding(summary: dict[str, Any]) -> str:
    lines = [
        "Onboarding summary",
        "",
        f"- Role: {summary['role']}",
        f"- Starting mode: {summary['starting_mode']}",
        f"- Default methodology: {summary['default_methodology']}",
        f"- KB status: {summary['kb_status']}",
        f"- Existing plans: {summary['existing_plans']}",
        f"- Existing projects: {summary['existing_projects']}",
        f"- Publishing: {summary['publishing']}",
        f"- First HIL: {summary['first_hil']}",
        "",
        "Recommended next steps:",
    ]
    for index, step in enumerate(summary["recommended_next_steps"], start=1):
        lines.append(f"{index}. {step}")
    return "\n".join(lines)


def select_pipeline(root: Path, pipeline_id: str, workspace: str, theme: str | None) -> dict[str, Any]:
    manifest = load_manifest(pipeline_id)
    workspace_dir = project_workspace_dir(root, workspace)
    workspace_dir.mkdir(parents=True, exist_ok=True)

    config = {}
    config_file = project_config_path(root, workspace)
    if config_file.exists():
        config = parse_yaml_subset(config_file.read_text(encoding="utf-8"))

    existing_status = load_json(project_status_path(root, workspace))

    config["methodology"] = manifest["id"]
    config["methodology_name"] = manifest.get("name")
    config["pipeline_plugin"] = deep_get(manifest, "pipeline.plugin")
    config["document_type"] = deep_get(manifest, "output.document_type")
    write_config_file(config_file, config)

    status = ensure_project_status(root, workspace, theme)
    should_request_project_framing = not existing_status or (
        existing_status.get("phase") == "planning" and not existing_status.get("skills")
    )
    if should_request_project_framing:
        hil = status["hil"]
        hil["checkpoint"] = "project-framing"
        hil["status"] = "awaiting_review"
        from datetime import datetime

        hil["requested_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
        hil["approved_at"] = None
        hil["approved_by"] = None
        hil["notes"] = "pipeline selected; confirm theme, methodology, and starting scope"
    write_json(project_status_path(root, workspace), status)

    stages = [stage.get("id") for stage in deep_get(manifest, "pipeline.stages") or []]
    return {
        "workspace": workspace,
        "theme": status.get("theme"),
        "pipeline": {
            "id": manifest.get("id"),
            "name": manifest.get("name"),
            "pipeline_plugin": deep_get(manifest, "pipeline.plugin"),
            "document_type": deep_get(manifest, "output.document_type"),
            "stages": stages,
        },
        "hil": status.get("hil"),
        "project_framing_requested": should_request_project_framing,
        "project_config": str(config_file.relative_to(root)),
    }


def write_config_file(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(dump_yaml_subset(data)) + "\n", encoding="utf-8")


def prepare_plan(root: Path, workspace: str, plan_level: str, methodology: str | None) -> dict[str, Any]:
    workspace_dir = planning_workspace_dir(root, workspace)
    workspace_dir.mkdir(parents=True, exist_ok=True)
    status = ensure_planning_status(root, workspace, plan_level)

    config_file = planning_config_path(root, workspace)
    config: dict[str, Any] = {}
    if config_file.exists():
        config = parse_yaml_subset(config_file.read_text(encoding="utf-8"))

    selected_methodology = methodology or config.get("methodology")
    if selected_methodology:
        if not manifest_path(selected_methodology).exists():
            raise SystemExit(f"Unknown methodology pipeline: {selected_methodology}")
        config["methodology"] = selected_methodology
        manifest = load_manifest(selected_methodology)
        config["methodology_name"] = manifest.get("name")
        config["pipeline_plugin"] = deep_get(manifest, "pipeline.plugin")
        config["document_type"] = deep_get(manifest, "output.document_type")
        write_config_file(config_file, config)

    return {
        "workspace": workspace,
        "plan_level": status.get("plan_level"),
        "methodology": config.get("methodology"),
        "planning_status": str(planning_status_path(root, workspace).relative_to(root)),
        "planning_config": str(config_file.relative_to(root)) if config_file.exists() else None,
    }


def cmd_init_runtime(args: argparse.Namespace) -> None:
    root = find_root(args.root, create=True)
    print(json.dumps(init_runtime(root), ensure_ascii=False, indent=2))


def cmd_config_show(args: argparse.Namespace) -> None:
    root = find_root(args.root)
    config = load_config(root)
    if args.json:
        print(json.dumps(config, ensure_ascii=False, indent=2))
        return
    print("\n".join(dump_yaml_subset(config)))


def cmd_config_set(args: argparse.Namespace) -> None:
    root = find_root(args.root)
    config = load_config(root)
    old = deep_set(config, args.key, parse_scalar(args.value))
    write_config(root, config)
    print(
        json.dumps(
            {
                "key": args.key,
                "old": old,
                "new": deep_get(config, args.key),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def cmd_onboarding_summary(args: argparse.Namespace) -> None:
    root = find_root(args.root)
    summary = onboarding_summary(
        root,
        args.role,
        args.starting_mode,
        args.methodology,
        args.import_materials,
        args.publishing,
    )
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    print(render_onboarding(summary))


def cmd_select_pipeline(args: argparse.Namespace) -> None:
    root = find_root(args.root)
    result = select_pipeline(root, args.pipeline_id, args.workspace, args.theme)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_prepare_plan(args: argparse.Namespace) -> None:
    root = find_root(args.root)
    result = prepare_plan(root, args.workspace, args.plan_level, args.methodology)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Runtime setup helper")
    parser.add_argument("--root", default=None, help="Project root containing .workshop/")
    sub = parser.add_subparsers(dest="command", required=True)

    init_cmd = sub.add_parser("init-runtime")
    init_cmd.set_defaults(func=cmd_init_runtime)

    config_show_cmd = sub.add_parser("config-show")
    config_show_cmd.add_argument("--json", action="store_true")
    config_show_cmd.set_defaults(func=cmd_config_show)

    config_set_cmd = sub.add_parser("config-set")
    config_set_cmd.add_argument("key")
    config_set_cmd.add_argument("value")
    config_set_cmd.set_defaults(func=cmd_config_set)

    onboarding_cmd = sub.add_parser("onboarding-summary")
    onboarding_cmd.add_argument("--role", choices=["curriculum-director", "classroom-teacher", "mixed-team"], default=None)
    onboarding_cmd.add_argument("--starting-mode", choices=["planning-first", "project-first", "mixed"], default=None)
    onboarding_cmd.add_argument("--methodology", choices=["pbl-huamei", "five-step", "mixed"], default=None)
    onboarding_cmd.add_argument("--import-materials", choices=["now", "later", "yes", "no"], default=None)
    onboarding_cmd.add_argument("--publishing", choices=["local", "cos"], default=None)
    onboarding_cmd.add_argument("--json", action="store_true")
    onboarding_cmd.set_defaults(func=cmd_onboarding_summary)

    select_pipeline_cmd = sub.add_parser("select-pipeline")
    select_pipeline_cmd.add_argument("pipeline_id")
    select_pipeline_cmd.add_argument("workspace")
    select_pipeline_cmd.add_argument("--theme", default=None)
    select_pipeline_cmd.set_defaults(func=cmd_select_pipeline)

    prepare_plan_cmd = sub.add_parser("prepare-plan")
    prepare_plan_cmd.add_argument("workspace")
    prepare_plan_cmd.add_argument("--plan-level", choices=["semester", "month", "week"], required=True)
    prepare_plan_cmd.add_argument("--methodology", default=None)
    prepare_plan_cmd.set_defaults(func=cmd_prepare_plan)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
