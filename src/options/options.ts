import { defaultUiSettings, loadStoredData, saveStoredData } from "../shared/storage";
import { toOriginPattern } from "../shared/openai";
import type { ApiConfig, OptimizeMode, UiSettings } from "../shared/storage";

type BgRes = { ok: true; data?: any } | { ok: false; error: string };

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

function setStatus(msg: string, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.style.color = isError ? "#b00020" : "#0b6b0b";
}

function uuid(): string {
  return crypto.randomUUID();
}

async function bg(message: any): Promise<BgRes> {
  return chrome.runtime.sendMessage(message);
}

function normalizeConfigFromUI(): ApiConfig {
  const baseUrl = (document.getElementById("baseUrl") as HTMLInputElement).value.trim();
  const apiKey = (document.getElementById("apiKey") as HTMLInputElement).value.trim();
  const defaultModel = (document.getElementById("defaultModel") as HTMLInputElement).value.trim();
  return {
    baseUrl,
    apiKey,
    defaultModel: defaultModel || undefined,
  };
}

function normalizeUiFromUI(): UiSettings {
  const placement = (document.getElementById("uiPlacement") as HTMLSelectElement).value as UiSettings["placement"];
  const corner = (document.getElementById("uiCorner") as HTMLSelectElement).value as UiSettings["corner"];
  const offsetXRaw = (document.getElementById("uiOffsetX") as HTMLInputElement).value;
  const offsetYRaw = (document.getElementById("uiOffsetY") as HTMLInputElement).value;
  const base = defaultUiSettings();
  const offsetX = Number.isFinite(Number(offsetXRaw)) ? Number(offsetXRaw) : base.offsetX;
  const offsetY = Number.isFinite(Number(offsetYRaw)) ? Number(offsetYRaw) : base.offsetY;
  return {
    placement: placement || base.placement,
    corner: corner || base.corner,
    offsetX,
    offsetY,
  };
}

function getSelectedModel(models: string[]): string {
  const sel = document.getElementById("modeModelSelect") as HTMLSelectElement;
  const manual = (document.getElementById("modeModelManual") as HTMLInputElement).value.trim();
  const fromSel = sel.value?.trim();
  if (fromSel) return fromSel;
  if (manual) return manual;
  return models[0] || "";
}

function renderModelSelect(models: string[], prefer?: string) {
  const sel = document.getElementById("modeModelSelect") as HTMLSelectElement;
  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = models.length ? "（选择模型）" : "（无模型列表）";
  sel.appendChild(opt0);

  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
  if (prefer && models.includes(prefer)) sel.value = prefer;
}

let editingModeId: string | null = null;
let cachedModels: string[] = [];

function clearModeForm() {
  (document.getElementById("modeName") as HTMLInputElement).value = "";
  (document.getElementById("modePrompt") as HTMLTextAreaElement).value = "";
  (document.getElementById("modeModelSelect") as HTMLSelectElement).value = "";
  (document.getElementById("modeModelManual") as HTMLInputElement).value = "";
  editingModeId = null;
}

