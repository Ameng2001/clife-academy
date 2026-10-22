#!/bin/zsh
# 建议书 md → HTML → PDF（Chrome 打印），公文格式：A4，上 37 下 35 左 28 右 26 mm，
# 正文仿宋三号 28 磅行距，一级标题黑体，二级标题楷体，标题小标宋二号。
# 本机若无仿宋/楷体，自动回落到宋体/黑体；装上 仿宋_GB2312、楷体_GB2312 后无需改动即生效。
set -e; cd "$(dirname "$0")"; SRC="${1:-继续教育学时认定-回填说明}"; MODE="${2:-doc}"; T=$(mktemp -d)
if [ "$MODE" = letter ]; then TOC=""; else TOC="--toc --toc-depth=2 -M toc-title=目录"; fi
cat > $T/doc.css <<'CSS'
@page{size:A4;margin:37mm 26mm 35mm 28mm;
  @bottom-center{content:"— " counter(page) " —";font-family:"Songti SC","SimSun",serif;font-size:14pt;color:#000}}
:root{
  --fs:"Times New Roman","仿宋_GB2312","FangSong","STFangsong","Songti SC","SimSun",serif;
  --kt:"Times New Roman","楷体_GB2312","KaiTi","STKaiti","Songti SC",serif;
  --ht:"Times New Roman","黑体","SimHei","Heiti SC","STHeiti",sans-serif;
  --xbs:"Times New Roman","方正小标宋简体","FZXiaoBiaoSong-B05S","Songti SC","STSong",serif;
}
body{font-family:var(--fs);font-size:16pt;line-height:28pt;color:#000;margin:0;padding:0;max-width:none}
header#title-block-header{text-align:center;page-break-after:always;padding-top:150pt}
header#title-block-header h1.title{font-family:var(--xbs);font-size:22pt;font-weight:700;line-height:36pt;margin:0 0 40pt;color:#000;border:none}
header#title-block-header p{font-family:var(--fs);font-size:16pt;line-height:28pt;text-indent:0;text-align:center;margin:6pt 0}
#TOC{page-break-after:always}
#TOC h1,#TOC h2,#toc-title{font-family:var(--ht);font-size:16pt;font-weight:400;text-align:center;letter-spacing:1em;text-indent:1em;margin:0 0 20pt;border:none;color:#000}
#TOC ul{list-style:none;padding:0;margin:0}
#TOC ul ul{padding-left:2em}
#TOC li{margin:0;line-height:28pt}
#TOC a{color:#000;text-decoration:none}
h1{font-family:var(--ht);font-size:16pt;font-weight:400;line-height:28pt;margin:14pt 0 0;color:#000;page-break-after:avoid;border:none;padding:0}
h2{font-family:var(--kt);font-size:16pt;font-weight:400;line-height:28pt;margin:8pt 0 0;color:#000;page-break-after:avoid}
p{margin:0;text-indent:2em;text-align:justify}
strong{font-weight:700}
ol,ul{margin:0;padding-left:2em}
li{margin:0}
li p{text-indent:0}
table{border-collapse:collapse;width:100%;margin:8pt 0 12pt;font-family:var(--fs);font-size:12pt;line-height:18pt;page-break-inside:auto}
tr{page-break-inside:avoid}
th,td{border:1px solid #000;padding:4pt 6pt;vertical-align:top;text-align:left;text-indent:0}
th{font-family:var(--ht);font-weight:400;text-align:center;white-space:nowrap}
td:first-child{white-space:nowrap}
td p,th p{text-indent:0;text-align:left}
pre{font-family:var(--fs);font-size:14pt;line-height:24pt;white-space:pre-wrap;margin:6pt 0 6pt 2em;background:none;border:none;padding:0}
code{font-family:inherit}
img{max-width:100%;display:block;margin:8pt auto}
figure{margin:8pt 0}
figcaption{text-align:center;text-indent:0;font-family:var(--ht);font-size:14pt;line-height:24pt}
hr{display:none}
blockquote{margin:0;padding-left:1em;border-left:2px solid #000}
CSS
pandoc "$SRC.md" -s ${=TOC} -M lang=zh-CN --css $T/doc.css --self-contained -o $T/doc.html 2>/dev/null
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/$SRC.pdf" "file://$T/doc.html" 2>/dev/null
pdfinfo "$SRC.pdf" | grep Pages
