/* 资源库的内置条目（docs/ROADMAP.md 第四节「文献与政策」）：教育部文件原文链接。
 * 只放核对过能打开的地址；《评估指南》教育部原文页在 2026-10 核对时已下线，先指到基础教育司的文件列表页，由那里检索。
 * 内置条目 id 以 seed: 开头，不可改不可删；关卡引用条文（refs）按 match 里的书名跳到这里。 */
export const SEED = Object.freeze([
  { id: 'seed:guide-3-6', kind: 'policy', title: '《3–6 岁儿童学习与发展指南》', domain: null, desc: '教育部 2012 年印发。五大领域、各年龄段的典型表现与教育建议；观察与评价、游戏支持都以它为依据。', url: 'http://www.moe.gov.cn/srcsite/A06/s3327/201210/t20121009_143254.html', source: '教育部', year: 2012, match: ['《指南》', '《3-6岁儿童学习与发展指南》', '《3–6 岁儿童学习与发展指南》'] },
  { id: 'seed:standard', kind: 'policy', title: '《幼儿园教师专业标准（试行）》', domain: 'reflect', desc: '教育部 2012 年印发。专业理念与师德、专业知识、专业能力三个维度；大课堂的七个能力领域取自其中的专业能力。', url: 'http://www.moe.gov.cn/srcsite/A10/s6991/201209/t20120913_145603.html', source: '教育部', year: 2012, match: ['《幼儿园教师专业标准（试行）》', '《专业标准》'] },
  { id: 'seed:eval', kind: 'policy', title: '《幼儿园保育教育质量评估指南》', domain: 'obs', desc: '教育部 2022 年印发（教基〔2022〕1 号）。办园方向、保育与安全、教育过程、环境创设、教师队伍五个方面；「认真观察幼儿并做必要记录」「家园共育」等要点出自这里。原文页请在基础教育司文件列表检索。', url: 'http://www.moe.gov.cn/srcsite/A06/s3327/', source: '教育部', year: 2022, match: ['《幼儿园保育教育质量评估指南》', '《评估指南》'] },
  { id: 'seed:outline', kind: 'policy', title: '《幼儿园教育指导纲要（试行）》', domain: 'plan', desc: '教育部 2001 年印发。教育内容与要求、组织与实施、教育评价。', url: 'http://www.moe.gov.cn/srcsite/A06/s3327/200107/t20010702_81984.html', source: '教育部', year: 2001, match: ['《幼儿园教育指导纲要（试行）》', '《纲要》'] },
  { id: 'seed:rules', kind: 'policy', title: '《幼儿园工作规程》', domain: 'life', desc: '教育部 2016 年修订。一日生活、卫生保健、安全、家园共育的基本规定。', url: 'http://www.moe.gov.cn/srcsite/A02/s5911/moe_621/201602/t20160229_231184.html', source: '教育部', year: 2016, match: ['《幼儿园工作规程》'] }
]);
export const KINDS = Object.freeze({ policy: '文献与政策', template: '模板与工具', case: '案例', other: '其他' });