function renderModesList(modes: OptimizeMode[]) {
  const root = document.getElementById("modesList")!;
  root.innerHTML = "";
  if (!modes.length) {
    const empty = document.createElement("div");
    empty.className = "small";
    empty.textContent = "暂无优化方式。先新增一个。";
    root.appendChild(empty);
    return;
  }

  for (const m of modes) {
    const item = document.createElement("div");
    item.className = "listItem";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = m.name;
    const meta = document.createElement("div");
    meta.className = "listItemMeta";
    meta.textContent = `model: ${m.model}`;
    left.appendChild(title);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "listItemActions";
    const editBtn = document.createElement("button");
    editBtn.textContent = "编辑";
    editBtn.onclick = () => {
      editingModeId = m.id;
      (document.getElementById("modeName") as HTMLInputElement).value = m.name;
      (document.getElementById("modePrompt") as HTMLTextAreaElement).value = m.prompt;
      if (cachedModels.includes(m.model)) {
        (document.getElementById("modeModelSelect") as HTMLSelectElement).value = m.model;
        (document.getElementById("modeModelManual") as HTMLInputElement).value = "";
      } else {
        (document.getElementById("modeModelSelect") as HTMLSelectElement).value = "";
        (document.getElementById("modeModelManual") as HTMLInputElement).value = m.model;
      }
      setStatus(`正在编辑：${m.name}`, false);
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.onclick = async () => {
      const next = modes.filter((x) => x.id !== m.id);
      const stored = await loadStoredData();
      await saveStoredData({ ...stored, modes: next });
      renderModesList(next);
      setStatus(`已删除：${m.name}`);
      if (editingModeId === m.id) clearModeForm();
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);
    root.appendChild(item);
  }
}

async function refreshFromStorage() {
  const stored = await loadStoredData();
  const config = stored.config;
  (document.getElementById("baseUrl") as HTMLInputElement).value = config?.baseUrl || "";
  (document.getElementById("apiKey") as HTMLInputElement).value = config?.apiKey || "";
  (document.getElementById("defaultModel") as HTMLInputElement).value = config?.defaultModel || "";

  const ui = stored.ui ?? defaultUiSettings();
  (document.getElementById("uiPlacement") as HTMLSelectElement).value = ui.placement;
  (document.getElementById("uiCorner") as HTMLSelectElement).value = ui.corner;
  (document.getElementById("uiOffsetX") as HTMLInputElement).value = String(ui.offsetX ?? 12);
  (document.getElementById("uiOffsetY") as HTMLInputElement).value = String(ui.offsetY ?? 12);

  cachedModels = (stored.remoteModels || []).map((m) => m.id).filter(Boolean);
  renderModelSelect(cachedModels, config?.defaultModel);
  renderModesList(stored.modes || []);
}

async function refreshRemoteModels() {
  setStatus("正在获取模型列表…", false);
  const res = await bg({ type: "refreshRemoteModels" });
  if (!res.ok) {
    cachedModels = [];
    renderModelSelect(cachedModels);
    setStatus(res.error + "\n\n已切换为手动输入模型名。", true);
    return;
  }
  cachedModels = res.data.models || [];
  renderModelSelect(cachedModels);
  setStatus(`获取成功：${cachedModels.length} 个模型`, false);
}

async function saveUiOnly() {
  const stored = await loadStoredData();
  const ui = normalizeUiFromUI();
  await saveStoredData({ ...stored, ui });
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshFromStorage();

  (document.getElementById("saveConfig") as HTMLButtonElement).onclick = async () => {
    const config = normalizeConfigFromUI();
    const stored = await loadStoredData();
    await saveStoredData({ ...stored, config });
    setStatus("已保存接口配置");
  };

  (document.getElementById("requestPerm") as HTMLButtonElement).onclick = async () => {
    try {
      const config = normalizeConfigFromUI();
      const originPattern = toOriginPattern(config.baseUrl);
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        setStatus("已取消授权。请允许访问该域名后再尝试。", true);
        return;
      }
      const stored = await loadStoredData();
      await saveStoredData({ ...stored, config });
      const res = await bg({ type: "refreshRemoteModels" });
      if (!res.ok) return setStatus(res.error, true);
      setStatus("已授权并获取模型列表成功");
      await refreshFromStorage();
    } catch (e: any) {
      setStatus(e?.message ? String(e.message) : String(e), true);
    }
  };

  (document.getElementById("refreshModels") as HTMLButtonElement).onclick = async () => {
    const config = normalizeConfigFromUI();
    const stored = await loadStoredData();
    await saveStoredData({ ...stored, config });
    await refreshRemoteModels();
    await refreshFromStorage();
  };

  (document.getElementById("validate") as HTMLButtonElement).onclick = async () => {
    const config = normalizeConfigFromUI();
    const stored = await loadStoredData();
    await saveStoredData({ ...stored, config });
    const model = config.defaultModel || cachedModels[0] || (document.getElementById("modeModelManual") as HTMLInputElement).value.trim();
    setStatus("正在验证接口…", false);
    const res = await bg({ type: "validateConfig", model: model || undefined });
    if (!res.ok) return setStatus(res.error, true);
    setStatus(`验证成功。\nmodel: ${res.data.model}\nsample: ${res.data.sample}`, false);
  };

  (document.getElementById("addMode") as HTMLButtonElement).onclick = async () => {
    const stored = await loadStoredData();
    const name = (document.getElementById("modeName") as HTMLInputElement).value.trim();
    const prompt = (document.getElementById("modePrompt") as HTMLTextAreaElement).value.trim();
    const model = getSelectedModel(cachedModels).trim();
    if (!name) return setStatus("请填写名称", true);
    if (!model) return setStatus("请先刷新模型列表或手动输入模型名", true);
    if (!prompt) return setStatus("请填写 prompt", true);

    const now = Date.now();
    const modes = (stored.modes || []).slice();
    if (editingModeId) {
      const idx = modes.findIndex((m) => m.id === editingModeId);
      if (idx >= 0) {
        modes[idx] = { ...modes[idx], name, model, prompt, updatedAt: now };
      } else {
        modes.unshift({ id: uuid(), name, model, prompt, updatedAt: now });
      }
    } else {
      modes.unshift({ id: uuid(), name, model, prompt, updatedAt: now });
    }

    await saveStoredData({ ...stored, modes });
    renderModesList(modes);
    setStatus(editingModeId ? "已更新优化方式" : "已新增优化方式");
    clearModeForm();
  };

  (document.getElementById("clearMode") as HTMLButtonElement).onclick = () => {
    clearModeForm();
    setStatus("已清空表单", false);
  };

  // 自动保存按钮位置相关配置
  const uiPlacementEl = document.getElementById("uiPlacement") as HTMLSelectElement;
  const uiCornerEl = document.getElementById("uiCorner") as HTMLSelectElement;
  const uiOffsetXEl = document.getElementById("uiOffsetX") as HTMLInputElement;
  const uiOffsetYEl = document.getElementById("uiOffsetY") as HTMLInputElement;

  const autoSaveHandler = () => {
    void saveUiOnly();
  };

  uiPlacementEl.addEventListener("change", autoSaveHandler);
  uiCornerEl.addEventListener("change", autoSaveHandler);
  uiOffsetXEl.addEventListener("change", autoSaveHandler);
  uiOffsetYEl.addEventListener("change", autoSaveHandler);
  uiOffsetXEl.addEventListener("blur", autoSaveHandler);
  uiOffsetYEl.addEventListener("blur", autoSaveHandler);
});

