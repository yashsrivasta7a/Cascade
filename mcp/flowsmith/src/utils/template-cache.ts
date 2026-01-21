import { logger } from "./logger.js";
import { checkWorkflowTemplate, createOrGetWorkflowTemplate, type WorkflowTemplate } from "./api-client.js";
import { hashWorkflowStructure, describeWorkflowStructure } from "./workflow-hash.js";
import type { Node, Edge, NodeSpec } from "../schemas/index.js";

// =============================================================================
// TEMPLATE CACHE - Comprehensive caching system for workflow templates
// Implements: LRU cache, semantic matching, pre-seeded templates
// =============================================================================

// -----------------------------------------------------------------------------
// 1. IN-MEMORY LRU CACHE
// -----------------------------------------------------------------------------

interface CacheEntry {
  template: WorkflowTemplate;
  lastAccess: number;
  hits: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  get(hash: string): WorkflowTemplate | null {
    const entry = this.cache.get(hash);
    if (entry) {
      entry.lastAccess = Date.now();
      entry.hits++;
      logger.debug(`[LRU Cache] HIT for ${hash.slice(0, 16)}... (hits: ${entry.hits})`);
      return entry.template;
    }
    return null;
  }

  set(hash: string, template: WorkflowTemplate): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      for (const [key, entry] of this.cache) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug(`[LRU Cache] Evicted ${oldestKey.slice(0, 16)}...`);
      }
    }

    this.cache.set(hash, {
      template,
      lastAccess: Date.now(),
      hits: 1,
    });
    logger.debug(`[LRU Cache] Stored ${hash.slice(0, 16)}...`);
  }

  getStats(): { size: number; totalHits: number; entries: Array<{ hash: string; hits: number }> } {
    let totalHits = 0;
    const entries: Array<{ hash: string; hits: number }> = [];
    
    for (const [hash, entry] of this.cache) {
      totalHits += entry.hits;
      entries.push({ hash: hash.slice(0, 16), hits: entry.hits });
    }
    
    return {
      size: this.cache.size,
      totalHits,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10),
    };
  }
}

// Global LRU cache instance
const templateCache = new LRUCache(50);

// -----------------------------------------------------------------------------
// 2. SEMANTIC MATCHING - Keywords and synonyms for workflow patterns
// -----------------------------------------------------------------------------

interface SemanticPattern {
  keywords: string[];
  nodeTypes: string[];
  inputTypes: Array<"text" | "image" | "video" | "audio">;
  description: string;
}

const SEMANTIC_PATTERNS: SemanticPattern[] = [
  // Video patterns
  {
    keywords: ["merge video", "combine video", "concatenate video", "join video", "video merge", "merge videos"],
    nodeTypes: ["input", "input", "merge-videos", "output"],
    inputTypes: ["video", "video"],
    description: "Merge two videos into one",
  },
  {
    keywords: ["merge audio video", "add audio", "combine audio video", "audio video merge", "add voice", "add voiceover"],
    nodeTypes: ["input", "input", "merge-audio-video", "output"],
    inputTypes: ["video", "audio"],
    description: "Add audio track to video",
  },
  {
    keywords: ["lipsync", "lip sync", "sync lips", "talking head", "animate face"],
    nodeTypes: ["input", "input", "lipsync", "output"],
    inputTypes: ["video", "audio"],
    description: "Sync lips in video to audio",
  },
  {
    keywords: ["extract audio", "get audio", "audio from video", "rip audio"],
    nodeTypes: ["input", "extract-audio", "output"],
    inputTypes: ["video"],
    description: "Extract audio from video",
  },
  {
    keywords: ["generate video", "create video", "text to video", "video generation", "make video"],
    nodeTypes: ["input", "seedance", "output"],
    inputTypes: ["text"],
    description: "Generate video from text prompt",
  },
  // Image patterns
  {
    keywords: ["generate image", "create image", "text to image", "image generation", "make image", "draw"],
    nodeTypes: ["input", "seedream", "output"],
    inputTypes: ["text"],
    description: "Generate image from text prompt",
  },
  {
    keywords: ["upscale", "enhance image", "improve image", "higher resolution", "super resolution"],
    nodeTypes: ["input", "seedvr", "output"],
    inputTypes: ["image"],
    description: "Upscale and enhance image",
  },
  {
    keywords: ["crop image", "resize image", "cut image"],
    nodeTypes: ["input", "crop-image", "output"],
    inputTypes: ["image"],
    description: "Crop an image",
  },
  // Audio patterns
  {
    keywords: ["text to speech", "tts", "voice", "speak", "narrate", "generate audio", "say"],
    nodeTypes: ["input", "elevenlabs", "output"],
    inputTypes: ["text"],
    description: "Convert text to speech",
  },
  // LLM patterns
  {
    keywords: ["llm", "chat", "ask ai", "gpt", "claude", "generate text", "write"],
    nodeTypes: ["input", "openrouter", "output"],
    inputTypes: ["text"],
    description: "Generate text with LLM",
  },
  // Complex pipelines
  {
    keywords: ["image to video", "animate image", "bring to life"],
    nodeTypes: ["input", "seedance", "output"],
    inputTypes: ["image"],
    description: "Animate an image into video",
  },
];

