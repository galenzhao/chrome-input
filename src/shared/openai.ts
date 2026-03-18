import type { ApiConfig } from "./storage";

export type ChatCompletionResult = {
  text: string;
  raw: unknown;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function toOriginPattern(baseUrl: string): string {
  const url = new URL(normalizeBaseUrl(baseUrl));
  return `${url.origin}/*`;
}

export async function fetchModels(config: ApiConfig): Promise<{ models: string[]; raw: unknown }> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = `${baseUrl}/v1/models`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
  const rawText = await res.text();
  let json: any;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`模型列表接口返回非 JSON（HTTP ${res.status}）`);
  }
  if (!res.ok) {
    const msg = (json && (json.error?.message || json.message)) || rawText || `HTTP ${res.status}`;
    throw new Error(`获取模型列表失败：${msg}`);
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  const models = data.map((m: any) => String(m?.id || "")).filter(Boolean);
  return { models, raw: json };
}

export async function chatComplete(config: ApiConfig, args: { model: string; systemPrompt?: string; userText: string; maxTokens?: number }): Promise<ChatCompletionResult> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = `${baseUrl}/v1/chat/completions`;
  const body = {
    model: args.model,
    messages: [
      ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
      { role: "user", content: args.userText },
    ],
    temperature: 0.2,
    max_tokens: args.maxTokens ?? 512,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let json: any;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`);
  }

  if (!res.ok) {
    const msg = (json && (json.error?.message || json.message)) || rawText || `HTTP ${res.status}`;
    throw new Error(`调用失败：${msg}`);
  }

  const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("接口返回为空（choices[0].message.content 为空）");
  return { text, raw: json };
}

