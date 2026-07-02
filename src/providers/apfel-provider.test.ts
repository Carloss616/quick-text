import { expect, test } from "bun:test";
import { parseChatCompletionChunk } from "./apfel-provider";

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
