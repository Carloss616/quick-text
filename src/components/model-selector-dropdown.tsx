import { List, open, showToast, Toast } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useEffect, useState } from "react";
import { useOllama } from "@/hooks";
import { formatSize } from "@/utils";

export enum ModelErrorState {
  OllamaMissing = "ollama_missing",
  OllamaNoModels = "ollama_no_models",
  OllamaSetupFailed = "ollama_setup_failed",
}

export function ModelSelectorDropdown({
  onModelSelected,
  onModelError,
  refreshToken,
}: {
  onModelSelected: (model: ModelResponse) => void;
  onModelError: (state: ModelErrorState) => void;
  refreshToken: number;
}) {
  const ollama = useOllama();
  const [models, setModels] = useState<ModelResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    function applyModels(result: { models: ModelResponse[] }) {
      if (isCancelled) return;
      setModels(result.models);
      if (result.models.length === 0) {
        onModelError(ModelErrorState.OllamaNoModels);
      }
    }

    async function listWithOllamaOpen() {
      await open("ollama://");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return ollama.list();
    }

    async function fetchModels() {
      setIsLoading(true);
      try {
        applyModels(await ollama.list());
      } catch {
        // Ollama may just be closed — open it, then retry twice.
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            applyModels(await listWithOllamaOpen());
            break;
          } catch (retryError) {
            if (attempt < 2) continue;
            onModelError(ModelErrorState.OllamaMissing);
            showToast({
              style: Toast.Style.Failure,
              title: "Failed to list models",
              message:
                retryError instanceof Error
                  ? retryError.message
                  : "Unknown error",
            });
          }
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchModels();

    return () => {
      isCancelled = true;
    };
  }, [ollama, onModelError, refreshToken]);

  return (
    <List.Dropdown
      tooltip="Change model"
      storeValue
      isLoading={isLoading}
      onChange={(value) => {
        const model = models.find((m) => m.name === value);
        if (model) onModelSelected(model);
      }}
      placeholder="Search Ollama models..."
    >
      {models.map((model) => (
        <List.Dropdown.Item
          key={model.name}
          title={`${model.name} (${formatSize(model.size)})`}
          value={model.name}
        />
      ))}
    </List.Dropdown>
  );
}
