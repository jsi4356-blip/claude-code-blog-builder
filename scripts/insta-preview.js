#!/usr/bin/env node
/**
 * 인스타그램 업로드 어시스턴트.
 * 게시물 폴더를 받아 preview.html 을 만들고 브라우저로 엽니다.
 *
 * Usage:
 *   node scripts/insta-preview.js --folder output/instagram/2026-10-03_X [--no-open]
 *
 * 기능:
 *   - 캐러셀 슬라이드를 업로드 순서대로 표시 + 개별/일괄 다운로드
 *   - 캡션 전체 / 본문만 / 해시태그만 복사 버튼
 *   - 비어 있는 실물 슬라이드 표시 (준비해야 할 작업물)
 *   - 업로드 체크리스트
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pad = (n) => String(n).padStart(2, '0');

function splitCaption(caption) {
  const tags = [...caption.matchAll(/(^|\s)(#[^\s#]+)/g)].map((m) => m[2]);
  const body = caption
    .split('\n')
    .filter((line) => !/^\s*(#[^\s#]+\s*)+$/.test(line))
    .join('\n')
    .trim();
  return { body, tags };
}

const CHECKLIST = [
  '실물 작업물 슬라이드가 모두 채워졌다 (AI 이미지로 대체하지 않음)',
  '캡션·슬라이드의 수치가 brand-facts.md / portfolio.md 와 일치한다',
  '클라이언트 공개 동의 범위를 확인했다',
  '슬라이드 순서가 1장 훅 → 마지막 CTA 로 되어 있다',
  '캡션 첫 줄이 "더 보기" 전에 끝난다',
  '해시태그 5개 이하',
  'DM 키워드 자동응답이 켜져 있다',
  '프로필 링크(견적 폼/채널)가 작동한다',
  '업로드 후 1시간 안에 달린 댓글·DM에 답한다',
  '_index.json 에 게시일을 기록했다',
];

function renderHtml({ folderName, deck, caption, images }) {
  const { body, tags } = splitCaption(caption);
  const slides = deck.slides || [];

  const slideCards = slides
    .map((s) => {
      const img = images.find((f) => f.startsWith(`slide-${pad(s.no)}.`));
      const media = img
        ? `<img src="images/${esc(img)}" alt="${esc(s.headline)}" />`
        : `<div class="empty">${s.source === 'real' ? '📁 실물 작업물 필요' : '🖼 이미지 미생성'}<small>${esc(s.asset || s.visual || '')}</small></div>`;
      return `<figure class="slide">
  ${media}
  <figcaption><b>${s.no}. ${esc(s.role || '')}</b> ${esc(s.headline)}${
        img ? ` <a href="images/${esc(img)}" download="${esc(img)}">⬇</a>` : ''
      }</figcaption>
</figure>`;
    })
    .join('\n');

  const checklist = CHECKLIST.map(
    (c, i) => `<label><input type="checkbox" id="c${i}" /> ${esc(c)}</label>`
  ).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>인스타 업로드 · ${esc(deck.topic || folderName)}</title>
<style>
  :root { --bg:#f7f6f2; --card:#fff; --fg:#1a1a1a; --muted:#6b6b6b; --line:#e4e2dc; --accent:#d97a3a; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161616; --card:#202020; --fg:#eee; --muted:#9a9a9a; --line:#333; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.6 -apple-system, "Pretendard", "Apple SD Gothic Neo", sans-serif; }
  main { max-width:1080px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:17px; margin:0 0 12px; }
  .meta { color:var(--muted); margin-bottom:24px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:20px; }
  .slides { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
  .slide { margin:0; }
  .slide img, .empty { width:100%; aspect-ratio:4/5; object-fit:cover; border-radius:8px; border:1px solid var(--line); display:block; }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--muted); text-align:center; padding:12px; }
  .empty small { font-size:12px; word-break:break-all; }
  figcaption { font-size:13px; margin-top:6px; } figcaption a { color:var(--accent); text-decoration:none; }
  pre { white-space:pre-wrap; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:12px; margin:0 0 12px; font:inherit; }
  button { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:8px 14px; font:inherit; cursor:pointer; margin:0 6px 6px 0; }
  button.ghost { background:transparent; color:var(--fg); border:1px solid var(--line); }
  label { display:block; padding:4px 0; }
</style>
</head>
<body>
<main>
  <h1>${esc(deck.topic || folderName)}</h1>
  <div class="meta">유형 ${esc(deck.type || '-')} · 퍼널 ${esc(deck.funnel || '-')} · DM 키워드 "${esc(deck.cta_keyword || '-')}" · 슬라이드 ${slides.length}장</div>

  <section>
    <h2>① 슬라이드 (업로드 순서)</h2>
    <div class="slides">${slideCards}</div>
    <p><button id="dlAll">⬇ 이미지 일괄 다운로드</button></p>
  </section>

  <section>
    <h2>② 캡션</h2>
    <pre id="caption">${esc(caption.trim())}</pre>
    <button data-copy="caption">캡션 전체 복사</button>
    <button class="ghost" data-copy="body">본문만 복사</button>
    <button class="ghost" data-copy="tags">해시태그만 복사 (${tags.length})</button>
  </section>

  <section>
    <h2>③ 업로드 체크리스트</h2>
    ${checklist}
  </section>
</main>
<script id="boot" type="application/json">${JSON.stringify({ caption: caption.trim(), body, tags: tags.join(' '), images }).replace(/<\/script/gi, '<\\/script')}</script>
<script>
  const BOOT = JSON.parse(document.getElementById('boot').textContent);
  const TEXT = { caption: BOOT.caption, body: BOOT.body, tags: BOOT.tags };
  document.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', async () => {
      const label = b.textContent;
      try { await navigator.clipboard.writeText(TEXT[b.dataset.copy]); b.textContent = '✓ 복사됨'; }
      catch { b.textContent = '복사 실패 — 직접 선택하세요'; }
      setTimeout(() => (b.textContent = label), 1500);
    });
  });
  document.getElementById('dlAll').addEventListener('click', () => {
    BOOT.images.forEach((img, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = 'images/' + img; a.download = img; document.body.appendChild(a); a.click(); a.remove();
    }, i * 300));
  });
  const KEY = 'insta-check:' + location.pathname;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  document.querySelectorAll('input[type=checkbox]').forEach((c) => {
    c.checked = Boolean(saved[c.id]);
    c.addEventListener('change', () => {
      saved[c.id] = c.checked;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
    });
  });
</script>
</body>
</html>`;
}

function openInBrowser(path) {
  const p = platform();
  const cmd = p === 'darwin' ? 'open' : p === 'win32' ? 'cmd' : 'xdg-open';
  const args = p === 'win32' ? ['/c', 'start', '', path] : [path];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.folder) {
    console.error('Usage: --folder <output/instagram/폴더> [--no-open]');
    process.exit(2);
  }
  const folder = args.folder.replace(/[\\/]+$/, '');
  const folderName = basename(folder);

  let deck;
  try {
    deck = JSON.parse(await readFile(join(folder, 'slides.json'), 'utf8'));
  } catch {
    console.error(`❌ ${folder}/slides.json 을 찾을 수 없습니다.`);
    process.exit(1);
  }
  let caption = '';
  try {
    caption = await readFile(join(folder, 'caption.md'), 'utf8');
  } catch {
    console.warn('⚠️  caption.md 없음');
  }
  let images = [];
  try {
    images = (await readdir(join(folder, 'images')))
      .filter((f) => /^slide-\d+\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort();
  } catch {
    console.warn('⚠️  images/ 폴더 없음 — insta-images.js 를 먼저 실행하세요');
  }

  const outPath = join(folder, 'preview.html');
  await writeFile(outPath, renderHtml({ folderName, deck, caption, images }));
  const missing = (deck.slides || []).length - images.length;
  console.log(`\n✅ 업로드 어시스턴트 생성: ${outPath}`);
  console.log(`   슬라이드 ${(deck.slides || []).length}장 / 이미지 ${images.length}장${missing > 0 ? ` / 준비 필요 ${missing}장` : ''}`);

  if (!args['no-open']) {
    if (openInBrowser(outPath)) console.log(`\n🌐 브라우저로 열었습니다.`);
    else console.log(`\n수동으로 열어주세요: file://${outPath.replace(/\\/g, '/')}`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
