"use client";

import { useMemo, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/components/flow";

// Animated workflow that cycles through states
const createNodes = (offset: number = 0): Node[] => [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 50 + offset, y: 250 },
    data: { 
      label: "API Request", 
      triggerType: "webhook",
      status: "success"
    },
  },
  {
    id: "ai-1",
    type: "ai",
    position: { x: 400, y: 80 },
    data: {
      label: "Analyze Intent",
      model: "gpt-4",
      prompt: "Classify user intent and extract entities",
      temperature: 0.3,
      status: "running"
    },
  },
  {
    id: "ai-2",
    type: "ai",
    position: { x: 400, y: 380 },
    data: {
      label: "Generate Response",
      model: "claude",
      prompt: "Create personalized response based on context",
      temperature: 0.7,
    },
  },
  {
    id: "condition-1",
    type: "condition",
    position: { x: 780, y: 220 },
    data: { 
      label: "Route Decision", 
      condition: "intent.type === 'purchase'" 
    },
  },
  {
    id: "action-1",
    type: "action",
    position: { x: 1150, y: 80 },
    data: { 
      label: "Update CRM", 
      actionType: "database",
    },
  },
  {
    id: "action-2",
    type: "action",
    position: { x: 1150, y: 250 },
    data: { 
      label: "Send Email", 
      actionType: "email",
    },
  },
  {
    id: "action-3",
    type: "action",
    position: { x: 1150, y: 420 },
    data: { 
      label: "Notify Slack", 
      actionType: "http",
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 1520, y: 250 },
    data: { 
      label: "Complete", 
      outputType: "return",
    },
  },
];

const createEdges = (): Edge[] => [
  { 
    id: "e1-ai1", 
    source: "trigger-1", 
    target: "ai-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#f59e0b", strokeWidth: 2 }
  },
  { 
    id: "e1-ai2", 
    source: "trigger-1", 
    target: "ai-2", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#f59e0b", strokeWidth: 2 }
  },
  { 
    id: "eai1-cond", 
    source: "ai-1", 
    target: "condition-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#8b5cf6", strokeWidth: 2 }
  },
  { 
    id: "eai2-cond", 
    source: "ai-2", 
    target: "condition-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#8b5cf6", strokeWidth: 2 }
  },
  { 
    id: "econd-act1", 
    source: "condition-1", 
    sourceHandle: "true",
    target: "action-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 2 }
  },
  { 
    id: "econd-act2", 
    source: "condition-1", 
    sourceHandle: "true",
    target: "action-2", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 2 }
  },
  { 
    id: "econd-act3", 
    source: "condition-1", 
    sourceHandle: "false",
    target: "action-3", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#ef4444", strokeWidth: 2 }
  },
  { 
    id: "eact1-out", 
    source: "action-1", 
    target: "output-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 }
  },
  { 
    id: "eact2-out", 
    source: "action-2", 
    target: "output-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 }
  },
  { 
    id: "eact3-out", 
    source: "action-3", 
    target: "output-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 }
  },
];

export function HeroFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(createNodes());
  const [edges, , onEdgesChange] = useEdgesState(createEdges());
  const [mounted, setMounted] = useState(false);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Subtle floating animation for nodes
  useEffect(() => {
    if (!mounted) return;
    
    const interval = setInterval(() => {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          position: {
            x: node.position.x + (Math.random() - 0.5) * 0.3,
            y: node.position.y + (Math.random() - 0.5) * 0.3,
          },
        }))
      );
    }, 100);

    return () => clearInterval(interval);
  }, [mounted, setNodes]);

  if (!mounted) {
    return <div className="w-full h-full bg-zinc-950" />;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={memoizedNodeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ 
        padding: 0.15,
        minZoom: 0.4,
        maxZoom: 0.8
      }}
      minZoom={0.2}
      maxZoom={1}
      defaultEdgeOptions={{
        type: "smoothstep",
        animated: true,
      }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
      preventScrolling={false}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={32}
        size={1.5}
        color="rgba(63, 63, 70, 0.5)"
      />
    </ReactFlow>
  );
}


