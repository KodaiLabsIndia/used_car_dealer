import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../apps/mobile/", import.meta.url));
const failures = [];
function scan(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    const child =
      ts.isJsxText(node) && node.text.trim()
        ? node
        : ts.isJsxExpression(node) &&
            node.expression &&
            ts.isStringLiteral(node.expression) &&
            node.expression.text.length
          ? node
          : null;
    if (
      child &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      let parent = node.parent;
      while (parent && ts.isJsxFragment(parent)) parent = parent.parent;
      const tag =
        parent && ts.isJsxElement(parent)
          ? parent.openingElement.tagName.getText(source)
          : "fragment";
      if (!["Text", "NativeText"].includes(tag)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        failures.push(
          `${path.relative(root, file)}:${line}: Put text inside Text, not ${tag}.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function directory(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) directory(file);
    else if (file.endsWith(".tsx")) scan(file);
  }
}
scan(path.join(root, "App.tsx"));
directory(path.join(root, "src"));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("Native text placement passed.");
