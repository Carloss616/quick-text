import { Action, ActionPanel, Color, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";

interface TranslateCommandProps {
  selectedModel: ModelResponse;
  selectedText: string;
}

enum Language {
  English = "English",
  Spanish = "Spanish",
  French = "French",
  German = "German",
  Italian = "Italian",
  Portuguese = "Portuguese",
}

export function TranslateItem({
  selectedModel,
  selectedText,
}: TranslateCommandProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    Language.English,
  );
  const subtitle = "Translate the currently selected text.";

  const request = useMemo(
    () => ({
      model: selectedModel.name,
      prompt: `Translate the following text to ${selectedLanguage}. Do not add any conversational filler, just return the exact translation:\n\n${selectedText}`,
      system: "You are a translation assistant.",
    }),
    [selectedModel.name, selectedText, selectedLanguage],
  );

  const metadata = useMemo(
    () => ({
      Language: {
        value: selectedLanguage,
        color: Color.Green,
      },
    }),
    [selectedLanguage],
  );

  return (
    <List.Item
      title="Translate"
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
            title="Change Language"
            shortcut={{ modifiers: ["cmd"], key: "l" }}
          >
            {Object.values(Language).map((language) => (
              <Action
                key={language}
                title={language}
                autoFocus={selectedLanguage === language}
                onAction={() => setSelectedLanguage(language)}
              />
            ))}
          </ActionPanel.Submenu>
        </ActionPanel>
      }
    />
  );
}
