import { ActionPanel, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";

interface FixGrammarItemProps {
  selectedModel: ModelResponse;
  selectedText: string;
}

export function FixGrammarItem({
  selectedModel,
  selectedText,
}: FixGrammarItemProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const subtitle = "Fix grammar of the currently selected text.";

  const request = useMemo(
    () => ({
      model: selectedModel.name,
      prompt: `Fix the grammar and spelling in the following text. Do not change the original meaning or add conversational filler, just return the corrected text:\n\n${selectedText}`,
      system: "You are a grammar correction assistant.",
    }),
    [selectedModel.name, selectedText],
  );

  return (
    <List.Item
      title="Fix Grammar"
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
