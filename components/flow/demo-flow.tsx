"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/components/flow";

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 0, y: 180 },
    data: { 
      label: "Webhook", 
      triggerType: "webhook",
      description: "Incoming request"
    },
  },
  {
    id: "ai-1",
    type: "ai",
    position: { x: 350, y: 100 },
    data: {
      label: "Analyze Content",
      model: "gpt-4",
      prompt: "Extract key entities and sentiment from the incoming data",
      temperature: 0.7,
    },
  },
  {
    id: "condition-1",
    type: "condition",
    position: { x: 700, y: 180 },
    data: { 
      label: "Check Sentiment", 
      condition: "sentiment > 0.7" 
    },
  },
  {
    id: "action-1",
    type: "action",
    position: { x: 1050, y: 50 },
    data: { 
      label: "Send to CRM", 
      actionType: "http",
      description: "POST /api/leads"
    },
  },
  {
    id: "action-2",
    type: "action",
    position: { x: 1050, y: 280 },
    data: { 
      label: "Flag for Review", 
      actionType: "database",
      description: "Insert into queue"
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 1400, y: 160 },
    data: { 
      label: "Complete", 
      outputType: "end",
      message: "Workflow finished"
    },
  },
];

const initialEdges: Edge[] = [
  { 
    id: "e1-2", 
    source: "trigger-1", 
    target: "ai-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#f59e0b", strokeWidth: 2 }
  },
  { 
    id: "e2-3", 
    source: "ai-1", 
    target: "condition-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#8b5cf6", strokeWidth: 2 }
  },
  { 
    id: "e3-4", 
    source: "condition-1", 
    sourceHandle: "true",
    target: "action-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 2 }
  },
  { 
    id: "e3-5", 
    source: "condition-1", 
    sourceHandle: "false",
    target: "action-2", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#ef4444", strokeWidth: 2 }
  },
  { 
    id: "e4-6", 
    source: "action-1", 
    target: "output-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 }
  },
  { 
    id: "e5-6", 
    source: "action-2", 
    target: "output-1", 
    type: "smoothstep", 
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 }
  },
];

interface DemoFlowProps {
  className?: string;
}

export function DemoFlow({ className }: DemoFlowProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  // Prevent default drag behavior for demo
  const onNodeDragStart = useCallback(() => {}, []);

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={memoizedNodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ 
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1
        }}
        minZoom={0.3}
        maxZoom={1.5}
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
        preventScrolling={true}
        onNodeDragStart={onNodeDragStart}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#27272a"
        />
        <Controls 
          showInteractive={false}
          className="!bg-zinc-900/90 !border-zinc-700 !rounded-xl !shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
}


