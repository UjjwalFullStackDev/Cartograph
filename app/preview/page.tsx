import * as fs from "node:fs";
import * as path from "node:path";
import type { Metadata } from "next";
import type { AnalysisResult } from "@/lib/parser/types";
import { CanvasShell } from "@/components/shell/canvas-shell";

export const metadata: Metadata = {
  title: "Preview Canvas | Cartograph",
  description: "Repository dependency canvas preview",
};

function loadPreviewData(): AnalysisResult | null {
  try {
    const dataPath = path.join(process.cwd(), "data", "preview-analysis.json");
    if (!fs.existsSync(dataPath)) {
      return null;
    }
    const raw = fs.readFileSync(dataPath, "utf-8");
    return JSON.parse(raw) as AnalysisResult;
  } catch (err) {
    console.error("Failed to read preview analysis data:", err);
    return null;
  }
}

export default function PreviewPage() {
  const data = loadPreviewData();

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center font-mono">
        <p className="text-xs font-semibold text-rose-500">
          Preview data missing
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Run parser with --output data/preview-analysis.json to generate the data contract.
        </p>
      </div>
    );
  }

  return <CanvasShell data={data} />;
}

