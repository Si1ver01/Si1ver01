import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReadme } from './check-profile-readme.mjs';

const validReadme = `# Profile\n\nОписание на русском.\n\n## Чем занимаюсь\n\nFrontend.\n\n## Стек\n\nTypeScript.\n\n## Сейчас в работе\n\n- [Проект](https://github.com/Si1ver01/example)\n\n## Контакты\n\n[GitHub](https://github.com/Si1ver01)`;

function rulesFor(source) {
  return validateReadme(source).map(({ rule }) => rule);
}

test('accepts a valid profile README', () => {
  assert.deepEqual(rulesFor(validReadme), []);
});

test('requires every profile section', () => {
  assert.ok(rulesFor(validReadme.replace('## Контакты', '## Другое')).includes('required-section'));
});

test('rejects template placeholders', () => {
  assert.ok(rulesFor(`${validReadme}\nTODO: add contact`).includes('placeholder'));
});

test('rejects duplicate project links', () => {
  const duplicate = validReadme.replace('[GitHub](https://github.com/Si1ver01)', '[GitHub](https://github.com/Si1ver01/example)');
  assert.ok(rulesFor(duplicate).includes('duplicate-project-link'));
});

test('rejects insecure links', () => {
  assert.ok(rulesFor(validReadme.replace('https://github.com/Si1ver01)', 'http://github.com/Si1ver01)')).includes('secure-link'));
});

test('rejects an unexpected npm package scope', () => {
  assert.ok(rulesFor(`${validReadme}\nnpm install @ddanshin94/typed-query-state`).includes('npm-package-name'));
});
