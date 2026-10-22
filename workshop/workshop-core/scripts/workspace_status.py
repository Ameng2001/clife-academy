#!/usr/bin/env python3
"""Workspace status helper for course-workshop-plugins.

Runtime layout:
  .workshop/
    projects/
    plans/
    kb/
    archive/
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def iso_now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def runtime_dir(root: Path) -> Path:
    return root / ".workshop"


def find_runtime_root(explicit: str | None, create: bool = False) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if create or (root / ".workshop").is_dir():
            return root
        raise SystemExit(f".workshop/ not found under: {root}")

    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".workshop").is_dir():
            return candidate

    if create:
        return current
    raise SystemExit("Could not find project root containing .workshop/")


def config_path(root: Path) -> Path:
    return runtime_dir(root) / "config.yaml"


def project_workspaces_dir(root: Path) -> Path:
    return runtime_dir(root) / "projects"


def planning_workspaces_dir(root: Path) -> Path:
    return runtime_dir(root) / "plans"


def archive_dir(root: Path) -> Path:
    return runtime_dir(root) / "archive"


def kb_dir(root: Path) -> Path:
    return runtime_dir(root) / "kb"


def project_workspace_dir(root: Path, name: str) -> Path:
    return project_workspaces_dir(root) / name


def planning_workspace_dir(root: Path, name: str) -> Path:
    return planning_workspaces_dir(root) / name


def workspace_dir(root: Path, name: str) -> Path:
    project = project_workspace_dir(root, name)
    if project.exists():
        return project
    planning = planning_workspace_dir(root, name)
    if planning.exists():
        return planning
    return project


def project_status_path(root: Path, name: str) -> Path:
    return project_workspace_dir(root, name) / "status.json"


def planning_status_path(root: Path, name: str) -> Path:
    return planning_workspace_dir(root, name) / "status.json"


def status_path(root: Path, name: str) -> Path:
    project = project_status_path(root, name)
    if project.exists():
        return project
    planning = planning_status_path(root, name)
    if planning.exists():
        return planning
    return project


def load_status(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_default_methodology(root: Path) -> str | None:
    config = config_path(root)
    if not config.exists():
        return None
    for line in config.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("methodology:"):
            return stripped.split(":", 1)[1].strip()
    return None


def read_default_target_collection(root: Path) -> str:
    config = config_path(root)
    if not config.exists():
        return "courses"
    for line in config.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("target_collection:"):
            return stripped.split(":", 1)[1].strip()
    return "courses"


def write_status(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_hil_state(data: dict[str, Any], checkpoint: str | None = None) -> dict[str, Any]:
    hil = data.setdefault(
        "hil",
        {
            "checkpoint": checkpoint or "project-framing",
            "status": "not_started",
            "requested_at": None,
            "approved_at": None,
            "approved_by": None,
            "notes": "",
        },
    )
    hil.setdefault("checkpoint", checkpoint or "project-framing")
    hil.setdefault("status", "not_started")
    hil.setdefault("requested_at", None)
    hil.setdefault("approved_at", None)
    hil.setdefault("approved_by", None)
    hil.setdefault("notes", "")
    return hil


def deliverables_for_workspace(root: Path, name: str) -> dict[str, bool]:
    ws = project_workspace_dir(root, name)
    return {
        "proposal": (ws / "proposal.md").exists(),
        "lesson": (ws / "lesson-plan.md").exists(),
        "quality_report": (ws / "quality-report.md").exists(),
        "review_comments": (ws / "review-comments.md").exists(),
        "resource_plan": (ws / "resource-plan.md").exists(),
        "resource_check_report": (ws / "resource-check-report.md").exists(),
    }


def required_skills_for(deliverables: dict[str, bool]) -> list[str]:
    required: list[str] = []
    if deliverables["proposal"]:
        required.extend(
            [
                "driving-question",
                "network-map",
                "inquiry-scaffold",
                "activity-design",
                "proposal-generate",
            ]
        )
    if deliverables["lesson"]:
        required.extend(
            [
                "lesson-objective",
                "lesson-scaffold",
                "lesson-detail",
                "lesson-generate",
            ]
        )
    return required


def completion_summary(skills: dict[str, Any]) -> tuple[int, int]:
    total = len(skills)
    done = sum(1 for value in skills.values() if value in {"done", "approved"})
    return done, total


def classify_workspace(root: Path, ws: Path, data: dict[str, Any]) -> str:
    status_type = data.get("type")
    if status_type == "planning":
        return "planning"
    if status_type == "project":
        return "project"
    if (ws / "semester-plan.md").exists() or (ws / "month-plan.md").exists() or any(ws.glob("week*-plan.md")):
        return "planning"
    return "project"


def summarize_workspace(root: Path, ws: Path) -> dict[str, Any]:
    name = ws.name
    data = load_status(ws / "status.json")
    kind = classify_workspace(root, ws, data)
    config_path = ws / "config.yaml"
    methodology = None
    if config_path.exists():
        for line in config_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("methodology:"):
                methodology = stripped.split(":", 1)[1].strip()
                break

    if kind == "planning":
        planning_files = []
        for candidate in ["semester-plan.md", "month-plan.md"]:
            if (ws / candidate).exists():
                planning_files.append(candidate)
        planning_files.extend(sorted(path.name for path in ws.glob("week*-plan.md")))
        return {
            "name": name,
            "type": "planning",
            "phase": data.get("phase", "unknown"),
            "plan_level": data.get("plan_level"),
            "linked_projects": data.get("linked_projects", []),
            "files": planning_files,
        }

    deliverables = deliverables_for_workspace(root, name)
    skills = data.get("skills", {})
    done, total = completion_summary(skills)
    deliverable_list = [key for key, exists in deliverables.items() if exists and key in {"proposal", "lesson"}]
    return {
        "name": name,
        "type": "project",
        "phase": data.get("phase", "unknown"),
        "methodology": methodology,
        "plan_refs": data.get("plan_refs", {"semester": None, "month": None, "week": None}),
        "hil": data.get("hil"),
        "deliverables": deliverable_list,
        "skills_done": done,
        "skills_total": total,
    }


def summarize_archives(root: Path) -> list[dict[str, Any]]:
    archive = archive_dir(root)
    if not archive.exists():
        return []
    entries = sorted(
        [path for path in archive.iterdir() if path.is_dir()],
        key=lambda p: p.name,
        reverse=True,
    )[:5]
    result = []
    for entry in entries:
        data = load_status(entry / "status.json")
        result.append({"name": entry.name, "shipped_to": data.get("shipped_to")})
    return result


def summarize_kb(root: Path) -> dict[str, int]:
    kb = kb_dir(root)
    categories = ["textbooks", "philosophy", "lesson-plans", "research-records", "calendars"]
    counts: dict[str, int] = {}
    for category in categories:
        category_dir = kb / category
        if not category_dir.exists():
            counts[category] = 0
            continue
        counts[category] = len([p for p in category_dir.glob("*.md") if p.name != ".gitkeep"])
    return counts


def summarize_status(root: Path) -> dict[str, Any]:
    projects = []
    planning = []
    project_root = project_workspaces_dir(root)
    if project_root.exists():
        for entry in sorted(project_root.iterdir()):
            if entry.name == ".gitkeep" or not entry.is_dir():
                continue
            projects.append(summarize_workspace(root, entry))
    planning_root = planning_workspaces_dir(root)
    if planning_root.exists():
        for entry in sorted(planning_root.iterdir()):
            if entry.name == ".gitkeep" or not entry.is_dir():
                continue
            planning.append(summarize_workspace(root, entry))
    return {
        "runtime_root": str(runtime_dir(root).relative_to(root)),
        "default_methodology": read_default_methodology(root),
        "knowledge_base": summarize_kb(root),
        "planning": planning,
        "projects": projects,
        "hil": summarize_hil(projects),
        "archives": summarize_archives(root),
    }


def summarize_hil(projects: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {
        "awaiting_review": 0,
        "changes_requested": 0,
        "approved": 0,
        "not_started": 0,
        "missing": 0,
    }
    waiting: list[dict[str, Any]] = []
    for project in projects:
        hil = project.get("hil")
        if not hil:
            counts["missing"] += 1
            continue
        status = hil.get("status", "missing")
        counts[status] = counts.get(status, 0) + 1
        if status in {"awaiting_review", "changes_requested"}:
            waiting.append(
                {
                    "name": project["name"],
                    "phase": project.get("phase"),
                    "checkpoint": hil.get("checkpoint"),
                    "status": status,
                }
            )
    return {
        "counts": counts,
        "attention": waiting,
    }


def format_plan_refs(plan_refs: dict[str, Any]) -> str:
    parts = []
    for key in ["semester", "month", "week"]:
        value = plan_refs.get(key)
        if value:
            parts.append(f"{key}:{value}")
    return ", ".join(parts) if parts else "-"


def format_project_row(project: dict[str, Any]) -> str:
    hil = project.get("hil") or {}
    hil_text = "-"
    if hil:
        hil_text = f"{hil.get('checkpoint', '?')} [{hil.get('status', '?')}]"
    deliverables = ", ".join(project.get("deliverables", [])) or "-"
    methodology = project.get("methodology") or "-"
    return (
        f"- {project['name']} | phase={project.get('phase')} | hil={hil_text} | "
        f"method={methodology} | skills={project.get('skills_done')}/{project.get('skills_total')} | "
        f"deliverables={deliverables} | plans={format_plan_refs(project.get('plan_refs', {}))}"
    )


def format_planning_row(plan: dict[str, Any]) -> str:
    linked = len(plan.get("linked_projects", []))
    return (
        f"- {plan['name']} | level={plan.get('plan_level') or '-'} | "
        f"phase={plan.get('phase')} | linked_projects={linked}"
    )


def render_status_dashboard(root: Path) -> str:
    summary = summarize_status(root)
    kb = summary["knowledge_base"]
    hil = summary["hil"]
    lines = [
        "Workshop Status",
        "===============",
        "",
        f"Runtime Root: {summary['runtime_root']}",
        f"Default Methodology: {summary.get('default_methodology') or '-'}",
        "",
        "Knowledge Base",
        (
            f"- textbooks={kb['textbooks']} | philosophy={kb['philosophy']} | "
            f"lesson-plans={kb['lesson-plans']} | research-records={kb['research-records']} | "
            f"calendars={kb['calendars']}"
        ),
        "",
        "HIL Overview",
        (
            f"- awaiting_review={hil['counts']['awaiting_review']} | "
            f"changes_requested={hil['counts']['changes_requested']} | "
            f"approved={hil['counts']['approved']} | "
            f"not_started={hil['counts']['not_started']} | "
            f"missing={hil['counts']['missing']}"
        ),
    ]
    if hil["attention"]:
        lines.extend(["- attention:"])
        for item in hil["attention"]:
            lines.append(
                f"  - {item['name']} | phase={item['phase']} | checkpoint={item['checkpoint']} | status={item['status']}"
            )
    lines.extend(["", "Planning"])
    if summary["planning"]:
        for plan in summary["planning"]:
            lines.append(format_planning_row(plan))
    else:
        lines.append("- none")
    lines.extend(["", "Projects"])
    if summary["projects"]:
        for project in summary["projects"]:
            lines.append(format_project_row(project))
    else:
        lines.append("- none")
    lines.extend(["", "Recent Archives"])
    if summary["archives"]:
        for archive in summary["archives"]:
            lines.append(f"- {archive['name']} -> {archive.get('shipped_to') or '-'}")
    else:
        lines.append("- none")
    return "\n".join(lines)


def validate_project(root: Path, name: str, required_phase: str | None) -> dict[str, Any]:
    data = load_status(project_status_path(root, name))
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") == "planning":
        raise SystemExit(f"Workspace '{name}' is planning, not a shippable project.")

    deliverables = deliverables_for_workspace(root, name)
    if not deliverables["proposal"] and not deliverables["lesson"]:
        raise SystemExit(
            f"Workspace '{name}' has no final deliverable. Expected proposal.md or lesson-plan.md."
        )

    if required_phase and data.get("phase") != required_phase:
        raise SystemExit(
            f"Workspace '{name}' is in phase '{data.get('phase')}', expected '{required_phase}'."
        )

    skills = data.get("skills", {})
    required_skills = required_skills_for(deliverables)
    missing_skills = [skill for skill in required_skills if skills.get(skill) not in {"done", "approved"}]
    hil = data.get("hil") or {}
    approval_gate_ready = True
    approval_gate_issue = None
    if required_phase == "approved":
        approval_gate_ready = hil.get("checkpoint") == "approval-gate" and hil.get("status") == "approved"
        if not approval_gate_ready:
            approval_gate_issue = "approval-gate is not approved"

    return {
        "workspace": name,
        "type": data.get("type", "unknown"),
        "phase": data.get("phase"),
        "hil": hil or None,
        "deliverables": deliverables,
        "required_skills": required_skills,
        "missing_skills": missing_skills,
        "approval_gate_ready": approval_gate_ready,
        "approval_gate_issue": approval_gate_issue,
        "optional_reviews": {
            "quality_report": deliverables["quality_report"],
            "review_comments": deliverables["review_comments"],
            "resource_plan": deliverables["resource_plan"],
            "resource_check_report": deliverables["resource_check_report"],
        },
        "ready": len(missing_skills) == 0 and approval_gate_ready,
    }


def copy_if_exists(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def release_bundle_files(root: Path, name: str) -> tuple[list[str], list[str]]:
    deliverables = deliverables_for_workspace(root, name)
    files_to_copy: list[str] = []
    directories_to_copy: list[str] = []

    if deliverables["proposal"]:
        files_to_copy.append("proposal.md")
        # PBL activities are part of the final release bundle when present.
        directories_to_copy.append("activities")

    if deliverables["lesson"]:
        files_to_copy.append("lesson-plan.md")

    for optional_file, exists in [
        ("quality-report.md", deliverables["quality_report"]),
        ("review-comments.md", deliverables["review_comments"]),
        ("resource-plan.md", deliverables["resource_plan"]),
        ("resource-check-report.md", deliverables["resource_check_report"]),
    ]:
        if exists:
            files_to_copy.append(optional_file)

    return files_to_copy, directories_to_copy


def promote_project(root: Path, name: str, overwrite: bool) -> dict[str, Any]:
    validation = validate_project(root, name, "approved")
    if not validation["ready"]:
        raise SystemExit(
            f"Workspace '{name}' is missing required skills: {', '.join(validation['missing_skills'])}"
        )

    project_status_file = project_status_path(root, name)
    project_status = load_status(project_status_file)
    source = project_workspace_dir(root, name)
    target_collection = project_status.get("target_collection") or read_default_target_collection(root)
    target_config = project_status.get("target") or {
        "kind": "local",
        "path": f"{target_collection}/{name}",
    }
    if target_config.get("kind", "local") != "local":
        raise SystemExit(
            f"Unsupported target kind '{target_config.get('kind')}'. Only 'local' is implemented currently."
        )
    target_path = target_config.get("path") or f"{target_collection}/{name}"
    target = (root / target_path).resolve()

    if target.exists():
        if not overwrite:
            raise SystemExit(f"Target already exists: {target}")
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    target.mkdir(parents=True, exist_ok=True)

    files_to_copy, directories_to_copy = release_bundle_files(root, name)
    for filename in files_to_copy:
        copy_if_exists(source / filename, target / filename)
    for directory in directories_to_copy:
        copy_if_exists(source / directory, target / directory)

    archive_name = f"{datetime.now().astimezone().date().isoformat()}-{name}"
    archive_target = archive_dir(root) / archive_name
    if archive_target.exists():
        raise SystemExit(f"Archive target already exists: {archive_target}")
    archive_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(archive_target))

    archived_status_file = archive_target / "status.json"
    archived_status = load_status(archived_status_file)
    archived_status["phase"] = "shipped"
    archived_status["shipped_at"] = iso_now()
    archived_status["shipped_to"] = str(target.relative_to(root))
    write_status(archived_status_file, archived_status)

    return {
        "workspace": name,
        "target": str(target.relative_to(root)),
        "archive": str(archive_target.relative_to(root)),
    }


def ensure_project_status(root: Path, name: str, theme: str | None) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    target_collection = data.get("target_collection") or read_default_target_collection(root)
    data.setdefault("type", "project")
    data.setdefault("project", name)
    data.setdefault("theme", theme or name)
    data.setdefault("target_collection", target_collection)
    data.setdefault("target", {"kind": "local", "path": f"{target_collection}/{name}"})
    data.setdefault("phase", "planning")
    data.setdefault("created_at", iso_now())
    data.setdefault("plan_refs", {"semester": None, "month": None, "week": None})
    data.setdefault("skills", {})
    ensure_hil_state(data)
    write_status(path, data)
    return data


def ensure_planning_status(root: Path, name: str, plan_level: str) -> dict[str, Any]:
    path = planning_status_path(root, name)
    data = load_status(path)
    data.setdefault("type", "planning")
    data.setdefault("plan_level", plan_level)
    data.setdefault("plan_name", name)
    data.setdefault("phase", "planning")
    data.setdefault("created_at", iso_now())
    data.setdefault("linked_projects", [])
    write_status(path, data)
    return data


def request_hil(root: Path, name: str, checkpoint: str, notes: str | None) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") != "project":
        raise SystemExit(f"Workspace '{name}' is not a project.")
    hil = ensure_hil_state(data, checkpoint)
    hil["checkpoint"] = checkpoint
    hil["status"] = "awaiting_review"
    hil["requested_at"] = iso_now()
    hil["approved_at"] = None
    hil["approved_by"] = None
    if notes is not None:
        hil["notes"] = notes
    write_status(path, data)
    return data


def approve_hil(root: Path, name: str, checkpoint: str, approved_by: str | None, notes: str | None) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") != "project":
        raise SystemExit(f"Workspace '{name}' is not a project.")
    hil = ensure_hil_state(data, checkpoint)
    hil["checkpoint"] = checkpoint
    hil["status"] = "approved"
    if hil.get("requested_at") is None:
        hil["requested_at"] = iso_now()
    hil["approved_at"] = iso_now()
    hil["approved_by"] = approved_by
    if notes is not None:
        hil["notes"] = notes
    write_status(path, data)
    return data


def reject_hil(root: Path, name: str, checkpoint: str, notes: str | None) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") != "project":
        raise SystemExit(f"Workspace '{name}' is not a project.")
    hil = ensure_hil_state(data, checkpoint)
    hil["checkpoint"] = checkpoint
    hil["status"] = "changes_requested"
    if hil.get("requested_at") is None:
        hil["requested_at"] = iso_now()
    hil["approved_at"] = None
    hil["approved_by"] = None
    if notes is not None:
        hil["notes"] = notes
    write_status(path, data)
    return data


def complete_stage_review(
    root: Path,
    name: str,
    checkpoint: str,
    skill: str,
    phase: str | None,
    approved_by: str | None,
    notes: str | None,
    value: str,
) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") != "project":
        raise SystemExit(f"Workspace '{name}' is not a project.")

    hil = ensure_hil_state(data, checkpoint)
    hil["checkpoint"] = checkpoint
    if hil.get("requested_at") is None:
        hil["requested_at"] = iso_now()
    hil["status"] = "approved"
    hil["approved_at"] = iso_now()
    hil["approved_by"] = approved_by
    if notes is not None:
        hil["notes"] = notes

    data.setdefault("skills", {})
    data["skills"][skill] = value

    if phase:
        data["phase"] = phase
        if phase == "approved":
            data["approved_at"] = iso_now()
            if approved_by:
                data["approved_by"] = approved_by

    write_status(path, data)
    return data


def record_project_artifact(
    root: Path,
    name: str,
    skill: str,
    phase: str | None,
    notes: str | None,
    value: str,
) -> dict[str, Any]:
    path = project_status_path(root, name)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {name}")
    if data.get("type") != "project":
        raise SystemExit(f"Workspace '{name}' is not a project.")

    data.setdefault("skills", {})
    data["skills"][skill] = value
    if phase:
        data["phase"] = phase

    if notes:
        artifact_notes = data.setdefault("artifact_notes", {})
        artifact_notes[skill] = notes

    write_status(path, data)
    return data


def cmd_ensure_project(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root, create=True)
    data = ensure_project_status(root, args.workspace, args.theme)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_ensure_planning(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root, create=True)
    data = ensure_planning_status(root, args.workspace, args.plan_level)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_set_skill(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    path = status_path(root, args.workspace)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {args.workspace}")
    data.setdefault("skills", {})
    data["skills"][args.skill] = args.value
    write_status(path, data)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_set_phase(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    path = status_path(root, args.workspace)
    data = load_status(path)
    if not data:
        raise SystemExit(f"Missing status.json for workspace: {args.workspace}")
    data["phase"] = args.phase
    if args.phase == "approved":
        data["approved_at"] = iso_now()
        if args.approved_by:
            data["approved_by"] = args.approved_by
        hil = ensure_hil_state(data, "approval-gate")
        hil["checkpoint"] = "approval-gate"
        hil["status"] = "approved"
        if hil.get("requested_at") is None:
            hil["requested_at"] = iso_now()
        hil["approved_at"] = data["approved_at"]
        hil["approved_by"] = args.approved_by
    write_status(path, data)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_request_hil(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    data = request_hil(root, args.workspace, args.checkpoint, args.notes)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_approve_hil(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    data = approve_hil(root, args.workspace, args.checkpoint, args.approved_by, args.notes)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_reject_hil(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    data = reject_hil(root, args.workspace, args.checkpoint, args.notes)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_complete_stage_review(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    data = complete_stage_review(
        root,
        args.workspace,
        args.checkpoint,
        args.skill,
        args.phase,
        args.approved_by,
        args.notes,
        args.value,
    )
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_record_project_artifact(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    data = record_project_artifact(
        root,
        args.workspace,
        args.skill,
        args.phase,
        args.notes,
        args.value,
    )
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_complete_project_skill(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root, create=True)
    data = ensure_project_status(root, args.workspace, args.theme)
    data.setdefault("skills", {})
    data["skills"][args.skill] = args.value
    if args.phase:
        data["phase"] = args.phase
        if args.phase == "approved":
            data["approved_at"] = iso_now()
            if args.approved_by:
                data["approved_by"] = args.approved_by
            hil = ensure_hil_state(data, "approval-gate")
            hil["checkpoint"] = "approval-gate"
            hil["status"] = "approved"
            if hil.get("requested_at") is None:
                hil["requested_at"] = iso_now()
            hil["approved_at"] = data["approved_at"]
            hil["approved_by"] = args.approved_by
    write_status(project_status_path(root, args.workspace), data)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_complete_planning(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root, create=True)
    data = ensure_planning_status(root, args.workspace, args.plan_level)
    if args.linked_project:
        linked = data.setdefault("linked_projects", [])
        if args.linked_project not in linked:
            linked.append(args.linked_project)
    write_status(planning_status_path(root, args.workspace), data)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_link_plan(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root, create=True)
    project = ensure_project_status(root, args.project, None)
    planning = ensure_planning_status(root, args.plan, args.plan_level)

    plan_refs = project.setdefault("plan_refs", {"semester": None, "month": None, "week": None})
    plan_refs[args.plan_level] = args.plan

    linked = planning.setdefault("linked_projects", [])
    if args.project not in linked:
        linked.append(args.project)

    write_status(project_status_path(root, args.project), project)
    write_status(planning_status_path(root, args.plan), planning)

    print(
        json.dumps(
            {
                "project": project["project"],
                "plan_level": args.plan_level,
                "plan": args.plan,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def cmd_validate_project(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    result = validate_project(root, args.workspace, args.required_phase)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ready"]:
        raise SystemExit(2)


def cmd_summarize_status(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    result = summarize_status(root)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_render_status(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    print(render_status_dashboard(root))


def cmd_promote_project(args: argparse.Namespace) -> None:
    root = find_runtime_root(args.root)
    result = promote_project(root, args.workspace, args.overwrite)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Workspace status helper")
    parser.add_argument("--root", help="Project root containing .workshop/", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    ensure_project = sub.add_parser("ensure-project")
    ensure_project.add_argument("workspace")
    ensure_project.add_argument("--theme", default=None)
    ensure_project.set_defaults(func=cmd_ensure_project)

    ensure_planning = sub.add_parser("ensure-planning")
    ensure_planning.add_argument("workspace")
    ensure_planning.add_argument("--plan-level", choices=["semester", "month", "week"], required=True)
    ensure_planning.set_defaults(func=cmd_ensure_planning)

    set_skill = sub.add_parser("set-skill")
    set_skill.add_argument("workspace")
    set_skill.add_argument("skill")
    set_skill.add_argument("--value", default="done")
    set_skill.set_defaults(func=cmd_set_skill)

    set_phase = sub.add_parser("set-phase")
    set_phase.add_argument("workspace")
    set_phase.add_argument("phase", choices=["planning", "designing", "reviewing", "approved", "shipped"])
    set_phase.add_argument("--approved-by", default=None)
    set_phase.set_defaults(func=cmd_set_phase)

    request_hil_cmd = sub.add_parser("request-hil")
    request_hil_cmd.add_argument("workspace")
    request_hil_cmd.add_argument(
        "checkpoint",
        choices=["project-framing", "design-scaffold", "deliverable-draft", "approval-gate"],
    )
    request_hil_cmd.add_argument("--notes", default=None)
    request_hil_cmd.set_defaults(func=cmd_request_hil)

    approve_hil_cmd = sub.add_parser("approve-hil")
    approve_hil_cmd.add_argument("workspace")
    approve_hil_cmd.add_argument(
        "checkpoint",
        choices=["project-framing", "design-scaffold", "deliverable-draft", "approval-gate"],
    )
    approve_hil_cmd.add_argument("--approved-by", default=None)
    approve_hil_cmd.add_argument("--notes", default=None)
    approve_hil_cmd.set_defaults(func=cmd_approve_hil)

    reject_hil_cmd = sub.add_parser("reject-hil")
    reject_hil_cmd.add_argument("workspace")
    reject_hil_cmd.add_argument(
        "checkpoint",
        choices=["project-framing", "design-scaffold", "deliverable-draft", "approval-gate"],
    )
    reject_hil_cmd.add_argument("--notes", default=None)
    reject_hil_cmd.set_defaults(func=cmd_reject_hil)

    complete_stage_review_cmd = sub.add_parser("complete-stage-review")
    complete_stage_review_cmd.add_argument("workspace")
    complete_stage_review_cmd.add_argument(
        "checkpoint",
        choices=["project-framing", "design-scaffold", "deliverable-draft", "approval-gate"],
    )
    complete_stage_review_cmd.add_argument("skill")
    complete_stage_review_cmd.add_argument(
        "--phase",
        choices=["planning", "designing", "reviewing", "approved", "shipped"],
        default=None,
    )
    complete_stage_review_cmd.add_argument("--approved-by", default=None)
    complete_stage_review_cmd.add_argument("--notes", default=None)
    complete_stage_review_cmd.add_argument("--value", default="done")
    complete_stage_review_cmd.set_defaults(func=cmd_complete_stage_review)

    record_project_artifact_cmd = sub.add_parser("record-project-artifact")
    record_project_artifact_cmd.add_argument("workspace")
    record_project_artifact_cmd.add_argument("skill")
    record_project_artifact_cmd.add_argument(
        "--phase",
        choices=["planning", "designing", "reviewing", "approved", "shipped"],
        default=None,
    )
    record_project_artifact_cmd.add_argument("--notes", default=None)
    record_project_artifact_cmd.add_argument("--value", default="done")
    record_project_artifact_cmd.set_defaults(func=cmd_record_project_artifact)

    complete_project_skill = sub.add_parser("complete-project-skill")
    complete_project_skill.add_argument("workspace")
    complete_project_skill.add_argument("skill")
    complete_project_skill.add_argument("--theme", default=None)
    complete_project_skill.add_argument("--value", default="done")
    complete_project_skill.add_argument(
        "--phase",
        choices=["planning", "designing", "reviewing", "approved", "shipped"],
        default=None,
    )
    complete_project_skill.add_argument("--approved-by", default=None)
    complete_project_skill.set_defaults(func=cmd_complete_project_skill)

    complete_planning = sub.add_parser("complete-planning")
    complete_planning.add_argument("workspace")
    complete_planning.add_argument("--plan-level", choices=["semester", "month", "week"], required=True)
    complete_planning.add_argument("--linked-project", default=None)
    complete_planning.set_defaults(func=cmd_complete_planning)

    link_plan = sub.add_parser("link-plan")
    link_plan.add_argument("project")
    link_plan.add_argument("plan")
    link_plan.add_argument("--plan-level", choices=["semester", "month", "week"], required=True)
    link_plan.set_defaults(func=cmd_link_plan)

    validate_project_cmd = sub.add_parser("validate-project")
    validate_project_cmd.add_argument("workspace")
    validate_project_cmd.add_argument(
        "--required-phase",
        choices=["planning", "designing", "reviewing", "approved", "shipped"],
        default=None,
    )
    validate_project_cmd.set_defaults(func=cmd_validate_project)

    summarize_status_cmd = sub.add_parser("summarize-status")
    summarize_status_cmd.set_defaults(func=cmd_summarize_status)

    render_status_cmd = sub.add_parser("render-status")
    render_status_cmd.set_defaults(func=cmd_render_status)

    promote_project_cmd = sub.add_parser("promote-project")
    promote_project_cmd.add_argument("workspace")
    promote_project_cmd.add_argument("--overwrite", action="store_true")
    promote_project_cmd.set_defaults(func=cmd_promote_project)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
