import path from "node:path";
import MagicString from "magic-string";
import { parseSync } from "oxc-parser";

export interface IconAsset {
  file: string;
}

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

interface IconUse {
  node: AstNode;
  localName: string;
  iconName: string;
  asset: IconAsset;
}

interface MarkerImport {
  declaration: AstNode;
  specifier: AstNode;
  specifiers: AstNode[];
  localName: string;
}

export class IconTransformError extends Error {
  readonly pos: number;

  constructor(pos: number, message: string) {
    super(message);
    this.name = "IconTransformError";
    this.pos = pos;
  }
}

const TYPE_ONLY_NODE_KEYS = new Set([
  "typeAnnotation",
  "typeParameters",
  "typeArguments",
  "returnType",
  "superTypeArguments",
  "superTypeParameters",
  "implements",
]);

export function transformIcons(
  source: string,
  filename: string,
  icons: Map<string, IconAsset>,
): { code: string; map: ReturnType<MagicString["generateMap"]> } | null {
  if (!source.includes("semion")) return null;

  const parsed = parseSync(filename, source, {
    lang: languageFor(filename),
    sourceType: "module",
    preserveParens: true,
  });
  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]!;
    const position = firstError.labels[0]?.start ?? 0;
    throw new IconTransformError(
      position,
      "Could not parse module for Semion: " + firstError.message,
    );
  }
  const program = parsed.program as unknown as AstNode;
  const markerImports = collectMarkerImports(program);
  if (markerImports.size === 0) return null;

  const uses: IconUse[] = [];
  const identifiers = new Set<string>();
  const importedLocalSpans = new Set(
    [...markerImports.values()].map(
      (imported) => imported.specifier.local.start + ":" + imported.specifier.local.end,
    ),
  );
  const escapedLocals = new Set<string>();
  walkWithScopes(program, [], (node, scopes) => {
    if (node.type === "Identifier" || node.type === "JSXIdentifier") {
      identifiers.add(node.name);
    }
    if (
      node.type === "Identifier" &&
      markerImports.has(node.name) &&
      !scopes.some((scope) => scope.has(node.name)) &&
      !importedLocalSpans.has(node.start + ":" + node.end)
    ) {
      escapedLocals.add(node.name);
    }
    if (node.type !== "JSXElement") return;
    const openingName = node.openingElement?.name;
    if (!openingName || openingName.type !== "JSXIdentifier") return;
    const imported = markerImports.get(openingName.name);
    if (!imported || scopes.some((scope) => scope.has(openingName.name))) return;

    const attributes = node.openingElement.attributes as AstNode[];
    const nameAttributes = attributes.filter(
      (attribute) =>
        attribute.type === "JSXAttribute" &&
        jsxAttributeName(attribute.name) === "name",
    );
    if (nameAttributes.length !== 1) {
      throw new IconTransformError(
        openingName.start,
        nameAttributes.length === 0
          ? 'Icon requires a static name attribute such as name="search".'
          : "Icon accepts exactly one name attribute.",
      );
    }
    const nameAttribute = nameAttributes[0] as AstNode;
    const iconName = staticStringAttribute(nameAttribute);
    if (iconName === undefined) {
      throw new IconTransformError(
        nameAttribute.start,
        'Icon names must be string literals, for example name="search".',
      );
    }
    const asset = icons.get(iconName);
    if (!asset) {
      throw new IconTransformError(
        nameAttribute.start,
        "Unknown icon " +
          JSON.stringify(iconName) +
          ". Check the SVG filenames in the configured icon directory.",
      );
    }
    uses.push({ node, localName: openingName.name, iconName, asset });
  });

  if (uses.length === 0) return null;

  const usedLocals = new Set(uses.map((use) => use.localName));
  const magic = new MagicString(source);
  const importedAssets = new Map<string, string>();
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const helperName = uniqueName(identifiers, "__semionIconProps");
  const insertion = insertionOffset(program, source);

  for (const use of uses) {
    let assetName = importedAssets.get(use.iconName);
    if (!assetName) {
      assetName = uniqueName(identifiers, "__semionIcon" + importedAssets.size);
      importedAssets.set(use.iconName, assetName);
    }

    const opening = use.node.openingElement as AstNode;
    const props = (opening.attributes as AstNode[])
      .filter(
        (attribute) =>
          !(attribute.type === "JSXAttribute" && jsxAttributeName(attribute.name) === "name"),
      )
      .map((attribute) => renderAttribute(source, attribute))
      .filter(Boolean);
    const isSelfClosing = Boolean(opening.selfClosing);
    const openingText =
      "<span {..." +
      helperName +
      "({" +
      props.join(", ") +
      "}, " +
      assetName +
      ")}" +
      (isSelfClosing ? " />" : ">");

    edits.push({ start: opening.start, end: opening.end, text: openingText });
    if (use.node.closingElement?.name) {
      const closingName = use.node.closingElement.name as AstNode;
      edits.push({ start: closingName.start, end: closingName.end, text: "span" });
    }
  }

  const removableLocals = new Set(
    [...usedLocals].filter((localName) => !escapedLocals.has(localName)),
  );
  edits.push(...removeMarkerImports(source, markerImports, removableLocals));

  for (const [iconName, localName] of importedAssets) {
    const asset = icons.get(iconName) as IconAsset;
    const relative = slash(path.relative(path.dirname(filename), asset.file));
    const specifier = relative.startsWith(".") ? relative : "./" + relative;
    edits.push({
      start: insertion,
      end: insertion,
      text:
        "import " +
        localName +
        " from " +
        JSON.stringify(specifier + "?no-inline") +
        ";\n",
    });
  }

  const helper =
    "function " +
    helperName +
    "(props, asset) {\n" +
    "  const result = { ...props };\n" +
    "  delete result.name;\n" +
    "  const mask = \"url(\" + JSON.stringify(asset) + \")\";\n" +
    "  return {\n" +
    "    ...result,\n" +
    "    className: result.className ? \"semion-icon \" + result.className : \"semion-icon\",\n" +
    "    style: { ...result.style, maskImage: mask, WebkitMaskImage: mask },\n" +
    "  };\n" +
    "}\n";
  edits.push({ start: insertion, end: insertion, text: helper });

  edits.sort((left, right) => right.start - left.start || right.end - left.end);
  for (const edit of edits) {
    if (edit.start === edit.end) magic.appendLeft(edit.start, edit.text);
    else magic.overwrite(edit.start, edit.end, edit.text);
  }

  return {
    code: magic.toString(),
    map: magic.generateMap({ source: filename, includeContent: true, hires: "boundary" }),
  };
}

