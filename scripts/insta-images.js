#!/usr/bin/env node
/**
 * 인스타그램 캐러셀 슬라이드 생성기.
 * slides.json 을 읽어 source:"ai" 슬라이드는 Nano Banana Pro (Gemini 3 Pro Image)로 4:5 생성,
 * source:"real" 슬라이드는 실제 작업물 파일을 images/ 로 복사합니다.
 * 외부 의존성 없음 — Node 20+ 내장 fetch 사용.
 *
 * 브랜드 시스템은 generate-images.js 와 같은 환경 변수를 사용:
 *   BRAND_NAME / BRAND_BG_COLOR / BRAND_FG_COLOR / BRAND_ACCENT
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/insta-images.js --folder output/instagram/<폴더> [--only 1,3]
 *
 * 출력: <folder>/images/slide-01.png ... (순서 = 업로드 순서)
 */

import { mkdir, writeFile, readFile, copyFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';

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

// ────────────────────────────────────────────────
// 브랜드 시스템 (환경 변수 기반 — /setup-domain이 설정)
// ────────────────────────────────────────────────
const BRAND_NAME = process.env.BRAND_NAME || 'YOUR BRAND';
const BG_COLOR   = process.env.BRAND_BG_COLOR || '#F7F6F2';
const FG_COLOR   = process.env.BRAND_FG_COLOR || '#1A1A1A';
const ACCENT     = process.env.BRAND_ACCENT   || '#D97A3A';

const BRAND_STYLE = [
  'Minimal Korean editorial Instagram carousel card, 4:5 portrait (1080x1350)',
  `off-white background (${BG_COLOR}), deep charcoal (${FG_COLOR}) text, single point color (${ACCENT})`,
  'premium clean sans-serif typography (Pretendard-like), very large headline readable on a phone',
  'generous whitespace, keep all text inside the central safe area (no text within 80px of edges)',
  'typographic card — NOT a fake portfolio piece, NOT a fake product mockup, NOT a fake review screenshot',
  'NO people, NO stock-photo aesthetic, NO fake logos, NO watermark, NO heavy gradient or glow',
  'Korean text must render perfectly legible and sharp, spelled exactly as given',
  `The only brand name shown is exactly "${BRAND_NAME}" — use this exact spelling and capitalization`,
].join('. ');

function slidePrompt(slide, total, deck) {
  const page = `${slide.no}/${total}`;
  const lines = [];
  if (slide.role === 'hook') {
    lines.push(
      `Create the COVER slide of a Korean Instagram carousel.`,
      `Huge bold Korean headline, left-aligned, occupying the upper half: "${slide.headline}"`,
      slide.body ? `Smaller sub-line below the headline: "${slide.body}"` : '',
      `Small pill tag in top-left with text: "${deck.topic}"`,
      `Bottom-right small hint text: "옆으로 넘기기 →"`
    );
  } else if (slide.role === 'cta') {
    lines.push(
      `Create the FINAL call-to-action slide of a Korean Instagram carousel.`,
      `Large bold Korean headline centered: "${slide.headline}"`,
      slide.body ? `Below it, a rounded button-like box in ${ACCENT} with white Korean text: "${slide.body}"` : '',
      `Small brand name "${BRAND_NAME}" at the bottom center.`
    );
  } else {
    lines.push(
      `Create an inner content slide of a Korean Instagram carousel.`,
      `Bold Korean headline at the top: "${slide.headline}"`,
      slide.body ? `Body text below in regular weight, max 3 lines: "${slide.body}"` : '',
      slide.visual
        ? `One simple supporting diagram element (not a photo): ${slide.visual}`
        : `One simple supporting diagram element (numbered badge, checklist, comparison table, or flow arrows) — not a photo.`
    );
  }
  lines.push(`Tiny page indicator in the top-right corner: "${page}"`, BRAND_STYLE);
  return lines.filter(Boolean).join('\n');
}

// ────────────────────────────────────────────────
// Gemini 호출
// ────────────────────────────────────────────────
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

async function generateOne(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { imageConfig: { aspectRatio: '4:5' } },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData?.data);
  if (!imgPart) {
    throw new Error(`No image in response: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

const pad = (n) => String(n).padStart(2, '0');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.folder) {
    console.error('Usage: --folder <output/instagram/폴더> [--only 1,3]');
    process.exit(2);
  }
  const folder = args.folder.replace(/[\\/]+$/, '');
  const deck = JSON.parse(await readFile(join(folder, 'slides.json'), 'utf8'));
  const slides = deck.slides || [];
  const only = args.only ? new Set(String(args.only).split(',').map(Number)) : null;
  const targets = slides.filter((s) => !only || only.has(s.no));

  const needsAi = targets.some((s) => s.source !== 'real');
  if (needsAi && !process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY environment variable is required.');
    process.exit(1);
  }

  const outDir = join(folder, 'images');
  await mkdir(outDir, { recursive: true });

  let okCount = 0;
  const todo = [];

  for (const slide of targets) {
    const name = `slide-${pad(slide.no)}`;
    if (slide.source === 'real') {
      if (slide.asset && (await exists(slide.asset))) {
        const dest = join(outDir, `${name}${extname(slide.asset).toLowerCase() || '.jpg'}`);
        await copyFile(slide.asset, dest);
        console.log(`  ✓ ${dest} (실물 작업물 복사)`);
        okCount++;
      } else {
        console.log(`  ☐ ${name}: 실물 이미지 필요 — ${slide.asset || '경로 미지정'}`);
        todo.push({ no: slide.no, asset: slide.asset || null, note: slide.visual || slide.headline });
      }
      continue;
    }
    try {
      console.log(`[generate] ${name} (${slide.role}) ...`);
      const buf = await generateOne(slidePrompt(slide, slides.length, deck));
      const path = join(outDir, `${name}.png`);
      await writeFile(path, buf);
      console.log(`  ✓ ${path} (${buf.length} bytes)`);
      okCount++;
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      todo.push({ no: slide.no, error: e.message });
    }
  }

  console.log(`\nDone: ${okCount}/${targets.length} slides saved to ${outDir}`);
  if (todo.length) {
    console.log(`남은 작업 ${todo.length}건:`);
    for (const t of todo) console.log(`  - ${t.no}장: ${t.error || `실물 이미지 ${t.asset || ''} 준비`}`);
  }
  if (needsAi && okCount === 0) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
