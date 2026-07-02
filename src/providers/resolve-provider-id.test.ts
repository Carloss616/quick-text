import { expect, test } from "bun:test";
import { resolveProviderId } from "./resolve-provider-id";

test("apple preference on macOS resolves to apple", () => {
  expect(resolveProviderId("apple", "darwin")).toBe("apple");
});

test("apple preference off macOS falls back to ollama", () => {
  expect(resolveProviderId("apple", "win32")).toBe("ollama");
});

test("missing/ollama preference resolves to ollama", () => {
  expect(resolveProviderId(undefined, "darwin")).toBe("ollama");
  expect(resolveProviderId("ollama", "darwin")).toBe("ollama");
});
