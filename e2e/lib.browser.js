// lib.ts
var GREEN = "\x1B[32m";
var YELLOW = "\x1B[33m";
var ORANGE = "\x1B[38;5;208m";
var RED = "\x1B[31m";
var RESET = "\x1B[0m";
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
  "deepseek-v4-pro": 1e6,
  "deepseek-v4-flash": 1e6,
  "deepseek-v4-flash-vision-exp": 1e6,
  "deepseek-v4-flash-fast": 1e6,
  "claude-sonnet-5": 1e6,
  "claude-sonnet-4-6": 1e6,
  "claude-fable-5-1": 1e6,
  "claude-fable-5": 1e6,
  "claude-opus-5": 1e6,
  "claude-opus-4-8": 1e6,
  "claude-opus-4-7": 1e6
};
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
function colorCredits(remaining, planId) {
  const total = PLAN_CREDITS[planId];
  const pctLeft = total && total > 0 ? remaining / total * 100 : 100;
  let color = GREEN;
  if (pctLeft < 50) color = YELLOW;
  if (pctLeft < 25) color = ORANGE;
  if (pctLeft < 10) color = RED;
  const s = remaining.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${color}$${s}${RESET}`;
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
  return windows[short] ?? windows[modelId];
}
function cyclePct(u) {
  const planTotal = PLAN_CREDITS[u.planId] ?? u.monthlyCredits;
  const pool = Math.max(planTotal, u.monthlyCredits) + u.purchasedCredits + u.freeCredits;
  if (pool <= 0) return 0;
  return pct(u.totalSpent, pool);
}
function computeStatus(s) {
  const ctx = s.contextLimit > 0 ? pct(s.currentTokens, s.contextLimit) : 0;
  const usge = s.usage ? pct(s.usage.fiveHourUsed, s.usage.fiveHourCap) : null;
  const skly = s.usage ? pct(s.usage.weeklyUsed, s.usage.weeklyCap) : null;
  const totl = s.usage ? cyclePct(s.usage) : null;
  const crdt = s.usage ? (s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits).toFixed(2) : null;
  return {
    cwd: s.cwd,
    branch: s.branch,
    dirty: s.dirty ? "dirty" : "clean",
    sessionName: s.sessionName,
    model: s.model,
    effort: s.effort,
    cntx: Math.round(ctx),
    usge: usge === null ? null : Math.round(usge),
    skly: skly === null ? null : Math.round(skly),
    totl: totl === null ? null : Math.round(totl),
    crdt
  };
}
var DIM = "\x1B[2m";
function buildStatusLine(s) {
  const dot = s.dirty ? `${ORANGE}\u25CF${RESET}` : `${GREEN}\u25CF${RESET}`;
  const branchText = s.branch ? `, ${s.branch} ${dot}` : "";
  const nameText = s.sessionName ? `, ${s.sessionName}` : "";
  const ctx = s.contextLimit > 0 ? pct(s.currentTokens, s.contextLimit) : 0;
  const shortModel = shortModelName(s.model);
  const modelText = shortModel ? `${shortModel}, ` : "";
  const effortText = s.effort ? `${s.effort}, ` : "";
  let right = `${modelText}${effortText}cntx: ${colorUsage(ctx)}`;
  if (s.usage) {
    const usg = pct(s.usage.fiveHourUsed, s.usage.fiveHourCap);
    const wkl = pct(s.usage.weeklyUsed, s.usage.weeklyCap);
    const tot = cyclePct(s.usage);
    const remaining = s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits;
    right += `, usge: ${colorUsage(usg)}, skly: ${colorUsage(wkl)}, totl: ${colorUsage(tot)}, crdt: ${colorCredits(remaining, s.usage.planId)}`;
  }
  return `${s.cwd}${branchText}${nameText}  ${DIM}\u2502${RESET}  ${right}`;
}
export {
  CONTEXT_WINDOWS,
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
  pct,
  resolveContextWindow,
  shortModelName
};
