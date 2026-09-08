#!/usr/bin/env node
/**
 * CHANGELOG.md, from the commit messages.
 *
 * Conventional Commits are the only contract here: a subject of the form
 * `type(scope): summary` decides the section a commit lands in, and `!` or a
 * `BREAKING CHANGE:` footer promotes it to the top. Anything that does not
 * parse is listed under Other rather than dropped — a changelog that silently
 * loses work is worse than an untidy one.
 *
 *   node infra/scripts/changelog.mjs            # rewrite CHANGELOG.md
 *   node infra/scripts/changelog.mjs --check    # fail if it would change
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SECTIONS = [
  ['breaking', 'Breaking changes'],
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'Pipeline'],
  ['chore', 'Chores'],
  ['other', 'Other'],
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** Tags newest first, oldest release last; HEAD stands in for the unreleased work. */
function releases() {
  const tags = git('tag', '--list', 'v*', '--sort=-creatordate').split('\n').filter(Boolean);
  const points = [{ name: 'Unreleased', ref: 'HEAD', date: '' }];
  for (const tag of tags) {
    points.push({ name: tag, ref: tag, date: git('log', '-1', '--format=%ad', '--date=short', tag) });
  }
  return points;
}

function commitsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const raw = git('log', range, '--no-merges', '--format=%H%x1f%s%x1f%b%x1e');
  if (!raw) return [];
  return raw
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ''] = entry.split('\x1f');
      const match = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject);
      const breaking = !!match?.[3] || /^BREAKING CHANGE:/m.test(body);
      return {
        hash: hash.slice(0, 7),
        type: breaking ? 'breaking' : (match?.[1] ?? 'other'),
        scope: match?.[2]?.slice(1, -1) ?? '',
        summary: match?.[4] ?? subject,
      };
    });
}

function render() {
  const points = releases();
  const lines = ['# Changelog', '', 'Generated from the commit messages by `npm run changelog`.', ''];

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i + 1];
    const commits = commitsBetween(previous?.ref, current.ref);
    if (!commits.length) continue;

    lines.push(`## ${current.name}${current.date ? ` — ${current.date}` : ''}`, '');
    for (const [type, title] of SECTIONS) {
      const group = commits.filter((c) => c.type === type);
      if (!group.length) continue;
      lines.push(`### ${title}`, '');
      for (const c of group) lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.summary} (${c.hash})`);
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

const next = render();
const check = process.argv.includes('--check');
const current = (() => {
  try {
    return readFileSync('CHANGELOG.md', 'utf8');
  } catch {
    return '';
  }
})();

if (check) {
  if (current !== next) {
    console.error('CHANGELOG.md is out of date. Run: npm run changelog');
    process.exit(1);
  }
  console.log('CHANGELOG.md is up to date.');
} else {
  writeFileSync('CHANGELOG.md', next, 'utf8');
  console.log('CHANGELOG.md written.');
}
