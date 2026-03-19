import { ActionPanel, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";

interface ParaphraseItemProps {
  selectedModel: ModelResponse;
  selectedText: string;
}

export function ParaphraseItem({
  selectedModel,
  selectedText,
}: ParaphraseItemProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const subtitle = "Paraphrase and improve the currently selected text.";

  const request = useMemo(
    () => ({
      model: selectedModel.name,
      prompt: `Paraphrase and improve the following text. Make it sound native and clear. Do not add any conversational filler or markdown code blocks, just return the exact text:\n\n${selectedText}`,
      system: "You are a paraphrasing assistant.",
    }),
    [selectedModel.name, selectedText],
  );

  return (
    <List.Item
      title="Paraphrase"
      subtitle={{
        value: subtitle,
        tooltip: subtitle,
      }}
      detail={
        <TextProcessorDetail
          selectedModel={selectedModel}
          selectedText={selectedText}
          request={request}
          setParentProcessedText={setProcessedText}
        />
      }
      actions={
        <ActionPanel>
          <CopyAndPasteActions content={processedText} />
        </ActionPanel>
      }
    />
  );
}
