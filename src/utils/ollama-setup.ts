import {
  errorOutput,
  getSupportedPlatform,
  runShellCommand,
  type SupportedPlatform,
} from "./shell";

export type RecommendedModel = "granite4" | "granite4:350m";

export function getOllamaInstallCommand(platform: NodeJS.Platform): string {
  const supportedPlatform = getSupportedPlatform(platform);
  if (supportedPlatform === "darwin") {
    return "curl -fsSL https://ollama.com/install.sh | sh";
  }

  return "irm https://ollama.com/install.ps1 | iex";
}

function getOllamaCheckCommand(platform: SupportedPlatform): string {
  if (platform === "darwin") {
    return "command -v ollama";
  }

  return "Get-Command ollama -ErrorAction SilentlyContinue";
}

export async function setupOllamaAndPullModel(
  model: RecommendedModel,
): Promise<void> {
  const platform = getSupportedPlatform(process.platform);
  const checkResult = await runShellCommand(
    getOllamaCheckCommand(platform),
    platform,
  );

  if (checkResult.exitCode !== 0) {
    const installResult = await runShellCommand(
      getOllamaInstallCommand(platform),
      platform,
    );
    if (installResult.exitCode !== 0) {
      throw new Error(
        errorOutput(installResult) || "Failed to install Ollama automatically.",
      );
    }
  }

  const pullResult = await runShellCommand(`ollama pull ${model}`, platform);
  if (pullResult.exitCode !== 0) {
    throw new Error(
      errorOutput(pullResult) || `Failed to pull model ${model}.`,
    );
  }
}

