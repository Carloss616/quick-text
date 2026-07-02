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
