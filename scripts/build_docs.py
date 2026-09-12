#!/usr/bin/env python3
"""
Build script for Nexus project documentation.
Converts all .md and .puml files to PDF in docs/build/

Usage:
    python scripts/build-docs.py          # Full build
    python scripts/build-docs.py --validate-only  # Only validate syntax
    python scripts/build-docs.py --skip-puml      # Skip PlantUML rendering
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
import zlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
BUILD = DOCS / "build"
IMAGES = BUILD / "images"
FLUXOS = DOCS / "puml" / "fluxosAtuais"
CACHE = ROOT / ".cache"
PLANTUML_JAR = CACHE / "plantuml.jar"
PLANTUML_URL = "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar"
PLANTUML_SERVER = "https://www.plantuml.com/plantuml"

# ── java / plantuml setup ──────────────────────────────────────

def _find_java() -> str | None:
    """Locate java executable."""
    for candidate in ["java", "java.exe"]:
        path = shutil.which(candidate)
        if path:
            return path
    # Check common install dirs
    for prog in [
        r"C:\Program Files\Eclipse Adoptium\jre-*\bin\java.exe",
        r"C:\Program Files\Java\*\bin\java.exe",
    ]:
        matches = sorted(Path(prog.split("\\")[0]).glob(prog.split("\\")[1]))
        if matches:
            return str(matches[-1])
    return None

def _ensure_plantuml_jar() -> Path | None:
    """Download plantuml.jar if missing. Returns path or None."""
    CACHE.mkdir(parents=True, exist_ok=True)
    if PLANTUML_JAR.exists():
        return PLANTUML_JAR
    print("  Downloading plantuml.jar...")
    try:
        urllib.request.urlretrieve(PLANTUML_URL, PLANTUML_JAR)
        return PLANTUML_JAR
    except Exception as e:
        print(f"  ⚠  Could not download plantuml.jar: {e}")
        return None

HAS_LOCAL_PLANTUML = _find_java() is not None and _ensure_plantuml_jar() is not None

# ── helpers ──────────────────────────────────────────────────────

def puml_encode(text: str) -> str:
    """PlantUML deflate + base64 encoding."""
    compressed = zlib.compress(text.encode("utf-8"))
    # Remove zlib header (2 bytes) and trailer (4 bytes)
    raw = compressed[2:-4]
    return base64.urlsafe_b64encode(raw).decode("ascii")

def _check_network() -> bool:
    """Check if the plantuml server is reachable."""
    try:
        urlopen(f"{PLANTUML_SERVER}/png/SoWkIImgAStDuNBAJrBGjLDmpCbCJYmfB5CNKB2fICqjL5kSnTGaU8IfASfC8pC1iAAGq7R4IINLm",
                timeout=3)
        return True
    except Exception:
        return False

NETWORK_AVAIL = _check_network()

def puml_validate_local(text: str) -> tuple[bool, str]:
    """Local validation via plantuml.jar --check syntax, or basic check if jar not available."""
    if HAS_LOCAL_PLANTUML:
        try:
            proc = subprocess.run(
                [_find_java(), "-jar", str(PLANTUML_JAR), "-checkyntax", "-stdin"],
                input=text, capture_output=True, text=True, timeout=30
            )
            if proc.returncode == 0:
                return True, ""
            return False, proc.stderr or proc.stdout
        except subprocess.TimeoutExpired:
            return False, "java timeout"
        except Exception as e:
            return False, str(e)
    else:
        # Basic check: @startuml / @enduml balance
        lines = text.split('\n')
        starts = sum(1 for l in lines if l.strip().startswith('@startuml'))
        ends = sum(1 for l in lines if l.strip().startswith('@enduml'))
        if starts != ends:
            return False, f"Unbalanced @startuml/@enduml: {starts} start, {ends} end"
        if starts == 0:
            return False, "Missing @startuml"
        return True, ""

def _puml_render_local(text: str, output_path: Path, fmt: str = "svg") -> bool:
    """Render via local plantuml.jar."""
    try:
        proc = subprocess.run(
            [_find_java(), "-jar", str(PLANTUML_JAR), "-t" + fmt, "-pipe", "-o", str(output_path.parent)],
            input=text, capture_output=True, text=True, timeout=60
        )
        # plantuml.jar with -p outputs filename on stdout
        if proc.returncode == 0:
            expected = output_path.parent / output_path.name
            if expected.exists():
                shutil.move(str(expected), str(output_path))
                return True
        return False
    except Exception:
        return False

def puml_validate(text: str) -> tuple[bool, str]:
    """Validate PUML syntax - uses local plantuml.jar if available, else basic check."""
    return puml_validate_local(text)

def puml_render_to_svg(text: str, output_path: Path) -> bool:
    """Render PUML to SVG — uses local jar if available, else remote API."""
    if HAS_LOCAL_PLANTUML:
        return _puml_render_local(text, output_path, "svg")
    # Fallback: remote API
    try:
        encoded = puml_encode(text)
        url = f"{PLANTUML_SERVER}/svg/{encoded}"
        resp = urlopen(url, timeout=30)
        svg = resp.read()
        output_path.write_bytes(svg)
        return True
    except Exception as e:
        print(f"  ⚠  SVG render failed: {e}")
        return False

def md_to_pdf(md_path: Path, pdf_path: Path) -> bool:
    """Convert markdown to PDF using md-to-pdf (node) if available,
    otherwise by rendering via PlantUML's text output as a fallback."""
    # Try md-to-pdf (node CLI) first
    try:
        subprocess.run(
            ["npx", "md-to-pdf", str(md_path), str(pdf_path)],
            capture_output=True, timeout=60, check=False
        )
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            return True
    except FileNotFoundError:
        pass
    
    # Fallback: copy as text (not ideal, but preserves content)
    print(f"  ⚠  md-to-pdf not available, copying {md_path.name} as text")
    content = md_path.read_text(encoding="utf-8")
    txt_path = pdf_path.with_suffix(".txt")
    txt_path.write_text(content, encoding="utf-8")
    return False

