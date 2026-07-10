export type StepAction =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'assert_visible'
  | 'assert_hidden'
  | 'assert_text'
  | 'wait'
  | 'custom';

export interface Step {
  action: StepAction;
  target?: string;
  value?: string;
  name?: string; // action: custom 일 때, steps/custom.ts 에 등록된 함수 이름
  params?: Record<string, unknown>; // action: custom 일 때 전달할 임의 파라미터
  timeoutMs?: number; // action: wait 일 때
}

export interface TestCase {
  id: string;
  title: string;
  tags?: string[];
  last_verified?: string;
  steps: Step[];
  file: string; // loader가 채워주는 원본 경로
}

export interface ElementDef {
  role?: string;
  name?: string;
  testId?: string;
  css?: string;
  text?: string;
}

export interface SelectorMap {
  pages: Record<string, string>;
  elements: Record<string, ElementDef>;
}
