import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { STRINGS_RUNTIME_ENTRYPOINT, STRINGS_RUNTIME_KIND } from "../src/domain.js";
import { createSessionManifest } from "../src/manifest.js";
import { ArtifactStore } from "../src/store.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-session-tools-"));
  return { root, store: new ArtifactStore({ root }) };
}

test("session stores are isolated", async () => {
  const { root, store } = await fixture();
  try {
    const manifest = createSessionManifest({ sessionKey: "A", name: "session_echo", description: "demo" });
    await store.putSessionManifest("A", manifest);
    assert.deepEqual((await store.listSession("A")).map((x) => x.manifest.name), ["session_echo"]);
    assert.deepEqual(await store.listSession("B"), []);
    assert.deepEqual(await store.listGlobal(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("manifest round-trips through the session store", async () => {
  const { root, store } = await fixture();
  try {
    const manifest = createSessionManifest({ sessionKey: "A", name: "session_echo", description: "demo" });
    await store.putSessionManifest("A", manifest);
    const restored = await store.readSession("A", "session_echo");
    assert.deepEqual(restored.manifest, manifest);
    assert.equal(restored.manifest.schemaVersion, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion requires explicit authorization and preserves session copy", async () => {
  const { root, store } = await fixture();
  try {
    const manifest = createSessionManifest({ sessionKey: "A", name: "session_echo", description: "demo" });
    await store.putSessionManifest("A", manifest);
    await assert.rejects(() => store.promote("A", "session_echo", false), /explicit authorization/);
    assert.equal((await store.listGlobal()).length, 0);

    const promoted = await store.promote("A", "session_echo", true);
    assert.equal(promoted.manifest.scope, "global");
    assert.equal(promoted.manifest.promotedFrom?.sessionKey, "A");
    assert.equal((await store.listSession("A")).length, 1);
    assert.equal((await store.listGlobal()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting a session tool does not delete promoted global copy", async () => {
  const { root, store } = await fixture();
  try {
    await store.putSessionManifest(
      "A",
      createSessionManifest({ sessionKey: "A", name: "session_echo", description: "demo" }),
    );
    await store.promote("A", "session_echo", true);
    await store.deleteSession("A", "session_echo");
    assert.equal((await store.listSession("A")).length, 0);
    assert.equal((await store.listGlobal()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion is never implicit", async () => {
  const { root, store } = await fixture();
  try {
    await store.putSessionManifest(
      "A",
      createSessionManifest({ sessionKey: "A", name: "session_echo", description: "demo" }),
    );
    assert.deepEqual(await store.listGlobal(), []);
    assert.equal((await store.listSession("A")).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native analysis tools remain session-scoped until explicitly promoted", async () => {
  const { root, store } = await fixture();
  try {
    const manifest = createSessionManifest({
      sessionKey: "lookcam",
      name: "native_strings_search",
      description: "Bounded native string search",
      trigger: "pre_compaction",
      runtimeKind: STRINGS_RUNTIME_KIND,
      entrypoint: STRINGS_RUNTIME_ENTRYPOINT,
      runtimeConfig: {
        defaultPath: "lookcam-re/apktool-out/lib/arm64-v8a/libDPS_API_PPCS.so",
        maxBytes: 32 * 1024 * 1024,
        maxOutputBytes: 32 * 1024,
      },
      sourceEntryIds: ["entry-1", "entry-2"],
    });
    await store.putSessionManifest("lookcam", manifest);

    assert.deepEqual(await store.listGlobal(), []);
    await assert.rejects(() => store.promote("lookcam", "native_strings_search", false), /explicit authorization/);

    const promoted = await store.promote("lookcam", "native_strings_search", true);
    assert.equal(promoted.manifest.scope, "global");
    assert.equal(promoted.manifest.runtime.entrypoint, STRINGS_RUNTIME_ENTRYPOINT);
    assert.deepEqual(promoted.manifest.runtime.config, manifest.runtime.config);
    assert.equal(promoted.manifest.promotedFrom?.artifactId, manifest.id);
    assert.equal((await store.listSession("lookcam")).length, 1);
    assert.equal((await store.listGlobal()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
