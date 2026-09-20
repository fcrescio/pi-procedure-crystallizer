import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredTool, ToolManifestV1 } from "./domain.js";
import { assertSafeSessionKey, assertSafeStoreRoot, assertSafeToolName, childPath } from "./paths.js";

export interface ArtifactStoreOptions {
  root: string;
}

export class ArtifactStore {
  readonly root: string;

  constructor(options: ArtifactStoreOptions) {
    this.root = path.resolve(options.root);
    assertSafeStoreRoot(this.root);
  }

  private sessionToolDir(sessionKey: string, name: string): string {
    assertSafeSessionKey(sessionKey);
    assertSafeToolName(name);
    return childPath(this.root, "sessions", sessionKey, "tools", name);
  }

  private globalToolDir(name: string): string {
    assertSafeToolName(name);
    return childPath(this.root, "global", name);
  }

  async putSessionManifest(sessionKey: string, manifest: ToolManifestV1): Promise<StoredTool> {
    if (manifest.scope !== "session") throw new Error("Expected session-scoped manifest");
    if (manifest.origin.sessionKey !== sessionKey) throw new Error("Origin session mismatch");
    assertSafeToolName(manifest.name);
    const directory = this.sessionToolDir(sessionKey, manifest.name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { manifest, directory };
  }

  async listSession(sessionKey: string): Promise<StoredTool[]> {
    assertSafeSessionKey(sessionKey);
    const toolsRoot = childPath(this.root, "sessions", sessionKey, "tools");
    let names: string[];
    try {
      names = await readdir(toolsRoot);
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
    const results: StoredTool[] = [];
    for (const name of names) {
      try {
        results.push(await this.readSession(sessionKey, name));
      } catch {
        // Ignore malformed/non-tool directories in listing; inspection can surface them later.
      }
    }
    return results.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }

  async readSession(sessionKey: string, name: string): Promise<StoredTool> {
    const directory = this.sessionToolDir(sessionKey, name);
    const raw = await readFile(path.join(directory, "manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as ToolManifestV1;
    if (manifest.schemaVersion !== 1 || manifest.scope !== "session" || manifest.name !== name) {
      throw new Error("Invalid session tool manifest");
    }
    if (manifest.origin.sessionKey !== sessionKey) throw new Error("Origin session mismatch");
    return { manifest, directory };
  }

  async deleteSession(sessionKey: string, name: string): Promise<void> {
    await rm(this.sessionToolDir(sessionKey, name), { recursive: true, force: true });
  }

  async promote(sessionKey: string, name: string, authorized: boolean): Promise<StoredTool> {
    if (!authorized) throw new Error("Promotion requires explicit authorization");
    const source = await this.readSession(sessionKey, name);
    const destination = this.globalToolDir(name);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = childPath(this.root, "global", `.${name}.promotion-${source.manifest.id}`);
    await rm(temporary, { recursive: true, force: true });
    await cp(source.directory, temporary, { recursive: true });

    const now = new Date().toISOString();
    const promoted: ToolManifestV1 = {
      ...source.manifest,
      scope: "global",
      updatedAt: now,
      promotedFrom: {
        sessionKey,
        artifactId: source.manifest.id,
        promotedAt: now,
      },
    };
    await writeFile(path.join(temporary, "manifest.json"), `${JSON.stringify(promoted, null, 2)}\n`, "utf8");
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);
    return { manifest: promoted, directory: destination };
  }

  async listGlobal(): Promise<StoredTool[]> {
    const root = childPath(this.root, "global");
    let names: string[];
    try {
      names = await readdir(root);
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
    const output: StoredTool[] = [];
    for (const name of names) {
      if (name.startsWith(".")) continue;
      assertSafeToolName(name);
      const directory = this.globalToolDir(name);
      const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")) as ToolManifestV1;
      if (manifest.scope === "global" && manifest.schemaVersion === 1) output.push({ manifest, directory });
    }
    return output.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }
}