/**
 * Find matching semantic pattern from user query
 */
export function findSemanticMatch(query: string): SemanticPattern | null {
  const lowerQuery = query.toLowerCase();
  
  let bestMatch: SemanticPattern | null = null;
  let bestScore = 0;
  
  for (const pattern of SEMANTIC_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lowerQuery.includes(keyword)) {
        // Longer keyword matches are worth more
        score += keyword.length;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }
  
  if (bestMatch && bestScore > 3) {
    logger.info(`[Semantic Match] Query "${query}" matched pattern: ${bestMatch.description}`);
    return bestMatch;
  }
  
  return null;
}

/**
 * Convert semantic pattern to NodeSpec array
 */
export function patternToNodeSpecs(pattern: SemanticPattern): NodeSpec[] {
  let inputIndex = 0;
  return pattern.nodeTypes.map((type) => {
    if (type === "input") {
      const inputType = pattern.inputTypes[inputIndex] || "text";
      inputIndex++;
      return { type: "input", inputType };
    }
    return { type };
  });
}

// -----------------------------------------------------------------------------
// 3. PRE-SEEDED TEMPLATES
// -----------------------------------------------------------------------------

export interface PreseededTemplate {
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  keywords: string[];
}

export const PRESEEDED_TEMPLATES: PreseededTemplate[] = [
  {
    name: "Video Merge",
    description: "Merge two videos into one",
    keywords: ["merge video", "combine video", "join video"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 0 }, data: { label: "Video 1", nodeType: "input", mediaType: "video" } },
      { id: "input-2", type: "input", position: { x: 0, y: 200 }, data: { label: "Video 2", nodeType: "input", mediaType: "video" } },
      { id: "merge-videos-3", type: "merge-videos", position: { x: 350, y: 100 }, data: { label: "Merge Videos", nodeType: "merge-videos" } },
      { id: "output-4", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "merge-videos-3", sourceHandle: "output", targetHandle: "video1" },
      { id: "e2", source: "input-2", target: "merge-videos-3", sourceHandle: "output", targetHandle: "video2" },
      { id: "e3", source: "merge-videos-3", target: "output-4", sourceHandle: "video", targetHandle: "input" },
    ],
  },
  {
    name: "Audio Video Merge",
    description: "Add audio track to video",
    keywords: ["merge audio video", "add audio", "voiceover"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 0 }, data: { label: "Video", nodeType: "input", mediaType: "video" } },
      { id: "input-2", type: "input", position: { x: 0, y: 200 }, data: { label: "Audio", nodeType: "input", mediaType: "audio" } },
      { id: "merge-audio-video-3", type: "merge-audio-video", position: { x: 350, y: 100 }, data: { label: "Merge Audio Video", nodeType: "merge-audio-video" } },
      { id: "output-4", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "merge-audio-video-3", sourceHandle: "output", targetHandle: "video" },
      { id: "e2", source: "input-2", target: "merge-audio-video-3", sourceHandle: "output", targetHandle: "audio" },
      { id: "e3", source: "merge-audio-video-3", target: "output-4", sourceHandle: "video", targetHandle: "input" },
    ],
  },
  {
    name: "Lipsync",
    description: "Sync lips in video to audio",
    keywords: ["lipsync", "lip sync", "talking head"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 0 }, data: { label: "Video", nodeType: "input", mediaType: "video" } },
      { id: "input-2", type: "input", position: { x: 0, y: 200 }, data: { label: "Audio", nodeType: "input", mediaType: "audio" } },
      { id: "lipsync-3", type: "lipsync", position: { x: 350, y: 100 }, data: { label: "Lipsync", nodeType: "lipsync" } },
      { id: "output-4", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "lipsync-3", sourceHandle: "output", targetHandle: "video" },
      { id: "e2", source: "input-2", target: "lipsync-3", sourceHandle: "output", targetHandle: "audio" },
      { id: "e3", source: "lipsync-3", target: "output-4", sourceHandle: "video", targetHandle: "input" },
    ],
  },
  {
    name: "Text to Image",
    description: "Generate image from text prompt",
    keywords: ["generate image", "text to image", "create image"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 100 }, data: { label: "Prompt", nodeType: "input", mediaType: "text" } },
      { id: "seedream-2", type: "seedream", position: { x: 350, y: 100 }, data: { label: "Seedream", nodeType: "seedream" } },
      { id: "output-3", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "seedream-2", sourceHandle: "output", targetHandle: "prompt" },
      { id: "e2", source: "seedream-2", target: "output-3", sourceHandle: "image", targetHandle: "input" },
    ],
  },
  {
    name: "Text to Speech",
    description: "Convert text to speech audio",
    keywords: ["text to speech", "tts", "voice", "narrate"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 100 }, data: { label: "Text", nodeType: "input", mediaType: "text" } },
      { id: "elevenlabs-2", type: "elevenlabs", position: { x: 350, y: 100 }, data: { label: "ElevenLabs", nodeType: "elevenlabs" } },
      { id: "output-3", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "elevenlabs-2", sourceHandle: "output", targetHandle: "text" },
      { id: "e2", source: "elevenlabs-2", target: "output-3", sourceHandle: "audio", targetHandle: "input" },
    ],
  },
  {
    name: "Image Upscale",
    description: "Upscale and enhance image quality",
    keywords: ["upscale", "enhance", "super resolution"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 100 }, data: { label: "Image", nodeType: "input", mediaType: "image" } },
      { id: "seedvr-2", type: "seedvr", position: { x: 350, y: 100 }, data: { label: "Seedvr", nodeType: "seedvr" } },
      { id: "output-3", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "seedvr-2", sourceHandle: "output", targetHandle: "image" },
      { id: "e2", source: "seedvr-2", target: "output-3", sourceHandle: "image", targetHandle: "input" },
    ],
  },
  {
    name: "Text to Video",
    description: "Generate video from text prompt",
    keywords: ["text to video", "generate video", "create video"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 100 }, data: { label: "Prompt", nodeType: "input", mediaType: "text" } },
      { id: "seedance-2", type: "seedance", position: { x: 350, y: 100 }, data: { label: "Seedance", nodeType: "seedance" } },
      { id: "output-3", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "seedance-2", sourceHandle: "output", targetHandle: "prompt" },
      { id: "e2", source: "seedance-2", target: "output-3", sourceHandle: "video", targetHandle: "input" },
    ],
  },
  {
    name: "LLM Chat",
    description: "Generate text with LLM",
    keywords: ["llm", "chat", "gpt", "claude", "generate text"],
    nodes: [
      { id: "input-1", type: "input", position: { x: 0, y: 100 }, data: { label: "Prompt", nodeType: "input", mediaType: "text" } },
      { id: "openrouter-2", type: "openrouter", position: { x: 350, y: 100 }, data: { label: "OpenRouter", nodeType: "openrouter" } },
      { id: "output-3", type: "output", position: { x: 700, y: 100 }, data: { label: "Output", nodeType: "output" } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "openrouter-2", sourceHandle: "output", targetHandle: "prompt" },
      { id: "e2", source: "openrouter-2", target: "output-3", sourceHandle: "text", targetHandle: "input" },
    ],
  },
];

