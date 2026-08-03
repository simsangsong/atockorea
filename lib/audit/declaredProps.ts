/**
 * Props a component declares and never reads — the general scanner.
 *
 * The narrow version of this defect cost the guide console its answer to "has
 * the driver opened the link?": `GuideConsole` declared `participants` on its
 * room type, the route had always sent it, every poll carried it, and the
 * component referenced the name exactly once — in the type. `qa-caller-absence`
 * cannot see that shape at all. The component is imported and rendered, and the
 * field genuinely exists in the payload. The dominant defect of this track, one
 * layer below a module: a FIELD with no consumer.
 *
 * ## Why this is built for precision, not recall
 *
 * The plan flagged the risk plainly: a wide version written in a hurry drowns in
 * rest/spread and destructuring false positives, gets muted, and then protects
 * nothing. Every rule below therefore prefers a MISS to a false alarm.
 *
 *   · Parsed, not grepped. A brace-counting scanner in this repo has already
 *     been broken by a curly brace inside a comment; the TypeScript parser is
 *     not.
 *   · A prop counts as read when its name appears anywhere else in the file.
 *     A local variable that happens to share the name therefore HIDES a real
 *     finding — a false negative, which is the safe direction.
 *   · Any component that forwards its props wholesale is skipped entirely:
 *     `{...props}`, `{...rest}`, or handing the props object to a function all
 *     use every prop without naming one.
 *   · Only props types declared in the same file are considered. An imported
 *     type may be shared by components this scan cannot see.
 *
 * Everything skipped is COUNTED and reported, so the scan can never claim more
 * coverage than it has — the recurring failure here is a checker that quietly
 * examines nothing and reports zero problems.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import ts from 'typescript';

export interface UnreadProp {
  file: string;
  component: string;
  prop: string;
}

export type SkipReason =
  | 'props-forwarded'
  | 'props-type-not-local'
  | 'no-props'
  | 'no-component';

export interface DeclaredPropsScan {
  /** Files walked. */
  files: number;
  /** Components whose props were actually examined. */
  examined: number;
  /** Declared prop names across those components. */
  declaredProps: number;
  skipped: Record<SkipReason, number>;
  findings: UnreadProp[];
}

const DEFAULT_ROOTS = ['components/tour-mode', 'components/tour-ops'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__tests__') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every identifier text in a subtree, with property NAMES included. */
function collectIdentifiers(node: ts.Node, into: Map<string, number>): void {
  const bump = (name: string) => into.set(name, (into.get(name) ?? 0) + 1);
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) bump(n.text);
    // `data['participants']` and `{ 'participants': x }` name the field too.
    else if (ts.isStringLiteralLike(n)) bump(n.text);
    n.forEachChild(visit);
  };
  visit(node);
}

/** The property names a type literal or local interface declares. */
function declaredNames(type: ts.TypeNode | undefined, source: ts.SourceFile): string[] | null {
  if (!type) return null;
  if (ts.isTypeLiteralNode(type)) {
    return type.members
      .filter(ts.isPropertySignature)
      .map((m) => (ts.isIdentifier(m.name) ? m.name.text : ts.isStringLiteral(m.name) ? m.name.text : null))
      .filter((n): n is string => Boolean(n));
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const wanted = type.typeName.text;
    for (const statement of source.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === wanted) {
        // An interface that extends something else may inherit props this scan
        // cannot resolve; its own members are still safe to check.
        return statement.members
          .filter(ts.isPropertySignature)
          .map((m) => (ts.isIdentifier(m.name) ? m.name.text : null))
          .filter((n): n is string => Boolean(n));
      }
      if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === wanted &&
        ts.isTypeLiteralNode(statement.type)
      ) {
        return statement.type.members
          .filter(ts.isPropertySignature)
          .map((m) => (ts.isIdentifier(m.name) ? m.name.text : null))
          .filter((n): n is string => Boolean(n));
      }
    }
    return null; // declared elsewhere — out of this scan's reach
  }
  return null;
}

