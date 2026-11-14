"use client";

import React, { memo, useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import type { FoldedFolderNode } from "@/lib/graph/types";

export interface FolderNodeData extends Record<string, unknown> {
  node: FoldedFolderNode;
  isOpen: boolean;
  isDimmed: boolean;
  isSelected: boolean;
  selectedFilePath: string | null;
  connectedFilePaths: Set<string> | null;
  hoveredFilePath: string | null;
  hoveredNodeId: string | null;
  onToggleOpen: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectFile: (filePath: string) => void;
  onHoverNode: (nodeId: string | null) => void;
  onHoverFile: (filePath: string | null) => void;
}

export type FolderNodeType = Node<FolderNodeData, "folderNode">;

function FolderNodeComponent({ data }: NodeProps<FolderNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals();

  const {
    node,
    isOpen,
    isDimmed,
    isSelected,
    selectedFilePath,
    connectedFilePaths,
    hoveredFilePath,
    hoveredNodeId,
    onToggleOpen,
    onSelectNode,
    onSelectFile,
    onHoverNode,
    onHoverFile,
  } = data;

  // Recompute handle positions when panel opens or collapses
  useEffect(() => {
    updateNodeInternals(node.id);
  }, [node.id, isOpen, updateNodeInternals]);

  const isNodeHovered =
    hoveredNodeId === node.id ||
    (!isOpen &&
      hoveredFilePath !== null &&
      node.files.some((f) => f.path === hoveredFilePath));

  if (isOpen) {
    return (
      <div
        className={`rounded-md border bg-white dark:bg-zinc-950 transition-all duration-150 shadow-md select-none ${
          isSelected
            ? "border-blue-500 ring-2 ring-blue-500/20"
            : isNodeHovered
              ? "border-blue-400 ring-2 ring-blue-400/30"
              : "border-zinc-300 dark:border-zinc-700"
        } ${isDimmed ? "opacity-20" : "opacity-100"}`}
        style={{ width: Math.max(node.width, 280) }}
      >
        {/* Default handles for folder-level fallback */}
        <Handle
          type="target"
          position={Position.Left}
          id="target-default"
          className="!w-2 !h-2 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-default"
          className="!w-2 !h-2 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
        />

        {/* Panel Header: Clicking closes the panel back to folded node */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(node.id);
            onToggleOpen(node.id);
          }}
          onMouseEnter={() => onHoverNode(node.id)}
          onMouseLeave={() => onHoverNode(null)}
          className="flex h-10 items-center justify-between border-b border-zinc-200 px-3 py-1.5 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/90 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors rounded-t-md shrink-0"
          title="Click to collapse panel"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              ▾
            </span>
            <div className="min-w-0">
              <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                {node.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
            <span className="text-zinc-500 dark:text-zinc-400">
              {node.fileCount} files
            </span>
            <span
              className="font-medium text-emerald-600 dark:text-emerald-400"
              title="Incoming dependencies (fan-in)"
            >
              ↓{node.fanIn}
            </span>
            <span
              className="font-medium text-amber-600 dark:text-amber-400"
              title="Outgoing dependencies (fan-out)"
            >
              ↑{node.fanOut}
            </span>
          </div>
        </div>

        {/* Scrollable File Rows: nowheel and nodrag allow mousewheel scroll without zooming/dragging the canvas */}
        <div
          onScroll={() => updateNodeInternals(node.id)}
          className="overflow-y-auto max-h-[312px] nowheel nodrag divide-y divide-zinc-100 dark:divide-zinc-800/60 p-0.5 [scrollbar-width:thin] [scrollbar-color:var(--color-zinc-300)_transparent] dark:[scrollbar-color:var(--color-zinc-700)_transparent]"
        >
          {node.files.map((file) => {
            const isFileSelected = selectedFilePath === file.path;
            const isFileConnected =
              connectedFilePaths !== null &&
              connectedFilePaths.has(file.path);
            const isFileHovered = hoveredFilePath === file.path;
            const isFileDimmed =
              selectedFilePath !== null &&
              !isFileSelected &&
              !isFileConnected &&
              !isFileHovered;

            return (
              <div
                key={file.path}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFile(file.path);
                }}
                onMouseEnter={() => onHoverFile(file.path)}
                onMouseLeave={() => onHoverFile(null)}
                className={`relative flex h-[26px] items-center justify-between px-2.5 rounded-xs text-[11px] font-mono transition-colors cursor-pointer ${
                  isFileSelected
                    ? "bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 font-medium ring-1 ring-blue-500/30"
                    : isFileHovered
                      ? "bg-blue-50/80 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 ring-1 ring-blue-400/60 font-medium"
                      : isFileConnected
                        ? "bg-zinc-100/90 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100 font-medium"
                        : "text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                } ${isFileDimmed ? "opacity-35" : "opacity-100"}`}
                title={file.path}
              >
                {/* Specific handles for this file row */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`in-${file.path}`}
                  className="!w-2 !h-2 !left-0 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`out-${file.path}`}
                  className="!w-2 !h-2 !right-0 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
                />

                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: file.color }}
                  />
                  <span className="truncate">{file.name}</span>
                </div>

                <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">
                  {file.fanIn > 0 && (
                    <span className="text-emerald-600/80 dark:text-emerald-400/80">
                      ↓{file.fanIn}
                    </span>
                  )}
                  {file.fanOut > 0 && (
                    <span className="text-amber-600/80 dark:text-amber-400/80">
                      ↑{file.fanOut}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Folded Node State
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectNode(node.id);
        onToggleOpen(node.id);
      }}
      onMouseEnter={() => onHoverNode(node.id)}
      onMouseLeave={() => onHoverNode(null)}
      className={`rounded-md border bg-white dark:bg-zinc-900 p-2.5 flex flex-col justify-between transition-all duration-150 shadow-xs cursor-pointer select-none hover:border-zinc-400 dark:hover:border-zinc-500 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : isNodeHovered
            ? "border-blue-400 ring-2 ring-blue-400/30 shadow-md"
            : "border-zinc-300 dark:border-zinc-700"
      } ${isDimmed ? "opacity-20" : "opacity-100"}`}
      style={{
        width: node.width,
        height: node.height,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="target-default"
        className="!w-2 !h-2 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-default"
        className="!w-2 !h-2 !bg-zinc-400 dark:!bg-zinc-500 !border !border-white dark:!border-zinc-900"
      />

      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            ▸
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
            {node.label}
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
          {node.fileCount}f
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80">
        <span
          className="text-emerald-600 dark:text-emerald-400 font-medium"
          title="Incoming dependencies (fan-in) determines height"
        >
          ↓ {node.fanIn}
        </span>
        <span
          className="text-amber-600 dark:text-amber-400 font-medium"
          title="Outgoing dependencies (fan-out)"
        >
          ↑ {node.fanOut}
        </span>
      </div>
    </div>
  );
}

export const FolderNode = memo(FolderNodeComponent);
