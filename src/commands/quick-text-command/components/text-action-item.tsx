import { Action, ActionPanel, Color, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { CopyAndPasteActions, TextProcessorDetail } from "@/components";
import type { Model, ProviderRequest } from "@/providers";
import type { TextAction } from "./text-actions";

interface TextActionItemProps {
  action: TextAction;
  selectedModel: Model;
  selectedText: string;
}

export function TextActionItem({
  action,
  selectedModel,
  selectedText,
}: TextActionItemProps) {
  const [processedText, setProcessedText] = useState<string | null>(null);
  const [option, setOption] = useState(action.selector?.options[0] ?? "");

  const request = useMemo<ProviderRequest>(
    () => ({
      model: selectedModel.id,
      prompt: action.buildPrompt(selectedText, option),
      system: action.system,
    }),
    [selectedModel.id, selectedText, option, action],
  );

  const metadata = useMemo(
    () =>
      action.selector
        ? {
            [action.selector.metadataLabel]: {
              value: option,
              color: Color.Green,
            },
          }
        : undefined,
    [action.selector, option],
  );

  return (
    <List.Item
      title={action.title}
      subtitle={{ value: action.subtitle, tooltip: action.subtitle }}
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
          {action.selector && (
            <ActionPanel.Submenu
              title={action.selector.title}
              shortcut={action.selector.shortcut}
            >
              {action.selector.options.map((opt) => (
                <Action
                  key={opt}
                  title={opt}
                  autoFocus={option === opt}
                  onAction={() => setOption(opt)}
                />
              ))}
            </ActionPanel.Submenu>
          )}
        </ActionPanel>
      }
    />
  );
}
