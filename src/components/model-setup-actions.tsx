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
    // Missing = not installed (needs brew install); NotRunning = installed but
    // stopped (just start it). setupApfel() handles both, only the label differs.
    const installNeeded = modelErrorState === ModelErrorState.Missing;
    return (
      <>
        <Action
          title={
            installNeeded ? "Install & Start Apfel" : "Start Apfel Service"
          }
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
