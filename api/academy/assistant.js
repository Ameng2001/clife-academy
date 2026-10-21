/* 答疑助手的模型出口：一问一答，不保存对话，不读任何幼儿数据。
 *
 * 配置两条路，先 env 后 Coach：
 *   ASSISTANT_PROVIDER=anthropic|openai|compatible  ASSISTANT_BASE_URL  ASSISTANT_API_KEY  ASSISTANT_MODEL
 *   否则用 Coach 的实例配置（管理台里接的模型，HTTPS 提供方）。
 * 没配就 configured() 为 false，助手只做规则整理（相似问题、本关要点、相关案例），不出草稿。 */
import os from 'node:os';
import * as cfgStore from '../coach/config.js';
import { HTTP_PROVIDERS, baseUrlFor } from '../coach/core/providers.js';

const ENV = () => ({ provider: (process.env.ASSISTANT_PROVIDER || '').trim(), base: (process.env.ASSISTANT_BASE_URL || '').trim().replace(/\/+$/, ''), key: (process.env.ASSISTANT_API_KEY || '').trim(), model: (process.env.ASSISTANT_MODEL || '').trim() });
const TIMEOUT_MS = Math.max(5000, +process.env.ASSISTANT_TIMEOUT_MS || 25000);

/** 解析出 { provider, base, key, model } 或 null。 */
export function resolve() {
  const e = ENV();
  if (e.key || e.base) {
    const provider = HTTP_PROVIDERS[e.provider] ? e.provider : (e.base.includes('anthropic') ? 'anthropic' : 'compatible');
    const base = e.base || HTTP_PROVIDERS[provider].defaultBase;
    const model = e.model || HTTP_PROVIDERS[provider].defaultModel;
    if (base && model && (e.key || HTTP_PROVIDERS[provider].keyOptional)) return { provider, base, key: e.key, model, from: 'env' };
  }
  try {
    if (!cfgStore.isEnabled() || !cfgStore.isConnected()) return null;
    const cfg = cfgStore.load();
    if (!HTTP_PROVIDERS[cfg.provider]) return null;
    const env = cfgStore.jobEnv(os.tmpdir(), cfgStore.credentialFor(cfgStore.boundUidFor(cfg)));
    const key = env[HTTP_PROVIDERS[cfg.provider].apiKeyEnv] || '';
    const base = baseUrlFor(cfg.provider, cfg), model = cfgStore.modelFor(cfg);
    if (!base || !model || (!key && !HTTP_PROVIDERS[cfg.provider].keyOptional)) return null;
    return { provider: cfg.provider, base, key, model, from: 'coach' };
  } catch { return null; }
}
export const configured = () => !!resolve();

/** 一次调用：system ＋ user 文本 → 模型文本；失败返回 null（答疑不等模型，照样进队列）。 */
export async function complete({ system, prompt, maxTokens = 1200, fetchImpl = globalThis.fetch }) {
  const c = resolve();
  if (!c) return null;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let url, headers, body, read;
    if (c.provider === 'anthropic') {
      url = c.base + '/v1/messages';
      headers = { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01' };
      body = { model: c.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] };
      read = d => (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    } else if (c.provider === 'gemini') {
      url = `${c.base}/v1beta/models/${encodeURIComponent(c.model)}:generateContent?key=${encodeURIComponent(c.key)}`;
      headers = { 'content-type': 'application/json' };
      body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } };
      read = d => ((d.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('');
    } else {
      url = c.base + '/v1/chat/completions';
      headers = { 'content-type': 'application/json', ...(c.key ? { authorization: 'Bearer ' + c.key } : {}) };
      body = { model: c.model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
      read = d => (d.choices || [])[0]?.message?.content || '';
    }
    const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const text = data ? read(data) : '';
    return text ? { text, model: c.model, provider: c.provider } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** 模型答复里的 JSON（允许 ```json 围栏与前后废话）。 */
export function parseJson(text) {
  if (!text) return null;
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (m ? m[1] : text).trim();
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
}
