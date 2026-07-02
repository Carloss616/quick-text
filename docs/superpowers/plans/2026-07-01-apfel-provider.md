# apfel (Apple Intelligence) Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add apfel (Apple FoundationModels via an OpenAI-compatible server) as an optional, macOS-only second provider alongside Ollama, selected by a preference.

**Architecture:** Introduce a thin `Provider` seam (`listModels()` + streaming `generate()`) with two implementations — ollama (wraps the `ollama` client) and apfel (raw `fetch` + manual SSE). A `useProvider()` hook picks the active one from a `provider` preference, forcing Ollama off-Mac. All UI consumes a neutral `Model` type instead of ollama's `ModelResponse`.

**Tech Stack:** TypeScript, React, Raycast API, `ollama` npm client, Node global `fetch`, bun (`bun test`, `bun run typecheck`).

## Global Constraints

- Ollama stays the default provider; apfel is opt-in and additive. Do not remove or degrade the Ollama path.
- No new heavy dependencies. apfel uses Node's global `fetch` — no `openai` SDK.
- apfel is macOS-only: gate with `process.platform === "darwin"`. Off-Mac, the provider resolver returns `ollama` regardless of the preference.
- apfel and Ollama share `http://localhost:11434`; the existing `ollamaUrl` preference is the base URL for both (apfel appends `/v1`). apfel has no port option.
- apfel model id string is `"apple-foundationmodel"`; UI label is `"Apple Intelligence"`.
- Do not add Claude/"Generated with" attribution to commits.
- Every task ends green on `bun run typecheck`.

---

### Task 1: Shared shell helper + apfel setup

Extract the private shell runner from `ollama-setup.ts` into a shared module, then add an apfel setup helper (brew install + start), mirroring the Ollama one.

**Files:**
- Create: `src/utils/shell.ts`
- Create: `src/utils/apfel-setup.ts`
- Modify: `src/utils/ollama-setup.ts` (remove moved helpers, import from `shell.ts`)
- Modify: `src/utils/index.ts` (export new modules)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `shell.ts`: `type SupportedPlatform = "darwin" | "win32"`; `interface RunCommandResult { exitCode: number; stdout: string; stderr: string }`; `function getSupportedPlatform(platform: NodeJS.Platform): SupportedPlatform`; `function runShellCommand(command: string, platform: SupportedPlatform): Promise<RunCommandResult>`; `function errorOutput(r: RunCommandResult): string`.
  - `apfel-setup.ts`: `function setupApfel(): Promise<void>`.

- [ ] **Step 1: Create `src/utils/shell.ts`** (move verbatim from `ollama-setup.ts`)

```ts
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
```

- [ ] **Step 2: Rewrite `src/utils/ollama-setup.ts` to import from `shell.ts`**

Replace the whole file with:

```ts
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
    throw new Error(errorOutput(pullResult) || `Failed to pull model ${model}.`);
  }
}
```

- [ ] **Step 3: Create `src/utils/apfel-setup.ts`**

```ts
import { errorOutput, runShellCommand } from "./shell";

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
```

- [ ] **Step 4: Update `src/utils/index.ts`**

```ts
export * from "./size";
export * from "./shell";
export * from "./ollama-setup";
export * from "./apfel-setup";
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/utils/shell.ts src/utils/apfel-setup.ts src/utils/ollama-setup.ts src/utils/index.ts
git commit -m "feat: add shared shell helper and apfel setup"
```

---

### Task 2: Provider seam + preference

Add the `provider` preference, the neutral `Model` type, both provider implementations, and the `useProvider` hook. TDD the two nontrivial pure functions: the SSE chunk parser and the provider resolver.

