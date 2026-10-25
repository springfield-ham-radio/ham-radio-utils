/**
 * Transitive relative `$ref` closure for one radio config.
 * Matches the file set `pack:release` zips for that model: shared schemas and
 * memory maps the config reaches, and not sibling radios.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * @returns Sorted repo-relative paths, including `startRelative`
 */
export function collectRefClosure(moduleRoot: string, startRelative: string): string[] {
  const included = new Set<string>([startRelative]);
  const pending = [startRelative];

  while (pending.length > 0) {
    const current = pending.pop();

    if (!current) {
      continue;
    }

    const text = readWorkingTreeText(moduleRoot, current);

    if (text === undefined) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      continue;
    }

    const fromDirectory = dirname(join(moduleRoot, current));

    for (const refPath of localRefTargets(parsed)) {
      const absolutePath = resolve(fromDirectory, refPath);
      const relativePath = toRepoRelative(moduleRoot, absolutePath);

      if (relativePath === undefined) {
        throw new Error(`${current} $ref escapes the repository: ${refPath}`);
      }

      if (!included.has(relativePath)) {
        included.add(relativePath);
        pending.push(relativePath);
      }
    }
  }

  return [...included].sort();
}

export function readWorkingTreeText(moduleRoot: string, relativePath: string): string | undefined {
  const absolutePath = join(moduleRoot, relativePath);

  if (!existsSync(absolutePath)) {
    return undefined;
  }

  return readFileSync(absolutePath, 'utf8');
}

export function localRefTargets(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      localRefTargets(item, into);
    }

    return into;
  }

  if (!value || typeof value !== 'object') {
    return into;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.$ref === 'string') {
    const refPath = filePathFromRef(record.$ref);

    if (refPath) {
      into.push(refPath);
    }
  }

  for (const child of Object.values(record)) {
    localRefTargets(child, into);
  }

  return into;
}

/**
 * Path portion of a relative file `$ref`, without a JSON pointer.
 * Fragment-only refs and absolute URIs are ignored.
 */
export function filePathFromRef(ref: string): string | undefined {
  if (ref.length === 0 || ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) {
    return undefined;
  }

  const hashIndex = ref.indexOf('#');
  const refPath = hashIndex === -1 ? ref : ref.slice(0, hashIndex);

  return refPath.length > 0 ? refPath : undefined;
}

function toRepoRelative(rootDirectory: string, absolutePath: string): string | undefined {
  const relativePath = relative(rootDirectory, absolutePath);

  if (relativePath === '' || relativePath.startsWith('..') || relativePath.includes(`${sep}..`)) {
    return undefined;
  }

  return relativePath.split(sep).join('/');
}
