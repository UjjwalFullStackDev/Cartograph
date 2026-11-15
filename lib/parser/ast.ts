import { Project, SyntaxKind, Node } from "ts-morph";
import type { ImportKind } from "./types";

export interface ExtractedReference {
  specifier: string;
  kind: ImportKind;
  isLiteral: boolean;
  rawExpression?: string;
}

/**
 * Reusable in-memory ts-morph project for parsing syntax trees without disk overhead.
 */
const sharedProject = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: {
    allowJs: true,
  },
});

/**
 * Parses file contents and extracts all static imports, re-exports, and dynamic imports.
 *
 * Rules:
 * 1. Plain imports (import ... from '...') become edges of kind 'import'.
 * 2. Re-exports (export ... from '...') become edges of kind 're-export'.
 * 3. Dynamic imports with literal strings (import('...')) become edges of kind 'dynamic-import'.
 * 4. Dynamic imports with non-literal expressions are flagged so coverage logs them as unresolvable.
 */
export function extractFileReferences(
  filePath: string,
  content: string
): ExtractedReference[] {
  const references: ExtractedReference[] = [];

  // Create virtual source file in memory
  const sourceFile = sharedProject.createSourceFile(
    `virtual://${filePath}`,
    content,
    { overwrite: true }
  );

  try {
    // 1. Plain static imports: import ... from '...' and import '...'
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      if (specifier) {
        references.push({
          specifier,
          kind: "import",
          isLiteral: true,
        });
      }
    }

    // 2. Re-exports: export { x } from '...', export * from '...'
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      if (exportDecl.hasModuleSpecifier()) {
        const specifier = exportDecl.getModuleSpecifierValue();
        if (specifier) {
          references.push({
            specifier,
            kind: "re-export",
            isLiteral: true,
          });
        }
      }
    }

    // 3. Dynamic imports: import('...')
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExpressions) {
      if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (
            Node.isStringLiteral(firstArg) ||
            Node.isNoSubstitutionTemplateLiteral(firstArg)
          ) {
            references.push({
              specifier: firstArg.getLiteralValue(),
              kind: "dynamic-import",
              isLiteral: true,
            });
          } else {
            // Dynamic import with variable or template expression
            references.push({
              specifier: firstArg.getText(),
              kind: "dynamic-import",
              isLiteral: false,
              rawExpression: firstArg.getText(),
            });
          }
        }
      }
    }
  } finally {
    // Clean up memory
    sharedProject.removeSourceFile(sourceFile);
  }

  return references;
}

