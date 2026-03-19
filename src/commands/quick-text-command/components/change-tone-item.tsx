import { Action, ActionPanel, Color, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";

interface ChangeToneItemProps {
  selectedModel: ModelResponse;
  selectedText: string;
}

enum Tone {
  Professional = "Professional",
  Casual = "Casual",
  Friendly = "Friendly",
  Direct = "Direct",
  Academic = "Academic",
}

export function ChangeToneItem({
  selectedModel,
  selectedText,
}: ChangeToneItemProps) {
  const [selectedTone, setSelectedTone] = useState<Tone>(Tone.Professional);
  const [processedText, setProcessedText] = useState<string | null>(null);
  const subtitle = "Change the tone of the currently selected text.";

  const request = useMemo(
    () => ({
      model: selectedModel.name,
      prompt: `Rewrite the following text in a ${selectedTone} tone. Do not add any conversational filler, just return the exact new text:\n\n${selectedText}`,
      system: "You are a text rewriting assistant.",
    }),
    [selectedModel.name, selectedTone, selectedText],
  );

  const metadata = useMemo(
    () => ({
      Tone: {
        value: selectedTone,
        color: Color.Green,
      },
    }),
    [selectedTone],
  );

  return (
    <List.Item
      title="Change Tone"
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
          metadata={metadata}
        />
      }
      actions={
        <ActionPanel>
          <CopyAndPasteActions content={processedText} />
          <ActionPanel.Submenu
            title="Change Tone"
            shortcut={{ modifiers: ["cmd"], key: "t" }}
          >
            {Object.values(Tone).map((tone) => (
              <Action
                key={tone}
                title={tone}
                autoFocus={selectedTone === tone}
                onAction={() => setSelectedTone(tone)}
              />
            ))}
          </ActionPanel.Submenu>
        </ActionPanel>
      }
    />
  );
}