function collectMarkerImports(program: AstNode): Map<string, MarkerImport> {
  const imports = new Map<string, MarkerImport>();
  for (const declaration of program.body as AstNode[]) {
    if (
      declaration.type !== "ImportDeclaration" ||
      declaration.source?.value !== "semion" ||
      declaration.importKind === "type"
    ) {
      continue;
    }
    const specifiers = (declaration.specifiers ?? []) as AstNode[];
    for (const specifier of specifiers) {
      if (
        specifier.type !== "ImportSpecifier" ||
        specifier.importKind === "type" ||
        importedName(specifier.imported) !== "Icon"
      ) {
        continue;
      }
      const localName = specifier.local.name as string;
      imports.set(localName, { declaration, specifier, specifiers, localName });
    }
  }
  return imports;
}

function importedName(node: AstNode): string | undefined {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return undefined;
}

function staticStringAttribute(attribute: AstNode): string | undefined {
  const value = attribute.value;
  if (value?.type === "Literal" && typeof value.value === "string") return value.value;
  const expression = value?.type === "JSXExpressionContainer" ? value.expression : undefined;
  if (expression?.type === "Literal" && typeof expression.value === "string") {
    return expression.value;
  }
  return undefined;
}

function jsxAttributeName(node: AstNode): string {
  if (node.type === "JSXNamespacedName") {
    return node.namespace.name + ":" + node.name.name;
  }
  return String(node.name);
}

