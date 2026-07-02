import { spawn } from "node:child_process";

export type SupportedPlatform = "darwin" | "win32";

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function getSupportedPlatform(
  platform: NodeJS.Platform,
): SupportedPlatform {
  if (platform === "darwin" || platform === "win32") {
    return platform;
  }
  throw new Error("Unsupported OS. This command supports macOS and Windows.");
}

export function runShellCommand(
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

export function errorOutput({ stdout, stderr }: RunCommandResult): string {
  return [stdout, stderr].filter(Boolean).join("\n");
}
