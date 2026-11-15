"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  useKeyPress,
  type Edge as FlowEdge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { AnalysisResult } from "@/lib/parser/types";
import { calculateDeterministicLayout } from "@/lib/graph/layout";
import { classifyFile } from "@/lib/taxonomy";
import { FolderNode, type FolderNodeType } from "./folder-node";
import type {
  FoldedFolderNode,
  FoldedGraphResult,
  FoldedNodeFile,
} from "@/lib/graph/types";

export type SelectedTarget =
  | { type: "node"; node: FoldedFolderNode }
  | { type: "file"; file: FoldedNodeFile; folderNode: FoldedFolderNode };

export interface MapCanvasProps {
  data: AnalysisResult;
  foldedGraph: FoldedGraphResult;
  openNodeIds: Set<string>;
  onToggleOpenNode: (nodeId: string) => void;
  selected: SelectedTarget | null;
  onSelectNode: (nodeId: string) => void;
  onSelectFile: (filePath: string) => void;
  onDeselect: () => void;
  activeCategoryId: string | null;
  hoveredFilePath: string | null;
  hoveredNodeId: string | null;
  onHoverFile: (filePath: string | null) => void;
  onHoverNode: (nodeId: string | null) => void;
}

const nodeTypes = {
  folderNode: FolderNode,
};

