# -*- coding: utf-8 -*-
"""第 6 关白板微课：按逐字稿四幕绘制线稿 PNG，并生成白板动画 Skill 所需的同名 annotation.json。
用法：python3 build_scenes.py <lines.json> <输出目录>
lines.json 由旁白合成步骤生成（每条字幕的 scene / text / start / end，单位秒）。
线稿规范取自 srt-whiteboard-animation：16:9、#F5EBD7 纸底、深灰素描线、红橙蓝少量点缀、画面无文字。"""
import json, math, random, sys, os
from PIL import Image, ImageDraw

W, H, S = 1672, 941, 2                      # 原图尺寸与超采样倍数
PAPER = (245, 235, 215)
INK = (58, 58, 58)
RED, ORANGE, BLUE = (214, 84, 77), (232, 147, 58), (74, 127, 193)
TINT = lambda c, a=0.22: tuple(int(PAPER[i] * (1 - a) + c[i] * a) for i in range(3))

# ---------------- 手绘笔触 ----------------
def resample(pts, step=6):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        out += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
    out.append(pts[-1]); return out

class Pen:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.img = Image.new('RGB', (W * S, H * S), PAPER)
        self.d = ImageDraw.Draw(self.img)
        self.boxes = []                    # 当前元素的包围盒累加
    def _track(self, pts, pad=0):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        self.boxes.append((min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad))
    def wobble(self, pts, amp=1.6):
        pts = resample(pts); ph = self.rng.random() * 6.28; f = self.rng.uniform(.04, .08)
        return [(x + amp * math.sin(i * f + ph), y + amp * math.cos(i * f * 1.3 + ph)) for i, (x, y) in enumerate(pts)]
    def line(self, pts, color=INK, w=4.2, closed=False, passes=2):
        if closed: pts = pts + [pts[0]]
        self._track(pts, w)
        for k in range(passes):
            q = self.wobble(pts, 1.8 if k else 1.2)
            q = [(x * S, y * S) for x, y in q]
            self.d.line(q, fill=color if k == 0 else tuple(min(255, c + 40) for c in color), width=int(w * S * (1 if k == 0 else .55)), joint='curve')
            r = w * S / 2
            for x, y in (q[0], q[-1]): self.d.ellipse((x - r, y - r, x + r, y + r), fill=color if k == 0 else tuple(min(255, c + 40) for c in color))
    def fill(self, pts, color):
        self._track(pts)
        self.d.polygon([(x * S, y * S) for x, y in self.wobble(pts, 1)], fill=color)
    # 形状
    def rect(self, x, y, rw, rh, r=10, **k):
        pts = []
        for cx, cy, a0 in ((x + rw - r, y + r, -90), (x + rw - r, y + rh - r, 0), (x + r, y + rh - r, 90), (x + r, y + r, 180)):
            pts += [(cx + r * math.cos(math.radians(a0 + t * 9)), cy + r * math.sin(math.radians(a0 + t * 9))) for t in range(11)]
        if k.pop('tint', None): self.fill(pts, k.pop('tc'))
        self.line(pts, closed=True, **k); return pts
    def ellipse(self, cx, cy, rx, ry, a0=0, a1=360, tint=None, **k):
        n = max(12, int(abs(a1 - a0) / 6))
        pts = [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * t / n)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * t / n))) for t in range(n + 1)]
        if tint: self.fill(pts, tint)
        self.line(pts, **k); return pts
    def arrow(self, x0, y0, x1, y1, color=INK, w=4.2, head=18):
        self.line([(x0, y0), (x1, y1)], color=color, w=w)
        a = math.atan2(y1 - y0, x1 - x0)
        for s in (-1, 1):
            self.line([(x1, y1), (x1 - head * math.cos(a + s * .5), y1 - head * math.sin(a + s * .5))], color=color, w=w)
    def person(self, cx, top, s=1.0, color=INK):
        self.ellipse(cx, top + 26 * s, 24 * s, 24 * s, color=color)
        self.line([(cx - 46 * s, top + 140 * s), (cx - 40 * s, top + 80 * s), (cx, top + 60 * s), (cx + 40 * s, top + 80 * s), (cx + 46 * s, top + 140 * s)], color=color)
    def thermo(self, x, y, h=120, color=RED):
        self.rect(x - 11, y, 22, h, r=11)
        self.ellipse(x, y + h + 8, 20, 20, tint=TINT(color, .55))
        self.line([(x, y + h + 4), (x, y + h * .35)], color=color, w=7)
    # 元素分组
    def begin(self): self.boxes = []
    def end(self, pad=24):
        x0 = min(b[0] for b in self.boxes) - pad; y0 = min(b[1] for b in self.boxes) - pad
        x1 = max(b[2] for b in self.boxes) + pad; y1 = max(b[3] for b in self.boxes) + pad
        x0, y0 = max(0, int(x0)), max(0, int(y0)); x1, y1 = min(W, int(x1)), min(H, int(y1))
        return {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}
    def save(self, path): self.img.resize((W, H), Image.LANCZOS).save(path)

