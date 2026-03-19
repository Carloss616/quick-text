import {
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import * as md from "ts-markdown-builder";
import { ModelErrorState, ModelSetupActions } from "@/components";
import {
  getOllamaInstallCommand,
  RecommendedModel,
  setupOllamaAndPullModel,
} from "@/utils";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

interface OllamaNoModelViewProps {
  ollamErrorState: ModelErrorState | null;
  setOllamaErrorState: Dispatch<SetStateAction<ModelErrorState | null>>;
  refreshModels: () => void;
}

export function NoModelItem({
  ollamErrorState,
  setOllamaErrorState,
  refreshModels,
}: OllamaNoModelViewProps) {
  const [isSetupRunning, setIsSetupRunning] = useState(false);

  const runSetupFlow = useCallback(
    async (model: RecommendedModel) => {
      try {
        getOllamaInstallCommand(process.platform);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setOllamaErrorState(ModelErrorState.OllamaSetupFailed);
        await showToast({
          style: Toast.Style.Failure,
          title: "Unsupported OS",
          message,
        });
        return;
      }
      const userApproved = await confirmAlert({
        title: "Install Ollama and download model?",
        message: `This will run CLI commands to install Ollama (if needed) and pull ${model}.`,
        primaryAction: {
          title: "Continue",
          style: Alert.ActionStyle.Default,
        },
      });

      if (!userApproved) return;
      setIsSetupRunning(true);
      setOllamaErrorState(null);

      const setupToast = await showToast({
        style: Toast.Style.Animated,
        title: "Setting up Ollama",
        message: `Pulling ${model}...`,
      });

      try {
        await setupOllamaAndPullModel(model);
        setupToast.style = Toast.Style.Success;
        setupToast.title = "Ollama ready";
        setupToast.message = `${model} is now available.`;
        refreshModels();
      } catch (error) {
        setOllamaErrorState(ModelErrorState.OllamaSetupFailed);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setupToast.style = Toast.Style.Failure;
        setupToast.title = "Automatic setup failed";
        setupToast.message = message;
      } finally {
        setOllamaErrorState(null);
        setIsSetupRunning(false);
      }
    },
    [refreshModels],
  );

  if (isSetupRunning) {
    return (
      <List.EmptyView
        icon={Icon.Hourglass}
        title="Checking Ollama setup..."
        description="Please wait while we inspect available models."
      />
    );
  }

  if (ollamErrorState === ModelErrorState.OllamaMissing) {
    const subtitle = "Install Ollama and pull a starter model";
    const markdown = md.joinBlocks([
      md.heading("What this action will do", { level: 3 }),
      md.orderedList([
        "Detect your OS automatically.",
        "Install Ollama with the official command for your OS.",
        "Pull recommended model `granite4:350m` (<1GB).",
        "Refresh model list.",
      ]),
      md.heading("Install command by OS", { level: 3 }),
      md.codeBlock("curl -fsSL https://ollama.com/install.sh | sh", {
        language: "sh",
      }),
      md.codeBlock("irm https://ollama.com/install.ps1 | iex", {
        language: "powershell",
      }),
      md.heading("Model pull command", { level: 3 }),
      md.codeBlock("ollama pull granite4:350m", {
        language: "sh",
      }),
      md.heading("Recommendation", { level: 3 }),
      md.blockquote(
        "Use simple models without integrated thinking to keep quick-text fast.",
      ),
    ]);

    return (
      <List.Item
        icon={Icon.ExclamationMark}
        title="Ollama not available"
        subtitle={{
          value: subtitle,
          tooltip: subtitle,
        }}
        actions={
          <ActionPanel>
            <ModelSetupActions
              modelErrorState={ollamErrorState}
              onRunSetupFlow={runSetupFlow}
              onRefreshModels={refreshModels}
            />
          </ActionPanel>
        }
        detail={<List.Item.Detail markdown={markdown} />}
      />
    );
  }

  if (ollamErrorState === ModelErrorState.OllamaNoModels) {
    const subtitle = "Download granite4 or granite4:350m";
    const markdown = md.joinBlocks([
      md.heading("What this action will do", { level: 3 }),
      md.orderedList([
        "Skip Ollama installation (already detected).",
        "Pull selected model.",
        "Refresh model list after download.",
      ]),
      md.heading("Model pull commands", { level: 3 }),
      md.codeBlock("ollama pull granite4:350m", {
        language: "sh",
      }),
      md.codeBlock("ollama pull granite4", {
        language: "sh",
      }),
      md.heading("Recommendation", { level: 3 }),
      md.blockquote(
        "Prefer simple models without integrated thinking. Thinking-enabled models usually slow down quick processing.",
      ),
    ]);

    return (
      <List.Item
        icon={Icon.Stars}
        title="No Ollama models found"
        subtitle={{
          value: subtitle,
          tooltip: subtitle,
        }}
        actions={
          <ActionPanel>
            <ModelSetupActions
              modelErrorState={ollamErrorState}
              onRunSetupFlow={runSetupFlow}
              onRefreshModels={refreshModels}
            />
          </ActionPanel>
        }
        detail={<List.Item.Detail markdown={markdown} />}
      />
    );
  }

  if (ollamErrorState === ModelErrorState.OllamaSetupFailed) {
    const subtitle = "Try again or run manual install";
    const markdown = md.joinBlocks([
      md.heading("What happened", { level: 3 }),
      "Automatic setup failed while installing Ollama or pulling the model.",
      md.heading("What this action will do", { level: 3 }),
      "Retry installation/pull with confirmation.",
      md.heading("Manual fallback commands", { level: 3 }),
      md.codeBlock("curl -fsSL https://ollama.com/install.sh | sh", {
        language: "sh",
      }),
      md.codeBlock("irm https://ollama.com/install.ps1 | iex", {
        language: "powershell",
      }),
      md.heading("Recommendation", { level: 3 }),
      md.blockquote(
        "Use simple models without integrated thinking for faster quick-text responses.",
      ),
    ]);

    return (
      <List.Item
        icon={Icon.ExclamationMark}
        title="Setup failed"
        subtitle={{
          value: subtitle,
          tooltip: subtitle,
        }}
        actions={
          <ActionPanel>
            <ModelSetupActions
              modelErrorState={ollamErrorState}
              onRunSetupFlow={runSetupFlow}
              onRefreshModels={refreshModels}
            />
          </ActionPanel>
        }
        detail={<List.Item.Detail markdown={markdown} />}
      />
    );
  }

  return (
    <List.EmptyView
      icon={Icon.Stars}
      title="No model selected"
      description="Select a model to continue. Prefer simple models without thinking for faster results."
    />
  );
}
