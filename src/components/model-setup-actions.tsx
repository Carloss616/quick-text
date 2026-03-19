import { Action, Icon } from "@raycast/api";
import { ModelErrorState } from "@/components";
import type { RecommendedModel } from "@/utils";

interface ModelSetupActionsProps {
  modelErrorState: ModelErrorState | null;
  onRunSetupFlow: (model: RecommendedModel) => Promise<void>;
  onRefreshModels: () => void;
}

export function ModelSetupActions({
  modelErrorState,
  onRunSetupFlow,
  onRefreshModels,
}: ModelSetupActionsProps) {
  return (
    <>
      <Action
        title={
          modelErrorState === ModelErrorState.OllamaMissing
            ? "Install Ollama + Pull Granite4:350m"
            : "Pull Granite4:350m (~700mb)"
        }
        icon={Icon.Download}
        onAction={() => void onRunSetupFlow("granite4:350m")}
      />
      {modelErrorState === ModelErrorState.OllamaNoModels && (
        <Action
          title="Pull Granite4 (~2gb)"
          icon={Icon.Download}
          onAction={() => void onRunSetupFlow("granite4")}
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
