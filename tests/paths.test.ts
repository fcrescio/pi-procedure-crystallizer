import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeToolName, childPath } from "../src/paths.js";

test("accepts conservative tool names", () => {
  assert.doesNotThrow(() => assertSafeToolName("extract_pdf_tables"));
});

test("rejects path traversal and unsafe names", () => {
  for (const name of ["../x", "a/b", "A", "", "foo-bar"]) {
    assert.throws(() => assertSafeToolName(name));
  }
});

test("childPath stays within root", () => {
  assert.equal(childPath("/tmp/root", "a", "b"), "/tmp/root/a/b");
  assert.throws(() => childPath("/tmp/root", "..", "escape"));
});
