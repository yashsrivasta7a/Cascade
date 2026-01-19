"use client";

import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BaseNode, type BaseNodeData } from "./base-node";
import { useFlowStore } from "@/store";
import { getNodeConfig } from "@/lib/config";

import type { NodeConfig, FieldConfig } from "@/lib/config/types";
import { dataTypeColors, type DataType, isTypeCompatible } from "@/types/nodes";
import { cn } from "@/lib/utils";
import {
  TextField,
  SelectField,
  FileField,
  NumberField,
  SliderField,
  ToggleField,
  OutputDisplay,
  type CropOverlay,
} from "./field-renderers";

// =============================================================================
// GENERIC NODE DATA TYPE
// =============================================================================

export interface GenericNodeData extends BaseNodeData {
  nodeType: string;
  result?: unknown;
  [key: string]: unknown;
}

// =============================================================================
// ICON MAPPING (based on category)
// =============================================================================

import {
  Image as ImageIcon,
  Film,
  Volume2,
  Brain,
  Wrench,
} from "lucide-react";

const categoryIcons = {
  image: ImageIcon,
  video: Film,
  audio: Volume2,
  llm: Brain,
  utility: Wrench,
};

// Node types that use async (Trigger.dev/fal.ai) execution
const ASYNC_NODE_TYPES = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];

// Node types that run locally/synchronously
const LOCAL_NODE_TYPES = ["crop-image", "merge-audio-video", "merge-videos", "extract-audio"];

// =============================================================================
// FIELD RENDERER - Renders a single form field based on config
// =============================================================================

interface FieldRendererProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  isConnected?: boolean;
  connectedValue?: string | null;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  /** Optional crop overlay for image fields (used by crop-image node) */
  cropOverlay?: CropOverlay;
}

