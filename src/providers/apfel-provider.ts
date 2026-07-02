import type { GenerateChunk, Model, Provider, ProviderRequest } from "./types";

// Extract the text delta from one SSE `data:` payload. null = skip this chunk.
export function parseChatCompletionChunk(data: string): string | null {
  if (data === "[DONE]") return null;
  const json = JSON.parse(data) as {
    choices?: { delta?: { content?: string } }[];
  };
  return json.choices?.[0]?.delta?.content ?? null;
}

export function createApfelProvider(baseUrl: string): Provider {
  const url = baseUrl.replace(/\/+$/, "");

  return {
    id: "apple",

    async listModels(): Promise<Model[]> {
      const res = await fetch(`${url}/v1/models`);
      if (!res.ok) throw new Error(`apfel responded ${res.status}`);
      const body = (await res.json()) as { data?: { id: string }[] };
      const id = body.data?.[0]?.id ?? "apple-foundationmodel";
      return [{ id, label: "Apple Intelligence" }];
    },

    async *generate(
      req: ProviderRequest,
      signal: AbortSignal,
    ): AsyncIterable<GenerateChunk> {
      const messages = [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ];
      const res = await fetch(`${url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: req.model, stream: true, messages }),
        signal,
      });
      if (!res.ok || !res.body)
        throw new Error(`apfel responded ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const text = parseChatCompletionChunk(trimmed.slice(5).trim());
          if (text) yield { text };
        }
      }
    },
  };
}
