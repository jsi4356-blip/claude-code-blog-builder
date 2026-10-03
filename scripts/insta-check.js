#!/usr/bin/env node
/**
 * 인스타그램 게시물 품질 검증기 — 수주형 게시물 결정론 채점.
 *
 * Usage:
 *   node scripts/insta-check.js --folder output/instagram/2026-10-03_상세페이지리뉴얼 [--max-hashtags 5]
 *
 * 입력: <folder>/caption.md (붙여넣을 캡션 그대로), <folder>/slides.json
 * 출력: <folder>/insta-report.json
 *
 * 경고만 하고 종료코드는 0 유지 (훅에서 Claude 작업을 막지 않음).
 */

import { readFile, readdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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

const DEFAULT_BANNED = ['최고', '최저', '최상', '무조건', '100%', '절대', '완벽', '유일', '독보적'];
const CTA_FALLBACK = ['DM', '디엠', '프로필 링크', '문의', '견적', '상담'];
const NEEDS_REAL_ASSET = ['portfolio', 'review'];

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadBanned() {
  const raw = await readOptional('knowledge/banned-words.json');
  if (!raw) return DEFAULT_BANNED;
  try {
    const j = JSON.parse(raw);
    const c = j.categories || {};
    return [
      ...(c.superlatives?.words || []),
      ...(c.domain_specific?.words || []),
    ].filter(Boolean);
  } catch {
    return DEFAULT_BANNED;
  }
}

// profile.md 의 "DM 키워드" 줄에서 키워드 추출
function profileDmKeyword(profile) {
  const m = profile.match(/\*\*DM 키워드\*\*:\s*([^\n<]+)/);
  if (!m) return null;
  const v = m[1].trim().replace(/^["'“]|["'”]$/g, '');
  return v && !v.includes('{{') ? v : null;
}

// 캡션/슬라이드에 쓰인 "숫자+단위" 표현 추출 (사실 확인 대상)
function extractClaims(text) {
  const re = /\d[\d,.]*\s*(%|건|곳|배|명|개사|년|개월|만\s*원|만원|억|원|시간|일)/g;
  return [...new Set((text.match(re) || []).map((s) => s.replace(/\s+/g, '')))];
}

const shingles = (text, n = 6) => {
  const s = text.replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i <= s.length - n; i++) set.add(s.slice(i, i + n));
  return set;
};

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (inter / (a.size + b.size - inter)) * 100;
}

async function otherCaptions(root, self) {
  const out = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const p = join(root, e.name, 'caption.md');
    if (resolve(join(root, e.name)) === resolve(self)) continue;
    const raw = await readOptional(p);
    if (raw) out.push({ file: p, raw });
  }
  return out;
}

