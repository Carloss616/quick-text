import { errorOutput, runShellCommand } from "./shell";

// Distinguishes "apfel not installed" from "installed but not running" — both
// look like a connection refusal over HTTP, so we probe the CLI. macOS-only.
export async function isApfelInstalled(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  const { exitCode } = await runShellCommand("command -v apfel", "darwin");
  return exitCode === 0;
}

// ponytail: sequential brew calls, mirrors setupOllamaAndPullModel; no unit test
// (brew side effects), covered by typecheck like the Ollama helper.
export async function setupApfel(): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Apple Intelligence (apfel) is only available on macOS.");
  }

  const checkResult = await runShellCommand("command -v apfel", "darwin");
  if (checkResult.exitCode !== 0) {
    const installResult = await runShellCommand("brew install apfel", "darwin");
    if (installResult.exitCode !== 0) {
      throw new Error(
        errorOutput(installResult) || "Failed to install apfel automatically.",
      );
    }
  }

  const startResult = await runShellCommand(
    "brew services start apfel",
    "darwin",
  );
  if (startResult.exitCode !== 0) {
    throw new Error(
      errorOutput(startResult) || "Failed to start the apfel service.",
    );
  }
}
