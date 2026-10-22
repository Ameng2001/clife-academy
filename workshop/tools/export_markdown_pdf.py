from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess, tempfile, re, sys, html

STYLE = '''
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; margin: 36px auto; max-width: 980px; line-height: 1.65; color: #222; }
h1,h2,h3,h4 { color: #111; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
th, td { border: 1px solid #d0d7de; padding: 8px 10px; vertical-align: top; }
th { background: #f6f8fa; }
blockquote { color: #57606a; border-left: 4px solid #d0d7de; padding-left: 12px; margin-left: 0; }
.mermaid { margin: 20px 0; text-align: center; }
@page { size: A4; margin: 16mm 14mm; }
</style>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
</script>
'''


def convert_one(md: Path, out_pdf: Path):
    text = md.read_text(encoding='utf-8')
    blocks = []

    def repl(match):
        idx = len(blocks)
        blocks.append(match.group(1))
        return f"MERMAID_PLACEHOLDER_{idx}"

    placeholder_md = re.sub(r'```mermaid\n(.*?)\n```', repl, text, flags=re.S)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        tmp_md = td / 'input.md'
        tmp_html = td / 'out.html'
        tmp_md.write_text(placeholder_md, encoding='utf-8')
        subprocess.run([
            '/opt/anaconda3/bin/pandoc', str(tmp_md), '-s', '-f', 'gfm', '-t', 'html5', '-o', str(tmp_html),
            '--metadata', f'title={md.stem}'
        ], check=True)
        html_text = tmp_html.read_text(encoding='utf-8')
        for i, block in enumerate(blocks):
            escaped = html.escape(block)
            pattern = f'<p>MERMAID_PLACEHOLDER_{i}</p>'
            replacement = f'<div class="mermaid">\n{escaped}\n</div>'
            html_text = html_text.replace(pattern, replacement)
        html_text = html_text.replace('</head>', STYLE + '\n</head>')
        tmp_html.write_text(html_text, encoding='utf-8')
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(tmp_html.resolve().as_uri(), wait_until='networkidle')
            page.wait_for_timeout(2200)
            out_pdf.parent.mkdir(parents=True, exist_ok=True)
            page.pdf(path=str(out_pdf), format='A4', print_background=True,
                     margin={'top': '12mm', 'right': '10mm', 'bottom': '12mm', 'left': '10mm'})
            browser.close()


def main(argv):
    if len(argv) < 3 or len(argv) % 2 == 0:
        print('usage: export_markdown_pdf.py in1.md out1.pdf [in2.md out2.pdf ...]')
        return 2
    args = argv[1:]
    for i in range(0, len(args), 2):
        src = Path(args[i])
        dst = Path(args[i+1])
        convert_one(src, dst)
        print(dst)
    return 0

if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
