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

export type StoredData = {
  version: number;
  config?: ApiConfig;
  modes?: OptimizeMode[];
  remoteModels?: RemoteModel[];
  ui?: UiSettings;
};

const STORAGE_KEY = "inputImproveData";
const CURRENT_VERSION = 1;

export function defaultUiSettings(): UiSettings {
  return {
    placement: "followInput",
    corner: "bottomRight",
    offsetX: 12,
    offsetY: 12,
  };
}

export async function loadStoredData(): Promise<StoredData> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const data = (result[STORAGE_KEY] || {}) as StoredData;
      if (!data.version) {
        resolve({
          version: CURRENT_VERSION,
          config: undefined,
          modes: [],
          remoteModels: [],
          ui: defaultUiSettings(),
        });
        return;
      }
      resolve({
        version: data.version,
        config: data.config,
        modes: data.modes ?? [],
        remoteModels: data.remoteModels ?? [],
        ui: data.ui ?? defaultUiSettings(),
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
  };
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: toSave }, () => resolve());
  });
}

export async function updateStoredData(
  updater: (current: StoredData) => StoredData | void
): Promise<StoredData> {
  const current = await loadStoredData();
  const updated = updater(current) || current;
  await saveStoredData(updated);
  return updated;
}

