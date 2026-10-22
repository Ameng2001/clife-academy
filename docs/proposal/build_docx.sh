#!/bin/zsh
# 建议书 md → Word（公文格式）。pandoc 出稿后补页面设置（A4、上37下35左28右26mm）、页脚页码、表格内文字样式。
set -e; cd "$(dirname "$0")"
SRC="${1:-继续教育学时认定-回填说明}"; MODE="${2:-doc}"; OUT="$SRC.docx"
if [ "$MODE" = letter ]; then TOC=""; else TOC="--toc --toc-depth=2 -M toc-title=目录"; fi
pandoc "$SRC.md" -o "$OUT" ${=TOC} -M lang=zh-CN --reference-doc=reference.docx --columns=10
python3 - "$OUT" <<'PY'
import sys,zipfile,re,shutil,os
out=sys.argv[1]; tmp=out+'.tmp'
zin=zipfile.ZipFile(out); zout=zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED)
sect='<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2098" w:right="1474" w:bottom="1984" w:left="1587" w:header="851" w:footer="1247" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:type="lines" w:linePitch="312"/></w:sectPr>'
names=zin.namelist()
rels=zin.read('word/_rels/document.xml.rels').decode('utf-8')
m=re.search(r'Id="([^"]+)"[^>]*Target="footer1.xml"',rels) or re.search(r'Target="footer1.xml"[^>]*Id="([^"]+)"',rels)
ftr_id=m.group(1) if m else 'rIdFtr1'
sect=sect.replace('r:id="rIdFtr1"','r:id="%s"'%ftr_id)
for n in names:
    data=zin.read(n)
    if n=='word/document.xml':
        d=data.decode('utf-8')
        d=re.sub(r'<w:sectPr\s*/>|<w:sectPr>.*?</w:sectPr>',sect,d,count=1,flags=re.S)
        if 'xmlns:r=' not in d[:3000]:
            d=d.replace('<w:document ','<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',1)
        # 表格单元格内段落统一用 TableText 样式
        def fix_tc(m):
            tc=m.group(0)
            tc=re.sub(r'<w:pPr>\s*<w:pStyle w:val="[^"]*"\s*/>', '<w:pPr><w:pStyle w:val="TableText"/>', tc)
            tc=re.sub(r'<w:p>(?!\s*<w:pPr>)', '<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>', tc)
            tc=re.sub(r'<w:p ([^>]*)>(?!\s*<w:pPr>)', r'<w:p \1><w:pPr><w:pStyle w:val="TableText"/></w:pPr>', tc)
            tc=re.sub(r'<w:pPr>(?!\s*<w:pStyle)', '<w:pPr><w:pStyle w:val="TableText"/>', tc)
            return tc
        d=re.sub(r'<w:tc>.*?</w:tc>',fix_tc,d,flags=re.S)
        # 含图片的段落：正文样式是 28 磅固定行距，内嵌图会被裁成一条线，改为单倍行距并居中
        def fix_fig(m):
            p=m.group(0)
            sp='<w:spacing w:before="120" w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>'
            if '<w:pPr>' in p:
                p=re.sub(r'<w:pPr>(.*?)</w:pPr>', lambda mm:'<w:pPr>'+re.sub(r'<w:(spacing|ind|jc)\b[^>]*/>','',mm.group(1))+sp+'</w:pPr>', p, count=1, flags=re.S)
            else:
                p=p.replace('<w:p>','<w:p><w:pPr>'+sp+'</w:pPr>',1)
            return p
        d=re.sub(r'<w:p(?:\s[^>]*)?>(?:(?!</w:p>).)*?<w:drawing>.*?</w:p>',fix_fig,d,flags=re.S)
        # 图题段落（ImageCaption）同样改单倍行距居中
        d=re.sub(r'<w:pPr><w:pStyle w:val="ImageCaption"\s*/></w:pPr>','<w:pPr><w:pStyle w:val="ImageCaption"/><w:spacing w:before="0" w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>',d)
        data=d.encode('utf-8')
    elif n=='word/_rels/document.xml.rels':
        r=data.decode('utf-8')
        if 'footer1.xml' not in r:
            r=r.replace('</Relationships>','<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Id="rIdFtr1" Target="footer1.xml"/></Relationships>')
        data=r.encode('utf-8')
    elif n=='[Content_Types].xml':
        c=data.decode('utf-8')
        if 'footer1.xml' not in c:
            c=c.replace('</Types>','<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
        data=c.encode('utf-8')
    zout.writestr(n,data)
if 'word/footer1.xml' not in names:
    zout.writestr('word/footer1.xml', zipfile.ZipFile('reference.docx').read('word/footer1.xml'))
zin.close(); zout.close(); shutil.move(tmp,out); print('docx patched')
PY
# 表格改固定布局：gridCol 按正文宽度 8845 dxa 等比缩放，并给每个单元格写 tcW，防止 Word/WPS 自动适应时溢出右页边
python3 - "$OUT" <<'PY'
import sys,zipfile,re,shutil
out=sys.argv[1]; tmp=out+'.tmp'; TW=8845
zin=zipfile.ZipFile(out); zout=zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED)
def fix_tbl(m):
    t=m.group(0)
    cols=[int(x) for x in re.findall(r'<w:gridCol w:w="(\d+)"',t)]
    if not cols: return t
    s=sum(cols); cols=[int(c*TW/s) for c in cols]
    it=iter(cols); t=re.sub(r'<w:gridCol w:w="\d+"\s*/>',lambda mm:'<w:gridCol w:w="%d"/>'%next(it),t)
    t=re.sub(r'(<w:tblW [^>]*/>)',r'\1<w:tblLayout w:type="fixed"/>',t,count=1)
    t=re.sub(r'<w:tblLayout [^>]*/>(?=.*<w:tblLayout )','',t,flags=re.S)
    def fix_tr(mr):
        tr=mr.group(0); i=[0]
        def fix_tc(mc):
            tc=mc.group(0); w=cols[min(i[0],len(cols)-1)]; i[0]+=1
            tc=re.sub(r'<w:tcW [^>]*/>','',tc)
            if '<w:tcPr>' in tc: tc=tc.replace('<w:tcPr>','<w:tcPr><w:tcW w:w="%d" w:type="dxa"/>'%w,1)
            else: tc=tc.replace('<w:tc>','<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/></w:tcPr>'%w,1)
            return tc
        return re.sub(r'<w:tc>.*?</w:tc>',fix_tc,tr,flags=re.S)
    return re.sub(r'<w:tr>.*?</w:tr>|<w:tr [^>]*>.*?</w:tr>',fix_tr,t,flags=re.S)
for n in zin.namelist():
    data=zin.read(n)
    if n=='word/document.xml':
        data=re.sub(r'<w:tbl>.*?</w:tbl>',fix_tbl,data.decode('utf-8'),flags=re.S).encode('utf-8')
    zout.writestr(n,data)
zin.close(); zout.close(); shutil.move(tmp,out); print('tables fixed-layout')
PY