# ---------------- 四幕画面（每个元素对应一条字幕） ----------------
def scene1(p):
    E = []
    p.begin()   # 晨检：园门＋额温枪
    p.line([(110, 700), (110, 330)]); p.line([(330, 700), (330, 330)])
    p.ellipse(220, 330, 110, 70, 180, 360)
    p.line([(80, 700), (360, 700)])
    p.rect(250, 470, 120, 46, r=14, tint=1, tc=TINT(ORANGE, .45)); p.line([(270, 516), (262, 590), (296, 590), (300, 516)])
    p.ellipse(395, 492, 10, 10, color=ORANGE)
    E.append(('晨检', '晨检场景铺垫', p.end()))
    p.begin()   # 只管入园那一刻：时钟
    p.ellipse(640, 300, 105, 105, tint=TINT(BLUE, .12))
    p.line([(640, 300), (640, 225)], w=5); p.line([(640, 300), (585, 330)], w=5)
    for k in range(12):
        a = math.radians(k * 30); p.line([(640 + 88 * math.cos(a), 300 + 88 * math.sin(a)), (640 + 98 * math.cos(a), 300 + 98 * math.sin(a))], w=3)
    p.line([(560, 450), (560, 470), (720, 470), (720, 450)], color=BLUE)
    E.append(('入园那一刻', '晨检只覆盖入园时点', p.end()))
    p.begin()   # 午睡发热、户外咳嗽
    p.rect(820, 500, 330, 70, r=18); p.line([(840, 570), (840, 640)]); p.line([(1130, 570), (1130, 640)])
    p.rect(840, 455, 110, 52, r=22, tint=1, tc=TINT(BLUE, .2))
    p.ellipse(1040, 480, 95, 38, 180, 360)
    p.thermo(1215, 300, 150)
    for k, (cx, cy, r) in enumerate([(930, 380, 16), (965, 345, 22), (1010, 318, 28)]):
        p.ellipse(cx, cy, r, r, color=BLUE, w=3.4)
    E.append(('午睡后与户外', '晨检之后出现的异常', p.end()))
    p.begin()   # 晨检记录里看不到
    p.rect(1340, 240, 220, 300, r=14)
    p.rect(1405, 222, 90, 36, r=10, tint=1, tc=TINT(INK, .15))
    for k in range(3): p.line([(1370, 300 + k * 44), (1530, 300 + k * 44)], w=3.2)
    p.line([(1370, 440), (1530, 440), (1530, 510), (1370, 510)], color=BLUE, w=3, closed=True, passes=1)
    p.ellipse(1450, 640, 70, 34, color=INK); p.ellipse(1450, 640, 18, 18, tint=TINT(BLUE, .5))
    p.line([(1385, 690), (1515, 590)], color=RED, w=5)
    E.append(('晨检记录', '晨检记录里缺少这些情况', p.end()))
    return E

