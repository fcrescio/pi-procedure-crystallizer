import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: patch-pi-bundle-debug.mjs INPUT OUTPUT");

let source = readFileSync(input, "utf8");
const beforeDecisions = `let contextOverflow=sameModel&&isContextOverflow(assistantMessage,contextWindow),recoverableLength=sameModel&&isRecoverableLength(assistantMessage,this.model?.maxTokens??0);if(contextOverflow||recoverableLength)`;
const afterDecisions = `let contextOverflow=sameModel&&isContextOverflow(assistantMessage,contextWindow),recoverableLength=sameModel&&isRecoverableLength(assistantMessage,this.model?.maxTokens??0);try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"decisions",stopReason:assistantMessage.stopReason,usage:assistantMessage.usage,contextWindow,sameModel,contextOverflow,recoverableLength,settings:settings2})+"\\n")}catch{}if(contextOverflow||recoverableLength)`;
if (source.indexOf(beforeDecisions) === -1 || source.indexOf(beforeDecisions) !== source.lastIndexOf(beforeDecisions)) {
  throw new Error("expected exactly one compaction decision site");
}
source = source.replace(beforeDecisions, afterDecisions);

const beforeThreshold = `return shouldCompact(contextTokens,contextWindow,settings2)?await this._runAutoCompaction("threshold",!1):!1`;
const afterThreshold = `try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"threshold",stopReason:assistantMessage.stopReason,usage:assistantMessage.usage,contextWindow,contextTokens,threshold:contextWindow-settings2.reserveTokens,settings:settings2,shouldCompact:shouldCompact(contextTokens,contextWindow,settings2)})+"\\n")}catch{}return shouldCompact(contextTokens,contextWindow,settings2)?await this._runAutoCompaction("threshold",!1):!1`;
if (source.indexOf(beforeThreshold) === -1 || source.indexOf(beforeThreshold) !== source.lastIndexOf(beforeThreshold)) {
  throw new Error("expected exactly one threshold site");
}
source = source.replace(beforeThreshold, afterThreshold);

const beforeAutoStart = `async _runAutoCompaction(reason,willRetry){let settings2=this.settingsManager.getCompactionSettings(),started=!1,fromExtension=!1;try{`;
const afterAutoStart = `async _runAutoCompaction(reason,willRetry){let settings2=this.settingsManager.getCompactionSettings(),started=!1,fromExtension=!1;try{try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"auto_start",reason,willRetry,settings:settings2})+"\\n")}catch{}`;
if (source.indexOf(beforeAutoStart) === -1 || source.indexOf(beforeAutoStart) !== source.lastIndexOf(beforeAutoStart)) {
  throw new Error("expected exactly one auto-compaction start site");
}
source = source.replace(beforeAutoStart, afterAutoStart);

const beforeAutoCatch = `catch(error){let errorMessage2=error instanceof Error?error.message:"compaction failed";`;
const afterAutoCatch = `catch(error){try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"auto_error",reason,willRetry,error:String(error),started})+"\\n")}catch{}let errorMessage2=error instanceof Error?error.message:"compaction failed";`;
if (source.indexOf(beforeAutoCatch) === -1 || source.indexOf(beforeAutoCatch) !== source.lastIndexOf(beforeAutoCatch)) {
  throw new Error("expected exactly one auto-compaction catch site");
}
source = source.replace(beforeAutoCatch, afterAutoCatch);

const beforeAppend = `this.sessionManager.appendCompaction(summary,firstKeptEntryId,tokensBefore,details,fromExtension,usage);let newEntries=this.sessionManager.getEntries()`;
const afterAppend = `try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"append_before",fromExtension,summaryChars:typeof summary==="string"?summary.length:null,tokensBefore,firstKeptEntryId,usageKeys:usage?Object.keys(usage):null})+"\\n")}catch{}this.sessionManager.appendCompaction(summary,firstKeptEntryId,tokensBefore,details,fromExtension,usage);try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"append_after",entryCount:this.sessionManager.getEntries().length})+"\\n")}catch{}let newEntries=this.sessionManager.getEntries()`;
const appendIndex = source.indexOf(beforeAppend, source.indexOf("async _runAutoCompaction"));
if (appendIndex === -1) {
  throw new Error("expected exactly one compaction append site");
}
source = source.slice(0, appendIndex) + afterAppend + source.slice(appendIndex + beforeAppend.length);

const beforeExtensionResult = `let extensionResult=await this._extensionRunner.emit({type:"session_before_compact",preparation,branchEntries:pathEntries,customInstructions:void 0,reason,willRetry,signal:this._autoCompactionAbortController.signal});if(extensionResult?.cancel)`;
const afterExtensionResult = `let extensionResult=await this._extensionRunner.emit({type:"session_before_compact",preparation,branchEntries:pathEntries,customInstructions:void 0,reason,willRetry,signal:this._autoCompactionAbortController.signal});try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"extension_result",reason,resultKeys:extensionResult?Object.keys(extensionResult):null,compactionKeys:extensionResult?.compaction?Object.keys(extensionResult.compaction):null,summaryChars:typeof extensionResult?.compaction?.summary==="string"?extensionResult.compaction.summary.length:null})+"\\n")}catch{}if(extensionResult?.cancel)`;
if (source.indexOf(beforeExtensionResult) === -1 || source.indexOf(beforeExtensionResult) !== source.lastIndexOf(beforeExtensionResult)) {
  throw new Error("expected exactly one extension compaction result site");
}
source = source.replace(beforeExtensionResult, afterExtensionResult);

const beforeEmitHandler = `let handlerResult=await handler(event,ctx);if(this.isSessionBeforeEvent(event)&&handlerResult&&(result=handlerResult,result.cancel))return result`;
const afterEmitHandler = `let handlerResult=await handler(event,ctx);if(event.type==="session_before_compact")try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"handler_result",extension:ext2.path,resultKeys:handlerResult?Object.keys(handlerResult):null,compactionKeys:handlerResult?.compaction?Object.keys(handlerResult.compaction):null})+"\\n")}catch{}if(this.isSessionBeforeEvent(event)&&handlerResult&&(result=handlerResult,result.cancel))return result`;
if (source.indexOf(beforeEmitHandler) === -1 || source.indexOf(beforeEmitHandler) !== source.lastIndexOf(beforeEmitHandler)) {
  throw new Error("expected exactly one extension handler site");
}
source = source.replace(beforeEmitHandler, afterEmitHandler);

const beforeRuntime = `let extensionsResult=this._resourceLoader.getExtensions();`;
const afterRuntime = `let extensionsResult=this._resourceLoader.getExtensions();try{require("node:fs").appendFileSync("/tmp/pi-check-compaction.jsonl",JSON.stringify({stage:"runtime_extensions",extensions:extensionsResult.extensions.map(e=>e.path)})+"\\n")}catch{}`;
if (source.indexOf(beforeRuntime) === -1 || source.indexOf(beforeRuntime) !== source.lastIndexOf(beforeRuntime)) {
  throw new Error("expected exactly one runtime extension site");
}
source = source.replace(beforeRuntime, afterRuntime);
writeFileSync(output, source);
