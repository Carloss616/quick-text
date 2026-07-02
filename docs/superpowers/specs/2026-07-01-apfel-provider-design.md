# Design: Apple Intelligence (apfel) as an optional second provider

Date: 2026-07-01

## Goal

Add **apfel** (Apple FoundationModels exposed as an OpenAI-compatible server) as an
optional, extra provider alongside Ollama. Ollama stays the default; apfel is
opt-in and macOS-only. No engine swap, no heavy new dependencies.

## Verified apfel facts

- Install: `brew install apfel`. Run in background: `brew services start apfel`
  (foreground: `apfel --serve`).
- OpenAI-compatible server at `http://localhost:11434/v1`.
  **Same default port as Ollama, and no documented `--port`/`PORT` option** — so
  apfel and Ollama cannot listen simultaneously.
- `GET /v1/models` → single model, id `"apple-foundationmodel"`.
- `POST /v1/chat/completions` with `"stream": true` → SSE stream of content deltas.
  No `thinking` stream. No size/date metadata.
- Requirements: macOS 26 Tahoe+, Apple Silicon, Apple Intelligence enabled.

## Decisions (approved)

1. **Provider selection = a `provider` dropdown preference** (`ollama` default / `apple`).
2. **HTTP = raw `fetch` + manual SSE parsing** for apfel. No new dependency.
3. **A neutral internal `Model` type** decouples the app from ollama's `ModelResponse`.

## Architecture

### 1. Preference (`package.json`)

Add a dropdown preference:

```jsonc
{
  "name": "provider",
  "type": "dropdown",
  "required": false,
  "title": "AI Provider",
  "description": "Ollama, or Apple Intelligence via apfel (macOS + Apple Silicon only). Both use the Server URL below (apfel listens on the same 11434 port).",
  "default": "ollama",
  "data": [
    { "title": "Ollama", "value": "ollama" },
    { "title": "Apple Intelligence (macOS only)", "value": "apple" }
  ]
}
```

`ollamaUrl` (default `http://localhost:11434`) stays and is the base URL for **both**
providers; apfel appends `/v1`.

**Manifest limitation (ponytail caveat):** Raycast cannot hide a manifest preference
option per-OS. So "Apple Intelligence" still appears in the dropdown on Windows, but a
runtime resolver forces `ollama` whenever `process.platform !== "darwin"`. The Apple
path therefore never activates off-Mac. This is the honest reading of "en Windows ni
aparece" given the platform's constraints.

### 2. Provider seam — new `src/providers/`

**`types.ts`**

```ts
export type Model = { id: string; label: string; size?: number; date?: string };

export type ProviderRequest = { model: string; system?: string; prompt: string };

export type GenerateChunk = { text?: string; thinking?: string };

export type ProviderId = "ollama" | "apple";

export interface Provider {
  id: ProviderId;
  listModels(): Promise<Model[]>;
  generate(req: ProviderRequest, signal: AbortSignal): AsyncIterable<GenerateChunk>;
}
```

**`ollama-provider.ts`** — wraps the existing `ollama` client (host from `ollamaUrl`).
- `listModels()`: `ollama.list()`, map each `ModelResponse` →
  `{ id: name, label: name, size, date: modified_at }`.
- `generate()`: `ollama.generate({ ...req, stream: true })`; for each chunk yield
  `{ thinking: chunk.thinking }` or `{ text: chunk.response }`. Abort via `stream.abort()`
  when `signal.aborted`.

**`apfel-provider.ts`** — raw `fetch`, base URL = `ollamaUrl`.
- `listModels()`: `GET {url}/v1/models`. Map `data[]` → `Model` (`id` from response,
  `label: "Apple Intelligence"`, no size/date). If the response is empty, fall back to a
  single `{ id: "apple-foundationmodel", label: "Apple Intelligence" }`. A network/HTTP
  error propagates (→ NotRunning, same semantics as Ollama).