**Files:**
- Modify: `package.json` (add `provider` preference)
- Modify: `raycast-env.d.ts` (add `provider` to `ExtensionPreferences`)
- Create: `src/providers/types.ts`
- Create: `src/providers/apfel-provider.ts`
- Create: `src/providers/apfel-provider.test.ts`
- Create: `src/providers/ollama-provider.ts`
- Create: `src/providers/use-provider.ts`
- Create: `src/providers/use-provider.test.ts`
- Create: `src/providers/index.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `types.ts`: `type Model = { id: string; label: string; size?: number; date?: string }`; `type ProviderRequest = { model: string; system?: string; prompt: string }`; `type GenerateChunk = { text?: string; thinking?: string }`; `type ProviderId = "ollama" | "apple"`; `interface Provider { id: ProviderId; listModels(): Promise<Model[]>; generate(req: ProviderRequest, signal: AbortSignal): AsyncIterable<GenerateChunk> }`.
  - `apfel-provider.ts`: `function parseChatCompletionChunk(data: string): string | null`; `function createApfelProvider(baseUrl: string): Provider`.
  - `ollama-provider.ts`: `function createOllamaProvider(host: string): Provider`.
  - `use-provider.ts`: `function resolveProviderId(pref: string | undefined, platform: NodeJS.Platform): ProviderId`; `function useProvider(): Provider`.

- [ ] **Step 1: Add the `provider` preference to `package.json`**

In the `preferences` array, add before the existing `ollamaUrl` entry:

```jsonc
{
  "name": "provider",
  "type": "dropdown",
  "required": false,
  "title": "AI Provider",
  "description": "Ollama, or Apple Intelligence via apfel (macOS + Apple Silicon only). Both use the Server URL below; apfel listens on the same 11434 port.",
  "default": "ollama",
  "data": [
    { "title": "Ollama", "value": "ollama" },
    { "title": "Apple Intelligence (macOS only)", "value": "apple" }
  ]
},
```

- [ ] **Step 2: Add `provider` to `raycast-env.d.ts`**

`ray build`/`ray develop` regenerate this file from the manifest, but `bun run typecheck` reads it as-is, so update it manually. In `ExtensionPreferences`, add above `"ollamaUrl"`:

```ts
  /** AI Provider */
  "provider": "ollama" | "apple"
```

- [ ] **Step 3: Create `src/providers/types.ts`**

```ts
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
```

- [ ] **Step 4: Write the failing SSE parser test** — `src/providers/apfel-provider.test.ts`

```ts
import { expect, test } from "bun:test";
import { parseChatCompletionChunk } from "./apfel-provider";

test("extracts the content delta from a chunk", () => {
  const data = JSON.stringify({ choices: [{ delta: { content: "Hola" } }] });
  expect(parseChatCompletionChunk(data)).toBe("Hola");
});

test("returns null for the [DONE] sentinel", () => {
  expect(parseChatCompletionChunk("[DONE]")).toBeNull();
});

