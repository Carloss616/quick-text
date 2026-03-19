import { Icon, List } from "@raycast/api";
import type { ModelResponse } from "ollama";
import { useState } from "react";
import { ModelSelectorDropdown } from "@/components";
import { useSelectedText } from "@/hooks";
import { ChangeToneItem } from "./components/change-tone-item";
import { FixGrammarItem } from "./components/fix-grammar-item";
import { ParaphraseItem } from "./components/paraphrase-item";
import { SummarizeItem } from "./components/summarize-item";
import { TranslateItem } from "./components/translate-item";

export function QuickTextCommand() {
	const { selectedText, isLoading } = useSelectedText();
	const [selectedModel, setSelectedModel] = useState<ModelResponse | null>(
		null,
	);

	return (
		<List
			isLoading={isLoading}
			isShowingDetail={!!selectedText && !!selectedModel}
			searchBarAccessory={
				<ModelSelectorDropdown onModelSelected={setSelectedModel} />
			}
		>
			{!selectedText ? (
				<List.EmptyView
					icon={Icon.TextSelection}
					title="No text selected"
					description="Select some text to continue"
				/>
			) : !selectedModel ? (
				<List.EmptyView
					icon={Icon.Stars}
					title="No model selected"
					description="Select a model to continue"
				/>
			) : (
				<>
					<ChangeToneItem
						selectedModel={selectedModel}
						selectedText={selectedText}
					/>
					<FixGrammarItem
						selectedModel={selectedModel}
						selectedText={selectedText}
					/>
					<ParaphraseItem
						selectedModel={selectedModel}
						selectedText={selectedText}
					/>
					<SummarizeItem
						selectedModel={selectedModel}
						selectedText={selectedText}
					/>
					<TranslateItem
						selectedModel={selectedModel}
						selectedText={selectedText}
					/>
				</>
			)}
		</List>
	);
}
