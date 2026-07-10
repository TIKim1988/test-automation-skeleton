import type { CustomStepFn } from '../runner/interpreter';

// YAML의 기본 action(click/fill/assert_* 등)만으로 표현하기 어려운 로직을
// 이름을 붙여 여기에 등록합니다.
//
// 테스트케이스 yaml에서는 이렇게 호출합니다:
//   - action: custom
//     name: download_and_verify
//     params: { fileName: "invoice.pdf" }
export const customSteps: Record<string, CustomStepFn> = {
  // download_and_verify: async (page, step, ctx) => {
  //   const [download] = await Promise.all([
  //     page.waitForEvent('download'),
  //     page.getByRole('button', { name: '다운로드' }).click(),
  //   ]);
  //   // ... 파일 검증 로직
  // },
};