def scene2(p):
    E = []
    p.begin()   # 全日观察：带眼睛的记录本
    p.rect(110, 210, 240, 320, r=16, tint=1, tc=TINT(BLUE, .1))
    p.line([(140, 210), (140, 530)], w=3)
    p.ellipse(240, 360, 70, 34); p.ellipse(240, 360, 20, 20, tint=TINT(BLUE, .55))
    E.append(('全日观察入口', '一天中记录异常的固定入口', p.end()))
    p.begin()   # 一日时间轴：入园 午餐 午睡 离园
    p.line([(430, 760), (1580, 760)], w=5)
    xs = [520, 800, 1080, 1360]
    for x in xs: p.line([(x, 745), (x, 775)], w=4)
    p.rect(485, 590, 70, 110, r=8); p.ellipse(538, 648, 6, 6)                       # 门
    p.ellipse(800, 650, 70, 40, 0, 180, tint=TINT(ORANGE, .3)); p.line([(722, 650), (878, 650)])  # 碗
    p.rect(1015, 650, 130, 40, r=12); p.ellipse(1100, 610, 26, 26, 60, 330, color=BLUE)  # 床与月亮
    p.line([(1305, 640), (1360, 590), (1415, 640)]); p.rect(1318, 640, 84, 60, r=4)     # 房子
    E.append(('一日四个时段', '入园、午餐、午睡、离园', p.end()))
    p.begin()   # 在哪个时段发现：红色标记
    p.ellipse(1080, 470, 34, 34, tint=TINT(RED, .5), color=RED)
    p.line([(1052, 490), (1080, 545), (1108, 490)], color=RED)
    E.append(('发现时段', '在发现的时段记录', p.end(18)))
    p.begin()   # 记录卡：幼儿、观察老师、体温、精神状态
    p.rect(470, 90, 520, 300, r=18)
    p.person(560, 140, .8); p.person(680, 120, 1.0)
    p.thermo(800, 140, 120, color=ORANGE)
    p.line([(860, 220), (885, 200), (910, 225), (935, 200), (960, 220)], color=BLUE, w=4)
    p.line([(860, 300), (960, 300)], w=3); p.line([(860, 335), (930, 335)], w=3)
    E.append(('记录内容', '选幼儿与观察老师，写体温与精神状态', p.end()))
    return E

def scene3(p):
    E = []
    p.begin()   # 发热待查：记录卡＋放大镜
    p.rect(100, 230, 300, 380, r=16)
    p.thermo(180, 290, 140)
    for k in range(3): p.line([(240, 310 + k * 50), (360, 310 + k * 50)], w=3)
    p.ellipse(330, 520, 48, 48, color=BLUE, tint=TINT(BLUE, .15)); p.line([(364, 555), (420, 620)], color=BLUE, w=7)
    E.append(('发热待查', '需要继续跟进的情况', p.end()))
    p.begin()   # 点「登记疾病」
    p.ellipse(620, 430, 70, 70, tint=TINT(RED, .45), color=RED)
    p.line([(620, 395), (620, 465)], color=RED, w=7); p.line([(585, 430), (655, 430)], color=RED, w=7)
    for r in (95, 120): p.ellipse(620, 430, r, r, 200, 250, color=INK, w=3)
    p.line([(660, 560), (640, 480), (670, 470), (700, 540), (720, 520), (735, 560), (700, 610), (665, 600)])
    E.append(('登记疾病', '在记录上点登记疾病', p.end()))
    p.begin()   # 进入疾病管理：箭头进文件夹
    p.arrow(780, 430, 880, 430)
    p.line([(900, 330), (980, 330), (1000, 355), (1110, 355), (1110, 540), (900, 540)], closed=True)
    p.line([(1005, 410), (1005, 490)], color=RED, w=7); p.line([(965, 450), (1045, 450)], color=RED, w=7)
    E.append(('疾病管理', '自动进入疾病管理', p.end()))
    p.begin()   # 追踪 → 康复 → 复课，同一条记录
    ys = [200, 430, 660]
    for y in ys: p.ellipse(1380, y, 62, 62)
    p.line([(1380, 262), (1380, 368)], w=3.4); p.line([(1380, 492), (1380, 598)], w=3.4)
    p.ellipse(1372, 192, 24, 24, color=INK, w=3.4); p.line([(1390, 210), (1410, 232)], w=4)       # 追踪：小放大镜
    p.line([(1350, 432), (1372, 455), (1414, 405)], color=BLUE, w=6)                            # 康复：对勾
    p.line([(1345, 675), (1380, 638), (1415, 675)]); p.rect(1352, 675, 56, 30, r=3)              # 复课：园舍
    p.line([(1470, 180), (1500, 180), (1500, 680), (1470, 680)], color=ORANGE, w=4)
    E.append(('一条记录到底', '追踪、康复、复课接在同一条记录上', p.end()))
    return E

