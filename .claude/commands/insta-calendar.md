---
description: 4주 인스타 게시 계획 (수주 퍼널 믹스 · 포트폴리오 순환 · 유형 연속 방지)
argument-hint: [주 수 (기본 4)] [주당 게시 수 (기본 3)]
---

"$ARGUMENTS" 기준으로 인스타그램 게시 계획을 세웁니다. 인자가 없으면 4주 × 주 3회.

## 사전 로드
1. `knowledge/instagram/playbook.md` — 4주 기본 믹스, 7유형
2. `knowledge/instagram/profile.md` — 의뢰자 페르소나·반론 (tip / faq 주제 소스)
3. `knowledge/instagram/portfolio.md` — 사례별 `마지막 게시일` (오래된 사례부터)
4. `output/instagram/_index.json` — 지난 게시 유형·훅
5. `keyword-bank/*.yml` — 블로그 키워드 (같은 주제를 인스타 tip으로 재활용 가능)
6. `output/instagram/_trends/` 의 가장 최근 `trends.json` (있을 경우 — `/insta-trends` 결과)

## 규칙
- 믹스: portfolio 4 · tip 3 · process 2 · review 1 · price 또는 faq 1 · offer 1 (4주·12개 기준, 비율 유지)
- 같은 유형 연속 2회 금지, 주 첫 게시는 portfolio 또는 tip
- portfolio는 사례 중복 없이, 이미지가 준비된 사례 우선
- offer는 실제 작업 가능 일정이 있을 때만 — 사용자에게 확인
- trends.json 이 있으면: 경쟁 계정 주당 업로드 수를 기준선으로 게시 빈도 제안, 참여 높은 포맷(릴스/캐러셀) 비중 반영, 경쟁이 몰리는 시간 대신 비어 있는 요일·시간 제안 — 근거 수치를 표 아래에 1줄씩 표기
- 블로그 `output/<날짜>_<키워드>/post.md` 가 있으면 그 내용을 tip 캐러셀로 재가공하는 슬롯 1개 포함

## 출력 → `output/instagram/calendar-<YYYY-MM-DD>.md`

| 주 | 요일 | 유형 | 주제 | 사례ID | 1장 훅 초안 | 준비물 | 명령 |
|----|------|------|------|--------|-------------|--------|------|
| 1 | 화 | portfolio | ... | case-01 | ... | before/after 이미지 | `/insta-new "..." --type portfolio` |

표 아래에:
- 이번 달 준비해야 할 실물 이미지 목록
- 스토리 운영 (게시 당일 공유 + 주 1회 하이라이트 업데이트)
- 주간 점검 지표 표 (playbook 7장) — 빈 칸으로
