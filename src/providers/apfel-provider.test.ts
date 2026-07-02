import { expect, test } from "bun:test";
import { parseChatCompletionChunk, selectAppleModel } from "./apfel-provider";

test("extracts the content delta from a chunk", () => {
  const data = JSON.stringify({ choices: [{ delta: { content: "Hola" } }] });
  expect(parseChatCompletionChunk(data)).toBe("Hola");
});

test("returns null for the [DONE] sentinel", () => {
  expect(parseChatCompletionChunk("[DONE]")).toBeNull();
});

test("returns null when the delta has no content (e.g. role-only chunk)", () => {
  const data = JSON.stringify({ choices: [{ delta: { role: "assistant" } }] });
  expect(parseChatCompletionChunk(data)).toBeNull();
});

test("selectAppleModel returns the Apple model when present", () => {
  const model = selectAppleModel({ data: [{ id: "apple-foundationmodel" }] });
  expect(model).toEqual({
    id: "apple-foundationmodel",
    label: "Apple Intelligence",
  });
});

test("selectAppleModel throws when the port serves Ollama models instead", () => {
  expect(() =>
    selectAppleModel({ data: [{ id: "granite4" }, { id: "llama3" }] }),
  ).toThrow();
});

test("selectAppleModel throws on an empty or absent model list", () => {
  expect(() => selectAppleModel({})).toThrow();
  expect(() => selectAppleModel({ data: [] })).toThrow();
});
