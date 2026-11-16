/**
 * 响应语言门禁（scripts/docs/check-response-language.ts）
 * ------------------------------------------------------------
 * 约定：返回给前端的 msg / message 必须是英文标识，中文由前端 i18n 负责。
 * 扫描范围：controller / BaseController / 错误中间件的响应出口，以及 MESSAGE_CODE 的值。
 * 只检查字符串字面量；注释、Swagger 描述、日志文案不在检查范围。
 * 用法：npm run check:response
 */

import fs from "fs";
import path from "path";
import ts from "typescript";

const ROOT = process.cwd();
const TARGET_ROOTS = ["src/modules", "src/base", "src/middleware"];
const RESPONSE_METHODS = new Set(["ok", "fail", "failWithData", "failJoi", "sendError", "json"]);
const CJK = /[\u4e00-\u9fff]/;

interface Finding {
  file: string;
  line: number;
  text: string;
}

/** 递归收集 .ts 文件 */
function collectFiles(dir: string, result: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, result);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      result.push(full);
    }
  }
}

/** 取字符串字面量的文本；无插值模板同样视为静态文本 */
function staticText(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

/** 检查对象字面量中的 msg / message 字段 */
function inspectObject(node: ts.Expression, file: string, findings: Finding[]): void {
  if (!ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText();
    if (name !== "msg" && name !== "message") continue;
    const text = staticText(property.initializer);
    if (text && CJK.test(text)) {
      const line = property.getSourceFile().getLineAndCharacterOfPosition(property.getStart()).line + 1;
      findings.push({ file, line, text });
    }
  }
}

/** 扫描单个源文件 */
function scanFile(file: string, findings: Finding[]): void {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const methodName = ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
      if (methodName && RESPONSE_METHODS.has(methodName)) {
        for (const arg of node.arguments) {
          const text = staticText(arg);
          if (text && CJK.test(text)) {
            const line = sourceFile.getLineAndCharacterOfPosition(arg.getStart()).line + 1;
            findings.push({ file, line, text });
          }
          inspectObject(arg, file, findings);
        }
      }
    }

    if (ts.isNewExpression(node)) {
      const name = node.expression.getText();
      if (name === "BusinessError") {
        const messageArg = node.arguments?.[1];
        const text = messageArg ? staticText(messageArg) : undefined;
        if (text && CJK.test(text)) {
          const line = sourceFile.getLineAndCharacterOfPosition(messageArg!.getStart()).line + 1;
          findings.push({ file, line, text });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

/** 校验 MESSAGE_CODE 的值必须是英文大写下划线标识 */
function scanMessageCodes(findings: Finding[]): void {
  const file = path.join(ROOT, "src/constants/messageCode.ts");
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "MESSAGE_CODE") {
      const init = node.initializer;
      if (init && ts.isObjectLiteralExpression(init)) {
        for (const property of init.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const text = staticText(property.initializer);
          if (text && !/^[A-Z0-9_]+$/.test(text)) {
            const line = sourceFile.getLineAndCharacterOfPosition(property.getStart()).line + 1;
            findings.push({ file, line, text });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function main(): void {
  const findings: Finding[] = [];
  const files: string[] = [];
  for (const root of TARGET_ROOTS) {
    collectFiles(path.join(ROOT, root), files);
  }

  for (const file of files) {
    scanFile(file, findings);
  }
  scanMessageCodes(findings);

  if (findings.length > 0) {
    console.error("[check:response] Chinese text found in response sinks:");
    for (const item of findings) {
      console.error(`  ${path.relative(ROOT, item.file)}:${item.line} -> ${item.text}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[check:response] OK (${files.length} files scanned)`);
}

main();
