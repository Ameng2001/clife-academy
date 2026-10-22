#!/bin/zsh
# 内部备查 md → PDF（内部阅读版式；页眉「内部备查 · 不对外」）。用法：./export_internal_pdf.sh <文件名不含扩展名>
set -e; cd "$(dirname "$0")"; N="$1"; T=$(mktemp -d)
cat > $T/int.css <<'CSS'
@page{size:A4;margin:20mm 18mm 18mm 18mm;
  @top-right{content:"内部备查 · 不对外";font-family:"PingFang SC",sans-serif;font-size:9pt;color:#b91c1c}
  @bottom-center{content:counter(page) " / " counter(pages);font-family:"Times New Roman",serif;font-size:9pt;color:#555}}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:10.5pt;line-height:1.7;color:#111;margin:0;max-width:none}
h1{font-size:16pt;margin:0 0 10pt;padding-bottom:6pt;border-bottom:2px solid #b91c1c;color:#111}
h2{font-size:12.5pt;margin:16pt 0 6pt;color:#1f3a5f;page-break-after:avoid}
h3{font-size:11pt;margin:12pt 0 4pt;color:#1f3a5f;page-break-after:avoid}
p{margin:5pt 0;text-align:justify}
blockquote{margin:6pt 0 10pt;padding:6pt 10pt;border-left:3px solid #b91c1c;background:#fef2f2;color:#7f1d1d}
blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:8pt 0 10pt;font-size:9.5pt;line-height:1.5}
tr{page-break-inside:avoid}
th,td{border:1px solid #bfc7d1;padding:4pt 6pt;vertical-align:top;text-align:left}
th{background:#eaf0f7;font-weight:600;white-space:nowrap}
td:first-child{white-space:nowrap}
ol,ul{margin:4pt 0;padding-left:22pt}
li{margin:3pt 0}
code{font-family:Menlo,monospace;font-size:9pt;background:#f3f4f6;padding:0 3px}
hr{border:none;border-top:1px solid #ccc;margin:12pt 0}
em{color:#555}
CSS
pandoc "$N.md" -s -M lang=zh-CN -M title=" " --css $T/int.css --self-contained -o $T/int.html 2>/dev/null
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/$N.pdf" "file://$T/int.html" 2>/dev/null
pdfinfo "$N.pdf" | grep Pages
