import { Ollama } from "ollama";
import type { GenerateChunk, Model, Provider, ProviderRequest } from "./types";

export function createOllamaProvider(host: string): Provider {
  const ollama = new Ollama({ host });

  return {
    id: "ollama",

    async listModels(): Promise<Model[]> {
      const { models } = await ollama.list();
      return models.map((m) => ({
        id: m.name,
        label: m.name,
        size: m.size,
        date: String(m.modified_at),
      }));
    },

    async *generate(
      req: ProviderRequest,
      signal: AbortSignal,
    ): AsyncIterable<GenerateChunk> {
      const stream = await ollama.generate({
        model: req.model,
        prompt: req.prompt,
        system: req.system,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal.aborted) {
          stream.abort();
          break;
        }
        if (chunk.thinking) yield { thinking: chunk.thinking };
        else if (chunk.response) yield { text: chunk.response };
      }
    },
  };
}
