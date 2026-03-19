import { List, open, showToast, Toast } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useEffect, useRef, useState } from "react";
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
  const modelsMapRef = useRef<Record<string, ModelResponse>>({});

  useEffect(() => {
    let isCancelled = false;

    function applyModels(result: { models: ModelResponse[] }) {
      if (result.models.length === 0) {
        setModels([]);
        modelsMapRef.current = {};
        onModelError(ModelErrorState.OllamaNoModels);
        return;
      }

      setModels(result.models);
      modelsMapRef.current = result.models.reduce(
        (acc, model) => {
          acc[model.name] = model;
          return acc;
        },
        {} as Record<string, ModelResponse>,
      );
    }

    async function openOllamaAndListModels() {
      await open("ollama://");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const result = await ollama.list();
      return result;
    }

    async function fetchModels() {
      if (isCancelled) return;
      setIsLoading(true);
      try {
        const result = await ollama.list();
        applyModels(result);
      } catch {
        try {
          const retryResult = await openOllamaAndListModels();
          applyModels(retryResult);
        } catch {
          try {
            const retryResult = await openOllamaAndListModels();
            applyModels(retryResult);
          } catch (retryError) {
            onModelError(ModelErrorState.OllamaMissing);

            const message =
              retryError instanceof Error
                ? retryError.message
                : "Unknown error";

            showToast({
              style: Toast.Style.Failure,
              title: "Failed to list models",
              message,
            });
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
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
        const model = modelsMapRef.current[value];
        if (model) {
          onModelSelected(model);
        }
      }}
      placeholder="Search Ollama models..."
    >
      {models.map((model) => (
        <List.Dropdown.Item
          key={model.name}
          title={`${model.name} (${formatSize(model.size)})`}
          value={model.name}
          keywords={[formatSize(model.size)]}
        />
      ))}
    </List.Dropdown>
  );
}
