import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReadme } from './check-profile-readme.mjs';

const validReadme = `# Profile 👋\n\nОписание на русском.\n\n## Чем занимаюсь\n\nFrontend.\n\n## Стек\n\nTypeScript.`;
const linkedReadme = `${validReadme}\n\n[Проект](https://github.com/Si1ver01/example)`;

function rulesFor(source) {
  return validateReadme(source).map(({ rule }) => rule);
}

test('accepts a valid profile README', () => {
  assert.deepEqual(rulesFor(validReadme), []);
});

test('requires every profile section', () => {
  assert.ok(rulesFor(validReadme.replace('## Стек', '## Другое')).includes('required-section'));
});

test('rejects deprecated profile sections', () => {
  assert.ok(rulesFor(`${validReadme}\n\n## Избранные проекты\n\nНе добавлять.`).includes('deprecated-section'));
});

test('rejects template placeholders', () => {
  assert.ok(rulesFor(`${validReadme}\nTODO: add contact`).includes('placeholder'));
});

test('rejects duplicate project links', () => {
  const duplicate = `${linkedReadme}\n[Дубликат](https://github.com/Si1ver01/example)`;
  assert.ok(rulesFor(duplicate).includes('duplicate-project-link'));
});

test('rejects insecure links', () => {
  assert.ok(rulesFor(linkedReadme.replace('https://github.com/Si1ver01/example)', 'http://github.com/Si1ver01/example)')).includes('secure-link'));
});

test('rejects an unexpected npm package scope', () => {
  assert.ok(rulesFor(`${validReadme}\nnpm install @ddanshin94/typed-query-state`).includes('npm-package-name'));
});
