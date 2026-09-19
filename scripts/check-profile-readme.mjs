import { readFile } from 'node:fs/promises';

const REQUIRED_SECTIONS = ['Чем занимаюсь', 'Стек'];
const FORBIDDEN_SECTIONS = ['Избранные проекты', 'Сейчас в работе', 'Контакты'];
const ALLOWED_HOSTS = new Set(['github.com', 'npmjs.com', 'www.npmjs.com', 'registry.npmjs.org']);
const ALLOWED_NPM_PACKAGE = '@ddanshin/typed-query-state';
const PLACEHOLDER_PATTERN = /TODO|FIXME|your name|replace this|coming soon|Hi there|I.?m currently working on/i;
const UNSUPPORTED_CLAIM_PATTERN = /\bsenior\b|production[- ]ready|production readiness|accessibility compliance|WCAG compliant|\d+\+?\s*years?\s+of experience|millions? of users?/i;

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

function log(level, message, data = {}) {
  const configuredLevel = String(process.env.LOG_LEVEL ?? 'INFO').toUpperCase();
  const threshold = LEVELS[configuredLevel] ?? LEVELS.INFO;
  if (LEVELS[level] < threshold) return;

  process.stdout.write(`${JSON.stringify({ level, component: 'profile-readme', message, ...data })}\n`);
}

function addError(errors, rule, message, line = undefined) {
  errors.push({ rule, message, ...(line === undefined ? {} : { line }) });
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function validateReadme(source) {
  const errors = [];
  const sectionCounts = new Map();

  if (!/[А-Яа-яЁё]/.test(source)) {
    addError(errors, 'language', 'README must contain human-readable Cyrillic text');
  }

  for (const section of REQUIRED_SECTIONS) {
    const matches = source.match(new RegExp(`^## ${section}$`, 'gm')) ?? [];
    sectionCounts.set(section, matches.length);
    if (matches.length !== 1) {
      addError(errors, 'required-section', `Section "${section}" must occur exactly once`);
    }
  }

  for (const section of FORBIDDEN_SECTIONS) {
    const matches = source.match(new RegExp(`^## ${section}$`, 'gm')) ?? [];
    sectionCounts.set(`forbidden:${section}`, matches.length);
    if (matches.length > 0) {
      addError(errors, 'deprecated-section', `Section "${section}" is no longer supported`);
    }
  }

  const placeholderMatch = source.match(PLACEHOLDER_PATTERN);
  if (placeholderMatch) {
    addError(errors, 'placeholder', `Placeholder text is not allowed: ${placeholderMatch[0]}`, lineNumberAt(source, placeholderMatch.index));
  }

  const unsupportedClaimMatch = source.match(UNSUPPORTED_CLAIM_PATTERN);
  if (unsupportedClaimMatch) {
    addError(errors, 'unsupported-claim', `Unsupported claim is not allowed: ${unsupportedClaimMatch[0]}`, lineNumberAt(source, unsupportedClaimMatch.index));
  }

  const markdownLinks = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => ({
    url: match[1],
    line: lineNumberAt(source, match.index),
  }));
  const projectPaths = new Set();

  for (const { url, line } of markdownLinks) {
    if (url.startsWith('#') || url.startsWith('./') || url.startsWith('../')) continue;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      addError(errors, 'link-url', `Invalid link URL: ${url}`, line);
      continue;
    }

    if (parsed.protocol !== 'https:') {
      addError(errors, 'secure-link', `Only HTTPS links are allowed: ${url}`, line);
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      addError(errors, 'allowed-host', `Host is not allow-listed: ${parsed.hostname}`, line);
    }

    if (parsed.hostname === 'github.com' && /^\/Si1ver01\/[^/]+\/?$/.test(parsed.pathname)) {
      const projectPath = parsed.pathname.replace(/\/$/, '').toLowerCase();
      if (projectPaths.has(projectPath)) {
        addError(errors, 'duplicate-project-link', `Project link occurs more than once: ${projectPath}`, line);
      }
      projectPaths.add(projectPath);
    }
  }

  for (const match of source.matchAll(/@[a-z0-9][a-z0-9-]*\/typed-query-state/gi)) {
    if (match[0] !== ALLOWED_NPM_PACKAGE) {
      addError(errors, 'npm-package-name', `Unexpected npm package name: ${match[0]}`, lineNumberAt(source, match.index));
    }
  }

  log('DEBUG', 'validation rules evaluated', {
    ruleIds: [...new Set(errors.map(({ rule }) => rule))],
    sections: Object.fromEntries(sectionCounts),
    sectionIds: [...sectionCounts.keys()],
    linkCategories: [...new Set(markdownLinks.map(({ url }) => url.startsWith('https://') ? 'https-external' : 'other'))],
    projectLinkCount: projectPaths.size,
  });
  return errors;
}

export async function checkReadme(filePath = 'README.md') {
  log('INFO', 'readme validation started', { file: filePath });
  const source = await readFile(filePath, 'utf8');
  const errors = validateReadme(source);
  if (errors.length > 0) {
    for (const error of errors) log('ERROR', error.message, { rule: error.rule, ...(error.line ? { line: error.line } : {}) });
    throw new Error(`README validation failed with ${errors.length} error(s)`);
  }
  const projectLinkCount = [...source.matchAll(/\[[^\]]+\]\(https:\/\/github\.com\/Si1ver01\/[^)]+\)/g)].length;
  const emojiCount = [...source.matchAll(/\p{Extended_Pictographic}/gu)].length;
  log('INFO', 'readme validation passed', {
    file: filePath,
    sectionCount: REQUIRED_SECTIONS.length,
    projectLinkCount,
    emojiCount,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2] ?? 'README.md';
  checkReadme(filePath).catch((error) => {
    log('ERROR', 'readme validation aborted', { error: error.message });
    process.exitCode = 1;
  });
}
