# -*- coding: utf-8 -*-
"""src/academy.body.html（Artifact 片段，无 html/head/body 外壳）→ 可独立打开的 学前大课堂.html。
源文件只有 src/ 一份；改完跑 `python3 build.py` 重新生成。"""
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))
RESET = """  <style>
    /* 与 Artifact 运行时等价的基础重置，保证独立打开时表现一致 */
    :root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
    html,body{margin:0}
    body{font:14px/1.6 system-ui,-apple-system,"Noto Sans SC",sans-serif}
    img{max-width:100%}
    [hidden]{display:none!important}
  </style>"""

for name, out in (("academy", "学前大课堂"),):
    src = os.path.join(HERE, "src", name + ".body.html")
    s = io.open(src, encoding="utf-8").read()
    i = s.index("</style>") + len("</style>")          # 头部止于第一个 </style>
    head, body = s[:i], s[i:]
    html = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + RESET + "\n" + head + "\n</head>\n<body>" + body + "\n</body>\n</html>\n")
    dst = os.path.join(HERE, out + ".html")
    io.open(dst, "w", encoding="utf-8").write(html)
    print("%-22s → %s (%d bytes)" % (os.path.basename(src), out + ".html", len(html.encode())))