/**
 * Find pre-seeded template by keywords
 */
export function findPreseededTemplate(query: string): PreseededTemplate | null {
  const lowerQuery = query.toLowerCase();
  
  for (const template of PRESEEDED_TEMPLATES) {
    for (const keyword of template.keywords) {
      if (lowerQuery.includes(keyword)) {
        logger.info(`[Preseeded] Found template: ${template.name}`);
        return template;
      }
    }
  }
  
  return null;
}

// -----------------------------------------------------------------------------
// 4. MAIN CACHE INTERFACE
// -----------------------------------------------------------------------------

export interface CachedWorkflow {
  name: string;
  nodes: Node[];
  edges: Edge[];
  structureHash: string;
  fromCache: "memory" | "database" | "preseeded" | "semantic" | "built";
  usageCount?: number;
}

/**
 * Get or build a workflow with caching
 * Priority: Memory Cache → Database → Preseeded → Semantic Match → Build
 */
export async function getOrBuildWorkflow(
  name: string,
  nodeSpecs: NodeSpec[],
  buildFn: (name: string, specs: NodeSpec[]) => { name: string; nodes: Node[]; edges: Edge[] }
): Promise<CachedWorkflow> {
  // Build to get the hash (cheap operation)
  const built = buildFn(name, nodeSpecs);
  const structureHash = hashWorkflowStructure(built.nodes, built.edges);
  
  // 1. Check memory cache
  const memoryCached = templateCache.get(structureHash);
  if (memoryCached) {
    return {
      name,
      nodes: memoryCached.nodes as Node[],
      edges: memoryCached.edges as Edge[],
      structureHash,
      fromCache: "memory",
      usageCount: memoryCached.usageCount,
    };
  }
  
  // 2. Check database cache
  try {
    const dbResult = await checkWorkflowTemplate(structureHash);
    if (dbResult.found && dbResult.template) {
      // Store in memory cache for next time
      templateCache.set(structureHash, dbResult.template);
      
      return {
        name,
        nodes: dbResult.template.nodes as Node[],
        edges: dbResult.template.edges as Edge[],
        structureHash,
        fromCache: "database",
        usageCount: dbResult.template.usageCount,
      };
    }
  } catch (err) {
    logger.warn(`[Cache] Database check failed:`, err);
  }
  
  // 3. Return built workflow and cache it
  return {
    name,
    nodes: built.nodes,
    edges: built.edges,
    structureHash,
    fromCache: "built",
  };
}

