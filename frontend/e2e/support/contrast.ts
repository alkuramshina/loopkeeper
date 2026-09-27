import type { Page } from '@playwright/test';

/**
 * Buttons that show only an icon, whose icon has less than 3:1 against the
 * surface behind it. Axe checks text only.
 */
export function iconButtonContrastIssues(page: Page) {
  return page.evaluate(() => {
    const channels = (color: string) =>
      (color.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (color: string) => {
      const [r, g, b] = channels(color)
        .slice(0, 3)
        .map((value) => {
          const part = value / 255;
          return part <= 0.03928
            ? part / 12.92
            : ((part + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const background = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        const [, , , alpha = 1] = channels(color);
        if (alpha >= 0.9) return color;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    return [...document.querySelectorAll<HTMLElement>('button, a')]
      .filter(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden' &&
          !element.innerText.trim() &&
          element.querySelector('svg'),
      )
      .flatMap((element) => {
        const icon = getComputedStyle(element).color;
        const behind = background(element);
        const [light, dark] = [luminance(icon), luminance(behind)].sort(
          (a, b) => b - a,
        );
        const ratio = (light + 0.05) / (dark + 0.05);
        return ratio < 3
          ? [
              `${element.getAttribute('aria-label') ?? element.className}: ${ratio.toFixed(2)}`,
            ]
          : [];
      });
  });
}
