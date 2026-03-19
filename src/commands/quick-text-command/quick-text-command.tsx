import { Icon, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useCallback, useState } from "react";
import { ModelSelectorDropdown, ModelErrorState } from "@/components";
import { useSelectedText } from "@/hooks";
import { ChangeToneItem } from "./components/change-tone-item";
import { FixGrammarItem } from "./components/fix-grammar-item";
import { ParaphraseItem } from "./components/paraphrase-item";
import { SummarizeItem } from "./components/summarize-item";
import { TranslateItem } from "./components/translate-item";
import { NoModelItem } from "./components/no-model-item";

export function QuickTextCommand() {
  const { selectedText, isLoading } = useSelectedText();
  const [selectedModel, setSelectedModel] = useState<ModelResponse | null>(
    null,
  );
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
          ollamErrorState={modelErrorState}
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
        <>
          <FixGrammarItem
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
          <ChangeToneItem
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
          <ParaphraseItem
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
          <SummarizeItem
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
          <TranslateItem
            selectedModel={selectedModel}
            selectedText={selectedText}
          />
        </>
      )}
    </List>
  );
}
