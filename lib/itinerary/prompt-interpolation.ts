/**
 * Replace `{{PLACEHOLDER}}` segments in a server-side prompt template.
 * Values must be pre-serialized (e.g. JSON strings). No user data in template files.
 */
const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;

export function interpolatePromptTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    key in values ? values[key]! : match,
  );
}
