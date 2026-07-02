import type { ProviderId } from "./types";

export function resolveProviderId(
  pref: string | undefined,
  platform: NodeJS.Platform,
): ProviderId {
  if (pref === "apple" && platform === "darwin") return "apple";
  return "ollama";
}
