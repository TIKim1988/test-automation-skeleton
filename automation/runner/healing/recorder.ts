import fs from 'fs';
import path from 'path';
import type { HealEvent, HealStrategy } from './types';

/**
 * STEP 2: 힐링 발동 사실을 구조화해 heal-report.json 으로 남기는 recorder.
 *
 * === 이 단계에서 하는 일 ===
 * resolveLocator 가 primary 로 못 잡고 폴백으로 요소를 "치유(heal)"했을 때
 * (STEP 3~4 에서 실제로 발생), ctx.onHeal(event) 로 넘어오는 HealEvent 를 모아
 * 실행 종료 시 test-results/heal-report.json 에 집계해서 쓴다.
 *
 * === 지금(STEP 2) 시점 ===
 * resolver 는 아직 primary 만 반환하므로 onHeal 은 호출되지 않는다. 따라서
 * 리포트는 totalHeals=0 인 빈 리포트로 생성된다. 이 단계의 목적은 "배관"을
 * 깔아두는 것 — STEP 3~4 에서 resolver 가 onHeal 을 부르기 시작하면 코드 변경
 * 없이 곧바로 리포트가 채워진다.
 *
 * 왜 필요한가: 힐링은 "일단 테스트를 통과시키되, 셀렉터가 낡았다는 사실을 놓치지
 * 않게" 하는 장치다. 무엇이 언제 어떤 전략으로 치유됐는지 기록이 남아야 나중에
 * selectors/ 를 실제로 고칠 수 있다. 그 기록의 단일 출력이 heal-report.json 이다.
 */

export interface HealReport {
  generatedAt: string;
  totalHeals: number;
  byStrategy: Partial<Record<HealStrategy, number>>;
  byTest: Record<string, number>;
  events: HealEvent[];
}

export interface HealRecorder {
  /** ctx.onHeal 에 연결되는 콜백 */
  onHeal: (event: HealEvent) => void;
  /** 현재까지 모인 이벤트 사본 */
  events: () => HealEvent[];
  /** outPath 에 heal-report.json 을 쓰고, 쓴 리포트를 반환 */
  flush: (outPath: string) => HealReport;
}

export function createHealRecorder(): HealRecorder {
  const collected: HealEvent[] = [];

  return {
    onHeal(event) {
      collected.push(event);
    },
    events() {
      return collected.slice();
    },
    flush(outPath) {
      // 같은 실행에서 워커가 여러 개거나 CI 재시도(retries)가 있으면 afterAll 이
      // 여러 번 돌 수 있다. 기존 파일이 있으면 병합해 유실을 막는다.
      let existing: HealEvent[] = [];
      if (fs.existsSync(outPath)) {
        try {
          const prev = JSON.parse(fs.readFileSync(outPath, 'utf8')) as Partial<HealReport>;
          if (Array.isArray(prev.events)) existing = prev.events;
        } catch {
          // 손상된 파일은 무시하고 새로 쓴다.
        }
      }
      const all = dedupe([...existing, ...collected]);
      const report = buildReport(all);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
      return report;
    },
  };
}

/** (testId, stepIndex, logicalName, healedBy, timestamp) 조합으로 중복 제거 */
function dedupe(events: HealEvent[]): HealEvent[] {
  const seen = new Set<string>();
  const out: HealEvent[] = [];
  for (const e of events) {
    const key = `${e.testId}|${e.stepIndex}|${e.logicalName}|${e.healedBy}|${e.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildReport(events: HealEvent[]): HealReport {
  const byStrategy: Partial<Record<HealStrategy, number>> = {};
  const byTest: Record<string, number> = {};
  for (const e of events) {
    byStrategy[e.healedBy] = (byStrategy[e.healedBy] ?? 0) + 1;
    byTest[e.testId] = (byTest[e.testId] ?? 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    totalHeals: events.length,
    byStrategy,
    byTest,
    events,
  };
}
