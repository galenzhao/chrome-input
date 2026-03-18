type BgRes = { ok: true; data?: any } | { ok: false; error: string };

type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type ModeUsageStats = {
  calls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  lastUsage?: TokenUsage;
  lastCalledAt?: number;
};

async function bg(message: any): Promise<BgRes> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : String(e) };
  }
}

function isPasswordLikeInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  const t = (el.getAttribute("type") || "text").toLowerCase();
  return t === "password";
}

function getEditableTarget(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof HTMLElement)) return null;
  if (start instanceof HTMLInputElement || start instanceof HTMLTextAreaElement) return start;
  const ce = start.closest?.('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]') as HTMLElement | null;
  if (ce) return ce;
  return null;
}

function getTextFromTarget(target: HTMLElement): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value || "";
  return (target.innerText || target.textContent || "").trimEnd();
}

function setTextToTarget(target: HTMLElement, text: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.value = text;
    target.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return;
  }
  target.textContent = text;
  target.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function formatModeUsageStats(stats?: ModeUsageStats): string {
  const calls = stats?.calls ?? 0;
  const totalTokens = stats?.totalTokens;
  const lastTotal = stats?.lastUsage?.totalTokens;
  const lastPrompt = stats?.lastUsage?.promptTokens;
  const lastCompletion = stats?.lastUsage?.completionTokens;

  const lines: string[] = [];
  lines.push(`调用: ${calls}，总 token: ${typeof totalTokens === "number" ? totalTokens : 0}`);
  if (typeof lastTotal === "number") {
    lines.push(`最近一次: ${lastTotal}（提示 ${typeof lastPrompt === "number" ? lastPrompt : "-"} / 输出 ${typeof lastCompletion === "number" ? lastCompletion : "-" }）`);
  } else {
    lines.push(`最近一次: -`);
  }
  return lines.join("\n");
}

