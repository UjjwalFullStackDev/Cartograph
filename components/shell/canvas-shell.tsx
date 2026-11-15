"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { AnalysisResult } from "@/lib/parser/types";
import { foldGraph } from "@/lib/graph/folding";
import { extractCategories } from "@/lib/taxonomy";
import { CategoryRail } from "./category-rail";
import { DetailPane } from "./detail-pane";
import {
  MapCanvas,
  type SelectedTarget,
} from "@/components/canvas/map-canvas";

interface CanvasShellProps {
  data: AnalysisResult;
}

export function CanvasShell({ data }: CanvasShellProps) {
  // Deterministic folding of the graph
  const foldedGraph = useMemo(() => {
    return foldGraph(data.files, data.edges);
  }, [data.files, data.edges]);

  // Set of opened folder panel IDs
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(
    () => new Set()
  );

  // Active selection: node, file, or null (resting repository summary)
  const [selection, setSelection] = useState<SelectedTarget | null>(null);

  // Active tab in the detail pane: survives selection changes
  const [activeTab, setActiveTab] = useState<"structure" | "explanation">(
    "structure"
  );

  // Hover states for bidirectional highlighting
  const [hoveredFilePath, setHoveredFilePath] = useState<string | null>(
    null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Categories for the left rail
  const categories = useMemo(() => {
    return extractCategories(data.files);
  }, [data.files]);

  // Active category filter from the left rail (dims everything not in category)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const handleSelectCategory = useCallback((id: string) => {
    setActiveCategoryId((prev) => (prev === id ? null : id));
  }, []);

  const repoName = useMemo(() => {
    return (
      data.rootDir.split(/[\\/]/).filter(Boolean).pop() || "repository"
    );
  }, [data.rootDir]);

  const internalEdges = useMemo(() => {
    return data.edges.filter((e) => e.isResolved).length;
  }, [data.edges]);

  // Toggle open/collapsed state of a folder node
  const handleToggleOpenNode = useCallback((nodeId: string) => {
    setOpenNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Select a folded folder node
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelection((prev) => {
        if (prev?.type === "node" && prev.node.id === nodeId) {
          return null;
        }
        const targetNode = foldedGraph.nodes.find((n) => n.id === nodeId);
        return targetNode ? { type: "node", node: targetNode } : null;
      });
    },
    [foldedGraph.nodes]
  );

  // Select a file by its relative path (from pane, canvas, or lists)
  const handleSelectFile = useCallback(
    (filePath: string) => {
      setSelection((prev) => {
        if (prev?.type === "file" && prev.file.path === filePath) {
          return null;
        }
        for (const node of foldedGraph.nodes) {
          const file = node.files.find((f) => f.path === filePath);
          if (file) {
            // Option A: Automatically expand the containing folder and any folder holding
            // pointed (target) files or pointing (source) files so all connected files are visible.
            const connectedFolderIds = new Set<string>();
            connectedFolderIds.add(node.id);

            for (const edge of foldedGraph.edges) {
              if (edge.sourceFilePath === filePath) {
                connectedFolderIds.add(edge.targetNodeId);
              } else if (edge.targetFilePath === filePath) {
                connectedFolderIds.add(edge.sourceNodeId);
              }
            }

            setOpenNodeIds((openPrev) => {
              const nextOpen = new Set(openPrev);
              for (const fId of connectedFolderIds) {
                nextOpen.add(fId);
              }
              return nextOpen;
            });

            return { type: "file", file, folderNode: node };
          }
        }
        return null;
      });
    },
    [foldedGraph.nodes, foldedGraph.edges]
  );

  // Deselect back to resting state
  const handleDeselect = useCallback(() => {
    setSelection(null);
  }, []);

  // Bidirectional hover: file hover
  const handleHoverFile = useCallback(
    (filePath: string | null) => {
      setHoveredFilePath(filePath);
      if (!filePath) {
        setHoveredNodeId(null);
        return;
      }
      // Also highlight containing node
      const parent = foldedGraph.nodes.find((n) =>
        n.files.some((f) => f.path === filePath)
      );
      if (parent) {
        setHoveredNodeId(parent.id);
      }
    },
    [foldedGraph.nodes]
  );

  // Bidirectional hover: node hover
  const handleHoverNode = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-zinc-100/60 dark:bg-zinc-950 font-sans">
      {/* Left Column: Category Rail */}
      <CategoryRail
        categories={categories}
        totalFiles={data.files.length}
        activeCategoryId={activeCategoryId}
        onSelectCategory={handleSelectCategory}
      />

      {/* Center Column: Map Canvas */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-white dark:bg-zinc-950">
        {/* Canvas Toolbar / Status Strip */}
        <div className="h-9 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xs shrink-0 select-none z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {repoName}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              preview
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>{data.files.length} files</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>{internalEdges} edges</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>{data.folders.length} folders</span>
          </div>
        </div>

        {/* Interactive React Flow Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <MapCanvas
            data={data}
            foldedGraph={foldedGraph}
            openNodeIds={openNodeIds}
            onToggleOpenNode={handleToggleOpenNode}
            selected={selection}
            onSelectNode={handleSelectNode}
            onSelectFile={handleSelectFile}
            onDeselect={handleDeselect}
            activeCategoryId={activeCategoryId}
            hoveredFilePath={hoveredFilePath}
            hoveredNodeId={hoveredNodeId}
            onHoverFile={handleHoverFile}
            onHoverNode={handleHoverNode}
          />
        </div>
      </main>

      {/* Right Column: Detail Inspector Pane */}
      <DetailPane
        data={data}
        selection={selection}
        onSelectFilePath={handleSelectFile}
        onSelectNodeId={handleSelectNode}
        onDeselect={handleDeselect}
        hoveredFilePath={hoveredFilePath}
        hoveredNodeId={hoveredNodeId}
        onHoverFilePath={handleHoverFile}
        onHoverNodeId={handleHoverNode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
