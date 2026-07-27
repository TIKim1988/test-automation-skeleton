import fs from 'fs';
import path from 'path';
import type { Fingerprint } from './types';

/**
 * STEP 3: 논리이름 -> 지문(Fingerprint) 저장소.
 *
 * 초록(정상) 실행에서 캡처한 지문을 파일 하나(baseline.json)에 쌓아둔다. 나중에
 * primary 가 깨진 빨강 실행에서 STEP 4 가 이 지문을 읽어 testid/role/label/text
 * 후보를 만든다. 즉 baseline 은 "정상일 때의 요소 생김새 스냅샷"이고, 힐링의 유일한
 * 폴백 재료다.
 *
 * 파일에 커밋해 두는 이유: CI 는 매 실행마다 새 체크아웃이라 실행 간 메모리가 없다.
 * 초록 실행에서 뜬 지문을 다음 실행(빨강일 수 있는)에서 쓰려면 저장소에 남아야 한다.
 */

export type BaselineStore = Record<string, Fingerprint>;

/** baseline.json 을 읽는다. 없거나 손상되면 빈 저장소를 돌려준다. */
export function loadBaseline(filePath: string): BaselineStore {
  try {
    if (!fs.existsSync(filePath)) return {};
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (doc && typeof doc === 'object' && doc.elements && typeof doc.elements === 'object') {
      return doc.elements as BaselineStore;
    }
    // elements 래핑이 없으면 평평한 맵으로 간주
    return (doc && typeof doc === 'object') ? (doc as BaselineStore) : {};
  } catch {
    return {};
  }
}

/**
 * 캡처한 지문을 저장소에 합친다(같은 논리이름이면 최신 캡처로 덮어씀).
 * 순수 함수: 새 객체를 반환한다.
 */
export function mergeFingerprint(
  store: BaselineStore,
  logicalName: string,
  fp: Fingerprint,
): BaselineStore {
  return { ...store, [logicalName]: fp };
}

/** 저장소를 baseline.json 으로 쓴다(논리이름 정렬, elements 래핑). */
export function saveBaseline(filePath: string, store: BaselineStore): void {
  const sorted: BaselineStore = {};
  for (const key of Object.keys(store).sort()) sorted[key] = store[key];
  const doc = {
    generatedAt: new Date().toISOString(),
    count: Object.keys(sorted).length,
    elements: sorted,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
}
