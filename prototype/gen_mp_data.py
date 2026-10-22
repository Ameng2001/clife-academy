# -*- coding: utf-8 -*-
"""从 src/academy.body.html 抽出课程数据块（ORG…DRILLS），生成小程序的 miniprogram/utils/data.js。
H5 与小程序共用同一份课程数据；改课程只改 src/academy.body.html，然后跑 python3 gen_mp_data.py。"""
import io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
src = io.open(os.path.join(HERE, "src", "academy.body.html"), encoding="utf-8").read()
a = src.index("const ORG=")
b = src.index("/* ════════════════ 状态")
block = src[a:b].rstrip()
# 附加：场景→图标键、学习人数（小程序卡片用）
c = src.index("const SKMAP=")
d = src.index("\n", src.index("const LEARN="))
extra = src[c:d]
out = ("// 由 gen_mp_data.py 从 ../src/academy.body.html 生成，不要手改\n"
       + block + "\n" + extra + "\n"
       + "// 岗位路径的键；领域路径（extra.js，手写）合在后面\n"
       + "const ROLE_PATHS=Object.keys(PATHS);\n"
       + "const X=require('./extra.js');Object.assign(PATHS,X.PATHS);for(const k in (X.APPEND||{}))PATHS[k]=(PATHS[k]||[]).concat(X.APPEND[k]);Object.assign(PATHN,X.PATHN);Object.assign(SKMAP,X.SKMAP||{});Object.assign(ROLES,X.ROLES||{});const PATH_META=X.META;\n"
       + "module.exports={ORG,ROLES,PATHN,PATHS,ROLE_PATHS,PATH_META,OBS,PROBES,STAFF,FILES,LIVES,REPLAYS,DRILLS,SKMAP,LEARN};\n")
dst = os.path.join(HERE, "..", "miniprogram", "utils", "data.js")
os.makedirs(os.path.dirname(dst), exist_ok=True)
io.open(dst, "w", encoding="utf-8").write(out)
print("data.js", len(out.encode()), "bytes")
