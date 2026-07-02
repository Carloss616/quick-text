import {
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { ModelErrorState, ModelSetupActions } from "@/components";
import { useProvider } from "@/providers";
import { RecommendedModel, setupApfel, setupOllamaAndPullModel } from "@/utils";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

interface NoModelViewProps {
  ollamaErrorState: ModelErrorState | null;
  setOllamaErrorState: Dispatch<SetStateAction<ModelErrorState | null>>;
  refreshModels: () => void;
}

type ErrorView = {
  icon: Icon;
  title: string;
  subtitle: string;
  markdown: string;
};

const OLLAMA_VIEWS: Record<ModelErrorState, ErrorView> = {
  [ModelErrorState.NotRunning]: {
    icon: Icon.Plug,
    title: "Ollama is not running",
    subtitle: "Open Ollama, then refresh",
    markdown: [
      "### Can't reach Ollama",
      "",
      "The Ollama server didn't respond. It's probably closed.",
      "",
      "### What to do",
      "",
      "1. Run the **Open Ollama** action below.",
      "2. Wait a couple seconds for it to start.",
      "3. Run **Refresh Models**.",
      "",
      "> Not installed yet? Use **Install Ollama + Pull Granite4:350m** instead.",
    ].join("\n"),
  },
  [ModelErrorState.Missing]: {
    icon: Icon.ExclamationMark,
    title: "Ollama not available",
    subtitle: "Install Ollama and pull a starter model",
    markdown: [
      "### What this action will do",
      "",
      "1. Detect your OS automatically.",
      "2. Install Ollama with the official command for your OS.",
      "3. Pull recommended model `granite4:350m` (<1GB).",
      "4. Refresh model list.",
      "",
      "### Install command by OS",
      "",
      "```sh",
      "curl -fsSL https://ollama.com/install.sh | sh",
      "```",
      "```powershell",
      "irm https://ollama.com/install.ps1 | iex",
      "```",
      "",
      "### Model pull command",
      "",
      "```sh",
      "ollama pull granite4:350m",
      "```",
      "",
      "### Recommendation",
      "",
      "> Use simple models without integrated thinking to keep quick-text fast.",
    ].join("\n"),
  },
  [ModelErrorState.NoModels]: {
    icon: Icon.Stars,
    title: "No Ollama models found",
    subtitle: "Download granite4 or granite4:350m",
    markdown: [
      "### What this action will do",
      "",
      "1. Skip Ollama installation (already detected).",
      "2. Pull selected model.",
      "3. Refresh model list after download.",
      "",
      "### Model pull commands",
      "",
      "```sh",
      "ollama pull granite4:350m",
      "```",
      "```sh",
      "ollama pull granite4",
      "```",
      "",
      "### Recommendation",
      "",
      "> Prefer simple models without integrated thinking. Thinking-enabled models usually slow down quick processing.",
    ].join("\n"),
  },
  [ModelErrorState.SetupFailed]: {
    icon: Icon.ExclamationMark,
    title: "Setup failed",
    subtitle: "Try again or run manual install",
    markdown: [
      "### What happened",
      "",
      "Automatic setup failed while installing Ollama or pulling the model.",
      "",
      "### What this action will do",
      "",
      "Retry installation/pull with confirmation.",
      "",
      "### Manual fallback commands",
      "",
      "```sh",
      "curl -fsSL https://ollama.com/install.sh | sh",
      "```",
      "```powershell",
      "irm https://ollama.com/install.ps1 | iex",
      "```",
      "",
      "### Recommendation",
      "",
      "> Use simple models without integrated thinking for faster quick-text responses.",
    ].join("\n"),
  },
};

const APFEL_VIEWS: Record<ModelErrorState, ErrorView> = {
  [ModelErrorState.NotRunning]: {
    icon: Icon.Plug,
    title: "Apfel is not running",
    subtitle: "Start the apfel service, then refresh",
    markdown: [
      "### Can't reach Apple Intelligence",
      "",
      "The apfel server (`localhost:11434`) didn't respond.",
      "",
      "### What to do",
      "",
      "1. Run **Start Apfel Service** below.",
      "2. Wait a couple seconds.",
      "3. Run **Refresh Models**.",
      "",
      "```sh",
      "brew services start apfel",
      "```",
    ].join("\n"),
  },
  [ModelErrorState.Missing]: {
    icon: Icon.ExclamationMark,
    title: "Apfel not available",
    subtitle: "Install apfel via Homebrew",
    markdown: [
      "### What this action will do",
      "",
      "1. Install apfel with Homebrew (if needed).",
      "2. Start the apfel background service.",
      "3. Refresh model list.",
      "",
      "```sh",
      "brew install apfel",
      "brew services start apfel",
      "```",
      "",
      "> Requires macOS 26+ on Apple Silicon with Apple Intelligence enabled.",
    ].join("\n"),
  },
  [ModelErrorState.NoModels]: {
    icon: Icon.Stars,
    title: "Apple Intelligence unavailable",
    subtitle: "Ensure Apple Intelligence is enabled",
    markdown: [
      "### No model reported",
      "",
      "apfel exposes a single on-device model. If none is listed, make sure",
      "Apple Intelligence is enabled in System Settings and the service is running.",
    ].join("\n"),
  },
  [ModelErrorState.SetupFailed]: {
    icon: Icon.ExclamationMark,
    title: "Setup failed",
    subtitle: "Try again or install manually",
    markdown: [
      "### What happened",
      "",
      "Automatic setup failed while installing or starting apfel.",
      "",
      "### Manual fallback",
      "",
      "```sh",
      "brew install apfel",
      "brew services start apfel",
      "```",
    ].join("\n"),
  },
};

export function NoModelItem({
  ollamaErrorState,
  setOllamaErrorState,
  refreshModels,
}: NoModelViewProps) {
  const provider = useProvider();
  const [isSetupRunning, setIsSetupRunning] = useState(false);

  const runSetup = useCallback(
    async (opts: {
      confirmTitle: string;
      confirmMessage: string;
      toastTitle: string;
      toastMessage: string;
      run: () => Promise<void>;
      successTitle: string;
      successMessage: string;
    }) => {
      const userApproved = await confirmAlert({
        title: opts.confirmTitle,
        message: opts.confirmMessage,
        primaryAction: { title: "Continue", style: Alert.ActionStyle.Default },
      });
      if (!userApproved) return;

      setIsSetupRunning(true);
      setOllamaErrorState(null);
      const setupToast = await showToast({
        style: Toast.Style.Animated,
        title: opts.toastTitle,
        message: opts.toastMessage,
      });

      try {
        await opts.run();
        setupToast.style = Toast.Style.Success;
        setupToast.title = opts.successTitle;
        setupToast.message = opts.successMessage;
        refreshModels();
      } catch (error) {
        setOllamaErrorState(ModelErrorState.SetupFailed);
        setupToast.style = Toast.Style.Failure;
        setupToast.title = "Automatic setup failed";
        setupToast.message =
          error instanceof Error ? error.message : "Unknown error";
      } finally {
        setIsSetupRunning(false);
      }
    },
    [refreshModels, setOllamaErrorState],
  );

  const runOllamaSetup = useCallback(
    (model: RecommendedModel) =>
      runSetup({
        confirmTitle: "Install Ollama and download model?",
        confirmMessage: `This will run CLI commands to install Ollama (if needed) and pull ${model}.`,
        toastTitle: "Setting up Ollama",
        toastMessage: `Pulling ${model}...`,
        run: () => setupOllamaAndPullModel(model),
        successTitle: "Ollama ready",
        successMessage: `${model} is now available.`,
      }),
    [runSetup],
  );

  const runApfelSetup = useCallback(
    () =>
      runSetup({
        confirmTitle: "Install and start apfel?",
        confirmMessage:
          "This will run `brew install apfel` (if needed) and `brew services start apfel`.",
        toastTitle: "Setting up apfel",
        toastMessage: "Installing and starting the service...",
        run: () => setupApfel(),
        successTitle: "Apfel ready",
        successMessage: "Apple Intelligence is now available.",
      }),
    [runSetup],
  );

  if (isSetupRunning) {
    return (
      <List.EmptyView
        icon={Icon.Hourglass}
        title="Checking setup..."
        description="Please wait while we inspect available models."
      />
    );
  }

  const views = provider.id === "apple" ? APFEL_VIEWS : OLLAMA_VIEWS;
  const view = ollamaErrorState ? views[ollamaErrorState] : null;
  if (view) {
    return (
      <List.Item
        icon={view.icon}
        title={view.title}
        subtitle={{ value: view.subtitle, tooltip: view.subtitle }}
        actions={
          <ActionPanel>
            <ModelSetupActions
              modelErrorState={ollamaErrorState}
              onRunOllamaSetup={runOllamaSetup}
              onRunApfelSetup={runApfelSetup}
              onRefreshModels={refreshModels}
            />
          </ActionPanel>
        }
        detail={<List.Item.Detail markdown={view.markdown} />}
      />
    );
  }

  return (
    <List.EmptyView
      icon={Icon.Stars}
      title="No model selected"
      description="Select a model to continue."
    />
  );
}
