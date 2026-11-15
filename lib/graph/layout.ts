import dagre from "dagre";
import type { FoldedFolderNode, GraphEdge } from "./types";

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getNodeDimensions(
  node: FoldedFolderNode,
  isOpen: boolean
): { width: number; height: number } {
  if (!isOpen) {
    return {
      width: node.width,
      height: node.height,
    };
  }

  // Open panel:
  // Header: 40px
  // Visible files: min(files.length, 12) * 26px (scrollable beyond 12)
  // Padding & borders: 8px
  const visibleCount = Math.min(node.files.length, 12);
  const height = 40 + visibleCount * 26 + 8;
  const width = Math.max(node.width, 280);

  return { width, height };
}

export function calculateDeterministicLayout(
  nodes: FoldedFolderNode[],
  edges: GraphEdge[],
  openNodeIds: Set<string>
): Map<string, NodePosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR", // Left to right flow
    nodesep: 48,   // Vertical space between adjacent nodes
    ranksep: 96,   // Horizontal space between ranks
    align: "UL",
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add all nodes with their calculated size
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const node of sortedNodes) {
    const isOpen = openNodeIds.has(node.id);
    const { width, height } = getNodeDimensions(node, isOpen);
    g.setNode(node.id, { width, height });
  }

  // Add deduplicated inter-node edges for rank calculation
  const seenEdgePairs = new Set<string>();
  const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of sortedEdges) {
    if (edge.sourceNodeId !== edge.targetNodeId) {
      const pairKey = `${edge.sourceNodeId}->${edge.targetNodeId}`;
      if (!seenEdgePairs.has(pairKey)) {
        seenEdgePairs.add(pairKey);
        g.setEdge(edge.sourceNodeId, edge.targetNodeId);
      }
    }
  }

  dagre.layout(g);

  const positions = new Map<string, NodePosition>();
  for (const node of sortedNodes) {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      const isOpen = openNodeIds.has(node.id);
      const { width, height } = getNodeDimensions(node, isOpen);
      positions.set(node.id, {
        x: Math.round(dagreNode.x - width / 2),
        y: Math.round(dagreNode.y - height / 2),
        width,
        height,
      });
    }
  }

  return positions;
}

