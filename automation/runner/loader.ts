import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { TestCase } from './types';

function walk(dir: string, excludeDirNames: Set<string> = new Set()): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.isDirectory() && excludeDirNames.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, excludeDirNames);
    if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) return [full];
    return [];
  });
}

export interface LoadTestCasesOptions {
  // testcases/ 바로 아래 폴더 이름 기준으로 제외. (테스트케이스 yaml 파일 자체는 건드리지 않음)
  excludeDirNames?: string[];
}

// testcases/ 아래 모든 yaml 파일을 재귀적으로 읽어서 TestCase 배열로 변환
export function loadTestCases(dir: string, options: LoadTestCasesOptions = {}): TestCase[] {
  const excludeDirNames = new Set(options.excludeDirNames ?? []);
  return walk(dir, excludeDirNames).map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const doc = yaml.load(raw) as Omit<TestCase, 'file'>;
    return { ...doc, file };
  });
}

// fixtures/ 폴더 아래 모든 yaml 파일을 하나의 데이터 맵으로 합칩니다.
// (users.yaml, lomastore.yaml 처럼 관심사별로 파일을 나눠도 최상위 키만 겹치지 않으면 자동으로 병합됨)
export function loadFixtures(dir: string): Record<string, unknown> {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const merged: Record<string, unknown> = {};
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const doc = (yaml.load(raw) ?? {}) as Record<string, unknown>;
    Object.assign(merged, doc);
  }
  return merged;
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
