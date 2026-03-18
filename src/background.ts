import { chatComplete, fetchModels, toOriginPattern } from "./shared/openai";
import { loadStoredData, saveStoredData, updateStoredData } from "./shared/storage";
import type { ApiConfig, OptimizeMode } from "./shared/storage";

type Msg =
  | { type: "getState" }
  | { type: "saveConfig"; config: ApiConfig }
  | { type: "validateConfig"; model?: string }
  | { type: "refreshRemoteModels" }
  | { type: "saveModes"; modes: OptimizeMode[] }
  | { type: "runMode"; modeId: string; inputText: string };

type MsgResponse = { ok: true; data?: any } | { ok: false; error: string };

function requireConfig(config?: ApiConfig): ApiConfig {
  if (!config?.baseUrl?.trim()) throw new Error("请先在配置页填写 baseUrl");
  if (!config?.apiKey?.trim()) throw new Error("请先在配置页填写 apiKey");
  return config;
}

chrome.runtime.onMessage.addListener((message: Msg, _sender, sendResponse: (res: MsgResponse) => void) => {
  (async () => {
    try {
      const stored = await loadStoredData();

      if (message.type === "getState") {
        sendResponse({ ok: true, data: stored });
        return;
      }

      if (message.type === "saveConfig") {
        await saveStoredData({ ...stored, config: message.config });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "saveModes") {
        await saveStoredData({ ...stored, modes: message.modes });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "refreshRemoteModels") {
        const config = requireConfig(stored.config);
        const { models, raw } = await fetchModels(config);
        await updateStoredData((cur) => ({
          ...cur,
          remoteModels: models.map((id) => ({ id })),
        }));
        sendResponse({ ok: true, data: { models, raw } });
        return;
      }

      if (message.type === "validateConfig") {
        const config = requireConfig(stored.config);

        let model = message.model?.trim() || config.defaultModel?.trim() || "";
        if (!model) {
          // try cached models first
          const cached = (stored.remoteModels || []).map((m) => m.id).filter(Boolean);
          if (cached.length) model = cached[0];
        }
        if (!model) {
          // try remote models
          try {
            const { models } = await fetchModels(config);
            model = models[0] || "";
            await updateStoredData((cur) => ({
              ...cur,
              remoteModels: models.map((id) => ({ id })),
            }));
          } catch {
            // ignore - will error below
          }
        }
        if (!model) throw new Error("无法验证：没有可用模型。请先刷新模型列表或手动填一个模型。");

        const r = await chatComplete(config, {
          model,
          systemPrompt: "You are a helpful assistant.",
          userText: "ping",
          maxTokens: 8,
        });
        sendResponse({ ok: true, data: { model, sample: r.text } });
        return;
      }

      if (message.type === "runMode") {
        const config = requireConfig(stored.config);
        const modes = stored.modes ?? [];
        const mode = modes.find((m) => m.id === message.modeId);
        if (!mode) throw new Error("未找到该优化方式");

        const result = await chatComplete(config, {
          model: mode.model,
          systemPrompt: mode.prompt,
          userText: message.inputText,
          maxTokens: 800,
        });
        sendResponse({ ok: true, data: { text: result.text } });
        return;
      }

      sendResponse({ ok: false, error: "unknown message" });
    } catch (e: any) {
      sendResponse({ ok: false, error: e?.message ? String(e.message) : String(e) });
    }
  })();

  return true;
});

