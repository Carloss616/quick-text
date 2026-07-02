import { List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { useProvider, type Model } from "@/providers";
import { formatSize, isApfelInstalled } from "@/utils";

export enum ModelErrorState {
  NotRunning = "not_running",
  Missing = "missing",
  NoModels = "no_models",
  SetupFailed = "setup_failed",
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
        onModelError(ModelErrorState.NoModels);
      }
    }

    async function fetchModels() {
      setIsLoading(true);
      try {
        applyModels(await provider.listModels());
      } catch (error) {
        // Can't reach the provider. For apfel, tell "not installed" apart from
        // "installed but stopped" so the setup UI offers the right action.
        const notInstalled =
          provider.id === "apple" && !(await isApfelInstalled());
        if (isCancelled) return;
        onModelError(
          notInstalled ? ModelErrorState.Missing : ModelErrorState.NotRunning,
        );
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
