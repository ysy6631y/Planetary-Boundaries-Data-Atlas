"""Read source archives without extraction, mutation, normalization or aggregation."""

from collections import Counter
import csv
import hashlib
import io
import json
from pathlib import Path
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit"


def display_name(info):
    name = info.filename
    if not info.flag_bits & 0x800:
        try:
            name = name.encode("cp437").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return unicodedata.normalize("NFC", name)


def decode(data):
    for encoding in ("utf-8-sig", "utf-16", "cp949"):
        try:
            return data.decode(encoding), encoding
        except UnicodeError:
            pass
    raise ValueError("No supported text encoding")


def main():
    OUT.mkdir(exist_ok=True)
    inventory = []
    boundaries = None
    markers = {}
    source_archive = None
    for archive in sorted(ROOT.glob("*.zip")):
        before = hashlib.sha256(archive.read_bytes()).hexdigest()
        record = {"archive": archive.name, "sha256": before, "files": []}
        with ZipFile(archive) as zipped:
            for info in zipped.infolist():
                entry = {
                    "zip_member": info.filename,
                    "display_path": display_name(info),
                    "bytes": info.file_size,
                }
                if info.is_dir():
                    entry["kind"] = "directory"
                elif info.filename.startswith("__MACOSX/") or info.filename.endswith(".DS_Store"):
                    entry["kind"] = "macos_metadata"
                else:
                    data = zipped.read(info)
                    entry["sha256"] = hashlib.sha256(data).hexdigest()
                    suffix = Path(info.filename).suffix.lower()
                    entry["kind"] = suffix.lstrip(".") or "other"
                    if suffix in (".csv", ".json", ".md", ".txt", ".js", ".html", ".svg"):
                        content, entry["encoding"] = decode(data)
                        entry["line_count"] = len(content.splitlines())
                        if suffix == ".csv":
                            rows = list(csv.reader(io.StringIO(content)))
                            entry["columns"] = rows[0] if rows else []
                            entry["rows"] = len(rows) - 1 if rows else 0
                            entry["ragged_rows"] = [
                                index for index, row in enumerate(rows[1:], 2)
                                if len(row) != len(entry["columns"])
                            ]
                            entry["blank_cells_by_column"] = {
                                column: sum(index >= len(row) or row[index] == "" for row in rows[1:])
                                for index, column in enumerate(entry["columns"])
                            }
                            entry["sample"] = rows[1:3]
                        elif suffix == ".json":
                            parsed = json.loads(content)
                            entry["top_level_keys"] = list(parsed) if isinstance(parsed, dict) else None
                            if info.filename.endswith("data/planetary-boundaries.json"):
                                boundaries = parsed
                                source_archive = archive.name
                                (OUT / "planetary-boundaries.source.json").write_bytes(data)
                                entry["snapshot"] = "audit/planetary-boundaries.source.json"
                        elif suffix == ".svg":
                            svg = ET.fromstring(content)
                            found = [
                                {"label": "".join(node.itertext()),
                                 "score_text": node.attrib["data-score"],
                                 "ui_x_text": node.attrib.get("data-x")}
                                for node in svg.iter() if "data-score" in node.attrib
                            ]
                            if found:
                                entry["existing_markers"] = found
                                markers[Path(info.filename).stem[3:]] = found
                        elif info.filename.endswith("scripts/generate.js"):
                            (OUT / "generate.source.js.txt").write_bytes(data)
                            entry["snapshot"] = "audit/generate.source.js.txt"
                record["files"].append(entry)
        record["unchanged_after_read"] = before == hashlib.sha256(archive.read_bytes()).hexdigest()
        inventory.append(record)

    if boundaries is None:
        raise ValueError("Planetary boundary source not found")
    controls = []
    for chapter in boundaries["chapters"]:
        for variable in chapter["variables"]:
            found = [m for m in markers.get(chapter["id"], []) if m["label"] == variable["label"]]
            if len(found) > 1:
                raise ValueError("Ambiguous SVG marker label")
            controls.append({
                "chapter_id": chapter["id"],
                "chapter_order": chapter["order"],
                "chapter_title_ko": chapter["title_ko"],
                "source_variable": variable,
                "existing_svg_marker": found[0] if found else None,
                "score_provenance": "existing SVG data-score; rounded to 4 decimal places" if found else None,
                "numeric_observation": variable["data_status"] == "verified_numeric",
            })
    (OUT / "inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")
    (OUT / "controls.json").write_text(json.dumps({
        "source_archive": source_archive,
        "normalization_executed": False,
        "aggregation_executed": False,
        "controls": controls,
    }, ensure_ascii=False, indent=2) + "\n")

    lines = ["# Archive inventory", "", "Generated by `python3 scripts/audit_data.py`. All CSV rows parsed; source archives read-only.", ""]
    for archive in inventory:
        files = archive["files"]
        csvs = [f for f in files if f["kind"] == "csv"]
        lines.extend([f"## {unicodedata.normalize('NFC', archive['archive'])}", "",
                      f"SHA-256: `{archive['sha256']}`", "",
                      f"Entries: {len(files)}; CSV files: {len(csvs)}; CSV rows: {sum(f['rows'] for f in csvs)}; unchanged: {archive['unchanged_after_read']}.", ""])
        for file in files:
            if file["kind"] in ("directory", "macos_metadata"):
                continue
            lines.append(f"- `{file['display_path']}` ({file['bytes']} bytes)")
            if file["kind"] == "csv":
                lines.append(f"  Rows: {file['rows']}; columns: `{json.dumps(file['columns'], ensure_ascii=False)}`; malformed-width rows: {len(file['ragged_rows'])}.")
        lines.append("")
    (OUT / "INVENTORY.md").write_text("\n".join(lines) + "\n")
    summary = {
        "archives": len(inventory),
        "csv_files": sum(f["kind"] == "csv" for a in inventory for f in a["files"]),
        "csv_rows": sum(f.get("rows", 0) for a in inventory for f in a["files"]),
        "all_sources_unchanged": all(a["unchanged_after_read"] for a in inventory),
        "boundary_count": len(boundaries["chapters"]),
        "control_count": len(controls),
        "statuses": dict(Counter(c["source_variable"]["data_status"] for c in controls)),
        "multiple_control_boundaries": [c["id"] for c in boundaries["chapters"] if len(c["variables"]) > 1],
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    for control in controls:
        variable = control["source_variable"]
        print(control["chapter_id"], variable["id"], json.dumps(control["existing_svg_marker"], ensure_ascii=False))


if __name__ == "__main__":
    main()