function InnerMapCanvas({
  foldedGraph,
  openNodeIds,
  onToggleOpenNode,
  selected,
  onSelectNode,
  onSelectFile,
  onDeselect,
  activeCategoryId,
  hoveredFilePath,
  hoveredNodeId,
  onHoverFile,
  onHoverNode,
}: MapCanvasProps) {
  const { fitView, getZoom, setCenter } = useReactFlow();
  const isSpacePressed = useKeyPress("Space");

  // Track zoom level ref for refitting constraints
  const zoomBeforeOpenRef = useRef<number>(1);
  const prevSelectedRef = useRef<SelectedTarget | null>(null);

  // Compute deterministic layout based on active open panels
  const positions = useMemo(() => {
    return calculateDeterministicLayout(
      foldedGraph.nodes,
      foldedGraph.edges,
      openNodeIds
    );
  }, [foldedGraph.nodes, foldedGraph.edges, openNodeIds]);

  // Wrapped toggle open to enforce refit constraints
  const handleToggleOpen = useCallback(
    (nodeId: string) => {
      zoomBeforeOpenRef.current = getZoom();
      onToggleOpenNode(nodeId);

      // Refit after state change without zooming in
      requestAnimationFrame(() => {
        const currentZoom = zoomBeforeOpenRef.current;
        fitView({
          maxZoom: Math.min(1.0, currentZoom),
          padding: 0.15,
          duration: 300,
        });
      });
    },
    [getZoom, fitView, onToggleOpenNode]
  );

  // Smoothly center the canvas on newly selected items without zooming in
  useEffect(() => {
    if (selected && selected !== prevSelectedRef.current) {
      const targetNodeId =
        selected.type === "node" ? selected.node.id : selected.folderNode.id;
      const pos = positions.get(targetNodeId);
      if (pos) {
        const currentZoom = getZoom();
        const nodeObj = foldedGraph.nodes.find((n) => n.id === targetNodeId);
        const width = nodeObj
          ? openNodeIds.has(nodeObj.id)
            ? Math.max(nodeObj.width, 280)
            : nodeObj.width
          : 200;
        const height = nodeObj
          ? openNodeIds.has(nodeObj.id)
            ? 320
            : nodeObj.height
          : 60;
        setCenter(pos.x + width / 2, pos.y + height / 2, {
          duration: 250,
          zoom: Math.min(currentZoom, 1.0),
        });
      }
    }
    prevSelectedRef.current = selected;
  }, [selected, positions, foldedGraph.nodes, openNodeIds, getZoom, setCenter]);

  // Determine connected files/nodes for dimming
  const activeConnections = useMemo(() => {
    if (!selected) return null;

    const connectedNodeIds = new Set<string>();
    const connectedFilePaths = new Set<string>();
    const connectedEdgeIds = new Set<string>();

    if (selected.type === "node") {
      connectedNodeIds.add(selected.node.id);
      for (const e of foldedGraph.edges) {
        if (e.sourceNodeId === selected.node.id) {
          connectedNodeIds.add(e.targetNodeId);
          connectedEdgeIds.add(e.id);
        } else if (e.targetNodeId === selected.node.id) {
          connectedNodeIds.add(e.sourceNodeId);
          connectedEdgeIds.add(e.id);
        }
      }
    } else {
      // File selection
      connectedFilePaths.add(selected.file.path);
      connectedNodeIds.add(selected.folderNode.id);

      for (const e of foldedGraph.edges) {
        if (e.sourceFilePath === selected.file.path) {
          connectedFilePaths.add(e.targetFilePath);
          connectedNodeIds.add(e.targetNodeId);
          connectedEdgeIds.add(e.id);
        } else if (e.targetFilePath === selected.file.path) {
          connectedFilePaths.add(e.sourceFilePath);
          connectedNodeIds.add(e.sourceNodeId);
          connectedEdgeIds.add(e.id);
        }
      }
    }

    return { connectedNodeIds, connectedFilePaths, connectedEdgeIds };
  }, [selected, foldedGraph.edges]);

  // Construct React Flow nodes
  const flowNodes: FolderNodeType[] = useMemo(() => {
    return foldedGraph.nodes.map((node) => {
      const isOpen = openNodeIds.has(node.id);
      const isSelected =
        selected?.type === "node" && selected.node.id === node.id;

      // Category match count for this panel/node
      const matchingFileCount =
        activeCategoryId !== null
          ? node.files.filter(
              (f) => classifyFile(f.path).id === activeCategoryId
            ).length
          : null;

      // Dimming calculation:
      // 1. If outside the active category filter, always dim the node.
      // 2. Otherwise, if an item is selected, dim anything not connected to it.
      let isDimmed = false;
      if (activeCategoryId !== null && matchingFileCount === 0) {
        isDimmed = true;
      } else if (activeConnections !== null) {
        isDimmed = !activeConnections.connectedNodeIds.has(node.id);
      }

      const pos = positions.get(node.id) || { x: 0, y: 0 };

      return {
        id: node.id,
        type: "folderNode" as const,
        position: { x: pos.x, y: pos.y },
        data: {
          node,
          isOpen,
          isDimmed,
          isSelected,
          selectedFilePath:
            selected?.type === "file" ? selected.file.path : null,
          connectedFilePaths: activeConnections?.connectedFilePaths || null,
          activeCategoryId,
          matchingFileCount,
          hoveredFilePath,
          hoveredNodeId,
          onToggleOpen: handleToggleOpen,
          onSelectNode,
          onSelectFile,
          onHoverNode,
          onHoverFile,
        },
      };
    });
  }, [
    foldedGraph.nodes,
    openNodeIds,
    selected,
    activeConnections,
    activeCategoryId,
    positions,
    hoveredFilePath,
    hoveredNodeId,
    handleToggleOpen,
    onSelectNode,
    onSelectFile,
    onHoverNode,
    onHoverFile,
  ]);

  // Construct React Flow edges
  const flowEdges: FlowEdge[] = useMemo(() => {
    return foldedGraph.edges.map((edge) => {
      const isSourceOpen = openNodeIds.has(edge.sourceNodeId);
      const isTargetOpen = openNodeIds.has(edge.targetNodeId);

      // Resolve handles
      const sourceHandle = isSourceOpen
        ? `out-${edge.sourceFilePath}`
        : "source-default";

      const targetHandle = isTargetOpen
        ? `in-${edge.targetFilePath}`
        : "target-default";

      // Edge coloring, highlighting, and dimming
      let strokeColor = "#a1a1aa"; // Default neutral zinc
      let strokeWidth = 1.2;
      let opacity = 0.45;
      let isConnected = true;

      const isHoveredEdge =
        (hoveredFilePath !== null &&
          (edge.sourceFilePath === hoveredFilePath ||
            edge.targetFilePath === hoveredFilePath)) ||
        (hoveredNodeId !== null &&
          (edge.sourceNodeId === hoveredNodeId ||
            edge.targetNodeId === hoveredNodeId));

      // Category match check for edges
      const sourceMatchesCategory =
        activeCategoryId === null ||
        classifyFile(edge.sourceFilePath).id === activeCategoryId;
      const targetMatchesCategory =
        activeCategoryId === null ||
        classifyFile(edge.targetFilePath).id === activeCategoryId;
      const edgeMatchesCategory =
        sourceMatchesCategory || targetMatchesCategory;

      if (!edgeMatchesCategory) {
        // Outside the active category filter: always dim
        opacity = 0.08;
        strokeColor = "#71717a";
      } else if (selected) {
        isConnected =
          activeConnections?.connectedEdgeIds.has(edge.id) || false;

        if (isConnected) {
          if (
            (selected.type === "node" &&
              edge.sourceNodeId === selected.node.id) ||
            (selected.type === "file" &&
              edge.sourceFilePath === selected.file.path)
          ) {
            // Outgoing is amber
            strokeColor = "#f59e0b";
            strokeWidth = isHoveredEdge ? 3.0 : 2.2;
            opacity = 1.0;
          } else {
            // Incoming is green
            strokeColor = "#10b981";
            strokeWidth = isHoveredEdge ? 3.0 : 2.2;
            opacity = 1.0;
          }
        } else {
          opacity = 0.08;
          strokeColor = "#71717a";
        }
      } else if (isHoveredEdge) {
        strokeColor = "#3b82f6";
        strokeWidth = 2.4;
        opacity = 0.95;
      } else if (activeCategoryId !== null) {
        strokeColor =
          sourceMatchesCategory && targetMatchesCategory
            ? "#3b82f6"
            : "#a1a1aa";
        strokeWidth = 1.6;
        opacity = 0.55;
      }

      return {
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle,
        targetHandle,
        animated: false,
        style: {
          stroke: strokeColor,
          strokeWidth,
          opacity,
          transition: "stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease",
        },
        markerEnd: isConnected
          ? {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: strokeColor,
            }
          : undefined,
      };
    });
  }, [
    foldedGraph.edges,
    openNodeIds,
    selected,
    activeConnections,
    activeCategoryId,
    hoveredFilePath,
    hoveredNodeId,
  ]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.0}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!isSpacePressed}
        panOnDrag={true}
        panActivationKeyCode="Space"
        onPaneClick={isSpacePressed ? undefined : onDeselect}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#71717a"
          gap={20}
          size={1}
          className="opacity-15 dark:opacity-25"
        />
        <Controls
          showInteractive={false}
          className="!bg-white dark:!bg-zinc-900 !border-zinc-200 dark:!border-zinc-800 !rounded-md !shadow-xs"
        />
      </ReactFlow>
    </div>
  );
}

export function MapCanvas(props: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerMapCanvas {...props} />
    </ReactFlowProvider>
  );
}
