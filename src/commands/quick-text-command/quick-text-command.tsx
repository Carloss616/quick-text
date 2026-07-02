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
  const [modelErrorState, setModelErrorState] =
    useState<ModelErrorState | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshModels = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={(!!selectedText && !!selectedModel) || !!modelErrorState}
      searchBarAccessory={
        <ModelSelectorDropdown
          onModelSelected={setSelectedModel}
          onModelError={setModelErrorState}
          refreshToken={refreshToken}
        />
      }
    >
      {!selectedModel ? (
        <NoModelItem
          ollamaErrorState={modelErrorState}
          setOllamaErrorState={setModelErrorState}
          refreshModels={refreshModels}
        />
      ) : !selectedText ? (
        <List.EmptyView
          icon={Icon.TextSelection}
          title="No text selected"
          description="Select some text to continue"
        />
      ) : (
        TEXT_ACTIONS.map((action) => (
          <TextActionItem
            key={action.title}
            action={action}
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
        ))
      )}
    </List>
  );
}
