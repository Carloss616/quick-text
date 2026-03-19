import { ActionPanel, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";

interface SummarizeItemProps {
  selectedModel: ModelResponse;
  selectedText: string;
}

export function SummarizeItem({
  selectedModel,
  selectedText,
}: SummarizeItemProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const subtitle = "Summarize the currently selected text.";

  const request = useMemo(
    () => ({
      model: selectedModel.name,
      prompt: `Summarize the following text concisely. Do not add conversational filler, just return the summary:\n\n${selectedText}`,
      system: "You are a summarization assistant.",
    }),
    [selectedModel.name, selectedText],
  );

  return (
    <List.Item
      title="Summarize"
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