test("returns null when the delta has no content (e.g. role-only chunk)", () => {
  const data = JSON.stringify({ choices: [{ delta: { role: "assistant" } }] });
  expect(parseChatCompletionChunk(data)).toBeNull();
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `bun test src/providers/apfel-provider.test.ts`
Expected: FAIL — cannot resolve `./apfel-provider` / `parseChatCompletionChunk` not defined.

- [ ] **Step 6: Create `src/providers/apfel-provider.ts`**

```ts
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
      if (!res.ok || !res.body) throw new Error(`apfel responded ${res.status}`);

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
```

- [ ] **Step 7: Run the SSE parser test to verify it passes**

Run: `bun test src/providers/apfel-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Write the failing provider-resolver test** — `src/providers/use-provider.test.ts`

```ts
import { expect, test } from "bun:test";
import { resolveProviderId } from "./use-provider";

test("apple preference on macOS resolves to apple", () => {
  expect(resolveProviderId("apple", "darwin")).toBe("apple");
});

test("apple preference off macOS falls back to ollama", () => {
  expect(resolveProviderId("apple", "win32")).toBe("ollama");
});

test("missing/ollama preference resolves to ollama", () => {
  expect(resolveProviderId(undefined, "darwin")).toBe("ollama");
  expect(resolveProviderId("ollama", "darwin")).toBe("ollama");
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `bun test src/providers/use-provider.test.ts`
Expected: FAIL — `resolveProviderId` not defined.

- [ ] **Step 10: Create `src/providers/ollama-provider.ts`**

```ts
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
```

- [ ] **Step 11: Create `src/providers/use-provider.ts`**

```ts
import { getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { createApfelProvider } from "./apfel-provider";
import { createOllamaProvider } from "./ollama-provider";
import type { Provider, ProviderId } from "./types";

export function resolveProviderId(
  pref: string | undefined,
  platform: NodeJS.Platform,
): ProviderId {
  if (pref === "apple" && platform === "darwin") return "apple";
  return "ollama";
}

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
```

- [ ] **Step 12: Create `src/providers/index.ts`**

```ts
export * from "./types";
export * from "./use-provider";
```

- [ ] **Step 13: Run the resolver test to verify it passes**

Run: `bun test src/providers/use-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 14: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 15: Commit**

```bash
git add package.json raycast-env.d.ts src/providers
git commit -m "feat: add provider seam with ollama and apfel implementations"
```

---

### Task 3: Wire consumers to the provider seam

Replace ollama's `ModelResponse`/`useOllama` throughout the model selection and streaming UI with the neutral `Model` type and `useProvider()`.

**Files:**
- Modify: `src/components/model-selector-dropdown.tsx`
- Modify: `src/components/text-processor-detail.tsx`
- Modify: `src/commands/quick-text-command/components/text-action-item.tsx`
- Modify: `src/commands/quick-text-command/quick-text-command.tsx`
- Delete: `src/hooks/use-ollama.ts`
- Modify: `src/hooks/index.ts` (drop `use-ollama` export)

**Interfaces:**
- Consumes from Task 2: `useProvider`, `Model`, `ProviderRequest`, `GenerateChunk` from `@/providers`.
- Produces: `ModelSelectorDropdown` now calls `onModelSelected(model: Model)`; `TextProcessorDetail` takes `selectedModel: Model` and `request: ProviderRequest`. (`ModelErrorState` enum is unchanged in this task — renamed in Task 4.)

- [ ] **Step 1: Delete `src/hooks/use-ollama.ts` and update `src/hooks/index.ts`**

`src/hooks/index.ts` becomes:

```ts
export * from "./use-selected-text";
```

```bash
git rm src/hooks/use-ollama.ts
```

- [ ] **Step 2: Rewrite `src/components/model-selector-dropdown.tsx`**

```tsx
import { List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { useProvider, type Model } from "@/providers";
import { formatSize } from "@/utils";

export enum ModelErrorState {
  OllamaNotRunning = "ollama_not_running",
  OllamaMissing = "ollama_missing",
  OllamaNoModels = "ollama_no_models",
  OllamaSetupFailed = "ollama_setup_failed",
}

export function ModelSelectorDropdown({
  onModelSelected,
  onModelError,
  refreshToken,
}: {
  onModelSelected: (model: Model) => void;
  onModelError: (state: ModelErrorState) => void;
  refreshToken: number;
}) {
  const provider = useProvider();
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    function applyModels(result: Model[]) {
      if (isCancelled) return;
      setModels(result);
      if (result.length === 0) {
        onModelError(ModelErrorState.OllamaNoModels);
      }
    }

    async function fetchModels() {
      setIsLoading(true);
      try {
        applyModels(await provider.listModels());
      } catch (error) {
        // Can't reach the provider — it's probably not running.
        onModelError(ModelErrorState.OllamaNotRunning);
        showToast({
          style: Toast.Style.Failure,
          title: "Can't reach the AI provider",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchModels();

    return () => {
      isCancelled = true;
    };
  }, [provider, onModelError, refreshToken]);

  return (
    <List.Dropdown
      tooltip="Change model"
      storeValue
      isLoading={isLoading}
      onChange={(value) => {
        const model = models.find((m) => m.id === value);
        if (model) onModelSelected(model);
      }}
      placeholder="Search models..."
    >
      {models.map((model) => (
        <List.Dropdown.Item
          key={model.id}
          title={
            model.size != null
              ? `${model.label} (${formatSize(model.size)})`
              : model.label
          }
          value={model.id}
        />
      ))}
    </List.Dropdown>
  );
}
```

- [ ] **Step 3: Rewrite `src/components/text-processor-detail.tsx`**

```tsx
import { Color, List, showToast, Toast } from "@raycast/api";
import { type Dispatch, useEffect, useMemo, useState } from "react";
import { useProvider, type Model, type ProviderRequest } from "@/providers";
import { formatSize } from "@/utils";

interface TextProcessorDetailProps {
  selectedModel: Model;
  selectedText: string;
  request: ProviderRequest;
  setParentProcessedText: Dispatch<React.SetStateAction<string | null>>;
  metadata?: Record<
    string,
    | string
    | {
        value: string;
        color?: Color | null;
      }
  >;
}

export function TextProcessorDetail({
  selectedModel,
  selectedText,
  request,
  setParentProcessedText,
  metadata,
}: TextProcessorDetailProps) {
  const provider = useProvider();
  const [processedText, setProcessedText] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();

    async function processText() {
      setIsLoading(true);
      setIsThinking(false);
      setThinkingText("");
      setProcessedText("");
      setParentProcessedText(null);

      let fullResponseText = "";
      let fullThinkingText = "";

      try {
        for await (const chunk of provider.generate(
          request,
          controller.signal,
        )) {
          if (controller.signal.aborted) break;

          if (chunk.thinking) {
            setIsThinking(true);
            fullThinkingText += chunk.thinking;
            setThinkingText(fullThinkingText);
          } else if (chunk.text) {
            setIsThinking(false);
            fullResponseText += chunk.text;
            setProcessedText(fullResponseText);
            setParentProcessedText(fullResponseText);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to process text",
          message: errorMsg,
        });
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    processText();

    return () => {
      controller.abort();
    };
  }, [provider, request]);

  const markdown = useMemo(() => {
    const quote = thinkingText
      ? `> ${thinkingText.replaceAll("\n", "\n> ")}\n\n`
      : "";
    return `${quote}${processedText}` || " "; // simulate empty with space
  }, [thinkingText, processedText]);

  return (
    <List.Item.Detail
      markdown={markdown}
      isLoading={isLoading || isThinking}
      metadata={
        <List.Item.Detail.Metadata>
          {metadata && (
            <>
              {Object.entries(metadata).map(([key, value]) => (
                <List.Item.Detail.Metadata.Label
                  key={key}
                  title={key}
                  text={value}
                />
              ))}
              <List.Item.Detail.Metadata.Separator />
            </>
          )}
          <List.Item.Detail.Metadata.Label
            title="Original"
            text={{
              value: selectedText,
              color: Color.SecondaryText,
            }}
          />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Model"
            text={selectedModel.label}
          />
          {selectedModel.size != null && (
            <List.Item.Detail.Metadata.Label
              title="Size"
              text={formatSize(selectedModel.size)}
            />
          )}
          {selectedModel.date && (
            <List.Item.Detail.Metadata.Label
              title="Date"
              text={new Date(selectedModel.date).toDateString()}
            />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
```

- [ ] **Step 4: Update `src/commands/quick-text-command/components/text-action-item.tsx`**

Replace the imports and the `ModelResponse`/`request` types:

```tsx
import { Action, ActionPanel, Color, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";
import type { Model, ProviderRequest } from "@/providers";
import type { TextAction } from "./text-actions";

interface TextActionItemProps {
  action: TextAction;
  selectedModel: Model;
  selectedText: string;
}

export function TextActionItem({
  action,
  selectedModel,
  selectedText,
}: TextActionItemProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const [option, setOption] = useState(action.selector?.options[0] ?? "");

  const request = useMemo<ProviderRequest>(
    () => ({
      model: selectedModel.id,
      prompt: action.buildPrompt(selectedText, option),
      system: action.system,
    }),
    [selectedModel.id, selectedText, option, action],
  );
```

(The rest of the file — the `metadata` memo and the returned JSX — is unchanged.)

- [ ] **Step 5: Update `src/commands/quick-text-command/quick-text-command.tsx`**

Change the two `ModelResponse` references:

```tsx
import { Icon, List } from "@raycast/api";
import { useCallback, useState } from "react";
import { ModelSelectorDropdown, ModelErrorState } from "@/components";
import { useSelectedText } from "@/hooks";
import type { Model } from "@/providers";
import { TextActionItem } from "./components/text-action-item";
import { TEXT_ACTIONS } from "./components/text-actions";
import { NoModelItem } from "./components/no-model-item";

export function QuickTextCommand() {
  const { selectedText, isLoading } = useSelectedText();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
```

(The rest of the component body is unchanged.)

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: consume provider seam and neutral Model type in UI"
```

---

### Task 4: Provider-aware setup & error UI

Make the "not running / missing / setup failed" copy and setup actions branch on the active provider so the Apple path offers brew-based setup instead of Ollama commands.

**Files:**
- Modify: `src/components/model-selector-dropdown.tsx` (rename `ModelErrorState` members to provider-neutral)
- Modify: `src/components/model-setup-actions.tsx`
- Modify: `src/commands/quick-text-command/components/no-model-item.tsx`

**Interfaces:**
- Consumes: `useProvider`/`ProviderId` from `@/providers`; `setupApfel`, `setupOllamaAndPullModel`, `RecommendedModel` from `@/utils`.
- Produces: `enum ModelErrorState { NotRunning, Missing, NoModels, SetupFailed }` (neutral names) used by all three files.

- [ ] **Step 1: Rename the enum in `src/components/model-selector-dropdown.tsx`**

Replace the enum and its two references inside the file:

```ts
export enum ModelErrorState {
  NotRunning = "not_running",
  Missing = "missing",
  NoModels = "no_models",
  SetupFailed = "setup_failed",
}
```

In `applyModels`, change `ModelErrorState.OllamaNoModels` → `ModelErrorState.NoModels`.
In the `catch`, change `ModelErrorState.OllamaNotRunning` → `ModelErrorState.NotRunning`.

- [ ] **Step 2: Rewrite `src/components/model-setup-actions.tsx` to branch on provider**

```tsx
import { Action, Icon, open } from "@raycast/api";
import { ModelErrorState } from "@/components";
import { useProvider } from "@/providers";
import type { RecommendedModel } from "@/utils";

interface ModelSetupActionsProps {
  modelErrorState: ModelErrorState | null;
  onRunOllamaSetup: (model: RecommendedModel) => Promise<void>;
  onRunApfelSetup: () => Promise<void>;
  onRefreshModels: () => void;
}

export function ModelSetupActions({
  modelErrorState,
  onRunOllamaSetup,
  onRunApfelSetup,
  onRefreshModels,
}: ModelSetupActionsProps) {
  const provider = useProvider();

  if (provider.id === "apple") {
    const installNeeded =
      modelErrorState === ModelErrorState.Missing ||
      modelErrorState === ModelErrorState.NotRunning;
    return (
      <>
        <Action
          title={installNeeded ? "Install & Start Apfel" : "Start Apfel Service"}
          icon={Icon.Download}
          onAction={() => void onRunApfelSetup()}
        />
        <Action
          title="Refresh Models"
          icon={Icon.ArrowClockwise}
          onAction={onRefreshModels}
        />
      </>
    );
  }

  return (
    <>
      {modelErrorState === ModelErrorState.NotRunning && (
        <Action
          title="Open Ollama"
          icon={Icon.AppWindow}
          onAction={() => void open("ollama://")}
        />
      )}
      <Action
        title={
          modelErrorState === ModelErrorState.Missing ||
          modelErrorState === ModelErrorState.NotRunning
            ? "Install Ollama + Pull Granite4:350m"
            : "Pull Granite4:350m (~700Mb)"
        }
        icon={Icon.Download}
        onAction={() => void onRunOllamaSetup("granite4:350m")}
      />
      {modelErrorState === ModelErrorState.NoModels && (
        <Action
          title="Pull Granite4 (~2Gb)"
          icon={Icon.Download}
          onAction={() => void onRunOllamaSetup("granite4")}
        />
      )}
      <Action
        title="Refresh Models"
        icon={Icon.ArrowClockwise}
        onAction={onRefreshModels}
      />
    </>
  );
}
```

- [ ] **Step 3: Rewrite `src/commands/quick-text-command/components/no-model-item.tsx`**

```tsx
import {
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { ModelErrorState, ModelSetupActions } from "@/components";
import { useProvider } from "@/providers";
import { RecommendedModel, setupApfel, setupOllamaAndPullModel } from "@/utils";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

interface NoModelViewProps {
  ollamaErrorState: ModelErrorState | null;
  setOllamaErrorState: Dispatch<SetStateAction<ModelErrorState | null>>;
  refreshModels: () => void;
}

type ErrorView = {
  icon: Icon;
  title: string;
  subtitle: string;
  markdown: string;
};

const OLLAMA_VIEWS: Record<ModelErrorState, ErrorView> = {
  [ModelErrorState.NotRunning]: {
    icon: Icon.Plug,
    title: "Ollama is not running",
    subtitle: "Open Ollama, then refresh",
    markdown: [
      "### Can't reach Ollama",
      "",
      "The Ollama server didn't respond. It's probably closed.",
      "",
      "### What to do",
      "",
      "1. Run the **Open Ollama** action below.",
      "2. Wait a couple seconds for it to start.",
      "3. Run **Refresh Models**.",
      "",
      "> Not installed yet? Use **Install Ollama + Pull Granite4:350m** instead.",
    ].join("\n"),
  },
  [ModelErrorState.Missing]: {
    icon: Icon.ExclamationMark,
    title: "Ollama not available",
    subtitle: "Install Ollama and pull a starter model",
    markdown: [
      "### What this action will do",
      "",
      "1. Detect your OS automatically.",
      "2. Install Ollama with the official command for your OS.",
      "3. Pull recommended model `granite4:350m` (<1GB).",
      "4. Refresh model list.",
      "",
      "### Model pull command",
      "",
      "```sh",
      "ollama pull granite4:350m",
      "```",
    ].join("\n"),
  },
  [ModelErrorState.NoModels]: {
    icon: Icon.Stars,
    title: "No Ollama models found",
    subtitle: "Download granite4 or granite4:350m",
    markdown: [
      "### What this action will do",
      "",
      "1. Skip Ollama installation (already detected).",
      "2. Pull selected model.",
      "3. Refresh model list after download.",
      "",
      "> Prefer simple models without integrated thinking for faster results.",
    ].join("\n"),
  },
  [ModelErrorState.SetupFailed]: {
    icon: Icon.ExclamationMark,
    title: "Setup failed",
    subtitle: "Try again or run manual install",
    markdown: [
      "### What happened",
      "",
      "Automatic setup failed while installing Ollama or pulling the model.",
      "",
      "### Manual fallback",
      "",
      "```sh",
      "curl -fsSL https://ollama.com/install.sh | sh",
      "```",
    ].join("\n"),
  },
};

const APFEL_VIEWS: Record<ModelErrorState, ErrorView> = {
  [ModelErrorState.NotRunning]: {
    icon: Icon.Plug,
    title: "Apfel is not running",
    subtitle: "Start the apfel service, then refresh",
    markdown: [
      "### Can't reach Apple Intelligence",
      "",
      "The apfel server (`localhost:11434`) didn't respond.",
      "",
      "### What to do",
      "",
      "1. Run **Start Apfel Service** below.",
      "2. Wait a couple seconds.",
      "3. Run **Refresh Models**.",
      "",
      "```sh",
      "brew services start apfel",
      "```",
    ].join("\n"),
  },
  [ModelErrorState.Missing]: {
    icon: Icon.ExclamationMark,
    title: "Apfel not available",
    subtitle: "Install apfel via Homebrew",
    markdown: [
      "### What this action will do",
      "",
      "1. Install apfel with Homebrew (if needed).",
      "2. Start the apfel background service.",
      "3. Refresh model list.",
      "",
      "```sh",
      "brew install apfel",
      "brew services start apfel",
      "```",
      "",
      "> Requires macOS 26+ on Apple Silicon with Apple Intelligence enabled.",
    ].join("\n"),
  },
  [ModelErrorState.NoModels]: {
    icon: Icon.Stars,
    title: "Apple Intelligence unavailable",
    subtitle: "Ensure Apple Intelligence is enabled",
    markdown: [
      "### No model reported",
      "",
      "apfel exposes a single on-device model. If none is listed, make sure",
      "Apple Intelligence is enabled in System Settings and the service is running.",
    ].join("\n"),
  },
  [ModelErrorState.SetupFailed]: {
    icon: Icon.ExclamationMark,
    title: "Setup failed",
    subtitle: "Try again or install manually",
    markdown: [
      "### What happened",
      "",
      "Automatic setup failed while installing or starting apfel.",
      "",
      "### Manual fallback",
      "",
      "```sh",
      "brew install apfel",
      "brew services start apfel",
      "```",
    ].join("\n"),
  },
};

export function NoModelItem({
  ollamaErrorState,
  setOllamaErrorState,
  refreshModels,
}: NoModelViewProps) {
  const provider = useProvider();
  const [isSetupRunning, setIsSetupRunning] = useState(false);

  const runOllamaSetup = useCallback(
    async (model: RecommendedModel) => {
      const userApproved = await confirmAlert({
        title: "Install Ollama and download model?",
        message: `This will run CLI commands to install Ollama (if needed) and pull ${model}.`,
        primaryAction: { title: "Continue", style: Alert.ActionStyle.Default },
      });
      if (!userApproved) return;

      setIsSetupRunning(true);
      setOllamaErrorState(null);
      const setupToast = await showToast({
        style: Toast.Style.Animated,
        title: "Setting up Ollama",
        message: `Pulling ${model}...`,
      });

      try {
        await setupOllamaAndPullModel(model);
        setupToast.style = Toast.Style.Success;
        setupToast.title = "Ollama ready";
        setupToast.message = `${model} is now available.`;
        refreshModels();
      } catch (error) {
        setOllamaErrorState(ModelErrorState.SetupFailed);
        setupToast.style = Toast.Style.Failure;
        setupToast.title = "Automatic setup failed";
        setupToast.message =
          error instanceof Error ? error.message : "Unknown error";
      } finally {
        setIsSetupRunning(false);
      }
    },
    [refreshModels, setOllamaErrorState],
  );

  const runApfelSetup = useCallback(async () => {
    const userApproved = await confirmAlert({
      title: "Install and start apfel?",
      message:
        "This will run `brew install apfel` (if needed) and `brew services start apfel`.",
      primaryAction: { title: "Continue", style: Alert.ActionStyle.Default },
    });
    if (!userApproved) return;

    setIsSetupRunning(true);
    setOllamaErrorState(null);
    const setupToast = await showToast({
      style: Toast.Style.Animated,
      title: "Setting up apfel",
      message: "Installing and starting the service...",
    });

    try {
      await setupApfel();
      setupToast.style = Toast.Style.Success;
      setupToast.title = "Apfel ready";
      setupToast.message = "Apple Intelligence is now available.";
      refreshModels();
    } catch (error) {
      setOllamaErrorState(ModelErrorState.SetupFailed);
      setupToast.style = Toast.Style.Failure;
      setupToast.title = "Automatic setup failed";
      setupToast.message =
        error instanceof Error ? error.message : "Unknown error";
    } finally {
      setIsSetupRunning(false);
    }
  }, [refreshModels, setOllamaErrorState]);

  if (isSetupRunning) {
    return (
      <List.EmptyView
        icon={Icon.Hourglass}
        title="Checking setup..."
        description="Please wait while we inspect available models."
      />
    );
  }

  const views = provider.id === "apple" ? APFEL_VIEWS : OLLAMA_VIEWS;
  const view = ollamaErrorState ? views[ollamaErrorState] : null;
  if (view) {
    return (
      <List.Item
        icon={view.icon}
        title={view.title}
        subtitle={{ value: view.subtitle, tooltip: view.subtitle }}
        actions={
          <ActionPanel>
            <ModelSetupActions
              modelErrorState={ollamaErrorState}
              onRunOllamaSetup={runOllamaSetup}
              onRunApfelSetup={runApfelSetup}
              onRefreshModels={refreshModels}
            />
          </ActionPanel>
        }
        detail={<List.Item.Detail markdown={view.markdown} />}
      />
    );
  }

  return (
    <List.EmptyView
      icon={Icon.Stars}
      title="No model selected"
      description="Select a model to continue."
    />
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `bun run lint`
Expected: PASS (fix with `bun run fix-lint` if needed).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: provider-aware setup and error UI for apfel"
```

---

## Manual verification (after all tasks)

1. `bun test` → all provider tests pass.
2. `bun run typecheck` and `bun run lint` → clean.
3. `bun run dev`, default preference (Ollama): existing flow works unchanged.
4. Set preference to **Apple Intelligence** (on a Mac with apfel running): dropdown shows a single "Apple Intelligence" model, no Size/Date rows; a text action streams a result.
5. Stop apfel (`brew services stop apfel`), reopen: "Apfel is not running" view with a **Start Apfel Service** action.
```
