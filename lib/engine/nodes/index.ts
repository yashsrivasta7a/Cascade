// =============================================================================
// NODE EXECUTORS - Register all node types here
// =============================================================================

import { registerNodeExecutor } from "../node-registry";

// Import all node executors
import seedreamExecutor from "./seedream";
import seedvrExecutor from "./seedvr";
import seedanceExecutor from "./seedance";
import elevenlabsExecutor from "./elevenlabs";
import openrouterExecutor from "./openrouter";
import lipsyncExecutor from "./lipsync";
import cropImageExecutor from "./crop-image";
import mergeAudioVideoExecutor from "./merge-audio-video";
import mergeVideosExecutor from "./merge-videos";
import extractAudioExecutor from "./extract-audio";

// Track if executors have been registered (for idempotency)
let executorsRegistered = false;

// Register all executors (idempotent - only runs once)
export function registerAllNodeExecutors(): void {
  if (executorsRegistered) return;
  executorsRegistered = true;
  
  registerNodeExecutor(seedreamExecutor);
  registerNodeExecutor(seedvrExecutor);
  registerNodeExecutor(seedanceExecutor);
  registerNodeExecutor(elevenlabsExecutor);
  registerNodeExecutor(openrouterExecutor);
  registerNodeExecutor(lipsyncExecutor);
  registerNodeExecutor(cropImageExecutor);
  registerNodeExecutor(mergeAudioVideoExecutor);
  registerNodeExecutor(mergeVideosExecutor);
  registerNodeExecutor(extractAudioExecutor);
}

// Export individual executors
export { seedreamExecutor, parseSeedreamResult } from "./seedream";
export { seedvrExecutor, parseSeedvrResult } from "./seedvr";
export { seedanceExecutor, parseSeedanceResult } from "./seedance";
export { elevenlabsExecutor, parseElevenlabsResult } from "./elevenlabs";
export { openrouterExecutor, parseOpenrouterResult } from "./openrouter";
export { lipsyncExecutor, parseLipsyncResult } from "./lipsync";
export { cropImageExecutor } from "./crop-image";
export { mergeAudioVideoExecutor } from "./merge-audio-video";
export { mergeVideosExecutor } from "./merge-videos";
export { extractAudioExecutor } from "./extract-audio";