function createUi() {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.zIndex = "2147483647";
  host.style.width = "0";
  host.style.height = "0";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .btn {
      all: unset;
      position: fixed;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: rgba(17,17,17,0.92);
      color: white;
      display: grid;
      place-items: center;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      user-select: none;
    }
    .btn[data-hidden="1"] { display: none; }
    .panel {
      position: fixed;
      min-width: 220px;
      max-width: 320px;
      background: white;
      color: #111;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 12px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.18);
      padding: 6px;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial;
    }
    .panel[data-hidden="1"] { display: none; }
    .item {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 10px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.2;
    }
    .item:hover { background: rgba(0,0,0,0.06); }
    .itemDisabled { opacity: 0.55; cursor: default; }
    .itemStat { font-size: 11px; color: #666; white-space: pre-wrap; }
    .hint { padding: 8px 10px; font-size: 12px; color: #666; }
    .err { padding: 8px 10px; font-size: 12px; color: #b00020; white-space: pre-wrap; }
  `;

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "优";
  btn.dataset.hidden = "1";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.dataset.hidden = "1";

  shadow.appendChild(style);
  shadow.appendChild(btn);
  shadow.appendChild(panel);

  return { host, shadow, btn, panel };
}

const ui = createUi();
let currentTarget: HTMLElement | null = null;
let isRunning = false;
let uiSettings: { placement: "followInput" | "fixed"; corner: "bottomRight" | "bottomLeft" | "topRight" | "topLeft"; offsetX: number; offsetY: number } = {
  placement: "followInput",
  corner: "bottomRight",
  offsetX: 12,
  offsetY: 12,
};

function hidePanel() {
  ui.panel.dataset.hidden = "1";
}

function hideAll() {
  ui.btn.dataset.hidden = "1";
  hidePanel();
  currentTarget = null;
}

function positionUi(target: HTMLElement) {
  const w = 34;
  const h = 34;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  let x = 8;
  let y = 8;

  const ox = uiSettings.offsetX ?? 12;
  const oy = uiSettings.offsetY ?? 12;

  if (uiSettings.placement === "fixed") {
    if (uiSettings.corner === "bottomRight") {
      x = window.innerWidth - w - ox;
      y = window.innerHeight - h - oy;
    } else if (uiSettings.corner === "bottomLeft") {
      x = ox;
      y = window.innerHeight - h - oy;
    } else if (uiSettings.corner === "topRight") {
      x = window.innerWidth - w - ox;
      y = oy;
    } else {
      x = ox;
      y = oy;
    }
  } else {
    const r = target.getBoundingClientRect();
    if (uiSettings.corner === "bottomRight") {
      x = r.right - w - ox;
      y = r.bottom - h - oy;
    } else if (uiSettings.corner === "bottomLeft") {
      x = r.left + ox;
      y = r.bottom - h - oy;
    } else if (uiSettings.corner === "topRight") {
      x = r.right - w - ox;
      y = r.top + oy;
    } else {
      x = r.left + ox;
      y = r.top + oy;
    }
  }

  x = clamp(x, 6, window.innerWidth - w - 6);
  y = clamp(y, 6, window.innerHeight - h - 6);

  ui.btn.style.left = `${x}px`;
  ui.btn.style.top = `${y}px`;

  ui.panel.style.left = `${clamp(x - 180, 8, window.innerWidth - 328)}px`;
  ui.panel.style.top = `${clamp(y + 38, 8, window.innerHeight - 180)}px`;
}

async function openPanel() {
  if (!currentTarget) return;
  ui.panel.innerHTML = `<div class="hint">加载中…</div>`;
  ui.panel.dataset.hidden = "0";

  console.log("[input-improve] openPanel");
  const res = await bg({ type: "getState" });
  if (!res.ok) {
    console.log("[input-improve] getState failed", res.error);
    const err = document.createElement("div");
    err.className = "err";
    err.textContent = res.error;
    ui.panel.appendChild(err);
    return;
  }

  const modes = (res.data?.modes || []) as Array<{ id: string; name: string }>;
  let modeStats = (res.data?.modeStats || {}) as Record<string, ModeUsageStats>;
  ui.panel.innerHTML = "";
  if (!modes.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "还没有配置优化方式。请在扩展配置页添加。";
    ui.panel.appendChild(hint);
    return;
  }

  for (const m of modes) {
    const item = document.createElement("div");
    item.className = "item";
    const title = document.createElement("div");
    title.textContent = m.name;
    const stat = document.createElement("div");
    stat.className = "itemStat";
    stat.textContent = formatModeUsageStats(modeStats[m.id]);
    item.appendChild(title);
    item.appendChild(stat);
    item.onclick = async () => {
      console.log("[input-improve] mode click", { modeId: m.id, modeName: m.name });
      if (!currentTarget || isRunning) return;
      isRunning = true;
      item.classList.add("itemDisabled");
      title.textContent = "处理中…";
      stat.textContent = "正在统计 token 使用量…";
      try {
        const inputText = getTextFromTarget(currentTarget);
        const run = await bg({ type: "runMode", modeId: m.id, inputText });
        if (!run.ok) throw new Error(run.error);
        setTextToTarget(currentTarget, String(run.data.text || ""));
        console.log("[input-improve] runMode success");

        // Update local (in-panel) token stats immediately.
        const usage = run.data?.usage as TokenUsage | undefined;
        const prev = modeStats[m.id];
        const next: ModeUsageStats = {
          calls: (prev?.calls ?? 0) + 1,
          totalPromptTokens: (prev?.totalPromptTokens ?? 0) + (typeof usage?.promptTokens === "number" ? usage.promptTokens : 0),
          totalCompletionTokens:
            (prev?.totalCompletionTokens ?? 0) + (typeof usage?.completionTokens === "number" ? usage.completionTokens : 0),
          totalTokens: (prev?.totalTokens ?? 0) + (typeof usage?.totalTokens === "number" ? usage.totalTokens : 0),
          lastUsage: usage,
          lastCalledAt: Date.now(),
        };
        modeStats[m.id] = next;
        title.textContent = m.name;
        stat.textContent = formatModeUsageStats(next);

        // Try refreshing stats from storage right after.
        // Some browsers may delay `sync` updates across extension contexts.
        try {
          const state2 = await bg({ type: "getState" });
          if (state2.ok && state2.data?.modeStats) {
            modeStats = state2.data.modeStats as Record<string, ModeUsageStats>;
            stat.textContent = formatModeUsageStats(modeStats[m.id]);
          }
        } catch {
          // ignore
        }

        // Give the user a moment to see the token stats.
        setTimeout(() => hidePanel(), 1200);
      } catch (e: any) {
        console.log("[input-improve] runMode error", e);
        ui.panel.innerHTML = "";
        const err = document.createElement("div");
        err.className = "err";
        err.textContent = e?.message ? String(e.message) : String(e);
        ui.panel.appendChild(err);
      } finally {
        isRunning = false;
      }
    };
    ui.panel.appendChild(item);
  }
}

ui.btn.addEventListener("click", (e) => {
  e.stopPropagation();
  console.log("[input-improve] button click", { panelHidden: ui.panel.dataset.hidden });
  if (ui.panel.dataset.hidden === "1") openPanel();
  else hidePanel();
});

document.addEventListener("click", (e) => {
  const path = (e.composedPath?.() || []) as EventTarget[];
  // clicks inside shadow will include ui.host
  if (path.includes(ui.host)) return;
  hidePanel();
});

document.addEventListener("focusin", (e) => {
  const path = (e.composedPath?.() || []) as EventTarget[];
  // 如果是点击 / 聚焦在我们自己的按钮或面板里，就不要隐藏或切换目标
  if (path.includes(ui.host)) {
    return;
  }
  const t = getEditableTarget(e.target);
  if (!t) {
    hideAll();
    return;
  }
  if (isPasswordLikeInput(t)) {
    hideAll();
    return;
  }
  currentTarget = t;
  ui.btn.dataset.hidden = "0";
  positionUi(t);
});

// 不在 focusout 时强制隐藏按钮，避免点击按钮时立即消失


document.addEventListener("scroll", () => {
  if (currentTarget && ui.btn.dataset.hidden !== "1") positionUi(currentTarget);
}, true);

window.addEventListener("resize", () => {
  if (currentTarget && ui.btn.dataset.hidden !== "1") positionUi(currentTarget);
});

async function loadUiSettings() {
  const res = await bg({ type: "getState" });
  if (!res.ok) return;
  const next = res.data?.ui;
  if (!next) return;
  uiSettings = {
    placement: next.placement || "followInput",
    corner: next.corner || "bottomRight",
    offsetX: typeof next.offsetX === "number" ? next.offsetX : 12,
    offsetY: typeof next.offsetY === "number" ? next.offsetY : 12,
  };
  console.debug("[input-improve] uiSettings loaded", uiSettings);
  if (currentTarget && ui.btn.dataset.hidden !== "1") positionUi(currentTarget);
}

loadUiSettings();
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName !== "local") return;
  loadUiSettings();
});

