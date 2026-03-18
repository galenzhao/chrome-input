type BgRes = { ok: true; data?: any } | { ok: false; error: string };

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
      padding: 10px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.2;
    }
    .item:hover { background: rgba(0,0,0,0.06); }
    .itemDisabled { opacity: 0.55; cursor: default; }
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
    item.textContent = m.name;
    item.onclick = async () => {
      console.log("[input-improve] mode click", { modeId: m.id, modeName: m.name });
      if (!currentTarget || isRunning) return;
      isRunning = true;
      item.classList.add("itemDisabled");
      item.textContent = "处理中…";
      try {
        const inputText = getTextFromTarget(currentTarget);
        const run = await bg({ type: "runMode", modeId: m.id, inputText });
        if (!run.ok) throw new Error(run.error);
        setTextToTarget(currentTarget, String(run.data.text || ""));
        console.log("[input-improve] runMode success");
        hidePanel();
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
  if (areaName !== "sync") return;
  loadUiSettings();
});

