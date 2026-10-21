# -*- coding: utf-8 -*-
"""从大课堂 H5 原型（academy.body.html）抽出课程数据块，生成 frontend/src/lib/lessons-data.js（ESM）。
用法：python3 scripts/import-lessons.py <academy.body.html 路径>
课程内容改在原型里，改完重跑；本文件输出不要手改。"""
import io, os, sys, re
src_path = sys.argv[1]
src = io.open(src_path, encoding="utf-8").read()
a = src.index("const ORG=")
b = src.index("/* ════════════════ 状态")
block = src[a:b].rstrip()
c = src.index("const SKMAP=")
d = src.index("\n", src.index("const LEARN="))
extra = src[c:d]
names = "ORG,ROLES,PATHN,PATHS,OBS,PROBES,STAFF,FILES,LIVES,REPLAYS,DRILLS,SKMAP,LEARN"
out = ("// 由 scripts/import-lessons.py 从大课堂原型 academy.body.html 生成，不要手改。\n"
       "// 课程数据：岗位、路径、关卡（讲看做测）、全日观察特辑、体检探针、资料、直播、练兵、能力地图。\n"
       "/* eslint-disable */\n" + block + "\n" + extra + "\n"
       + "export {" + names + "};\n"
       + "export default {" + names + "};\n")
here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, "..", "frontend", "src", "lib", "lessons-data.js")
io.open(dst, "w", encoding="utf-8").write(out)
print(dst, len(out.encode()), "bytes")
