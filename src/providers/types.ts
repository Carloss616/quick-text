export type ProviderId = "ollama" | "apple";

export type Model = {
  id: string;
  label: string;
  size?: number;
  date?: string;
};

export type ProviderRequest = {
  model: string;
  system?: string;
  prompt: string;
};

export type GenerateChunk = {
  text?: string;
  thinking?: string;
};

export interface Provider {
  id: ProviderId;
  listModels(): Promise<Model[]>;
  generate(
    req: ProviderRequest,
    signal: AbortSignal,
  ): AsyncIterable<GenerateChunk>;
}