/** Names bound by a parameter, plus whether it captures a rest/whole object. */
function paramBinding(param: ts.ParameterDeclaration): {
  destructured: string[];
  wholeName: string | null;
  hasRest: boolean;
} {
  if (ts.isIdentifier(param.name)) {
    return { destructured: [], wholeName: param.name.text, hasRest: false };
  }
  if (ts.isObjectBindingPattern(param.name)) {
    const destructured: string[] = [];
    let hasRest = false;
    let restName: string | null = null;
    for (const element of param.name.elements) {
      if (element.dotDotDotToken) {
        hasRest = true;
        if (ts.isIdentifier(element.name)) restName = element.name.text;
        continue;
      }
      const key = element.propertyName ?? element.name;
      if (ts.isIdentifier(key)) destructured.push(key.text);
    }
    return { destructured, wholeName: restName, hasRest };
  }
  return { destructured: [], wholeName: null, hasRest: false };
}

/**
 * Does this component hand its props (or a rest of them) on wholesale? If so
 * every declared prop is used without being named and nothing here can judge it.
 */
function forwardsProps(fn: ts.Node, names: string[]): boolean {
  if (names.length === 0) return false;
  let forwards = false;
  const visit = (n: ts.Node) => {
    if (forwards) return;
    if (ts.isJsxSpreadAttribute(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text)) {
      forwards = true;
      return;
    }
    if (ts.isSpreadAssignment(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text)) {
      forwards = true;
      return;
    }
    if (ts.isCallExpression(n)) {
      for (const arg of n.arguments) {
        if (ts.isIdentifier(arg) && names.includes(arg.text)) forwards = true;
      }
    }
    n.forEachChild(visit);
  };
  visit(fn);
  return forwards;
}

type ComponentLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;

function componentsOf(source: ts.SourceFile): Array<{ name: string; fn: ComponentLike }> {
  const out: Array<{ name: string; fn: ComponentLike }> = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      out.push({ name: statement.name?.text ?? '(default)', fn: statement });
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          out.push({ name: decl.name.text, fn: decl.initializer });
        }
      }
    }
  }
  // A component starts with a capital; a helper does not.
  return out.filter((c) => /^[A-Z]/.test(c.name) || c.name === '(default)');
}

export function scanDeclaredProps(
  root: string = process.cwd(),
  roots: string[] = DEFAULT_ROOTS,
): DeclaredPropsScan {
  const files = roots.flatMap((r) => walk(path.join(root, r)));
  const skipped: Record<SkipReason, number> = {
    'props-forwarded': 0,
    'props-type-not-local': 0,
    'no-props': 0,
    'no-component': 0,
  };
  const findings: UnreadProp[] = [];
  let examined = 0;
  let declaredProps = 0;

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const components = componentsOf(source);
    if (components.length === 0) {
      skipped['no-component'] += 1;
      continue;
    }

    // Identifier census for the WHOLE file: a prop read anywhere counts, and a
    // same-named local hides the finding rather than inventing one.
    const census = new Map<string, number>();
    collectIdentifiers(source, census);

    for (const { name, fn } of components) {
      const param = fn.parameters[0];
      if (!param) {
        skipped['no-props'] += 1;
        continue;
      }
      const names = declaredNames(param.type, source);
      if (!names) {
        skipped['props-type-not-local'] += 1;
        continue;
      }
      const binding = paramBinding(param);
      const forwardable = [binding.wholeName].filter((n): n is string => Boolean(n));
      if (binding.hasRest || forwardsProps(fn, forwardable)) {
        skipped['props-forwarded'] += 1;
        continue;
      }

      examined += 1;
      declaredProps += names.length;
      for (const prop of names) {
        // Every declared prop is named at least once — in the declaration
        // itself, and again in the signature when it is destructured. More than
        // that means something in the file actually touches it.
        const declarationMentions = 1 + (binding.destructured.includes(prop) ? 1 : 0);
        if ((census.get(prop) ?? 0) <= declarationMentions) {
          findings.push({ file: rel, component: name, prop });
        }
      }
    }
  }

  return { files: files.length, examined, declaredProps, skipped, findings };
}