- `generate()`: `POST {url}/v1/chat/completions` with
  `{ model, stream: true, messages: [{role:"system",content:system?}, {role:"user",content:prompt}] }`
  (omit the system message when `system` is empty). Read `res.body` as a stream, split
  SSE `data:` lines, ignore `[DONE]`, `JSON.parse` each, yield
  `{ text: choices[0].delta.content }` for non-empty deltas. Pass `signal` to `fetch` for
  cancellation.

**`use-provider.ts`** — hook that reads `provider` + `ollamaUrl` prefs and
`process.platform`, memoizes and returns the active `Provider`. Off-Mac ⇒ always Ollama.

`src/providers/index.ts` re-exports; `src/hooks/index.ts` re-exports `useProvider`.
The old `useOllama` hook is subsumed by the ollama provider (removed or kept internal to
`ollama-provider.ts`).

### 3. Setup helpers

Extract the private `runShellCommand` spawn helper from `ollama-setup.ts` into
**`src/utils/shell.ts`** (shared).

**`src/utils/apfel-setup.ts`** — mirrors `ollama-setup.ts`, darwin-only:
- check `command -v apfel`
- if missing: `brew install apfel`
- `brew services start apfel`
- error handling identical in shape to `setupOllamaAndPullModel` (throw with combined
  stdout/stderr on non-zero exit).

`ollama-setup.ts` keeps its Ollama-specific logic and now imports `runShellCommand` from
`shell.ts`.

### 4. Consumer refactors (mechanical)

- **`model-selector-dropdown.tsx`**: use `provider.listModels()` returning `Model[]`.
  Match by `model.id`. For Apple the list is one item; the dropdown still renders it
  (single item, `storeValue`) for flow consistency.
- **`text-processor-detail.tsx`**: consume `provider.generate(request, signal)` yielding
  `GenerateChunk`. Keep the thinking-vs-text branching (Ollama emits thinking; apfel does
  not). Render Size/Date metadata only when the selected `Model` has those fields.
- **`text-action-item.tsx`** and **`quick-text-command.tsx`**: `ModelResponse` → `Model`,
  `selectedModel.name` → `selectedModel.id`.
- **`no-model-item.tsx` + `model-setup-actions.tsx`**: error copy and setup actions become
  **provider-parameterized**.
  - Enum members go provider-neutral: `NotRunning` / `Missing` / `NoModels` / `SetupFailed`.
  - Copy + commands branch on the active `ProviderId`:
    - Ollama → existing copy, `ollama pull …`, `open ollama://`.
    - Apple → `Missing` action runs `brew install apfel` then `brew services start apfel`;
      `NotRunning` action runs `brew services start apfel`; no `NoModels` state (single
      fixed model).

## Data flow

```
provider pref ──▶ useProvider() ──▶ Provider
                                     │
   listModels() ─▶ Model[] ─▶ dropdown ─▶ selectedModel
                                             │
 action + option ─▶ ProviderRequest {model,system,prompt}
                                             │
                          provider.generate(req, signal)
                                             │
                        stream of GenerateChunk {text|thinking}
                                             │
                             TextProcessorDetail renders
```

Identical for both providers; only the two provider files know the wire format.

## Error handling

- `listModels()` throwing = server unreachable → `NotRunning` (unchanged behavior).
- Apple selected off-Mac → resolver returns Ollama, so no dead/unsupported UI.
- `generate()` errors surface via the existing failure toast in `text-processor-detail`.

## Testing

- `assert`-based self-check for the apfel SSE parser (the only nontrivial parsing),
  fed canned `data:` chunks including a `[DONE]` terminator and an empty-delta chunk.
- Everything else is type-swaps over existing, already-working UI.
- `bun run typecheck` must pass.

## Out of scope / YAGNI

- Configurable apfel port (not supported by apfel; both share 11434).
- Multi-model listing for Apple (single fixed model).
- Non-streaming path (streaming covers the UI need).
- `openai` SDK (raw fetch is fewer deps for one endpoint).
