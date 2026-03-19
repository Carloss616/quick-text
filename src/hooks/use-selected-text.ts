import { getSelectedText } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

/**
 * Hook that captures the selected text from the frontmost application
 * IMMEDIATELY when the command launches, before any UI steals focus.
 */
export function useSelectedText() {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const captured = useRef(false);

  useEffect(() => {
    // Only capture once, on first mount
    if (captured.current) return;
    captured.current = true;

    async function capture() {
      try {
        const text = await getSelectedText();
        setSelectedText(text.trim());
      } catch {
        // no actions
      } finally {
        setIsLoading(false);
      }
    }
    capture();
  }, []);

  return { selectedText, isLoading };
}
