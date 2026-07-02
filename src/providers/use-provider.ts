import { getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { createApfelProvider } from "./apfel-provider";
import { createOllamaProvider } from "./ollama-provider";
import { resolveProviderId } from "./resolve-provider-id";
import type { Provider } from "./types";

export function useProvider(): Provider {
  return useMemo(() => {
    const { provider, ollamaUrl } = getPreferenceValues<Preferences>();
    const url = ollamaUrl || "http://localhost:11434";
    const id = resolveProviderId(provider, process.platform);
    return id === "apple"
      ? createApfelProvider(url)
      : createOllamaProvider(url);
  }, []);
}
