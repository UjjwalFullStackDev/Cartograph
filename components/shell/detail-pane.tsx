"use client";

import React, { useState, useMemo } from "react";
import type { AnalysisResult } from "@/lib/parser/types";
import { classifyFile, isUnidentifiedByConvention } from "@/lib/taxonomy";
import { detectFramework } from "@/lib/parser/adapters";
import type { SelectedTarget } from "@/components/canvas/map-canvas";
import { computeTransitiveWalk } from "@/lib/graph/traversal";
import { computeInsights } from "@/lib/graph/insights";

interface DetailPaneProps {
  data: AnalysisResult;
  selection: SelectedTarget | null;
  onSelectFilePath: (filePath: string) => void;
  onSelectNodeId: (nodeId: string) => void;
  onDeselect: () => void;
  hoveredFilePath: string | null;
  hoveredNodeId: string | null;
  onHoverFilePath: (filePath: string | null) => void;
  onHoverNodeId: (nodeId: string | null) => void;
  activeTab: "structure" | "explanation";
  onTabChange: (tab: "structure" | "explanation") => void;
}

export function DetailPane({
  data,
  selection,
  onSelectFilePath,
  onDeselect,
  hoveredFilePath,
  onHoverFilePath,
  activeTab,
  onTabChange,
}: DetailPaneProps) {
  // Transitive walk toggle state for a selected file: blast radius vs dependency chain
  const [activeWalk, setActiveWalk] = useState<"blast" | "dependencies" | null>(
    null
  );

  // Insights panel state in resting overview: starts collapsed as required
  const [insightsExpanded, setInsightsExpanded] = useState<boolean>(false);

  const repoName = useMemo(() => {
    return (
      data.rootDir.split(/[\\/]/).filter(Boolean).pop() || "repository"
    );
  }, [data.rootDir]);

  const framework = useMemo(() => {
    return detectFramework({ rootDir: data.rootDir, files: data.files });
  }, [data.rootDir, data.files]);

  const internalEdgesCount = useMemo(() => {
    return data.edges.filter((e) => e.isResolved).length;
  }, [data.edges]);

  const routeFilesCount = useMemo(() => {
    return data.files.filter((f) => classifyFile(f.path).id === "routes")
      .length;
  }, [data.files]);

  const unidentifiedFilesCount = useMemo(() => {
    return data.files.filter((f) => isUnidentifiedByConvention(f.path))
      .length;
  }, [data.files]);

  // Ranked List 1: Most depended-on files (ordered by fanIn descending)
  const mostDependedOn = useMemo(() => {
    return [...data.files]
      .filter((f) => f.fanIn > 0)
      .sort((a, b) => b.fanIn - a.fanIn);
  }, [data.files]);

  // Ranked List 2: Files nothing imports at all (where reading starts)
  const whereReadingStarts = useMemo(() => {
    return [...data.files]
      .filter((f) => f.fanIn === 0)
      .sort((a, b) => b.fanOut - a.fanOut || a.path.localeCompare(b.path));
  }, [data.files]);

  // Repository-level mathematical insights
  const repositoryInsights = useMemo(() => {
    return computeInsights(data.files, data.edges);
  }, [data.files, data.edges]);

  // For a selected file: unique direct dependencies and dependents
  const fileConnections = useMemo(() => {
    if (!selection || selection.type !== "file") {
      return { dependencies: [], dependents: [] };
    }
    const currentPath = selection.file.path;
    const depSet = new Set<string>();
    const srcSet = new Set<string>();

    for (const edge of data.edges) {
      if (!edge.isResolved) continue;
      if (edge.sourcePath === currentPath) {
        depSet.add(edge.targetPath);
      }
      if (edge.targetPath === currentPath) {
        srcSet.add(edge.sourcePath);
      }
    }

    return {
      dependencies: Array.from(depSet).sort(),
      dependents: Array.from(srcSet).sort(),
    };
  }, [selection, data.edges]);

  // Transitive blast radius (everything that breaks if this file changes, depth 2)
  const blastRadius = useMemo(() => {
    if (!selection || selection.type !== "file") {
      return { items: [], totalCount: 0 };
    }
    return computeTransitiveWalk(
      selection.file.path,
      data.edges,
      "dependents",
      2
    );
  }, [selection, data.edges]);

  // Transitive dependency chain (everything this file needs, depth 2)
  const dependencyChain = useMemo(() => {
    if (!selection || selection.type !== "file") {
      return { items: [], totalCount: 0 };
    }
    return computeTransitiveWalk(
      selection.file.path,
      data.edges,
      "dependencies",
      2
    );
  }, [selection, data.edges]);

  // Insights that apply specifically to the selected file
  const activeFileInsights = useMemo(() => {
    if (!selection || selection.type !== "file") return [];
    const filePath = selection.file.path;
    const items: Array<{ title: string; sentence: string; extra?: string }> =
      [];

    if (
      repositoryInsights.unimported.files?.some((f) => f.path === filePath)
    ) {
      items.push({
        title: repositoryInsights.unimported.title,
        sentence: repositoryInsights.unimported.sentence,
      });
    }

    if (
      repositoryInsights.unusualFanIn.files?.some((f) => f.path === filePath)
    ) {
      items.push({
        title: repositoryInsights.unusualFanIn.title,
        sentence: repositoryInsights.unusualFanIn.sentence,
        extra: `Imported by ${selection.file.fanIn} files`,
      });
    }

    const cycleMatch = repositoryInsights.cycles.cycles?.find((c) =>
      c.members.includes(filePath)
    );
    if (cycleMatch) {
      items.push({
        title: repositoryInsights.cycles.title,
        sentence: repositoryInsights.cycles.sentence,
        extra: cycleMatch.chain.join(" → "),
      });
    }

    if (
      repositoryInsights.oversized.files?.some((f) => f.path === filePath)
    ) {
      items.push({
        title: repositoryInsights.oversized.title,
        sentence: repositoryInsights.oversized.sentence,
        extra: `${selection.file.lineCount.toLocaleString()} lines`,
      });
    }

    return items;
  }, [selection, repositoryInsights]);

  // For a selected folder: breakdown of categories inside it
  const folderCategoryBreakdown = useMemo(() => {
    if (!selection || selection.type !== "node") return [];
    const counts: Record<
      string,
      { name: string; color: string; count: number }
    > = {};

    for (const file of selection.node.files) {
      const cat = classifyFile(file.path);
      if (!counts[cat.id]) {
        counts[cat.id] = { name: cat.name, color: cat.color, count: 0 };
      }
      counts[cat.id].count++;
    }

    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [selection]);

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 flex flex-col overflow-hidden select-none">
      {/* Header Tabs */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-1 h-full">
          <button
            type="button"
            onClick={() => onTabChange("structure")}
            className={`h-full px-2.5 text-[11px] font-mono font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "structure"
                ? "border-blue-500 text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            Structure
          </button>
          <button
            type="button"
            onClick={() => onTabChange("explanation")}
            className={`h-full px-2.5 text-[11px] font-mono font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "explanation"
                ? "border-blue-500 text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            Explanation
          </button>
        </div>

        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          {selection ? selection.type : "repo"}
        </div>
      </div>

      {/* Pane Content Body */}
      <div className="flex-1 overflow-y-auto p-3 text-[11px] font-mono [scrollbar-width:thin]">
        {activeTab === "explanation" ? (
          /* Tab 2: Explanation (Empty state until model call) */
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-8 h-8 rounded border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2.5">
              AI
            </div>
            <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs mb-1 break-all">
              {selection
                ? selection.type === "file"
                  ? selection.file.name
                  : selection.node.label
                : repoName}
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-[210px] leading-relaxed">
              Explanation is an empty state for now — nothing fills it until
              there is a model call to fill it with.
            </p>
          </div>
        ) : !selection ? (
          /* Tab 1 (Resting State): Repository Summary */
          <div className="space-y-4">
            {/* Repo Title & Framework */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1">
                Repository
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                  {repoName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                  {framework}
                </span>
              </div>
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-2 gap-2 py-2 border-y border-zinc-100 dark:border-zinc-800/80">
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Files</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {data.files.length}
                </span>
              </div>
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Imports</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {internalEdgesCount}
                </span>
              </div>
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Routes</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {routeFilesCount}
                </span>
              </div>
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">
                  Unclassified
                </span>
                <span
                  className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                  title="Files no convention could identify"
                >
                  {unidentifiedFilesCount}
                </span>
              </div>
            </div>

            {/* Ranked List 1: Depended On Most */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Depended on most
                </span>
                <span className="text-[9px] text-zinc-400">
                  {mostDependedOn.length} files
                </span>
              </div>
              <p className="text-[10px] text-zinc-400/80 mb-2">
                What the rest of the repository leans on most
              </p>
              <div className="space-y-1">
                {mostDependedOn.slice(0, 10).map((file) => {
                  const cat = classifyFile(file.path);
                  const isHovered = hoveredFilePath === file.path;

                  return (
                    <button
                      type="button"
                      key={file.path}
                      onClick={() => onSelectFilePath(file.path)}
                      onMouseEnter={() => onHoverFilePath(file.path)}
                      onMouseLeave={() => onHoverFilePath(null)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                        isHovered
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                      }`}
                      title={file.path}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{file.path}</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] shrink-0 font-medium ml-2">
                        ↓{file.fanIn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ranked List 2: Where Reading Starts (fanIn === 0) */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Where reading starts
                </span>
                <span className="text-[9px] text-zinc-400">
                  {whereReadingStarts.length} files
                </span>
              </div>
              <p className="text-[10px] text-zinc-400/80 mb-2">
                Files nothing imports at all
              </p>
              <div className="space-y-1">
                {whereReadingStarts.slice(0, 10).map((file) => {
                  const cat = classifyFile(file.path);
                  const isHovered = hoveredFilePath === file.path;

                  return (
                    <button
                      type="button"
                      key={file.path}
                      onClick={() => onSelectFilePath(file.path)}
                      onMouseEnter={() => onHoverFilePath(file.path)}
                      onMouseLeave={() => onHoverFilePath(null)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                        isHovered
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                      }`}
                      title={file.path}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{file.path}</span>
                      </div>
                      {file.fanOut > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[10px] shrink-0 font-medium ml-2">
                          ↑{file.fanOut}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[9px] shrink-0 ml-2">
                          leaf
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Insights Panel: Starts collapsed, never the first thing seen */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setInsightsExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
                title="Toggle insights panel"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 font-mono">
                    {insightsExpanded ? "▾" : "▸"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-600 dark:text-zinc-300">
                    Insights
                  </span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {repositoryInsights.totalFindings} findings
                </span>
              </button>

              {insightsExpanded && (
                <div className="mt-2.5 space-y-4">
                  {/* 1. Files nothing imports (leads the list, excludes framework conventions) */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-semibold">
                        {repositoryInsights.unimported.title}
                      </span>
                      <span className="text-[9px] text-zinc-400 tabular-nums">
                        {repositoryInsights.unimported.count} files
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400/90 mb-1.5 leading-tight">
                      {repositoryInsights.unimported.sentence}
                    </p>
                    <div className="space-y-1 max-h-44 overflow-y-auto [scrollbar-width:thin]">
                      {repositoryInsights.unimported.files?.map((file) => {
                        const cat = classifyFile(file.path);
                        const isHovered = hoveredFilePath === file.path;

                        return (
                          <button
                            type="button"
                            key={file.path}
                            onClick={() => onSelectFilePath(file.path)}
                            onMouseEnter={() => onHoverFilePath(file.path)}
                            onMouseLeave={() => onHoverFilePath(null)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                              isHovered
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={file.path}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate">{file.path}</span>
                            </div>
                            {file.detail && (
                              <span className="text-[9px] text-zinc-400 font-mono shrink-0 ml-1.5">
                                {file.detail}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Files an unusual number of things import */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-semibold">
                        {repositoryInsights.unusualFanIn.title}
                      </span>
                      <span className="text-[9px] text-zinc-400 tabular-nums">
                        {repositoryInsights.unusualFanIn.count} files
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400/90 mb-1.5 leading-tight">
                      {repositoryInsights.unusualFanIn.sentence}
                    </p>
                    <div className="space-y-1 max-h-44 overflow-y-auto [scrollbar-width:thin]">
                      {repositoryInsights.unusualFanIn.files?.map((file) => {
                        const cat = classifyFile(file.path);
                        const isHovered = hoveredFilePath === file.path;

                        return (
                          <button
                            type="button"
                            key={file.path}
                            onClick={() => onSelectFilePath(file.path)}
                            onMouseEnter={() => onHoverFilePath(file.path)}
                            onMouseLeave={() => onHoverFilePath(null)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                              isHovered
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={file.path}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate">{file.path}</span>
                            </div>
                            {file.detail && (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono shrink-0 ml-1.5 font-medium">
                                {file.detail}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Import cycles */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-semibold">
                        {repositoryInsights.cycles.title}
                      </span>
                      <span className="text-[9px] text-zinc-400 tabular-nums">
                        {repositoryInsights.cycles.count} cycle
                        {repositoryInsights.cycles.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400/90 mb-1.5 leading-tight">
                      {repositoryInsights.cycles.sentence}
                    </p>
                    {repositoryInsights.cycles.count === 0 ? (
                      <div className="text-[10px] text-zinc-400 py-1 italic">
                        No cyclic dependencies detected.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {repositoryInsights.cycles.cycles?.map(
                          (cycle, cycleIdx) => (
                            <div
                              key={cycleIdx}
                              className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1"
                            >
                              <div className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                                Cycle #{cycleIdx + 1} ({cycle.chain.length - 1} hops)
                              </div>
                              <div className="space-y-1">
                                {cycle.chain
                                  .slice(0, cycle.chain.length - 1)
                                  .map((filePath, hopIdx) => {
                                    const isHovered =
                                      hoveredFilePath === filePath;

                                    return (
                                      <div key={hopIdx} className="space-y-0.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onSelectFilePath(filePath)
                                          }
                                          onMouseEnter={() =>
                                            onHoverFilePath(filePath)
                                          }
                                          onMouseLeave={() =>
                                            onHoverFilePath(null)
                                          }
                                          className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left cursor-pointer transition-colors ${
                                            isHovered
                                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30"
                                              : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                          }`}
                                          title={`Select ${filePath}`}
                                        >
                                          <span className="text-[9px] text-zinc-400 font-mono">
                                            {hopIdx + 1}.
                                          </span>
                                          <span className="truncate flex-1">
                                            {filePath}
                                          </span>
                                        </button>
                                        <div className="pl-4 text-[9px] text-zinc-400 font-mono">
                                          ↓ imports
                                        </div>
                                      </div>
                                    );
                                  })}
                                <div className="pl-4 text-[9px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                                  ↺ {cycle.chain[0]}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Files that are simply too long (oversized) */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-semibold">
                        {repositoryInsights.oversized.title}
                      </span>
                      <span className="text-[9px] text-zinc-400 tabular-nums">
                        {repositoryInsights.oversized.count} files
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400/90 mb-1.5 leading-tight">
                      {repositoryInsights.oversized.sentence}
                    </p>
                    <div className="space-y-1 max-h-44 overflow-y-auto [scrollbar-width:thin]">
                      {repositoryInsights.oversized.files?.map((file) => {
                        const cat = classifyFile(file.path);
                        const isHovered = hoveredFilePath === file.path;

                        return (
                          <button
                            type="button"
                            key={file.path}
                            onClick={() => onSelectFilePath(file.path)}
                            onMouseEnter={() => onHoverFilePath(file.path)}
                            onMouseLeave={() => onHoverFilePath(null)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                              isHovered
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={file.path}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate">{file.path}</span>
                            </div>
                            {file.detail && (
                              <span className="text-zinc-400 text-[9px] font-mono shrink-0 ml-1.5">
                                {file.detail}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : selection.type === "node" ? (
          /* Tab 1: Selected Folder State */
          <div className="space-y-4">
            <div>
              <button
                type="button"
                onClick={onDeselect}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-2 flex items-center gap-1 cursor-pointer"
              >
                ← Repository overview
              </button>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1">
                Folded Folder
              </span>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs break-all">
                {selection.node.label}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5 break-all">
                {selection.node.fullPath}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-100 dark:border-zinc-800/80">
              <div>
                <span className="text-[10px] text-zinc-400 block">Files</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {selection.node.fileCount}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Fan-In</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {selection.node.fanIn}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Fan-Out</span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {selection.node.fanOut}
                </span>
              </div>
            </div>

            {/* Folder Content Breakdown by Category */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1.5">
                Categories inside
              </span>
              <div className="flex flex-wrap gap-1.5">
                {folderCategoryBreakdown.map((cat) => (
                  <div
                    key={cat.name}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px]"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 font-semibold">
                      {cat.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Files inside this folder */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1.5">
                Files ({selection.node.files.length})
              </span>
              <div className="space-y-1">
                {selection.node.files.map((f) => {
                  const isHovered = hoveredFilePath === f.path;

                  return (
                    <button
                      type="button"
                      key={f.path}
                      onClick={() => onSelectFilePath(f.path)}
                      onMouseEnter={() => onHoverFilePath(f.path)}
                      onMouseLeave={() => onHoverFilePath(null)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                        isHovered
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                      }`}
                      title={f.path}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: f.color }}
                        />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-400 shrink-0 ml-2">
                        {f.fanIn > 0 && (
                          <span className="text-emerald-600/80 dark:text-emerald-400/80">
                            ↓{f.fanIn}
                          </span>
                        )}
                        {f.fanOut > 0 && (
                          <span className="text-amber-600/80 dark:text-amber-400/80">
                            ↑{f.fanOut}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Tab 1: Selected File State */
          <div className="space-y-4">
            <div>
              <button
                type="button"
                onClick={onDeselect}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-2 flex items-center gap-1 cursor-pointer"
              >
                ← Repository overview
              </button>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1">
                File Details
              </span>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs break-all">
                {selection.file.name}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5 break-all">
                {selection.file.path}
              </div>
            </div>

            {/* Applicable Insights for this file */}
            {activeFileInsights.length > 0 && (
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                  Insight fact
                </span>
                {activeFileInsights.map((fi, i) => (
                  <div key={i} className="text-[10px] leading-snug">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {fi.sentence}
                    </span>
                    {fi.extra && (
                      <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {fi.extra}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Category and Line Count */}
            <div className="flex items-center justify-between py-1.5 border-y border-zinc-100 dark:border-zinc-800/80 text-[10px]">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: selection.file.color }}
                />
                <span>{selection.file.category}</span>
              </div>
              <span className="text-zinc-500 dark:text-zinc-400">
                {selection.file.lineCount} lines
              </span>
            </div>

            {/* Direct Dependencies & Dependents Count Bar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">
                  Dependencies
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  ↑ {fileConnections.dependencies.length}
                </span>
              </div>
              <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">
                  Dependents
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ↓ {fileConnections.dependents.length}
                </span>
              </div>
            </div>

            {/* Graph Action Buttons: Blast Radius & Dependency Chain */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveWalk((prev) => (prev === "blast" ? null : "blast"))
                }
                className={`px-2 py-1.5 rounded text-[10px] font-mono font-medium border text-center transition-colors cursor-pointer ${
                  activeWalk === "blast"
                    ? "bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-200 ring-1 ring-rose-500/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                }`}
                title="Calculate everything that breaks if this file changes (2 levels deep)"
              >
                Blast radius
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveWalk((prev) =>
                    prev === "dependencies" ? null : "dependencies"
                  )
                }
                className={`px-2 py-1.5 rounded text-[10px] font-mono font-medium border text-center transition-colors cursor-pointer ${
                  activeWalk === "dependencies"
                    ? "bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-950/60 dark:border-amber-600 dark:text-amber-200 ring-1 ring-amber-500/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                }`}
                title="Calculate everything this file needs (2 levels deep)"
              >
                Dependency chain
              </button>
            </div>

            {/* Dynamic View: Active Walk or Direct Neighbor Lists */}
            {activeWalk === "blast" ? (
              /* View: Blast Radius */
              <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold block">
                      Blast radius ({blastRadius.totalCount})
                    </span>
                    <span className="text-[9px] text-zinc-400">
                      Everything that breaks if this file changes (2 levels)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveWalk(null)}
                    className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    close
                  </button>
                </div>

                {blastRadius.items.length === 0 ? (
                  <div className="text-[10px] text-zinc-400 py-1 italic">
                    Nothing breaks if this file changes (leaf file).
                  </div>
                ) : (
                  <div className="space-y-1">
                    {blastRadius.items.map((item) => {
                      const cat = classifyFile(item.path);
                      const isHovered = hoveredFilePath === item.path;

                      return (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => onSelectFilePath(item.path)}
                          onMouseEnter={() => onHoverFilePath(item.path)}
                          onMouseLeave={() => onHoverFilePath(null)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                            isHovered
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                          }`}
                          title={item.path}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{item.path}</span>
                          </div>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 ml-1.5">
                            hop {item.depth}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeWalk === "dependencies" ? (
              /* View: Dependency Chain */
              <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold block">
                      Dependency chain ({dependencyChain.totalCount})
                    </span>
                    <span className="text-[9px] text-zinc-400">
                      Everything this file needs (2 levels)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveWalk(null)}
                    className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    close
                  </button>
                </div>

                {dependencyChain.items.length === 0 ? (
                  <div className="text-[10px] text-zinc-400 py-1 italic">
                    This file has no dependencies.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dependencyChain.items.map((item) => {
                      const cat = classifyFile(item.path);
                      const isHovered = hoveredFilePath === item.path;

                      return (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => onSelectFilePath(item.path)}
                          onMouseEnter={() => onHoverFilePath(item.path)}
                          onMouseLeave={() => onHoverFilePath(null)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                            isHovered
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                          }`}
                          title={item.path}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{item.path}</span>
                          </div>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 ml-1.5">
                            hop {item.depth}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* View: Direct Dependencies & Dependents */
              <>
                {/* Full List of Dependencies (Imports) */}
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1">
                    Depends on ({fileConnections.dependencies.length})
                  </span>
                  {fileConnections.dependencies.length === 0 ? (
                    <div className="text-[10px] text-zinc-400 py-1 italic">
                      None (leaf file)
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {fileConnections.dependencies.map((targetPath) => {
                        const cat = classifyFile(targetPath);
                        const isHovered = hoveredFilePath === targetPath;

                        return (
                          <button
                            type="button"
                            key={targetPath}
                            onClick={() => onSelectFilePath(targetPath)}
                            onMouseEnter={() => onHoverFilePath(targetPath)}
                            onMouseLeave={() => onHoverFilePath(null)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                              isHovered
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/40"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={targetPath}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{targetPath}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Full List of Dependents (Imported by) */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-1">
                    Depended on by ({fileConnections.dependents.length})
                  </span>
                  {fileConnections.dependents.length === 0 ? (
                    <div className="text-[10px] text-zinc-400 py-1 italic">
                      None (entry point)
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {fileConnections.dependents.map((sourcePath) => {
                        const cat = classifyFile(sourcePath);
                        const isHovered = hoveredFilePath === sourcePath;

                        return (
                          <button
                            type="button"
                            key={sourcePath}
                            onClick={() => onSelectFilePath(sourcePath)}
                            onMouseEnter={() => onHoverFilePath(sourcePath)}
                            onMouseLeave={() => onHoverFilePath(null)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left cursor-pointer transition-colors ${
                              isHovered
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/40"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={sourcePath}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{sourcePath}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