function renderAttribute(source: string, attribute: AstNode): string {
  if (attribute.type === "JSXSpreadAttribute") {
    const argument = attribute.argument as AstNode;
    return "..." + source.slice(argument.start, argument.end);
  }
  if (attribute.type !== "JSXAttribute") {
    throw new IconTransformError(attribute.start, "Unsupported JSX attribute syntax on Icon.");
  }
  const name = jsxAttributeName(attribute.name);
  const propertyName = "[" + JSON.stringify(name) + "]";
  if (attribute.value == null) return propertyName + ": true";
  if (attribute.value.type === "Literal" && typeof attribute.value.value === "string") {
    return propertyName + ": " + JSON.stringify(attribute.value.value);
  }
  if (attribute.value.type === "JSXExpressionContainer") {
    const expression = attribute.value.expression as AstNode;
    if (expression.type === "JSXEmptyExpression") {
      throw new IconTransformError(
        attribute.start,
        "Empty JSX expressions are not valid Icon props.",
      );
    }
    return propertyName + ": " + source.slice(expression.start, expression.end);
  }
  throw new IconTransformError(attribute.start, "Unsupported JSX attribute value on Icon.");
}

function removeMarkerImports(
  source: string,
  imports: Map<string, MarkerImport>,
  usedLocals: Set<string>,
): Array<{ start: number; end: number; text: string }> {
  const byDeclaration = new Map<AstNode, MarkerImport[]>();
  for (const imported of imports.values()) {
    if (!usedLocals.has(imported.localName)) continue;
    const group = byDeclaration.get(imported.declaration) ?? [];
    group.push(imported);
    byDeclaration.set(imported.declaration, group);
  }

  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const [declaration, selected] of byDeclaration) {
    const specifiers = selected[0]!.specifiers;
    const selectedIndexes = new Set(
      selected.map((item) => specifiers.indexOf(item.specifier)),
    );
    if (selectedIndexes.size === specifiers.length) {
      edits.push({ start: declaration.start, end: declaration.end, text: "" });
      continue;
    }

    const runs: Array<[number, number]> = [];
    for (const index of [...selectedIndexes].sort((left, right) => left - right)) {
      const last = runs[runs.length - 1];
      if (last && index === last[1] + 1) last[1] = index;
      else runs.push([index, index]);
    }
    for (const [first, last] of runs) {
      if (last < specifiers.length - 1) {
        edits.push({
          start: specifiers[first]!.start,
          end: specifiers[last + 1]!.start,
          text: "",
        });
      } else {
        const previous = specifiers[first - 1] as AstNode;
        const gap = source.slice(previous.end, specifiers[first]!.start);
        const comma = gap.lastIndexOf(",");
        edits.push({
          start: previous.end + comma,
          end: specifiers[last]!.end,
          text: "",
        });
      }
    }
  }
  return edits;
}

function insertionOffset(program: AstNode, source: string): number {
  let offset = 0;
  if (program.hashbang) {
    offset = program.hashbang.end;
    if (source[offset] === "\r") offset += source[offset + 1] === "\n" ? 2 : 1;
    else if (source[offset] === "\n") offset += 1;
  }
  for (const directive of (program.directives ?? []) as AstNode[]) {
    offset = Math.max(offset, directive.end);
  }
  return offset;
}

function uniqueName(names: Set<string>, base: string): string {
  if (!names.has(base)) {
    names.add(base);
    return base;
  }
  let suffix = 2;
  while (names.has(base + suffix)) suffix += 1;
  const name = base + suffix;
  names.add(name);
  return name;
}

function languageFor(filename: string): "js" | "jsx" | "ts" | "tsx" {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".tsx") return "tsx";
  if (extension === ".jsx") return "jsx";
  if (extension === ".ts" || extension === ".mts" || extension === ".cts") return "ts";
  return "js";
}

function slash(value: string): string {
  return value.split(path.sep).join("/");
}

