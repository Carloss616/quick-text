import { Action } from "@raycast/api";

export function CopyAndPasteActions({ content }: { content: string | null }) {
  if (!content) return null;
  return (
    <>
      <Action.Paste title="Replace Selection" content={content} />
      <Action.CopyToClipboard
        title="Copy to Clipboard"
        content={content}
        shortcut={{ modifiers: ["cmd"], key: "c" }}
      />
    </>
  );
}
