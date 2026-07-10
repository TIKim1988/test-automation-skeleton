import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { TestCase } from './types';

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) return [full];
    return [];
  });
}

// testcases/ 아래 모든 yaml 파일을 재귀적으로 읽어서 TestCase 배열로 변환
export function loadTestCases(dir: string): TestCase[] {
  return walk(dir).map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const doc = yaml.load(raw) as Omit<TestCase, 'file'>;
    return { ...doc, file };
  });
}

export function loadFixtures(file: string): Record<string, unknown> {
  const raw = fs.readFileSync(file, 'utf8');
  return (yaml.load(raw) ?? {}) as Record<string, unknown>;
}

// "${user.email}" 같은 템플릿 문자열을 fixtures 데이터로 치환
export function resolveTemplate(value: string, data: Record<string, unknown>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, refPath: string) => {
    const parts = refPath.trim().split('.');
    let current: unknown = data;
    for (const part of parts) {
      current = (current as Record<string, unknown> | undefined)?.[part];
    }
    return current === undefined ? '' : String(current);
  });
}