def scene4(p):
    E = []
    p.begin()   # 园长工作台的疾病看板
    p.rect(100, 160, 520, 340, r=14); p.line([(330, 500), (330, 570)]); p.line([(250, 575), (410, 575)])
    p.line([(150, 450), (570, 450)], w=3)
    for k, h in enumerate([60, 100, 80, 140]): p.rect(180 + k * 95, 450 - h, 50, h, r=4, w=3.4)
    E.append(('疾病看板', '每条登记汇总到看板', p.end()))
    p.begin()   # 同一个班连着几天出现相似症状
    for k in range(3):
        x = 690 + k * 135
        p.rect(x, 250, 110, 140, r=10); p.line([(x, 285), (x + 110, 285)], w=3)
        p.ellipse(x + 55, 345, 22, 22, tint=TINT(ORANGE, .55), color=ORANGE)
    p.line([(690, 430), (1080, 430)], color=ORANGE, w=4)
    E.append(('连续几天', '同一个班连续出现相似症状', p.end()))
    p.begin()   # 提示加强晨检和消毒：铃铛＋喷壶
    p.line([(1180, 330), (1185, 250), (1225, 215), (1265, 250), (1270, 330)]); p.line([(1160, 330), (1290, 330)])
    p.ellipse(1225, 345, 14, 14, tint=TINT(ORANGE, .6), color=ORANGE)
    for s in (-1, 1): p.line([(1225 + s * 80, 230), (1225 + s * 100, 210)], color=ORANGE, w=3.4)
    p.rect(1400, 260, 90, 140, r=14, tint=1, tc=TINT(BLUE, .25)); p.line([(1420, 260), (1420, 220), (1470, 220), (1500, 235)])
    for k in range(3): p.ellipse(1530 + k * 14, 225 + k * 6, 4, 4, color=BLUE, w=3)
    E.append(('加强晨检和消毒', '看板提示处置措施', p.end()))
    p.begin()   # 保健医记得及时，园长看得早
    p.person(1210, 560, 1.0); p.line([(1185, 556), (1235, 556)], color=RED, w=4)
    p.arrow(1290, 640, 1410, 640, color=BLUE)
    p.person(1480, 560, 1.0); p.ellipse(1480, 760, 46, 22); p.ellipse(1480, 760, 10, 10, tint=TINT(BLUE, .6))
    E.append(('及时与看早', '保健医及时记录，园长及早发现', p.end()))
    return E

SCENES = [('scene-01-chenjian', scene1), ('scene-02-quanri', scene2), ('scene-03-dengji', scene3), ('scene-04-kanban', scene4)]

def main(lines_json, outdir):
    L = json.load(open(lines_json, encoding='utf-8'))
    lines, total = L['lines'], L['total']
    os.makedirs(outdir, exist_ok=True)
    by = {}
    for l in lines: by.setdefault(l['scene'], []).append(l)
    bounds = []
    for k in range(1, 5):
        s = 0 if k == 1 else (by[k - 1][-1]['end'] + by[k][0]['start']) / 2
        e = total if k == 4 else (by[k][-1]['end'] + by[k + 1][0]['start']) / 2
        bounds.append((s, e))
    for k, (name, fn) in enumerate(SCENES, 1):
        p = Pen(k); els = fn(p); p.save(os.path.join(outdir, name + '.png'))
        s0, s1 = bounds[k - 1]; cues = by[k]
        assert len(cues) == len(els), (name, len(cues), len(els))
        elements = []
        for i, ((label, role, reg), cue) in enumerate(zip(els, cues), 1):
            st = int((cue['start'] - s0) * 1000) - 200
            nxt = int((cues[i]['start'] - s0) * 1000) - 300 if i < len(cues) else int((s1 - s0) * 1000) - 700
            dur = max(1200, min(nxt - st, int((cue['end'] - cue['start']) * 1000) + 600))
            elements.append({'id': f'e{i}', 'label': label, 'sequence': i, 'narrativeRole': role, 'subtitle': cue['text'], 'type': 'object',
                             'region': reg, 'reveal': {'direction': 'left_to_right', 'startMs': max(0, st), 'durationMs': dur, 'maskPaddingPx': 18, 'protectedRegions': []},
                             'handPath': {'start': [reg['x'], reg['y'] + reg['height'] // 2], 'end': [reg['x'] + reg['width'], reg['y'] + reg['height'] // 2], 'easing': 'easeInOut'}})
        ann = {'sceneId': name[:8], 'canvas': {'width': W, 'height': H}, 'storyBasis': '；'.join(c['text'] for c in cues),
               'sceneDurationMs': int(round((s1 - s0) * 1000)), 'elements': elements}
        json.dump(ann, open(os.path.join(outdir, name + '.annotation.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(name, ann['sceneDurationMs'], [(e['label'], e['reveal']['startMs'], e['reveal']['durationMs']) for e in elements])

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
