"use client";

import { memo, useEffect, useRef } from "react";
import { NodeProps } from "reactflow";
import { Type } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { useFlowStore } from "@/store";

export interface TextInputNodeData extends BaseNodeData {
  text?: string;
}

function TextInputNodeComponent(props: NodeProps<TextInputNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const lastTextRef = useRef<string>("");

  // Propagate text to connected nodes when it changes
  useEffect(() => {
    if (data.text && data.text !== lastTextRef.current) {
      lastTextRef.current = data.text;
      propagateOutput(id, data.text);
    }
  }, [data.text, id, propagateOutput]);

  return (
    <BaseNode
      {...props}
      color="zinc"
      isUtility
      data={{
        ...data,
        label: data.label || "Text Input",
        description: "Enter text to pass to other nodes",
        icon: <Type className="w-5 h-5" />,
        provider: "Input",
        estimatedCost: 0,
      }}
      inputs={[]}
      outputs={[{ id: "text", type: "text", label: "Text" }]}
      left={
        <div className="w-full">
          <textarea
            value={data.text || ""}
            onChange={(e) => updateNode(id, { text: e.target.value })}
            placeholder="Enter your text here..."
            rows={5}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />
          <div className="text-[9px] text-zinc-500 mt-1.5">
            {data.text ? `${data.text.length} chars` : "Type to send to connected nodes"}
          </div>
        </div>
      }
    />
  );
}

export const TextInputNode = memo(TextInputNodeComponent);
