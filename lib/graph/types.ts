export interface FoldedNodeFile {
  path: string;
  name: string;
  category: string;
  color: string;
  lineCount: number;
  fanIn: number;
  fanOut: number;
}

export interface FoldedFolderNode {
  id: string; // Directory posix path (e.g. "src/stock/controllers" or ".")
  label: string; // Shortest unique label
  fullPath: string; // Original directory path
  files: FoldedNodeFile[];
  fileCount: number;
  fanIn: number; // Unique files/nodes outside this folder that depend on files inside it
  fanOut: number; // Unique files/nodes outside this folder that this folder depends on
  height: number; // Calculated from fan-in
  width: number; // Calculated from label length
  isOpen: boolean; // Whether the folder is expanded into an open panel
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceFilePath: string;
  targetFilePath: string;
  specifier: string;
  kind: string;
}

export interface FoldedGraphResult {
  nodes: FoldedFolderNode[];
  edges: GraphEdge[];
  thresholdUsed: number;
  nodeCount: number;
  fileCount: number;
  edgeCount: number;
}

