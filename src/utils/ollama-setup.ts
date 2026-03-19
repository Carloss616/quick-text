import { spawn } from "node:child_process";

export type SupportedPlatform = "darwin" | "win32";

export type RecommendedModel = "granite4" | "granite4:350m";

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface OllamaSetupResult {
  installedOllama: boolean;
  pulledModel: boolean;
  output: string;
}

function getSupportedPlatform(platform: NodeJS.Platform): SupportedPlatform {
  if (platform === "darwin" || platform === "win32") {
    return platform;
  }
  throw new Error("Unsupported OS. This command supports macOS and Windows.");
}

function runShellCommand(
  command: string,
  platform: SupportedPlatform,
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child =
      platform === "win32"
        ? spawn("powershell", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command,
          ])
        : spawn("sh", ["-c", command]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

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
): Promise<OllamaSetupResult> {
  const platform = getSupportedPlatform(process.platform);
  const installCommand = getOllamaInstallCommand(platform);
  const checkCommand = getOllamaCheckCommand(platform);

  const checkResult = await runShellCommand(checkCommand, platform);
  const isOllamaInstalled = checkResult.exitCode === 0;

  let installedOllama = false;
  if (!isOllamaInstalled) {
    const installResult = await runShellCommand(installCommand, platform);
    if (installResult.exitCode !== 0) {
      const output = [installResult.stdout, installResult.stderr]
        .filter(Boolean)
        .join("\n");
      throw new Error(output || "Failed to install Ollama automatically.");
    }
    installedOllama = true;
  }

  const pullResult = await runShellCommand(`ollama pull ${model}`, platform);
  if (pullResult.exitCode !== 0) {
    const output = [pullResult.stdout, pullResult.stderr]
      .filter(Boolean)
      .join("\n");
    throw new Error(output || `Failed to pull model ${model}.`);
  }

  return {
    installedOllama,
    pulledModel: true,
    output: [pullResult.stdout, pullResult.stderr].filter(Boolean).join("\n"),
  };
}
