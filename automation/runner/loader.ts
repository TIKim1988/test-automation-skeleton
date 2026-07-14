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
//
// 주의: 이 파일들은 git에 커밋됩니다. 로그인 비밀번호처럼 노출되면 안 되는 값은
// 절대 여기에 실제 값으로 넣지 말고, 테스트케이스에서 "${env.VAR_NAME}" 문법으로
// 참조하세요 (resolveTemplate 참고). fixtures는 검색어/상품 slug처럼 민감하지 않은
// 데이터 전용입니다.
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

// 템플릿 문자열을 치환합니다. 두 가지 소스를 지원합니다.
//   "${user.email}"      -> fixtures 데이터(data)에서 조회
//   "${env.VAR_NAME}"     -> process.env.VAR_NAME 에서 조회 (git에 커밋되지 않는 값)
//
// 로그인 아이디/비밀번호처럼 민감한 값은 항상 env 쪽을 씁니다.
// 로컬 실행: .env.example을 복사해 .env로 만들고 값을 채우면 playwright.config.ts가
// 자동으로 로드합니다 (.env는 .gitignore에 포함되어 git에 올라가지 않음).
// CI 실행: 저장소 Settings > Secrets and variables > Actions에 같은 이름으로 등록하면
// 워크플로(.github/workflows/*.yml)의 env: 블록을 통해 주입됩니다.
export function resolveTemplate(value: string, data: Record<string, unknown>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, refPath: string) => {
    const trimmed = refPath.trim();

    if (trimmed.startsWith('env.')) {
      const envVarName = trimmed.slice('env.'.length);
      const envValue = process.env[envVarName];
      if (envValue === undefined) {
        throw new Error(
          `환경변수 '${envVarName}'가 설정되지 않았습니다. ` +
            `로컬에서는 .env.example을 복사한 .env 파일을, CI에서는 GitHub Actions Secrets를 확인하세요.`
        );
      }
      return envValue;
    }

    const parts = trimmed.split('.');
    let current: unknown = data;
    for (const part of parts) {
      current = (current as Record<string, unknown> | undefined)?.[part];
    }
    return current === undefined ? '' : String(current);
  });
}
