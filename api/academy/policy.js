/* 口径库（docs/ROADMAP.md 第十三节第 5 条）：平台的红线原来散在各模块的 SYSTEM 提示、校验与注释里，这里合成一份，各处引用同一份。
 *   - 给模型的：各模块的 SYSTEM 提示用 systemRules() 拼出「规矩」段，不再各写各的
 *   - 给人的：GET /api/policy 不登录也给，网页 /policy、登录前页「三条原则」、运营后台「平台口径」、MCP policy 工具都读它
 * 改口径只改这一个文件；哪条管哪里见 where。不在这里做文本过滤（幼儿姓名识别做不准），过滤仍在各模块按字段收口。 */

export const VERSION = '2026-10-22';

export const RULES = Object.freeze([
  { id: 'child-data', title: '不碰幼儿数据', text: '不用数字产品生成观察记录、不评价任何幼儿、不给幼儿贴标签；作品与案例里不出现幼儿姓名与正脸；平台只记教师自己的学习。',
    why: '2026 年学前教育数字产品的政策底线；平台是教师的，不是孩子的。', where: ['提交作品', '专家案例', '答疑助手', 'Coach', '讲堂包', '轻形态'],
    prompt: '不出现任何幼儿姓名或个人信息；不生成观察记录、不评价幼儿、不给幼儿贴标签。' },
  { id: 'child-screen', title: '幼儿不对屏', text: '平台的全部内容面向成人（教师、园长、家长），不做任何让幼儿看屏幕的内容或环节。',
    why: '学前阶段减少屏幕暴露是共识，也是市里的口径。', where: ['课包', '轻形态', '名师讲堂'], prompt: '内容只给成人看，不写让幼儿对着屏幕的环节。' },
  { id: 'no-ranking', title: '不排名、不比较', text: '不排个人、不排园所、不排区县；园所之间只给中位数，且其他园不少于 3 所；个人分数只有本人看得到；汇总只给岗位、人数、比例，不列名单。',
    why: '一排名就变成考核，教师就会应付；研修平台要的是用起来。', where: ['园长看板', '区县看板', '与其他园对照', 'MCP', '周报', '斗课'],
    prompt: '不排名、不比较同事或园所；不说谁比谁好。' },
  { id: 'work-not-person', title: '评作品不评人', text: '点评、量表、斗课打分都对作品，不对人；点评写的是这份作品改哪一处，不是这位教师怎么样。',
    why: '评人会伤人，评作品能改进。', where: ['点评队列', '斗课', '自评与三方评', 'Coach'], prompt: '不评价教师这个人，只说事与下一步。' },
  { id: 'ai-drafts', title: 'AI 只起草，人来定', text: '规则定结构，模型只改措辞；Coach 的建议采用与否本人定；答疑助手只整理与起草，由种子教师或讲师回答；讲堂包与轻形态的草稿由作者改定。没接模型时规则草稿照样可用。',
    why: '模型会编；结构与事实由规则和人把关，模型只负责说人话。', where: ['Coach', '答疑', '讲堂包', '轻形态'],
    prompt: '只根据给你的材料改措辞，不新增材料里没有的内容、做法与数据；结构照草稿，不改条数与顺序。' },
  { id: 'no-checkin', title: '不打卡、不催、不迎检', text: '没有签到、连续天数、学习时长排行；提醒只在本人预约的那一场开播前发一条，不发「今天有课」；不做为了检查留痕的功能。',
    why: '打卡制造的是数据，不是学习。', where: ['订阅消息', '首页', '周报'], prompt: '不写口号，不催，不要求打卡。' },
  { id: 'credits-not-money', title: '学分换的是工具额度', text: '学分可以兑换教研工坊、观察评价等工具的使用额度；不是货币，不能提现、不能转让、不排行、兑了不可逆。',
    why: '把激励留在专业内，不让它变成另一套 KPI。', where: ['积分', '我的', '工具接口'], prompt: null },
  { id: 'real-name', title: '实名共享，署名跟着走', text: '专家案例实名、登录可见、不对外；改编别人的案例要记来源，原作者与改编者都署名；轻形态、讲堂包、分享日页脚都带作者。',
    why: '署名是对做事的人最直接的尊重，也是别人敢用的前提。', where: ['专家案例', '改编来源链', '轻形态', '分享日'], prompt: '引用别人的做法要保留出处与作者。' },
  { id: 'no-social-currency', title: '不做点赞与下载数墙', text: '不做点赞、收藏数、下载次数这类公开计数；「用过，有效」只给作者、本园园长与管理员看，用来找分享者，不公开。',
    why: '公开计数会把分享变成表演。', where: ['专家案例', '精品微课', '名师讲堂'], prompt: null },
  { id: 'plain', title: '句子短，像人在说话', text: '对教师与家长的文字不写口号、不夸大、不说教；先给做法再给依据；对家长不制造焦虑。',
    why: '教师每天看的字够多了。', where: ['答疑', 'Coach', '讲堂包', '轻形态', '公告'], prompt: '句子短，像人在说话；不写口号、不夸大、不说教。' }
]);

export const ruleOf = id => RULES.find(r => r.id === id) || null;

/** 拼给模型的「规矩」段：按 id 取有 prompt 的条，编号列出；不传 id 就取全部有 prompt 的。 */
export function systemRules(ids = null) {
  const list = (ids ? ids.map(ruleOf).filter(Boolean) : RULES).filter(r => r.prompt);
  return '规矩：\n' + list.map((r, i) => `${i + 1}. ${r.prompt}`).join('\n');
}

/** 给人看的 JSON（不登录也给）。 */
export function policyRoutes({ json }) {
  return {
    'GET /api/policy': async (req, res) => {
      json(res, 200, { version: VERSION, rules: RULES.map(({ id, title, text, why, where }) => ({ id, title, text, why, where })) });
    }
  };
}
