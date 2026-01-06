"use client";

import { useState, useCallback } from "react";
import type { Node, Edge } from "reactflow";

// =============================================================================
// WORKFLOW MANAGEMENT HOOK
// =============================================================================

interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodesJson: Node[];
  edgesJson: Edge[];
  viewportJson?: { x: number; y: number; zoom: number };
  version: number;
}

interface ExecuteResponse {
  executionId: string;
  triggerRunId: string;
  status: string;
  estimatedCost: number;
}

export function useWorkflow(workflowId?: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a workflow
  const loadWorkflow = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load workflow");
      }

      const data = await response.json();
      setWorkflow(data.workflow);
      return data.workflow as Workflow;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a workflow
  const saveWorkflow = useCallback(
    async (
      data: {
        name?: string;
        description?: string;
        nodesJson?: Node[];
        edgesJson?: Edge[];
        viewportJson?: { x: number; y: number; zoom: number };
      },
      id?: string
    ) => {
      setIsSaving(true);
      setError(null);

      try {
        const workflowIdToUse = id ?? workflowId;
        const isUpdate = Boolean(workflowIdToUse);

        const response = await fetch(
          isUpdate ? `/api/workflows/${workflowIdToUse}` : "/api/workflows",
          {
            method: isUpdate ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save workflow");
        }

        const result = await response.json();
        setWorkflow(result.workflow);
        return result.workflow as Workflow;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [workflowId]
  );

  // Execute a workflow
  const executeWorkflow = useCallback(
    async (id?: string): Promise<ExecuteResponse | null> => {
      const workflowIdToUse = id ?? workflowId;
      if (!workflowIdToUse) {
        setError("No workflow ID provided");
        return null;
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/workflows/${workflowIdToUse}/execute`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to execute workflow");
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return null;
      }
    },
    [workflowId]
  );

  // Delete a workflow
  const deleteWorkflow = useCallback(
    async (id?: string) => {
      const workflowIdToUse = id ?? workflowId;
      if (!workflowIdToUse) {
        setError("No workflow ID provided");
        return false;
      }

      try {
        const response = await fetch(`/api/workflows/${workflowIdToUse}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete workflow");
        }

        setWorkflow(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [workflowId]
  );

  return {
    workflow,
    isLoading,
    isSaving,
    error,
    loadWorkflow,
    saveWorkflow,
    executeWorkflow,
    deleteWorkflow,
  };
}

