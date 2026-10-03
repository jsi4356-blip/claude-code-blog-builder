#!/usr/bin/env node
/**
 * Claude Code PostToolUse 훅 라우터.
 * stdin으로 받은 JSON을 파싱해서
 *   - output/<폴더>/post.md → quality-check + duplicate-check
 *   - output/instagram/<폴더>/caption.md 또는 slides.json → insta-check
 * 을 자동 실행합니다.
 *
 * 훅이 실패해도 Claude의 작업을 막지 않도록 항상 exit 0.
 */

import { spawnSync } from 'node:child_process';
import { basename, dirname } from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    // 2초 후 타임아웃
    setTimeout(() => resolve(data), 2000);
  });
}

function extractPath(payload) {
  try {
    const j = JSON.parse(payload);
    return (
      j?.tool_input?.file_path ||
      j?.tool_input?.path ||
      j?.file_path ||
      null
    );
  } catch {
    return null;
  }
}

function extractKeyword(filePath) {
  // output/2026-04-08_상세페이지AI/post.md → 상세페이지AI
  const folder = basename(dirname(filePath));
  return folder.replace(/^\d{4}-\d{2}-\d{2}_/, '');
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  return r.status;
}

async function main() {
  const payload = await readStdin();
  const filePath = extractPath(payload);
  if (!filePath) process.exit(0);

  const normalized = filePath.replace(/\\/g, '/');

  // output/instagram/<폴더>/caption.md | slides.json
  if (/\/output\/instagram\/[^/]+\/(caption\.md|slides\.json)$/.test(normalized)) {
    console.log(`\n🤖 [자동 훅] 인스타 게시물 감지 → insta-check 실행`);
    run('node', ['scripts/insta-check.js', '--folder', dirname(filePath)]);
    process.exit(0);
  }

  // output/<anything>/post.md 만 대상
  if (!/\/output\/[^/]+\/post\.md$/.test(normalized)) process.exit(0);

  const keyword = extractKeyword(filePath);

  console.log(`\n🤖 [자동 훅] post.md 감지 → 품질검사 + 유사도검사 실행`);
  run('node', ['scripts/quality-check.js', '--file', filePath, '--keyword', keyword]);
  run('node', ['scripts/duplicate-check.js', '--file', filePath]);
}

main().catch(() => process.exit(0));