function walkWithScopes(
  root: AstNode,
  inheritedScopes: Set<string>[],
  visit: (node: AstNode, scopes: Set<string>[]) => void,
): void {
  const walk = (value: unknown, scopes: Set<string>[]): void => {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, scopes);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as AstNode;
    if (typeof node.type !== "string") return;

    visit(node, scopes);

    if (isFunction(node)) {
      const bindings = new Set<string>();
      if (node.id?.name) bindings.add(node.id.name);
      for (const parameter of (node.params ?? []) as AstNode[]) {
        collectPatternBindings(parameter, bindings);
      }
      collectVarBindings(node.body, bindings);
      walkChildren(node, scopes.concat(bindings), walk);
      return;
    }

    if (node.type === "BlockStatement") {
      const bindings = collectLexicalBindings(node.body as AstNode[]);
      walkChildren(node, scopes.concat(bindings), walk);
      return;
    }

    if (node.type === "CatchClause") {
      const bindings = new Set<string>();
      if (node.param) collectPatternBindings(node.param as AstNode, bindings);
      walkChildren(node, scopes.concat(bindings), walk);
      return;
    }

    if (
      node.type === "ForStatement" ||
      node.type === "ForInStatement" ||
      node.type === "ForOfStatement"
    ) {
      const bindings = new Set<string>();
      const left = node.type === "ForStatement" ? node.init : node.left;
      if (left?.type === "VariableDeclaration" && left.kind !== "var") {
        for (const declaration of left.declarations as AstNode[]) {
          collectPatternBindings(declaration.id as AstNode, bindings);
        }
      }
      walkChildren(node, bindings.size ? scopes.concat(bindings) : scopes, walk);
      return;
    }

    if (node.type === "SwitchStatement") {
      const bindings = new Set<string>();
      for (const clause of node.cases as AstNode[]) {
        collectLexicalBindings(clause.consequent as AstNode[], bindings);
      }
      walkChildren(node, scopes.concat(bindings), walk);
      return;
    }

    if (node.type === "ClassExpression" && node.id?.name) {
      walkChildren(node, scopes.concat(new Set([node.id.name])), walk);
      return;
    }

    walkChildren(node, scopes, walk);
  };

  walk(root, inheritedScopes);
}

function walkChildren(
  node: AstNode,
  scopes: Set<string>[],
  walk: (value: unknown, scopes: Set<string>[]) => void,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (
      key === "type" ||
      key === "start" ||
      key === "end" ||
      key === "range" ||
      key === "loc" ||
      TYPE_ONLY_NODE_KEYS.has(key)
    ) {
      continue;
    }
    walk(value, scopes);
  }
}

function isFunction(node: AstNode): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function collectLexicalBindings(
  statements: AstNode[],
  bindings = new Set<string>(),
): Set<string> {
  for (const statement of statements) {
    if (statement.type === "VariableDeclaration" && statement.kind !== "var") {
      for (const declaration of statement.declarations as AstNode[]) {
        collectPatternBindings(declaration.id as AstNode, bindings);
      }
    } else if (
      (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") &&
      statement.id?.name
    ) {
      bindings.add(statement.id.name);
    }
  }
  return bindings;
}

function collectVarBindings(node: unknown, bindings: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collectVarBindings(child, bindings);
    return;
  }
  if (!node || typeof node !== "object") return;
  const current = node as AstNode;
  if (
    typeof current.type !== "string" ||
    isFunction(current) ||
    current.type === "ClassDeclaration" ||
    current.type === "ClassExpression"
  ) {
    return;
  }
  if (current.type === "VariableDeclaration" && current.kind === "var") {
    for (const declaration of current.declarations as AstNode[]) {
      collectPatternBindings(declaration.id as AstNode, bindings);
    }
  }
  for (const [key, value] of Object.entries(current)) {
    if (key === "type" || key === "start" || key === "end" || TYPE_ONLY_NODE_KEYS.has(key)) continue;
    collectVarBindings(value, bindings);
  }
}

function collectPatternBindings(node: AstNode, bindings: Set<string>): void {
  if (node.type === "Identifier") {
    bindings.add(node.name);
  } else if (node.type === "RestElement") {
    collectPatternBindings(node.argument as AstNode, bindings);
  } else if (node.type === "AssignmentPattern") {
    collectPatternBindings(node.left as AstNode, bindings);
  } else if (node.type === "ArrayPattern") {
    for (const element of node.elements as Array<AstNode | null>) {
      if (element) collectPatternBindings(element, bindings);
    }
  } else if (node.type === "ObjectPattern") {
    for (const property of node.properties as AstNode[]) {
      collectPatternBindings(
        (property.type === "RestElement" ? property.argument : property.value) as AstNode,
        bindings,
      );
    }
  } else if (node.type === "TSParameterProperty") {
    collectPatternBindings(node.parameter as AstNode, bindings);
  }
}
