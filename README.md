# Quick Text

Rewrite, fix, and transform text instantly.

## Prerequisites

- [Raycast](https://raycast.com/)
- [Ollama](https://ollama.ai/) running locally with at least one model pulled (e.g., `ollama pull granite4`).

## Installation

1. Clone this repository.
2. Run `bun install` to install dependencies.
3. Run `bun dev` to start the extension in Raycast.

## Commands

- **Quick Text**: Opens a view to modify the currently selected text using your local AI models.

## Preferences

You can configure the extension via Raycast settings:

- **Ollama Server URL**: The URL of your local Ollama instance (default: `http://localhost:11434`).

## Technologies Used

- [Raycast API](https://developers.raycast.com/)
- [Ollama Node.js Library](https://github.com/jmorganca/ollama-js)
- React & TypeScript
