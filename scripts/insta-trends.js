#!/usr/bin/env node
/**
 * 인스타그램 업계 업로드 동향 수집기 — 공식 Instagram Graph API.
 * 업계 해시태그 인기/최근 게시물 + 경쟁 비즈니스 계정의 최근 게시물을 모아
 * 포맷(영상/캐러셀/이미지) 비중, 포맷별 참여도, 업로드 요일·시간, 계정별 업로드 빈도,
 * 상위 게시물 훅, 함께 쓰인 해시태그를 정리합니다.
 * 외부 의존성 없음 — Node 20+ 내장 fetch 사용. 스크래핑 없음 (계정 제재 위험 없음).
 *
 * 필요 환경 변수:
 *   IG_USER_ID       — 내 인스타 비즈니스/크리에이터 계정 ID (숫자)
 *   IG_ACCESS_TOKEN  — instagram_basic 권한이 있는 액세스 토큰
 *   IG_GRAPH_VERSION — 선택, 기본 v23.0
 *
 * 제한 (Meta 정책):
 *   - 해시태그: 7일 동안 고유 해시태그 30개까지 조회 가능
 *   - recent_media 는 최근 24시간 게시물만
 *   - 남의 게시물은 조회수 없음 → 좋아요+댓글로 참여도 계산 (좋아요 숨김 게시물은 댓글만)
 *   - business_discovery 는 비즈니스/크리에이터 계정만 조회 가능
 *
 * Usage:
 *   node scripts/insta-trends.js --hashtags "상세페이지,브랜딩디자인" --accounts "competitor1,competitor2" \
 *     [--days 30] [--output output/instagram/_trends/2026-10-03]
 *   node scripts/insta-trends.js --from-json output/instagram/_trends/2026-10-03/raw.json   # 저장된 원본 재분석
 *
 * 출력: <output>/raw.json, trends.json, trends.md
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const splitCsv = (s) =>
  (s || '')
    .split(',')
    .map((x) => x.trim().replace(/^[#@]/, ''))
    .filter(Boolean);

const today = () => new Date().toISOString().slice(0, 10);

// ────────────────────────────────────────────────
// Graph API
// ────────────────────────────────────────────────
const VERSION = process.env.IG_GRAPH_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

const HASHTAG_FIELDS = 'id,media_type,caption,comments_count,like_count,timestamp,permalink';
const ACCOUNT_MEDIA_FIELDS = `${HASHTAG_FIELDS},media_product_type`;

async function graph(path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries({ ...params, access_token: process.env.IG_ACCESS_TOKEN })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Graph API ${res.status} (${e.code ?? '-'}): ${e.message || 'unknown error'}`);
  }
  return json;
}

async function fetchHashtag(tag, userId) {
  const search = await graph('ig_hashtag_search', { user_id: userId, q: tag });
  const id = search?.data?.[0]?.id;
  if (!id) throw new Error(`해시태그 "${tag}" 를 찾지 못함`);
  const out = { tag, id, top: [], recent: [] };
  for (const edge of ['top_media', 'recent_media']) {
    const r = await graph(`${id}/${edge}`, { user_id: userId, fields: HASHTAG_FIELDS, limit: 50 });
    out[edge === 'top_media' ? 'top' : 'recent'] = r.data || [];
  }
  return out;
}

async function fetchAccount(username, userId) {
  const query = (fields) =>
    graph(userId, {
      fields: `business_discovery.username(${username}){username,followers_count,media_count,media.limit(50){${fields}}}`,
    });
  let r;
  try {
    r = await query(ACCOUNT_MEDIA_FIELDS);
  } catch {
    // 일부 버전/계정에서 media_product_type 을 거부하면 빼고 재시도
    r = await query(HASHTAG_FIELDS);
  }
  const bd = r.business_discovery || {};
  return {
    username: bd.username || username,
    followers_count: bd.followers_count ?? null,
    media_count: bd.media_count ?? null,
    media: bd.media?.data || [],
  };
}

// ────────────────────────────────────────────────
// 분석
// ────────────────────────────────────────────────
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function format(m) {
  if (m.media_product_type === 'REELS') return '릴스';
  if (m.media_type === 'VIDEO') return '영상';
  if (m.media_type === 'CAROUSEL_ALBUM') return '캐러셀';
  return '이미지';
}

const engagement = (m) => (m.like_count ?? 0) + (m.comments_count ?? 0);

// KST 기준 요일·시간
function kst(ts) {
  const d = new Date(new Date(ts).getTime() + 9 * 3600 * 1000);
  return { weekday: WEEKDAYS[d.getUTCDay()], hour: d.getUTCHours() };
}

const firstLine = (caption) => (caption || '').trim().split('\n')[0].slice(0, 80);

function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function formatStats(media) {
  const groups = new Map();
  for (const m of media) {
    const f = format(m);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(m);
  }
  return [...groups.entries()]
    .map(([f, list]) => ({
      format: f,
      count: list.length,
      share_percent: +((list.length / media.length) * 100).toFixed(1),
      avg_engagement: Math.round(list.reduce((n, m) => n + engagement(m), 0) / list.length),
      avg_comments: +(list.reduce((n, m) => n + (m.comments_count ?? 0), 0) / list.length).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);
}

function analyze(raw, days) {
  const since = Date.now() - days * 86400 * 1000;
  const hashtagMedia = raw.hashtags.flatMap((h) => [...h.top, ...h.recent].map((m) => ({ ...m, _src: `#${h.tag}` })));
  const accountMedia = raw.accounts.flatMap((a) =>
    a.media.filter((m) => new Date(m.timestamp).getTime() >= since).map((m) => ({ ...m, _src: `@${a.username}` }))
  );

  // 해시태그 top/recent 사이 중복 제거
  const seen = new Set();
  const all = [...hashtagMedia, ...accountMedia].filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));

  const accounts = raw.accounts.map((a) => {
    const recent = a.media.filter((m) => new Date(m.timestamp).getTime() >= since);
    const weeks = days / 7;
    return {
      username: a.username,
      followers_count: a.followers_count,
      posts_in_period: recent.length,
      posts_per_week: +(recent.length / weeks).toFixed(1),
      formats: formatStats(recent.length ? recent : a.media),
      engagement_rate_percent:
        a.followers_count && recent.length
          ? +((recent.reduce((n, m) => n + engagement(m), 0) / recent.length / a.followers_count) * 100).toFixed(2)
          : null,
    };
  });

  const coTags = countBy(
    all.flatMap((m) => [...(m.caption || '').matchAll(/#([^\s#]+)/g)].map((x) => x[1])),
    (t) => t
  )
    .filter(([t]) => !raw.hashtags.some((h) => h.tag === t))
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  const top = [...all]
    .sort((a, b) => engagement(b) - engagement(a))
    .slice(0, 10)
    .map((m) => ({
      source: m._src,
      format: format(m),
      engagement: engagement(m),
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      hook: firstLine(m.caption),
      caption_length: (m.caption || '').length,
      posted_kst: m.timestamp ? `${kst(m.timestamp).weekday} ${kst(m.timestamp).hour}시` : null,
      permalink: m.permalink,
    }));

  const timed = all.filter((m) => m.timestamp);
  return {
    generated_at: new Date().toISOString(),
    period_days: days,
    sample_size: all.length,
    sources: {
      hashtags: raw.hashtags.map((h) => h.tag),
      accounts: raw.accounts.map((a) => a.username),
    },
    formats: all.length ? formatStats(all) : [],
    upload_weekday: countBy(timed, (m) => kst(m.timestamp).weekday).map(([weekday, count]) => ({ weekday, count })),
    upload_hour_kst: countBy(timed, (m) => kst(m.timestamp).hour)
      .slice(0, 6)
      .map(([hour, count]) => ({ hour, count })),
    avg_caption_length: all.length
      ? Math.round(all.reduce((n, m) => n + (m.caption || '').length, 0) / all.length)
      : 0,
    accounts,
    related_hashtags: coTags,
    top_posts: top,
    errors: raw.errors || [],
  };
}

function toMarkdown(t) {
  const rows = (list, cols) => list.map((r) => `| ${cols.map((c) => r[c] ?? '-').join(' | ')} |`).join('\n');
  return `# 인스타그램 업계 동향 — ${t.generated_at.slice(0, 10)}

- 수집 대상: 해시태그 ${t.sources.hashtags.map((h) => `#${h}`).join(' ') || '-'} / 계정 ${t.sources.accounts.map((a) => `@${a}`).join(' ') || '-'}
- 표본: ${t.sample_size}개 게시물 (계정은 최근 ${t.period_days}일)
- 참여도 = 좋아요 + 댓글 (남의 게시물은 조회수가 API로 제공되지 않음)

## 포맷 비중과 참여도

| 포맷 | 게시물 | 비중 | 평균 참여 | 평균 댓글 |
|------|--------|------|-----------|-----------|
${rows(t.formats, ['format', 'count', 'share_percent', 'avg_engagement', 'avg_comments'])}

## 경쟁 계정 업로드 빈도

| 계정 | 팔로워 | 기간 내 게시 | 주당 게시 | 참여율(%) | 주력 포맷 |
|------|--------|--------------|-----------|-----------|-----------|
${t.accounts
  .map(
    (a) =>
      `| @${a.username} | ${a.followers_count ?? '-'} | ${a.posts_in_period} | ${a.posts_per_week} | ${a.engagement_rate_percent ?? '-'} | ${a.formats[0]?.format ?? '-'} |`
  )
  .join('\n')}

## 업로드 요일 / 시간 (KST)

- 요일: ${t.upload_weekday.map((d) => `${d.weekday} ${d.count}`).join(' · ') || '-'}
- 시간 TOP: ${t.upload_hour_kst.map((h) => `${h.hour}시 ${h.count}`).join(' · ') || '-'}
- 평균 캡션 길이: ${t.avg_caption_length}자

## 참여 상위 게시물 훅

| # | 출처 | 포맷 | 참여 | 게시 | 첫 줄 |
|---|------|------|------|------|-------|
${t.top_posts.map((p, i) => `| ${i + 1} | ${p.source} | ${p.format} | ${p.engagement} | ${p.posted_kst ?? '-'} | ${p.hook.replace(/\|/g, '/')} |`).join('\n')}

## 함께 쓰인 해시태그

${t.related_hashtags.map((h) => `#${h.tag}(${h.count})`).join(' ') || '-'}
${t.errors.length ? `\n## 수집 오류\n\n${t.errors.map((e) => `- ${e}`).join('\n')}\n` : ''}
> 이 자료는 남의 게시물 경향입니다. 그대로 따라 하지 말고 /insta-calendar 에서 우리 수주 퍼널 믹스에 맞게 반영하세요.
`;
}

// ────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const days = Number(args.days || 30);

  let raw;
  let output = args.output;
  if (args['from-json']) {
    raw = JSON.parse(await readFile(args['from-json'], 'utf8'));
    output = output || args['from-json'].replace(/[\\/][^\\/]+$/, '');
  } else {
    const hashtags = splitCsv(args.hashtags);
    const accounts = splitCsv(args.accounts);
    if (!hashtags.length && !accounts.length) {
      console.error('Usage: --hashtags "a,b" --accounts "x,y" [--days 30] [--output dir]  |  --from-json raw.json');
      process.exit(2);
    }
    const userId = process.env.IG_USER_ID;
    if (!userId || !process.env.IG_ACCESS_TOKEN) {
      console.error('ERROR: IG_USER_ID 와 IG_ACCESS_TOKEN 환경 변수가 필요합니다. (docs/instagram-guide.md 참조)');
      process.exit(1);
    }
    if (hashtags.length > 10) {
      console.warn(`⚠️  해시태그 ${hashtags.length}개 — 7일 동안 고유 해시태그 30개까지만 조회됩니다.`);
    }

    raw = { collected_at: new Date().toISOString(), hashtags: [], accounts: [], errors: [] };
    for (const tag of hashtags) {
      try {
        console.log(`[hashtag] #${tag} ...`);
        const h = await fetchHashtag(tag, userId);
        raw.hashtags.push(h);
        console.log(`  ✓ 인기 ${h.top.length} / 최근 24h ${h.recent.length}`);
      } catch (e) {
        console.error(`  ✗ #${tag}: ${e.message}`);
        raw.errors.push(`#${tag}: ${e.message}`);
      }
    }
    for (const name of accounts) {
      try {
        console.log(`[account] @${name} ...`);
        const a = await fetchAccount(name, userId);
        raw.accounts.push(a);
        console.log(`  ✓ 게시물 ${a.media.length}개 (팔로워 ${a.followers_count ?? '-'})`);
      } catch (e) {
        console.error(`  ✗ @${name}: ${e.message}`);
        raw.errors.push(`@${name}: ${e.message}`);
      }
    }
    if (!raw.hashtags.length && !raw.accounts.length) {
      console.error('\n수집된 데이터가 없습니다. 토큰 권한과 계정 ID를 확인하세요.');
      process.exit(1);
    }
    output = output || join('output', 'instagram', '_trends', today());
  }

  await mkdir(output, { recursive: true });
  const trends = analyze(raw, days);
  if (!args['from-json']) await writeFile(join(output, 'raw.json'), JSON.stringify(raw, null, 2));
  await writeFile(join(output, 'trends.json'), JSON.stringify(trends, null, 2));
  await writeFile(join(output, 'trends.md'), toMarkdown(trends));

  console.log(`\n📈 표본 ${trends.sample_size}개 게시물`);
  for (const f of trends.formats) {
    console.log(`   ${f.format.padEnd(4)} ${String(f.share_percent).padStart(5)}%  평균 참여 ${f.avg_engagement}`);
  }
  console.log(`\n저장: ${join(output, 'trends.md')}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
