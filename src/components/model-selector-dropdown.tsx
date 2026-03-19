import { List, showToast, Toast } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useEffect, useRef, useState } from "react";
import { useOllama } from "@/hooks";
import { formatSize } from "@/utils";

export function ModelSelectorDropdown({
  onModelSelected,
}: {
  onModelSelected: (model: ModelResponse) => void;
}) {
  const ollama = useOllama();
  const [models, setModels] = useState<ModelResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const modelsMapRef = useRef<Record<string, ModelResponse>>({});

  useEffect(() => {
    async function fetchModels() {
      try {
        const result = await ollama.list();
        if (result.models.length === 0) {
          throw new Error(
            "No models found. Run `ollama pull <model>` to download one.",
          );
        }
        setModels(result.models);
        modelsMapRef.current = result.models.reduce(
          (acc, model) => {
            acc[model.name] = model;
            return acc;
          },
          {} as Record<string, ModelResponse>,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to list models",
          message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, []);

  return (
    <List.Dropdown
      tooltip="Change model"
      storeValue
      isLoading={isLoading}
      onChange={(value) => {
        const model = modelsMapRef.current[value];
        onModelSelected(model);
      }}
      placeholder="Search Ollama models..."
    >
      {models.map((model) => (
        <List.Dropdown.Item
          key={model.name}
          title={`${model.name} (${formatSize(model.size)})`}
          value={model.name}
          keywords={[formatSize(model.size)]}
        />
      ))}
    </List.Dropdown>
  );
}
