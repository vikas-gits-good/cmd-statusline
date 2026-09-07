// lib.ts
var GREEN = "\x1B[32m";
var YELLOW = "\x1B[33m";
var ORANGE = "\x1B[38;5;208m";
var RED = "\x1B[31m";
var RESET = "\x1B[0m";
var DIM = "\x1B[2m";
var PLAN_CREDITS = {
  "individual-go": 10,
  "individual-goat": 70,
  "individual-pro": 30,
  "individual-pro-v1": 80,
  "individual-provider": 15,
  "individual-max": 150,
  "individual-ultra": 300,
  "teams-pro": 40
};
var CONTEXT_WINDOWS = {
  "MiniMaxAI/MiniMax-M2.5": 2e5,
  "MiniMaxAI/MiniMax-M3": 1e6,
  "MiniMaxAI/MiniMax-M3-Free": 1e6,
  "Qwen/Qwen3.7-Flash": 1e6,
  "Qwen/Qwen3.7-Max": 1e6,
  "Qwen/Qwen3.7-Plus": 1e6,
  "Qwen/Qwen3.8-27B": 262144,
  "Qwen/Qwen3.8-Flash": 1e6,
  "Qwen/Qwen3.8-Max": 1e6,
  "Qwen/Qwen3.8-Max-0902": 1e6,
  "claude-fable-5": 1e6,
  "claude-fable-5-1": 1e6,
  "claude-haiku-4-5-20251001": 2e5,
  "claude-opus-4-7": 1e6,
  "claude-opus-4-8": 1e6,
  "claude-opus-5": 1e6,
  "claude-sonnet-4-6": 1e6,
  "claude-sonnet-5": 1e6,
  "deepseek/deepseek-v4-flash": 1e6,
  "deepseek/deepseek-v4-flash-fast": 1e6,
  "deepseek/deepseek-v4-flash-vision-exp": 1e6,
  "deepseek/deepseek-v4-pro": 1e6,
  "google/gemini-3.1-flash-lite": 1e6,
  "google/gemini-3.5-flash": 1e6,
  "google/gemini-3.5-flash-lite": 1e6,
  "google/gemini-3.6-flash": 1e6,
  "google/gemini-3.7-flash": 1048576,
  "google/gemini-3.8-flash": 1e6,
  "gpt-5.3-codex": 4e5,
  "gpt-5.4": 4e5,
  "gpt-5.4-mini": 4e5,
  "gpt-5.5": 4e5,
  "gpt-5.6-luna": 105e4,
  "gpt-5.6-sol": 105e4,
  "gpt-5.6-terra": 105e4,
  "gpt-6-astra": 105e4,
  "inclusionai/ling-3.0-flash-free": 256e3,
  "meituan/LongCat-2.0:free": 1048576,
  "meta/muse-spark-1.1": 1048576,
  "meta/muse-spark-1.2": 1048576,
  "meta/muse-spark-1.2-contributor": 1048576,
  "meta/muse-spark-1.3": 1048576,
  "meta/muse-spark-1.3-contributor": 1048576,
  "minimax/minimax-m2.7-free": 197e3,
  "minimax/minimax-m3-free": 1e6,
  "moonshotai/Kimi-K2.5": 256e3,
  "moonshotai/Kimi-K2.6": 256e3,
  "moonshotai/Kimi-K2.7-Code": 256e3,
  "moonshotai/Kimi-K2.7-Code-Highspeed": 262e3,
  "moonshotai/Kimi-K3": 1e6,
  "nvidia/nemotron-3-ultra-550b-a55b": 1e6,
  "poolside/laguna-s-2.1-free": 256e3,
  "sakana/fugu-ultra": 1e6,
  "stepfun/Step-3.5-Flash": 1e6,
  "stepfun/Step-3.7-Flash": 256e3,
  "tencent/Hy3": 262144,
  "tencent/hy3-paid": 262144,
  "tencent/hy4-preview": 1048576,
  "thinkingmachines/inkling": 256e3,
  "thinkingmachines/inkling-small": 1e6,
  "xai/grok-4.5": 5e5,
  "xai/grok-4.6": 5e5,
  "xiaomi/mimo-v2.5": 1e6,
  "xiaomi/mimo-v2.5-pro": 1e6,
  "z-ai/glm-5.3-flash": 1048576,
  "zai-org/GLM-5": 2e5,
  "zai-org/GLM-5.2": 1e6,
  "zai-org/GLM-5.2-Fast": 1e6,
  "zai-org/GLM-5.3": 1e6
};
function sanitizeDisplay(text) {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
}
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
function pct(used, cap) {
  if (cap <= 0) return 0;
  return Math.min(100, Math.max(0, used / cap * 100));
}
function colorUsage(n) {
  const v = Math.min(100, Math.round(n));
  let color = GREEN;
  if (v >= 50) color = YELLOW;
  if (v >= 75) color = ORANGE;
  if (v >= 90) color = RED;
  return `${color}${v}%${RESET}`;
}
function formatMoney(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function colorCredits(remaining, planId) {
  const total = PLAN_CREDITS[planId];
  const pctLeft = total && total > 0 ? remaining / total * 100 : 100;
  let color = GREEN;
  if (pctLeft < 50) color = YELLOW;
  if (pctLeft < 25) color = ORANGE;
  if (pctLeft < 10) color = RED;
  return `${color}$${formatMoney(remaining)}${RESET}`;
}
function shortModelName(full) {
  if (!full) return "";
  let s = full.replace(/^[^/]+\//, "");
  s = s.replace(/-\([^)]*\)/g, "");
  s = s.replace(/\([^)]*\)/g, "");
  s = s.replace(/-$/, "");
  return s.trim();
}
function resolveContextWindow(modelId, windows = CONTEXT_WINDOWS) {
  if (!modelId) return void 0;
  const short = shortModelName(modelId);
  const candidates = [modelId, short];
  for (const prefix of [
    "deepseek/",
    "anthropic/",
    "openai/",
    "google/",
    "xai/",
    "meta/",
    "sakana/",
    "nvidia/",
    "poolside/",
    "stepfun/",
    "tencent/",
    "xiaomi/",
    "minimax/",
    "moonshotai/"
  ]) {
    if (!short.includes("/")) candidates.push(`${prefix}${short}`);
  }
  for (const c of candidates) {
    if (c in windows) return windows[c];
  }
  const lower = modelId.toLowerCase();
  for (const key of Object.keys(windows)) {
    if (key.toLowerCase() === lower) return windows[key];
  }
  const shortLower = short.toLowerCase();
  for (const key of Object.keys(windows)) {
    if (key.toLowerCase().endsWith(`/${shortLower}`) || key.toLowerCase() === shortLower)
      return windows[key];
  }
  return void 0;
}
function cyclePct(u) {
  const planTotal = PLAN_CREDITS[u.planId] ?? u.monthlyCredits;
  const pool = Math.max(planTotal, u.monthlyCredits) + u.purchasedCredits + u.freeCredits;
  if (pool <= 0) return 0;
  return pct(u.totalSpent, pool);
}
function computeStatus(s) {
  const hasContext = s.contextLimit > 0;
  const ctx = hasContext ? pct(s.currentTokens, s.contextLimit) : null;
  const usge = s.usage ? pct(s.usage.fiveHourUsed, s.usage.fiveHourCap) : null;
  const wkly = s.usage ? pct(s.usage.weeklyUsed, s.usage.weeklyCap) : null;
  const totl = s.usage ? cyclePct(s.usage) : null;
  const crdt = s.usage ? formatMoney(s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits) : null;
  return {
    cwd: sanitizeDisplay(s.cwd),
    branch: s.branch,
    dirty: s.dirty ? "dirty" : "clean",
    sessionName: sanitizeDisplay(s.sessionName),
    model: sanitizeDisplay(s.model),
    effort: sanitizeDisplay(s.effort),
    cntx: ctx === null ? null : Math.round(ctx),
    usge: usge === null ? null : Math.round(usge),
    wkly: wkly === null ? null : Math.round(wkly),
    totl: totl === null ? null : Math.round(totl),
    crdt
  };
}
function ellipsize(text, max) {
  if (max <= 0) return "\u2026";
  if (text.length <= max) return text;
  if (max === 1) return "\u2026";
  return `${text.slice(0, max - 1).trimEnd()}\u2026`;
}
function buildStatusLine(s, maxWidth) {
  const seg = computeStatus(s);
  const dot = seg.dirty === "dirty" ? `${ORANGE}\u25CF${RESET}` : `${GREEN}\u25CF${RESET}`;
  const shortModel = shortModelName(seg.model);
  const cntxText = seg.cntx === null ? `${DIM}--${RESET}` : colorUsage(seg.cntx);
  const fields = [
    { text: seg.cwd, priority: 100, droppable: false }
    // identity, never drop
  ];
  if (seg.branch) fields.push({ text: `${seg.branch} ${dot}`, priority: 90, droppable: false });
  if (seg.sessionName) fields.push({ text: seg.sessionName, priority: 80, droppable: true });
  fields.push(
    { text: DIM + "\u2502" + RESET, priority: 70, droppable: false },
    // separator
    { text: shortModel, priority: 60, droppable: false },
    { text: seg.effort, priority: 50, droppable: true },
    { text: `cntx: ${cntxText}`, priority: 40, droppable: false }
  );
  if (s.usage) {
    fields.push(
      { text: `usge: ${colorUsage(seg.usge ?? 0)}`, priority: 30, droppable: true },
      { text: `wkly: ${colorUsage(seg.wkly ?? 0)}`, priority: 20, droppable: true },
      { text: `totl: ${colorUsage(seg.totl ?? 0)}`, priority: 10, droppable: true },
      {
        text: `crdt: ${colorCredits(s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits, s.usage.planId)}`,
        priority: 5,
        droppable: true
      }
    );
  }
  const join = (parts) => {
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === 0) {
        out += p.text;
      } else if (p.priority === 70) {
        out += `  ${p.text}  `;
      } else if (parts[i - 1]?.priority === 70) {
        out += p.text;
      } else {
        out += `, ${p.text}`;
      }
    }
    return out;
  };
  const fits = (line2) => maxWidth === void 0 || stripAnsi(line2).length <= maxWidth;
  let kept = [...fields];
  let line = join(kept);
  if (fits(line)) return line;
  const droppable = kept.filter((f) => f.droppable).sort((a, b) => a.priority - b.priority);
  for (const drop of droppable) {
    kept = kept.filter((f) => f !== drop);
    line = join(kept);
    if (fits(line)) return line;
  }
  line = join(kept);
  const visible = stripAnsi(line);
  if (visible.length <= maxWidth) return line;
  const sep = kept.find((f) => f.priority === 70);
  const sepWidth = sep ? stripAnsi(`  ${sep.text}  `).length : 0;
  const sepIdx = kept.indexOf(sep);
  const before = kept.slice(0, sepIdx);
  const after = kept.slice(sepIdx + 1);
  const beforeWidth = stripAnsi(join(before)).length;
  const afterWidth = stripAnsi(join(after)).length;
  const available = Math.max(1, maxWidth - beforeWidth - afterWidth - sepWidth);
  const target = before.reduce(
    (a, b) => stripAnsi(b.text).length > stripAnsi(a.text).length ? b : a,
    before[0]
  );
  if (target) {
    const idx = kept.indexOf(target);
    const ell = ellipsize(target.text, available);
    const rebuilt = join([...kept.slice(0, idx), { ...target, text: ell }, ...kept.slice(idx + 1)]);
    if (fits(rebuilt)) return rebuilt;
  }
  return ellipsize(seg.cwd, maxWidth);
}
export {
  CONTEXT_WINDOWS,
  DIM,
  GREEN,
  ORANGE,
  PLAN_CREDITS,
  RED,
  RESET,
  YELLOW,
  buildStatusLine,
  colorCredits,
  colorUsage,
  computeStatus,
  cyclePct,
  ellipsize,
  formatMoney,
  pct,
  resolveContextWindow,
  sanitizeDisplay,
  shortModelName,
  stripAnsi
};
