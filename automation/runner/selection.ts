import type { TestCase } from './types';
export function selectCases(cases: TestCase[], tags: string[], quarantineOnly = false): TestCase[] {
  return cases.filter((tc) => tc.enabled !== false && tc.status !== 'manual' &&
    (!quarantineOnly || tc.status === 'quarantine') &&
    (!tags.length || tags.some((tag) => tc.tags?.includes(tag))));
}
