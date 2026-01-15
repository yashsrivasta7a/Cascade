// =============================================================================
// NODE EXECUTORS - Fully config-driven
// All nodes use GenericNodeExecutor which reads from node-config.ts
// Internal/utility nodes delegate execution to FFmpeg handlers
// =============================================================================

import { registerNodeExecutor } from "../node-registry";
import { GenericNodeExecutor } from "../generic-executor";
import { getAllNodeTypes } from "@/lib/config";

// Register all executors using the config-driven GenericNodeExecutor
// GenericNodeExecutor handles:
// - AI nodes: via provider adapters (fal, openrouter)
// - Utility nodes: delegates to internal FFmpeg handlers
export function registerAllNodeExecutors(): void {
  const nodeTypes = getAllNodeTypes();
  
  for (const nodeType of nodeTypes) {
    const executor = new GenericNodeExecutor(nodeType);
    registerNodeExecutor(executor as any);
  }
}

// Re-export legacy executors and parsers for backward compatibility
export {
  seedreamExecutor,
  parseSeedreamResult,
} from "../nodes-legacy/seedream";

export {
  seedvrExecutor,
  parseSeedvrResult,
} from "../nodes-legacy/seedvr";

export {
  seedanceExecutor,
  parseSeedanceResult,
} from "../nodes-legacy/seedance";

export {
  elevenlabsExecutor,
  parseElevenlabsResult,
} from "../nodes-legacy/elevenlabs";

export {
  openrouterExecutor,
  parseOpenrouterResult,
} from "../nodes-legacy/openrouter";

export {
  lipsyncExecutor,
  parseLipsyncResult,
} from "../nodes-legacy/lipsync";

// Re-export utility node executors for backward compatibility
export { cropImageExecutor } from "../nodes-legacy/crop-image";
export { mergeAudioVideoExecutor } from "../nodes-legacy/merge-audio-video";
export { mergeVideosExecutor } from "../nodes-legacy/merge-videos";
export { extractAudioExecutor } from "../nodes-legacy/extract-audio";
