import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { SelectorMap } from './types';

// selectors/ 폴더 아래 모든 yaml 파일을 하나의 맵으로 합칩니다.
// (여러 화면별로 파일을 나눠도, 자동화 러너 입장에서는 이름 하나로 조회 가능)
export function loadSelectors(dir: string): SelectorMap {
  const merged: SelectorMap = { pages: {}, elements: {} };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const doc = (yaml.load(raw) ?? {}) as Partial<SelectorMap>;
    Object.assign(merged.pages, doc.pages ?? {});
    Object.assign(merged.elements, doc.elements ?? {});
  }
  return merged;
}