/**
 * Find workflow by natural language query
 * Checks preseeded templates and semantic patterns
 */
export function findWorkflowByQuery(query: string): CachedWorkflow | null {
  // 1. Check preseeded templates
  const preseeded = findPreseededTemplate(query);
  if (preseeded) {
    const structureHash = hashWorkflowStructure(preseeded.nodes, preseeded.edges);
    return {
      name: preseeded.name,
      nodes: preseeded.nodes,
      edges: preseeded.edges,
      structureHash,
      fromCache: "preseeded",
    };
  }
  
  // 2. No match found
  return null;
}

/**
 * Save workflow to cache (both memory and database)
 */
export async function saveToCache(
  name: string,
  nodes: Node[],
  edges: Edge[],
  description?: string
): Promise<{ structureHash: string; cached: boolean; usageCount: number }> {
  const structureHash = hashWorkflowStructure(nodes, edges);
  
  try {
    const result = await createOrGetWorkflowTemplate({
      structureHash,
      name,
      description: description || describeWorkflowStructure(nodes),
      nodesJson: nodes,
      edgesJson: edges,
    });
    
    // Update memory cache
    templateCache.set(structureHash, result.template);
    
    return {
      structureHash,
      cached: result.cached,
      usageCount: result.template.usageCount,
    };
  } catch (err) {
    logger.warn(`[Cache] Failed to save template:`, err);
    return {
      structureHash,
      cached: false,
      usageCount: 0,
    };
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    memoryCache: templateCache.getStats(),
    preseededCount: PRESEEDED_TEMPLATES.length,
    semanticPatterns: SEMANTIC_PATTERNS.length,
  };
}