async function check(folder, maxHashtags) {
  const caption = await readOptional(join(folder, 'caption.md'));
  const slidesRaw = await readOptional(join(folder, 'slides.json'));
  const results = [];
  const push = (name, pass, detail) => results.push({ name, pass, detail });

  let deck = null;
  if (slidesRaw) {
    try {
      deck = JSON.parse(slidesRaw);
    } catch (e) {
      push('slides.json', false, `JSON 파싱 실패: ${e.message}`);
    }
  } else {
    push('slides.json', false, '파일 없음');
  }
  if (!caption) push('caption.md', false, '파일 없음');

  const profile = await readOptional('knowledge/instagram/profile.md');
  const facts =
    (await readOptional('knowledge/brand-facts.md')) +
    (await readOptional('knowledge/instagram/portfolio.md')) +
    profile;
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const slideText = slides.map((s) => `${s.headline || ''} ${s.body || ''}`).join('\n');

  // ── 캡션 ─────────────────────────────────────
  if (caption) {
    const len = caption.trim().length;
    push(
      '캡션 길이',
      len <= 2200 && len >= 150,
      `${len}자 (권장 300~1,500 / 최대 2,200)`
    );

    const firstLine = caption.trim().split('\n')[0].trim();
    push(
      '첫 줄 훅',
      firstLine.length > 0 && firstLine.length <= 45 && !firstLine.startsWith('#'),
      `"${firstLine.slice(0, 50)}" — ${firstLine.length}자 (≤ 45자, '더 보기' 전에 보이는 부분)`
    );

    const tags = [...caption.matchAll(/(^|\s)#([^\s#]+)/g)].map((m) => m[2]);
    const uniq = new Set(tags);
    push(
      '해시태그',
      tags.length >= 1 && tags.length <= maxHashtags && uniq.size === tags.length,
      `${tags.length}개 (권장 3~${maxHashtags})${uniq.size !== tags.length ? ' — 중복 있음' : ''}`
    );

    const ctaKeyword = deck?.cta_keyword || profileDmKeyword(profile);
    const ctaWords = ctaKeyword ? [ctaKeyword] : CTA_FALLBACK;
    const ctaHit = ctaWords.find((w) => caption.includes(w));
    push(
      'CTA',
      Boolean(ctaHit),
      ctaHit
        ? `"${ctaHit}" 포함`
        : `${ctaKeyword ? `DM 키워드 "${ctaKeyword}"` : 'DM/문의/견적'} 없음 — 마지막에 행동 유도 필요`
    );

    const links = caption.match(/https?:\/\/\S+|www\.\S+/g) || [];
    push(
      '캡션 URL',
      links.length === 0,
      links.length === 0 ? '없음' : `${links.length}개 — 캡션 URL은 클릭 안 됨, "프로필 링크"로 안내`
    );
  }

  // ── 금칙어 (캡션 + 슬라이드) ─────────────────
  const banned = await loadBanned();
  const allText = `${caption}\n${slideText}`;
  const hits = banned.filter((w) => allText.includes(w));
  push('최상급/금칙어', hits.length === 0, hits.length === 0 ? '없음' : `발견: ${hits.join(', ')}`);

  // ── 수치 사실 확인 ───────────────────────────
  const factsFlat = facts.replace(/\s+/g, '');
  const claims = extractClaims(allText);
  const unverified = claims.filter((c) => !factsFlat.includes(c));
  push(
    '수치 출처',
    unverified.length === 0,
    unverified.length === 0
      ? `${claims.length}개 수치 모두 knowledge/ 에서 확인`
      : `knowledge/ 에 없는 수치: ${unverified.join(', ')} — 사실 확인 또는 삭제`
  );

  // ── 슬라이드 ─────────────────────────────────
  if (deck) {
    push(
      '슬라이드 수',
      slides.length >= 3 && slides.length <= 20,
      `${slides.length}장 (권장 5~10 / 최대 20)`
    );

    const long = slides.filter(
      (s) => (s.headline || '').length > 30 || (s.body || '').length > 90
    );
    push(
      '슬라이드 글자수',
      long.length === 0,
      long.length === 0
        ? '모두 제목 ≤ 30자 / 본문 ≤ 90자'
        : `초과: ${long.map((s) => `${s.no}장`).join(', ')} — 한 장에 메시지 하나`
    );

    const first = slides[0];
    const last = slides[slides.length - 1];
    push(
      '훅 → CTA 구조',
      first?.role === 'hook' && last?.role === 'cta',
      `1장 role=${first?.role ?? '-'}, 마지막 role=${last?.role ?? '-'} (hook / cta 필요)`
    );

    const realSlides = slides.filter((s) => s.source === 'real');
    if (NEEDS_REAL_ASSET.includes(deck.type)) {
      push(
        '실제 작업물',
        realSlides.length > 0,
        realSlides.length > 0
          ? `실물 슬라이드 ${realSlides.length}장`
          : `${deck.type} 게시물인데 source:"real" 슬라이드 없음 — AI 이미지로 작업물을 대체하지 말 것`
      );
    }

    const missing = [];
    for (const s of realSlides) {
      if (!s.asset || !(await exists(s.asset))) missing.push(`${s.no}장(${s.asset || '경로 없음'})`);
    }
    if (realSlides.length) {
      push(
        '실물 이미지 파일',
        missing.length === 0,
        missing.length === 0 ? '모두 존재' : `파일 없음: ${missing.join(', ')} — 업로드 전 준비`
      );
    }
  }

  // ── 내 캡션끼리 유사도 ───────────────────────
  if (caption) {
    const mine = shingles(caption);
    const others = await otherCaptions(join(folder, '..'), folder);
    let top = { file: null, sim: 0 };
    for (const o of others) {
      const sim = jaccard(mine, shingles(o.raw));
      if (sim > top.sim) top = { file: o.file, sim };
    }
    push(
      '캡션 유사도',
      top.sim < 30,
      others.length === 0
        ? '비교 대상 없음'
        : `최대 ${top.sim.toFixed(1)}% (${top.file}) — 30% 미만 권장`
    );
  }

  return { type: deck?.type || null, slides: slides.length, results };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.folder) {
    console.error('Usage: --folder <output/instagram/폴더> [--max-hashtags 5]');
    process.exit(2);
  }
  const folder = args.folder.replace(/[\\/]+$/, '');
  const maxHashtags = Number(args['max-hashtags'] || 5);

  const report = await check(folder, maxHashtags);

  console.log(`\n📸 인스타그램 게시물 리포트`);
  console.log(`폴더: ${folder}`);
  console.log(`유형: ${report.type ?? '-'} / 슬라이드 ${report.slides}장\n`);

  let warnings = 0;
  for (const r of report.results) {
    console.log(`${r.pass ? '✅ PASS' : '⚠️  WARN'}  ${r.name.padEnd(12)} — ${r.detail}`);
    if (!r.pass) warnings++;
  }
  console.log(`\n결과: ${warnings === 0 ? '모든 검사 통과' : `${warnings}개 경고`}\n`);

  const reportPath = join(folder, 'insta-report.json');
  await writeFile(reportPath, JSON.stringify({ folder, ...report }, null, 2));
  console.log(`리포트 저장: ${reportPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
