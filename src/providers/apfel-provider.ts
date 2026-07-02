import type { GenerateChunk, Model, Provider, ProviderRequest } from "./types";

// Extract the text delta from one SSE `data:` payload. null = skip this chunk.
export function parseChatCompletionChunk(data: string): string | null {
  if (data === "[DONE]") return null;
  const json = JSON.parse(data) as {
    choices?: { delta?: { content?: string } }[];
  };
  return json.choices?.[0]?.delta?.content ?? null;
}

// apfel exposes exactly the "apple-foundationmodel" id. Ollama also serves
// /v1/models on port 11434, so require that id to confirm we're really talking
// to apfel and not to Ollama sitting on the shared port.
export function selectAppleModel(body: { data?: { id: string }[] }): Model {
  const model = body.data?.find((m) => m.id === "apple-foundationmodel");
  if (!model) {
    throw new Error(
      "No Apple Intelligence model here — apfel isn't the server on this port (Ollama may be using 11434).",
    );
  }
  return { id: model.id, label: "Apple Intelligence" };
}

export function createApfelProvider(baseUrl: string): Provider {
  const url = baseUrl.replace(/\/+$/, "");

  return {
    id: "apple",

    async listModels(): Promise<Model[]> {
      const res = await fetch(`${url}/v1/models`);
      if (!res.ok) throw new Error(`apfel responded ${res.status}`);
      const body = (await res.json()) as { data?: { id: string }[] };
      return [selectAppleModel(body)];
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
          const data = trimmed.slice(5).trim();
          let text: string | null;
          try {
            text = parseChatCompletionChunk(data);
          } catch {
            continue; // ponytail: skip a malformed SSE chunk instead of killing the stream
          }
          if (text) yield { text };
        }
      }
    },
  };
}
