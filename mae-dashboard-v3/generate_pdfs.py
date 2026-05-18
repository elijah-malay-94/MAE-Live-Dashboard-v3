#!/usr/bin/env python3
"""
Generate MAE Dashboard Handbook PDFs (IT and EN) using Chrome headless.
Extracts handbook content from index.html, inlines CSS, and prints to PDF.
"""

import subprocess
import sys
import os
import tempfile

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML = os.path.join(BASE_DIR, "index.html")
CSS_FILE   = os.path.join(BASE_DIR, "css", "handbook.css")
DOCS_DIR   = os.path.join(BASE_DIR, "docs")
CHROME     = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

OUTPUT = {
    "it": os.path.join(DOCS_DIR, "MAE_Dashboard_Handbook_IT.pdf"),
    "en": os.path.join(DOCS_DIR, "MAE_Dashboard_Handbook_EN.pdf"),
}

# Map lang code -> id of the .handbook-lang div in index.html
LANG_ID = {
    "it": "handbookIT",
    "en": "handbookEN",
}

# ── Check deps ─────────────────────────────────────────────────────────────
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing beautifulsoup4…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4", "-q"])
    from bs4 import BeautifulSoup

os.makedirs(DOCS_DIR, exist_ok=True)

# ── Load source files ──────────────────────────────────────────────────────
print("Reading index.html…")
with open(INDEX_HTML, encoding="utf-8") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

print("Reading handbook.css…")
with open(CSS_FILE, encoding="utf-8") as f:
    css = f.read()

# ── HTML template ──────────────────────────────────────────────────────────
TEMPLATE = """\
<!DOCTYPE html><html lang="{lang}"><head><meta charset="UTF-8"><style>
{css}
.handbook-page{{display:block!important;position:static!important;background:#fff!important;}}
.handbook-lang{{display:block!important;}}
</style></head><body><div class="handbook-page">{body}</div></body></html>"""

# ── Extract per-language handbook content ──────────────────────────────────
def extract_lang(lang: str) -> str:
    """Return the inner HTML of .handbook-lang[lang=<lang>] (or data-lang)."""
    # Try data-lang attribute first, then lang attribute
    node = soup.find(class_="handbook-lang", attrs={"data-lang": lang})
    if node is None:
        node = soup.find(class_="handbook-lang", lang=lang)
    if node is None:
        # Fallback: find by id convention
        node = soup.find(id=f"handbook-{lang}")
    if node is None:
        # Last resort: look inside .handbook-page for the lang div
        hb = soup.find(class_="handbook-page")
        if hb:
            node = hb.find(class_="handbook-lang", attrs={"data-lang": lang})
    if node is None:
        raise RuntimeError(f"Could not find handbook content for lang='{lang}'")
    return str(node)


def extract_handbook_body(lang: str) -> str:
    """
    Return everything inside .handbook-page that belongs to <lang>.
    For .handbook-lang nodes keep only the one matching lang (mark it active).
    Identification uses LANG_ID map (id attribute like 'handbookIT').
    """
    hb = soup.find(class_="handbook-page")
    if hb is None:
        raise RuntimeError("No .handbook-page element found in index.html")

    target_id = LANG_ID[lang]

    import copy

    parts = []
    for child in hb.children:
        if hasattr(child, "get") and "handbook-lang" in child.get("class", []):
            child_id = child.get("id", "")
            if child_id == target_id:
                # Render this block with active class so CSS shows it
                child_copy = copy.copy(child)
                classes = list(child_copy.get("class", []))
                if "active" not in classes:
                    classes.append("active")
                child_copy["class"] = classes
                parts.append(str(child_copy))
            # Skip all other lang blocks
        else:
            parts.append(str(child))

    return "".join(parts)


# ── Detect structure ───────────────────────────────────────────────────────
hb_page = soup.find(class_="handbook-page")
if hb_page is None:
    print("ERROR: .handbook-page not found in index.html")
    sys.exit(1)

lang_divs = hb_page.find_all(class_="handbook-lang")
print(f"Found {len(lang_divs)} .handbook-lang block(s) inside .handbook-page")
for d in lang_divs:
    div_id = d.get("id", "?")
    print(f"  lang block id='{div_id}'")

# ── Generate PDFs ──────────────────────────────────────────────────────────
tmp_files = []

for lang, out_path in OUTPUT.items():
    print(f"\n{'='*60}")
    print(f"Generating {lang.upper()} PDF…")

    body_html = extract_handbook_body(lang)
    html_content = TEMPLATE.format(lang=lang, css=css, body=body_html)

    # Write temp HTML
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".html", encoding="utf-8",
        delete=False, prefix=f"mae_handbook_{lang}_"
    )
    tmp.write(html_content)
    tmp.close()
    tmp_files.append(tmp.name)
    print(f"  Temp HTML: {tmp.name}  ({os.path.getsize(tmp.name):,} bytes)")

    # Run Chrome headless
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--print-to-pdf-no-header",
        "--run-all-compositor-stages-before-draw",
        "--print-background",
        "--paper-width=8.268",
        "--paper-height=11.693",
        f"--print-to-pdf={out_path}",
        f"file:///{tmp.name.replace(os.sep, '/')}",
    ]
    print(f"  Running Chrome…")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"  Chrome stderr: {result.stderr[:500]}")
    if os.path.exists(out_path):
        size = os.path.getsize(out_path)
        print(f"  Output: {out_path}")
        print(f"  Size:   {size:,} bytes  ({size/1024:.1f} KB)")
    else:
        print(f"  ERROR: PDF not created at {out_path}")
        print(f"  Chrome stdout: {result.stdout[:300]}")
        print(f"  Chrome stderr: {result.stderr[:300]}")

# ── Page count via pikepdf (optional) ─────────────────────────────────────
print("\n" + "="*60)
try:
    import pikepdf
    for lang, out_path in OUTPUT.items():
        if os.path.exists(out_path):
            with pikepdf.open(out_path) as pdf:
                pages = len(pdf.pages)
            print(f"{lang.upper()} PDF: {pages} pages  ({os.path.getsize(out_path)/1024:.1f} KB)")
except ImportError:
    # Fall back to a simple byte-count heuristic
    try:
        import subprocess as sp
        for lang, out_path in OUTPUT.items():
            if os.path.exists(out_path):
                with open(out_path, "rb") as f:
                    data = f.read()
                count = data.count(b"/Type /Page\n") + data.count(b"/Type/Page\n") + data.count(b"/Type /Page ")
                print(f"{lang.upper()} PDF: ~{count} pages  ({os.path.getsize(out_path)/1024:.1f} KB)")
    except Exception as e:
        print(f"Page count unavailable: {e}")
        for lang, out_path in OUTPUT.items():
            if os.path.exists(out_path):
                print(f"{lang.upper()} PDF: {os.path.getsize(out_path)/1024:.1f} KB")

# ── Cleanup temp files ─────────────────────────────────────────────────────
for f in tmp_files:
    try:
        os.unlink(f)
    except Exception:
        pass

print("\nDone.")
