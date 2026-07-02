import { Color, List, showToast, Toast } from "@raycast/api";
import { type Dispatch, useEffect, useMemo, useState } from "react";
import { useProvider, type Model, type ProviderRequest } from "@/providers";
import { formatSize } from "@/utils";

interface TextProcessorDetailProps {
  selectedModel: Model;
  selectedText: string;
  request: ProviderRequest;
  setParentProcessedText: Dispatch<React.SetStateAction<string | null>>;
  metadata?: Record<
    string,
    | string
    | {
        value: string;
        color?: Color | null;
      }
  >;
}

export function TextProcessorDetail({
  selectedModel,
  selectedText,
  request,
  setParentProcessedText,
  metadata,
}: TextProcessorDetailProps) {
  const provider = useProvider();
  const [processedText, setProcessedText] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();

    async function processText() {
      setIsLoading(true);
      setIsThinking(false);
      setThinkingText("");
      setProcessedText("");
      setParentProcessedText(null);

      let fullResponseText = "";
      let fullThinkingText = "";

      try {
        for await (const chunk of provider.generate(
          request,
          controller.signal,
        )) {
          if (controller.signal.aborted) break;

          if (chunk.thinking) {
            setIsThinking(true);
            fullThinkingText += chunk.thinking;
            setThinkingText(fullThinkingText);
          } else if (chunk.text) {
            setIsThinking(false);
            fullResponseText += chunk.text;
            setProcessedText(fullResponseText);
            setParentProcessedText(fullResponseText);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to process text",
          message: errorMsg,
        });
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    processText();

    return () => {
      controller.abort();
    };
  }, [provider, request]);

  const markdown = useMemo(() => {
    const quote = thinkingText
      ? `> ${thinkingText.replaceAll("\n", "\n> ")}\n\n`
      : "";
    return `${quote}${processedText}` || " "; // simulate empty with space
  }, [thinkingText, processedText]);

  return (
    <List.Item.Detail
      markdown={markdown}
      isLoading={isLoading || isThinking}
      metadata={
        <List.Item.Detail.Metadata>
          {metadata && (
            <>
              {Object.entries(metadata).map(([key, value]) => (
                <List.Item.Detail.Metadata.Label
                  key={key}
                  title={key}
                  text={value}
                />
              ))}
              <List.Item.Detail.Metadata.Separator />
            </>
          )}
          <List.Item.Detail.Metadata.Label
            title="Original"
            text={{
              value: selectedText,
              color: Color.SecondaryText,
            }}
          />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Model"
            text={selectedModel.label}
          />
          {selectedModel.size != null && (
            <List.Item.Detail.Metadata.Label
              title="Size"
              text={formatSize(selectedModel.size)}
            />
          )}
          {selectedModel.date && (
            <List.Item.Detail.Metadata.Label
              title="Date"
              text={new Date(selectedModel.date).toDateString()}
            />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