function FieldRenderer({ field, value, onChange, isConnected, connectedValue, disabled, onUploadingChange, cropOverlay }: FieldRendererProps) {
  switch (field.type) {
    case "textarea":
    case "text":
      return (
        <TextField
          config={field}
          value={(value as string) ?? ""}
          onChange={onChange}
          isConnected={isConnected}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <SelectField
          config={field}
          value={(value as string) ?? (field.defaultValue as string) ?? ""}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "file":
      return (
        <FileField
          config={field}
          value={(value as string) ?? null}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          onUploadingChange={onUploadingChange}
          cropOverlay={cropOverlay}
          isConnected={isConnected}
          connectedValue={connectedValue}
        />
      );

    case "number":
      return (
        <NumberField
          config={field}
          value={value as number | undefined}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "slider":
      return (
        <SliderField
          config={field}
          value={(value as number) ?? (field.defaultValue as number) ?? field.min}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "toggle":
      return (
        <ToggleField
          config={field}
          value={(value as boolean) ?? (field.defaultValue as boolean) ?? false}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "hidden":
      return null;

    default:
      return (
        <div className="text-[10px] text-red-500">
          Unknown field type: {(field as FieldConfig).type}
        </div>
      );
  }
}

// =============================================================================
// FIELD WITH HANDLE - Renders a field with its input handle aligned
// =============================================================================

interface FieldWithHandleProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  isConnected?: boolean;
  connectedValue?: string | null;
  disabled?: boolean;
  handleType: DataType;
  isDragging?: boolean;
  draggedType?: DataType | null;
  onUploadingChange?: (uploading: boolean) => void;
  /** Optional crop overlay for image fields */
  cropOverlay?: CropOverlay;
}

function FieldWithHandle({ 
  field, 
  value, 
  onChange, 
  isConnected,
  connectedValue,
  disabled,
  handleType,
  isDragging,
  draggedType,
  onUploadingChange,
  cropOverlay,
}: FieldWithHandleProps) {
  const handleColor = dataTypeColors[handleType] || dataTypeColors.any;
  const isCompatible = isDragging && draggedType && isTypeCompatible(draggedType, handleType);
  const isIncompatible = isDragging && draggedType && !isCompatible;
  
  const tooltipText = field.label + (field.required ? " (required)" : "");

  return (
    <div className="relative">
      {/* Simple dot handle at node left edge */}
      <div 
        className={cn(
          "absolute z-30 group/handle transition-opacity duration-200",
          isIncompatible && "opacity-30"
        )}
        style={{ 
          left: -35,
          top: 8,
          transform: "translateX(-50%)",
        }}
        data-handletype={handleType}
      >
        {isCompatible && (
          <div 
            className="absolute rounded-full animate-ping"
            style={{ 
              width: 12,
              height: 12,
              backgroundColor: handleColor.solid,
              opacity: 0.4,
              left: -1,
              top: -1,
            }}
          />
        )}
        <Handle
          id={field.id}
          type="target"
          position={Position.Left}
          data-handletype={handleType}
          title={tooltipText}
          style={{ 
            position: "relative",
            left: 0,
            top: 0,
            transform: "none",
            width: 10,
            height: 10,
            borderWidth: 0,
            backgroundColor: handleColor.solid,
            boxShadow: isCompatible ? `0 0 8px ${handleColor.solid}` : undefined,
          }}
          className="!relative !left-0 !top-0 !transform-none transition-all duration-200"
        />
        
        {/* Hover tooltip - shows outside node (to the left) */}
        <div 
          className={cn(
            "absolute right-full mr-3 top-1/2 -translate-y-1/2",
            "px-3 py-1.5 rounded-lg",
            "bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10",
            "text-[11px] text-gray-700 dark:text-white/90 whitespace-nowrap",
            "opacity-0 group-hover/handle:opacity-100 pointer-events-none",
            "transition-opacity duration-150",
            "shadow-xl shadow-black/10 dark:shadow-black/50"
          )}
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {tooltipText}
        </div>
      </div>
      
      {/* Field content */}
      <FieldRenderer
        field={field}
        value={value}
        onChange={onChange}
        isConnected={isConnected}
        connectedValue={connectedValue}
        disabled={disabled}
        onUploadingChange={onUploadingChange}
        cropOverlay={cropOverlay}
      />
    </div>
  );
}

// =============================================================================
// GENERIC NODE COMPONENT
// =============================================================================

function GenericNodeComponent(props: NodeProps<GenericNodeData>) {
  const { data, id } = props;
  const nodeType = data.nodeType;

  // Get node config
  const nodeConfig = useMemo(() => getNodeConfig(nodeType), [nodeType]);

  // Store hooks
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const setWorkflowRunning = useFlowStore((s) => s.setWorkflowRunning);
  const isHandleConnected = useFlowStore((s) => s.isHandleConnected);
  const getHandleSource = useFlowStore((s) => s.getHandleSource);
  const nodes = useFlowStore((s) => s.nodes);
  const runNode = useFlowStore((s) => s.runNode);
  const workflowId = useFlowStore((s) => s.workflowId);
  const connectingFrom = useFlowStore((s) => s.connectingFrom);
  const setNodeUploading = useFlowStore((s) => s.setNodeUploading);
  
  // Dragging state for handle compatibility
  const isDragging = Boolean(connectingFrom);
  const draggedType = connectingFrom?.handleType as DataType | null;

  // Local state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const isUploading = uploadingFields.size > 0;
  const isProcessing = data.status === "running" || data.status === "queued" || isGenerating;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track uploading state per field and report to global store
  const handleUploadingChange = useCallback((fieldId: string, uploading: boolean) => {
    setUploadingFields((prev) => {
      const next = new Set(prev);
      if (uploading) {
        next.add(fieldId);
      } else {
        next.delete(fieldId);
      }
      // Report to global store: node is uploading if ANY field is uploading
      setNodeUploading(id, next.size > 0);
      return next;
    });
  }, [id, setNodeUploading]);
  
  // Clean up upload status when component unmounts
  useEffect(() => {
    return () => {
      setNodeUploading(id, false);
    };
  }, [id, setNodeUploading]);

  // Handle field value change
  const handleFieldChange = useCallback(
    (fieldId: string, value: unknown) => {
      console.log(`[GenericNode:${id}] handleFieldChange called: ${fieldId} = ${value}`);
      updateNode(id, { [fieldId]: value });
      
      // Immediately verify the store was updated
      setTimeout(() => {
        const updatedNodes = useFlowStore.getState().nodes;
        const updatedNode = updatedNodes.find(n => n.id === id);
        if (updatedNode) {
          console.log(`[GenericNode:${id}] Store after update: ${fieldId} = ${(updatedNode.data as Record<string, unknown>)[fieldId]}`);
        }
      }, 0);
    },
    [id, updateNode]
  );

  // Check if a field's handle is connected
  const isFieldConnected = useCallback(
    (fieldId: string) => {
      return isHandleConnected(id, fieldId);
    },
    [id, isHandleConnected]
  );

  // Get connected output value for a field (for preview in file fields)
  const getConnectedOutput = useCallback(
    (fieldId: string): string | null => {
      const source = getHandleSource(id, fieldId);
      if (!source) return null;
      
      const sourceNode = nodes.find(n => n.id === source.sourceNodeId);
      if (!sourceNode) return null;
      
      const sourceData = sourceNode.data as Record<string, unknown>;
      
      // Check common output locations
      if (sourceData.result && typeof sourceData.result === "string") {
        return sourceData.result;
      }
      if (sourceData.outputVideo && typeof sourceData.outputVideo === "string") {
        return sourceData.outputVideo;
      }
      if (sourceData.outputAudio && typeof sourceData.outputAudio === "string") {
        return sourceData.outputAudio;
      }
      if (sourceData.outputImage && typeof sourceData.outputImage === "string") {
        return sourceData.outputImage;
      }
      
      return null;
    },
    [id, getHandleSource, nodes]
  );

  // Run a connected parent node if it doesn't have output yet
  // NOTE: This is ONLY for MEDIA connections (image, video, audio), NOT settings connections
  const ensureParentOutput = useCallback(async (handleId: string): Promise<string | null> => {
    const source = getHandleSource(id, handleId);
    if (!source) return null;
    
    const parentNode = nodes.find(n => n.id === source.sourceNodeId);
    if (!parentNode) return null;
    
    // Check if this is a SETTINGS connection (source handle ends with "-setting" or matches a known setting)
    const settingsHandles = [
      "xPercent", "yPercent", "widthPercent", "heightPercent",
      "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
      "stability", "clarity", "transitionDuration", "prompt", "negativePrompt",
      "aspectRatio", "model", "systemPrompt", "duration", "text",
    ];
    const isSettingsConnection = source.sourceHandle.endsWith("-setting") ||
      settingsHandles.includes(source.sourceHandle.replace("-setting", ""));
    
    if (isSettingsConnection) {
      // For settings connections, DON'T run parent or return result
      // The setting value is already synced to this node via updateNode
      console.log(`[GenericNode] ${handleId} is a settings connection, using node's own value`);
      return null;
    }
    
    const parentResult = parentNode.data?.result || parentNode.data?.response;
    
    if (parentResult) {
      // Parent already has output
      return typeof parentResult === "string" ? parentResult : String(parentResult);
    }
    
    // Parent doesn't have output - run it first
    updateNode(id, { status: "queued" });
    try {
      await runNode(source.sourceNodeId);
      // Get updated result after parent ran
      const updatedNodes = useFlowStore.getState().nodes;
      const updatedParent = updatedNodes.find(n => n.id === source.sourceNodeId);
      return updatedParent?.data?.result || updatedParent?.data?.response || null;
    } catch (err) {
      console.error(`[GenericNode] Failed to run parent node:`, err);
      return null;
    }
  }, [id, getHandleSource, nodes, runNode, updateNode]);

  // Run node execution - handles each node type appropriately
  const runGenerate = useCallback(async () => {
    if (!nodeConfig) return;

    // If already running, abort
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      updateNode(id, { status: "idle" });
      return;
    }

    setIsGenerating(true);
    updateNode(id, { result: "", status: "running" });
    abortControllerRef.current = new AbortController();

    try {
      console.log(`[GenericNode:${id}] Starting runGenerate for ${nodeType}`);
      
      // Get fresh node data from store to avoid stale closure issues
      const freshNodes = useFlowStore.getState().nodes;
      const freshNode = freshNodes.find(n => n.id === id);
      const freshData = (freshNode?.data ?? data) as Record<string, unknown>;
      
      // DEBUG: Log all crop-related data
      if (nodeType === "crop-image") {
        console.log(`[GenericNode:${id}] CROP DEBUG - Closure data:`, {
          xPercent: data.xPercent,
          yPercent: data.yPercent,
          widthPercent: data.widthPercent,
          heightPercent: data.heightPercent,
        });
        console.log(`[GenericNode:${id}] CROP DEBUG - Fresh data:`, {
          xPercent: freshData.xPercent,
          yPercent: freshData.yPercent,
          widthPercent: freshData.widthPercent,
          heightPercent: freshData.heightPercent,
        });
      }
      
      // Build input from node data
      const input: Record<string, unknown> = {};
      
      // List of numeric fields that must be numbers
      const numericFields = new Set([
        "xPercent", "yPercent", "widthPercent", "heightPercent",
        "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
        "stability", "clarity", "transitionDuration",
        "topP", "topK", "frequencyPenalty", "presencePenalty",
      ]);
      
      // Settings fields - these get their values from settings connections, NOT from parent output
      const settingsFields = new Set([
        "xPercent", "yPercent", "widthPercent", "heightPercent",
        "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
        "stability", "clarity", "transitionDuration", "prompt", "negativePrompt",
        "aspectRatio", "model", "systemPrompt", "duration", "text",
        "topP", "topK", "frequencyPenalty", "presencePenalty",
      ]);
      
      for (const field of nodeConfig.ui.inputs) {
        const fieldId = field.id;
        // Use fresh data from store to avoid stale closure issues
        let value = freshData[fieldId];
        
        // For settings fields, use the node's own data (synced via settings connections)
        // DON'T try to get "parent output" - that's for media, not settings
        const isSettingsField = settingsFields.has(fieldId) || field.type === "slider" || field.type === "number";
        
        // Check if this field is connected and get parent output if needed
        // Only for NON-settings fields (media inputs like image, video, audio)
        if (isHandleConnected(id, fieldId) && !isSettingsField) {
          console.log(`[GenericNode:${id}] Field ${fieldId} is connected (media), getting parent output...`);
          const parentOutput = await ensureParentOutput(fieldId);
          console.log(`[GenericNode:${id}] Parent output for ${fieldId}:`, parentOutput?.slice(0, 50));
          if (parentOutput !== null) {
            value = parentOutput;
            // Update node data with parent output
            updateNode(id, { [fieldId]: parentOutput });
          }
        } else if (isHandleConnected(id, fieldId) && isSettingsField) {
          // For settings fields that are connected, just use the already-synced value
          console.log(`[GenericNode:${id}] Field ${fieldId} is a settings connection, using synced value: ${value}`);
        }
        
        if (value !== undefined && value !== null && value !== "") {
          // Ensure numeric fields are numbers (not objects from settings inheritance)
          // Check both the known numeric field names AND slider/number field types
          const isNumericField = numericFields.has(fieldId) || field.type === "slider" || field.type === "number";
          
          if (isNumericField) {
            if (typeof value === "number") {
              input[fieldId] = value;
            } else if (typeof value === "string" && !isNaN(Number(value))) {
              input[fieldId] = Number(value);
            } else {
              // Object or invalid value for numeric field - log and use default
              console.warn(`[GenericNode] Numeric field ${fieldId} has invalid value type ${typeof value}, skipping:`, value);
              // Don't add to input - let Zod use the default
            }
          } else if (field.type === "file" && typeof value === "string") {
            // Normalize file fields to AssetRef format for backend
            if (fieldId === "referenceImages") {
              input[fieldId] = [value];
            } else {
              input[fieldId] = { url: value };
            }
          } else {
            input[fieldId] = value;
          }
        }
      }
      
      // Ensure required fields are present
      if (nodeType === "openrouter" && !input.prompt) {
        input.prompt = freshData.prompt || "";
      }

      // Handle OpenRouter LLM specially - use streaming endpoint
      if (nodeType === "openrouter") {
        const response = await fetch("/api/nodes/llm/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: input.prompt || freshData.prompt,
            systemPrompt: input.systemPrompt || freshData.systemPrompt,
            model: input.model || freshData.model || "openai/gpt-4o-mini",
            temperature: input.temperature ?? freshData.temperature ?? 0.7,
            maxTokens: input.maxTokens ?? freshData.maxTokens ?? 4096,
            topP: input.topP ?? freshData.topP,
            frequencyPenalty: input.frequencyPenalty ?? freshData.frequencyPenalty,
            presencePenalty: input.presencePenalty ?? freshData.presencePenalty,
            context: input.context || freshData.context,
            imageUrl: input.inputImage || freshData.inputImage,
            negativePrompt: input.negativePrompt || freshData.negativePrompt,
            useCache: freshData.useCache,
            workflowId: workflowId ?? undefined,
            nodeId: id,
            nodeLabel: freshData.label || nodeConfig.label,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "LLM request failed");
        }

        const result = await response.json();
        
        if (result.text) {
          updateNode(id, { result: result.text, status: "completed" });
          propagateOutput(id, result.text);
        } else if (result.error) {
          throw new Error(result.error);
        } else {
          throw new Error("No response received");
        }
        
        setIsGenerating(false);
        return;
      }

      // Handle local/sync nodes
      if (LOCAL_NODE_TYPES.includes(nodeType)) {
        // For crop-image, ALWAYS get the latest values directly from the store
        // This ensures we use the most up-to-date slider values
        if (nodeType === "crop-image") {
          // Re-fetch the node data one more time to be absolutely sure
          const latestNodes = useFlowStore.getState().nodes;
          const latestNode = latestNodes.find(n => n.id === id);
          const latestData = latestNode?.data as Record<string, unknown> | undefined;
          
          // Force set crop values from the latest store state
          input.xPercent = typeof latestData?.xPercent === "number" ? latestData.xPercent : 0;
          input.yPercent = typeof latestData?.yPercent === "number" ? latestData.yPercent : 0;
          input.widthPercent = typeof latestData?.widthPercent === "number" ? latestData.widthPercent : 100;
          input.heightPercent = typeof latestData?.heightPercent === "number" ? latestData.heightPercent : 100;
          
          console.log(`[GenericNode] crop-image FINAL params: x=${input.xPercent}, y=${input.yPercent}, w=${input.widthPercent}, h=${input.heightPercent}`);
          console.log(`[GenericNode] crop-image latestData:`, latestData ? {
            xPercent: latestData.xPercent,
            yPercent: latestData.yPercent,
            widthPercent: latestData.widthPercent,
            heightPercent: latestData.heightPercent,
          } : 'NO DATA');
        }
        
        // Debug: Log the final input being sent
        console.log(`[GenericNode] Sending ${nodeType} to API with input:`, JSON.stringify(input, null, 2));
        
        // Final sanitization check - ensure no objects in numeric fields
        const finalInput: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input)) {
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            // Check if it's an AssetRef (has url property) - that's valid for file fields
            if ("url" in value) {
              finalInput[key] = value;
            } else {
              console.error(`[GenericNode] BLOCKED object value for ${key}:`, value);
              // Skip this field - let Zod use default
            }
          } else {
            finalInput[key] = value;
          }
        }
        
        const response = await fetch("/api/nodes/execute-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeType,
            input: finalInput,
            workflowId: workflowId ?? undefined,
            nodeId: id,
            nodeLabel: freshData.label || nodeConfig.label,
          }),
          signal: abortControllerRef.current.signal,
        });

        const result = await response.json();
        
        console.log(`[GenericNode] ${nodeType} API response:`, result.success ? "success" : "failed", result.error || "");
        
        if (!result.success) {
          throw new Error(result.error || "Execution failed");
        }

        const outputUrl = result.output?.url || result.output?.video?.url || result.output?.audio?.url || result.output?.image?.url;
        console.log(`[GenericNode] ${nodeType} output URL:`, outputUrl?.slice(0, 80));
        
        if (outputUrl) {
          updateNode(id, { result: outputUrl, status: "completed" });
          propagateOutput(id, outputUrl);
        }
        
        setIsGenerating(false);
        return;
      }

      // Handle async nodes (fal.ai via Trigger.dev)
      if (ASYNC_NODE_TYPES.includes(nodeType)) {
        setWorkflowRunning(true); // Enable polling
        
        const response = await fetch("/api/nodes/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeType,
            input: { ...input, nodeId: id },
            workflowId: workflowId ?? undefined,
            nodeId: id,
            nodeLabel: freshData.label || nodeConfig.label,
          }),
          signal: abortControllerRef.current.signal,
        });

        const result = await response.json();
        
        if (result.status === "error") {
          throw new Error(result.error || "Execution failed to start");
        }

        // Async node triggered - start polling
        updateNode(id, { status: "running" });
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/nodes/status?nodeId=${encodeURIComponent(id)}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setIsGenerating(false);
              const outputUrl = statusData.output?.image?.url || statusData.output?.video?.url || statusData.output?.audio?.url || statusData.output?.url;
              updateNode(id, { result: outputUrl || "", status: "completed" });
              if (outputUrl) propagateOutput(id, outputUrl);
              setWorkflowRunning(false);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setIsGenerating(false);
              updateNode(id, {
                result: "",
                status: "failed",
                error: statusData.error || "Execution failed",
              });
              setWorkflowRunning(false);
            }
          } catch (err) {
            console.error("[GenericNode] Poll error:", err);
          }
        }, 2000);
        
        // Store interval for cleanup on abort
        abortControllerRef.current = { abort: () => clearInterval(pollInterval) } as AbortController;
        return;
      }

      // Fallback - shouldn't reach here
      throw new Error(`Unknown node type: ${nodeType}`);
      
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateNode(id, { status: "idle" });
      } else {
        updateNode(id, {
          result: "",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [nodeConfig, nodeType, data, id, isGenerating, isHandleConnected, ensureParentOutput, updateNode, propagateOutput, setWorkflowRunning, workflowId]);

  // If no config found, show error
  if (!nodeConfig) {
    return (
      <BaseNode
        {...props}
        color="zinc"
        data={{
          ...data,
          label: `Unknown: ${nodeType}`,
          description: "Node configuration not found",
        }}
      >
        <div className="text-red-500 text-xs p-2">
          Node type "{nodeType}" not found in config.
        </div>
      </BaseNode>
    );
  }

  // Separate basic and advanced fields
  const basicFields = nodeConfig.ui.inputs.filter((f) => !f.advanced && f.type !== "hidden");
  const advancedFields = nodeConfig.ui.inputs.filter((f) => f.advanced && f.type !== "hidden");
  const hasAdvanced = advancedFields.length > 0;

  // Get icon based on category
  const IconComponent = categoryIcons[nodeConfig.category] || Wrench;

  // Helper to get handle type for a field - infers from field ID and type
  const getFieldHandleType = useCallback((field: FieldConfig): DataType => {
    const id = field.id.toLowerCase();
    
    // First check field ID for media types (most specific)
    if (id.includes("video") || id === "video") return "video";
    if (id.includes("audio") || id === "audio") return "audio";
    if (id.includes("image") || id.includes("frame") || id === "image") return "image";
    
    // File inputs - check accept attribute or fall back to category
    if (field.type === "file") {
      const accept = (field as any).accept as string | undefined;
      if (accept?.includes("video")) return "video";
      if (accept?.includes("audio")) return "audio";
      if (accept?.includes("image")) return "image";
      // Fall back to category
      return nodeConfig.category === "video" ? "video" : nodeConfig.category === "audio" ? "audio" : "image";
    }
    
    // Infer from field ID for other types
    if (id.includes("negative")) return "negative";
    if (id.includes("prompt") || id === "text" || id.includes("systemprompt") || id.includes("script")) return "prompt";
    if (id.includes("seed")) return "seed";
    if (id.includes("aspect")) return "aspectRatio";
    if (id.includes("duration")) return "duration";
    if (id.includes("model")) return "model";
    if (id.includes("temp")) return "temperature";
    
    // Number fields
    if (field.type === "slider" || field.type === "number") return "number";
    if (id.includes("steps") || id.includes("scale") || id.includes("tokens") || 
        id.includes("penalty") || id.includes("bitrate") || id.includes("sample") || 
        id.includes("channels") || id.includes("guidance") || id.includes("cfg")) return "number";
    
    // Boolean fields
    if (field.type === "toggle") return "boolean";
    if (id.includes("replace") || id.includes("enhance") || id.includes("normalize") || 
        id.includes("truncate") || id.includes("sync") || id.includes("cache")) return "boolean";
    
    // Default to text for textarea/text fields
    if (field.type === "textarea" || field.type === "text") return "text";
    
    return "any";
  }, [nodeConfig.category]);

  // No handles passed to BaseNode - all handles rendered inline with fields
  const settingsInputHandles: any[] = [];

  const outputHandles = nodeConfig.ui.outputs.map((o) => ({
    id: o.id,
    type: o.type,
    label: o.label,
  }));

  // Check if we can run (has required fields filled)
  const canRun = useMemo(() => {
    for (const field of nodeConfig.ui.inputs) {
      if (field.required) {
        const value = data[field.id];
        if (value === undefined || value === null || value === "") {
          // Check if connected
          if (!isFieldConnected(field.id)) {
            return false;
          }
        }
      }
    }
    return true;
  }, [nodeConfig, data, isFieldConnected]);

  // Check if node has output (for skip feature)
  const hasOutput = Boolean(data.result && (typeof data.result === "string" ? data.result.trim().length > 0 : true));
  
  // Skip toggle handler - update node data and propagate if has output
  const handleSkipToggle = useCallback((newSkip: boolean) => {
    updateNode(id, { skip: newSkip });
    
    // If enabling skip and we have output, propagate it to downstream nodes
    if (newSkip && hasOutput && data.result) {
      propagateOutput(id, data.result as string);
    }
  }, [id, updateNode, hasOutput, data.result, propagateOutput]);

  return (
    <BaseNode
      {...props}
      nodeType={nodeType}
      color={nodeConfig.color as any}
      layout={nodeConfig.ui.layout || "vertical"}
      skip={data.skip === true}
      hasOutput={hasOutput}
      onSkipToggle={handleSkipToggle}
      data={{
        ...data,
        nodeType, // Also include in data for consistency
        label: data.label || nodeConfig.label,
        description: data.description || nodeConfig.description,
        icon: <IconComponent className="w-5 h-5" />,
        provider: nodeConfig.providers[0]?.id || "internal",
        estimatedCost: nodeConfig.estimatedCost,
        _isUploading: isUploading, // Disable run button during uploads
      }}
      inputs={settingsInputHandles as any}
      outputs={outputHandles as any}
      left={
        <div className="space-y-3">
          {/* Basic Fields with inline handles */}
          {basicFields.map((field) => {
            // Build crop overlay for crop-image node's image field
            const cropOverlay = nodeType === "crop-image" && field.id === "image" && data.image
              ? {
                  xPercent: typeof data.xPercent === "number" ? data.xPercent : 0,
                  yPercent: typeof data.yPercent === "number" ? data.yPercent : 0,
                  widthPercent: typeof data.widthPercent === "number" ? data.widthPercent : 100,
                  heightPercent: typeof data.heightPercent === "number" ? data.heightPercent : 100,
                }
              : undefined;
            
            // DEBUG: Show crop values directly on the node
            if (nodeType === "crop-image" && field.id === "image") {
              console.log(`[GenericNode:${id}] RENDER - data.xPercent=${data.xPercent}, data.widthPercent=${data.widthPercent}`);
            }
            
            return (
              <FieldWithHandle
                key={field.id}
                field={field}
                value={data[field.id]}
                onChange={(v) => handleFieldChange(field.id, v)}
                isConnected={isFieldConnected(field.id)}
                connectedValue={getConnectedOutput(field.id)}
                disabled={isProcessing}
                handleType={getFieldHandleType(field)}
                isDragging={isDragging}
                draggedType={draggedType}
                onUploadingChange={(uploading) => handleUploadingChange(field.id, uploading)}
                cropOverlay={cropOverlay}
              />
            );
          })}

          {/* Advanced Fields Section */}
          {hasAdvanced && (
            <div className="space-y-3">
              {/* Toggle button */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="nodrag nowheel text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAdvanced ? "Hide advanced" : `Show advanced (${advancedFields.length})`}
              </button>

              {/* Advanced fields - handles always rendered, content animated */}
              <div className={cn(
                "pt-3 border-t border-gray-200 dark:border-white/5 space-y-3",
                !showAdvanced && "hidden"
              )}>
                {advancedFields.map((field) => (
                  <FieldWithHandle
                    key={field.id}
                    field={field}
                    value={data[field.id]}
                    onChange={(v) => handleFieldChange(field.id, v)}
                    isConnected={isFieldConnected(field.id)}
                    connectedValue={getConnectedOutput(field.id)}
                    disabled={isProcessing}
                    handleType={getFieldHandleType(field)}
                    isDragging={isDragging}
                    draggedType={draggedType}
                    onUploadingChange={(uploading) => handleUploadingChange(field.id, uploading)}
                  />
                ))}
              </div>

              {/* Hidden handles when collapsed - ALWAYS connectable */}
              {!showAdvanced && advancedFields.map((field, index) => {
                const handleType = getFieldHandleType(field);
                const handleColor = dataTypeColors[handleType] || dataTypeColors.any;
                const isCompatible = isDragging && draggedType && isTypeCompatible(draggedType, handleType);
                
                // Position each hidden handle at a different vertical position
                const topPercent = 60 + (index * 10);
                
                return (
                  <div
                    key={`hidden-wrapper-${field.id}`}
                    className="absolute z-20"
                    style={{
                      left: -4,
                      top: `${topPercent}%`,
                      transform: "translateY(-50%)",
                    }}
                    data-handletype={handleType}
                  >
                    <Handle
                      id={field.id}
                      type="target"
                      position={Position.Left}
                      data-handletype={handleType}
                      style={{
                        position: "relative",
                        width: isCompatible ? 12 : 8,
                        height: isCompatible ? 12 : 8,
                        opacity: isCompatible ? 1 : 0,
                        pointerEvents: "all",
                        borderWidth: 0,
                        backgroundColor: handleColor.solid,
                        boxShadow: isCompatible ? `0 0 10px ${handleColor.solid}` : undefined,
                        transition: "all 0.2s ease",
                      }}
                      className="!relative !left-0 !top-0 !transform-none"
                    />
                    {/* Show tooltip when compatible and dragging */}
                    {isCompatible && (
                      <div 
                        className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/20 text-[9px] text-gray-700 dark:text-white/90 whitespace-nowrap shadow-lg"
                        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      >
                        {field.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      }
      right={
        nodeConfig.ui.outputs.length > 0 ? (
          <div className="space-y-2">
            {nodeConfig.ui.outputs.map((output) => (
              <OutputDisplay
                key={output.id}
                config={output}
                value={data.result}
                isLoading={isProcessing}
              />
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

// TEMP: Removed memo to debug stale closure issues
export const GenericNode = GenericNodeComponent;

// =============================================================================
// FACTORY FUNCTION - Creates node component for a specific type
// =============================================================================

/**
 * Create a typed node component from node config
 * This allows using GenericNode for any node type defined in config
 */
export function createNodeComponent(nodeType: string) {
  const NodeComponent = memo(function ConfiguredNode(props: NodeProps<GenericNodeData>) {
    return <GenericNode {...props} data={{ ...props.data, nodeType }} />;
  });

  NodeComponent.displayName = `${nodeType}Node`;
  return NodeComponent;
}

/**
 * Create all node components from config
 */
export function createAllNodeComponents(): Record<string, React.ComponentType<NodeProps<GenericNodeData>>> {
  const { getAllNodeTypes } = require("@/lib/config");
  const nodeTypes = getAllNodeTypes() as string[];

  const components: Record<string, React.ComponentType<NodeProps<GenericNodeData>>> = {};

  for (const nodeType of nodeTypes) {
    components[nodeType] = createNodeComponent(nodeType);
  }

  return components;
}

export default GenericNode;
