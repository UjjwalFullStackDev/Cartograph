import { runCli } from "../lib/parser/cli";

runCli(process.argv.slice(2)).catch((err: unknown) => {
  console.error("Parser failed:", err);
  process.exit(1);
});

