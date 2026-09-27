import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Clients translate errors by `code` and never show the English fallback, so
// every code the API can return needs a frontend translation.
const sourceRoot = join(__dirname, '..', '..');
const translationsPath = join(
  sourceRoot,
  '..',
  'frontend',
  'src',
  'i18n',
  'locales',
  'ru',
  'common.json',
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory())
      return name === 'generated' ? [] : sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function apiErrorCodes(): string[] {
  const codes = new Set<string>();
  for (const file of sourceFiles(sourceRoot)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /new DomainException\(\s*[^,]+,\s*'([a-z_]+\.[a-z_]+)'/g,
    ))
      codes.add(match[1]);
    // The global filter maps framework exceptions to status defaults.
    if (file.endsWith('http-exception.filter.ts'))
      for (const match of source.matchAll(/return '([a-z_]+\.[a-z_]+)';/g))
        codes.add(match[1]);
  }
  return [...codes].sort();
}

describe('API error code translations', () => {
  it('finds the codes it checks', () => {
    expect(apiErrorCodes()).toEqual(
      expect.arrayContaining(['campaign.not_found', 'validation.failed']),
    );
  });

  it('has a Russian translation for every API error code', () => {
    const translations = JSON.parse(readFileSync(translationsPath, 'utf8')) as {
      errors: Record<string, string>;
    };
    expect(
      apiErrorCodes().filter((code) => !(code in translations.errors)),
    ).toEqual([]);
  });
});
