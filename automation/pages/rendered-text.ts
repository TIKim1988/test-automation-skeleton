import type { Locator } from '@playwright/test';

// NumberFlow의 이전 숫자는 inert로 남아 있어. 현재 표시되는 숫자만 읽어.
export function renderedText(node: Node): string {
  function read(current: Node): string {
    if (current.nodeType === 3) return current.textContent ?? '';
    const element = current as Element;
    if (element.hasAttribute?.('inert') || ['STYLE','SCRIPT'].includes(element.tagName)) return '';
    const root = element.shadowRoot ?? current;
    return Array.from(root.childNodes ?? []).map(read).join('');
  }
  return read(node).replace(/[\s\u200b]/g, '');
}
export async function displayedText(locator: Locator): Promise<string> {
  return locator.evaluate(renderedText);
}