# ── validation ───────────────────────────────────────────────────

def validate_all_puml() -> int:
    """Validate all .puml files. Returns error count."""
    errors = 0
    puml_files = list(DOCS.rglob("*.puml"))
    
    if not puml_files:
        print("No .puml files found.")
        return 0
    
    print(f"Validating {len(puml_files)} PlantUML files...\n")
    
    for pf in sorted(puml_files):
        rel = pf.relative_to(ROOT)
        text = pf.read_text(encoding="utf-8")
        ok, msg = puml_validate(text)
        if ok:
            print(f"  ✓ {rel}")
        else:
            print(f"  ✗ {rel}")
            print(f"    Error: {msg[:200]}")
            errors += 1
    
    return errors

# ── rendering ────────────────────────────────────────────────────

def render_all_puml() -> int:
    """Render all .puml files to SVG in build directory. Returns error count."""
    errors = 0
    IMAGES.mkdir(parents=True, exist_ok=True)
    
    puml_files = list(DOCS.rglob("*.puml"))
    
    for pf in sorted(puml_files):
        rel = pf.relative_to(ROOT)
        text = pf.read_text(encoding="utf-8")
        
        # Determine output name
        stem = pf.stem
        parent_dir = pf.parent.relative_to(DOCS) if pf.parent != DOCS else "."
        if parent_dir != ".":
            out_dir = IMAGES / str(parent_dir)
        else:
            out_dir = IMAGES
        out_dir.mkdir(parents=True, exist_ok=True)
        svg_path = out_dir / f"{stem}.svg"
        
        print(f"  Rendering {rel}...", end=" ")
        ok = puml_render_to_svg(text, svg_path)
        if ok:
            print("SVG ✓")
        else:
            print("FAILED")
            errors += 1
    
    return errors

def render_all_md() -> int:
    """Convert all .md files to PDF in build directory."""
    errors = 0
    
    md_files = list(DOCS.glob("*.md"))
    for mf in sorted(md_files):
        rel = mf.relative_to(DOCS)
        pdf_path = BUILD / mf.with_suffix(".pdf").name
        print(f"  Converting {rel}...", end=" ")
        ok = md_to_pdf(mf, pdf_path)
        if ok:
            print("PDF ✓")
        else:
            print("TXT (fallback)")
    
    return errors

# ── main ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Nexus docs build tool")
    parser.add_argument("--validate-only", action="store_true",
                       help="Only validate PUML syntax, skip rendering")
    parser.add_argument("--skip-puml", action="store_true",
                       help="Skip PlantUML rendering")
    args = parser.parse_args()
    
    os.chdir(ROOT)
    BUILD.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    
    exit_code = 0
    
    print("=" * 50)
    print("  Nexus Documentation Build")
    print("=" * 50)
    
    # Step 1: Validate all PUML files
    print("\n[1/3] Validating PlantUML files...")
    puml_errors = validate_all_puml()
    if puml_errors > 0:
        print(f"\n❌ {puml_errors} PlantUML file(s) have syntax errors!")
        exit_code = 1
        if args.validate_only:
            sys.exit(exit_code)
    else:
        print("\n✅ All PlantUML files valid!")
    
    if args.validate_only:
        sys.exit(exit_code)
    
    # Step 2: Render PUML to SVG
    if not args.skip_puml:
        print("\n[2/3] Rendering PlantUML diagrams...")
        render_errors = render_all_puml()
        if render_errors > 0:
            print(f"  ⚠  {render_errors} diagram(s) failed to render")
    else:
        print("\n[2/3] Skipping PlantUML rendering (--skip-puml)")
    
    # Step 3: Convert MD to PDF
    print("\n[3/3] Converting documentation to PDF...")
    render_all_md()
    
    print(f"\n{'=' * 50}")
    print(f"  Build complete!")
    print(f"  Output: {BUILD.relative_to(ROOT)}/")
    print(f"{'=' * 50}")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()