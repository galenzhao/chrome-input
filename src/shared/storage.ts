export type ApiConfig = {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
};

export type OptimizeMode = {
  id: string;
  name: string;
  model: string;
  prompt: string;
  /**
   * Optional generation cap for this mode.
   * If omitted, we intentionally don't send `max_tokens` so the backend/model can use its own default maximum.
   */
  maxTokens?: number;
  updatedAt: number;
};

export type RemoteModel = {
  id: string;
  created?: number;
  owned_by?: string;
  [key: string]: unknown;
};

export type UiSettings = {
  /**
   * followInput: 按输入框位置浮动（默认）
   * fixed: 固定在页面角落（避免与其他插件冲突）
   */
  placement: "followInput" | "fixed";
  corner: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
  offsetX: number;
  offsetY: number;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ModeUsageStats = {
  calls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  lastUsage?: TokenUsage;
  lastCalledAt?: number;
};

export type StoredData = {
  version: number;
  config?: ApiConfig;
  modes?: OptimizeMode[];
  remoteModels?: RemoteModel[];
  ui?: UiSettings;
  modeStats?: Record<string, ModeUsageStats>;
};

const STORAGE_KEY = "inputImproveData";
const CURRENT_VERSION = 2;

export function defaultUiSettings(): UiSettings {
  return {
    placement: "followInput",
    corner: "bottomRight",
    offsetX: 12,
    offsetY: 12,
  };
}

async function loadStoredDataFromArea(area: "sync" | "local"): Promise<StoredData | undefined> {
  return new Promise((resolve) => {
    chrome.storage[area].get([STORAGE_KEY], (result) => {
      const data = (result[STORAGE_KEY] || {}) as StoredData;
      if (!data.version) return resolve(undefined);
      resolve({
        version: data.version,
        config: data.config,
        modes: data.modes ?? [],
        remoteModels: data.remoteModels ?? [],
        ui: data.ui ?? defaultUiSettings(),
        modeStats: data.modeStats ?? {},
      });
    });
  });
}

export async function saveStoredData(data: StoredData): Promise<void> {
  const toSave: StoredData = {
    version: CURRENT_VERSION,
    config: data.config,
    modes: data.modes ?? [],
    remoteModels: data.remoteModels ?? [],
    ui: data.ui ?? defaultUiSettings(),
    modeStats: data.modeStats ?? {},
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: toSave }, () => resolve());
  });
}

export async function loadStoredData(): Promise<StoredData> {
  // Prefer `local` for stats to avoid `chrome.storage.sync` item quota overflow.
  const local = await loadStoredDataFromArea("local");
  if (local) return local;

  // Fallback for existing users (before this change).
  const sync = await loadStoredDataFromArea("sync");
  if (sync) {
    // Best-effort migration; ignore quota errors because we just fixed the target.
    void saveStoredData(sync).catch(() => {});
    return sync;
  }

  return {
    version: CURRENT_VERSION,
    config: undefined,
    modes: [],
    remoteModels: [],
    ui: defaultUiSettings(),
    modeStats: {},
  };
}

export async function updateStoredData(
  updater: (current: StoredData) => StoredData | void
): Promise<StoredData> {
  const current = await loadStoredData();
  const updated = updater(current) || current;
  await saveStoredData(updated);
  return updated;
}

