---
description: 업계 해시태그·경쟁 계정의 인스타 업로드 동향 수집 (공식 Graph API — 포맷 비중·업로드 빈도·시간대·상위 훅)
argument-hint: [--hashtags "a,b"] [--accounts "x,y"] [--days 30]
---

"$ARGUMENTS" 로 업계 인스타그램 업로드 동향을 수집합니다.

## 0. 사전 체크
- `.env` 에 `IG_USER_ID`, `IG_ACCESS_TOKEN` 이 없거나 placeholder면 → `docs/instagram-guide.md` 의 "동향 수집 토큰 발급"을 안내하고 중단
- 인자가 없으면 `knowledge/instagram/profile.md` 의 서비스·의뢰자 업종으로 해시태그 3~5개를 제안하고, 경쟁/참고 계정 핸들은 사용자에게 물어봄 (추정 금지)
- 해시태그는 7일에 고유 30개까지 조회 가능 — 한 번에 5~8개 권장

## 1. 수집
```bash
set -a && . ./.env && set +a && node scripts/insta-trends.js \
  --hashtags "..." --accounts "..." --days 30
```
결과: `output/instagram/_trends/<날짜>/trends.md` (+ `trends.json`, `raw.json`)

저장된 원본 재분석 (API 호출 없음): `node scripts/insta-trends.js --from-json output/instagram/_trends/<날짜>/raw.json --days 14`

## 2. 해석해서 보고 (trends.md 를 Read)
- 영상/릴스 vs 캐러셀 vs 이미지 비중과 포맷별 평균 참여 — 어느 포맷이 표본 대비 참여가 높은가
- 경쟁 계정 주당 업로드 수 → 우리 게시 빈도 기준선
- 업로드 요일·시간 TOP → 경쟁이 몰리는 시간과 비어 있는 시간
- 참여 상위 게시물의 첫 줄 훅 패턴 3개 (문장을 베끼지 말고 구조만 추출)
- 함께 쓰인 해시태그 중 의뢰자가 실제 검색할 만한 것 → 캡션 해시태그 후보 (최대 5개 규칙 유지)

## 3. 반영
- `/insta-calendar` 가 최신 `output/instagram/_trends/*/trends.json` 을 읽어 포맷·요일·시간을 조정
- 릴스 비중이 높게 나오면 portfolio/process 유형 일부를 릴스 대본(작업 과정 타임랩스, Before→After 전환)으로 제안

## 한계 (사용자에게 함께 알릴 것)
- 남의 게시물은 조회수가 없어 좋아요+댓글로만 비교, 좋아요 숨김 게시물은 과소평가됨
- recent_media 는 최근 24시간분만 — 해시태그 동향은 주 1회 이상 쌓아야 의미 있음
- business_discovery 는 비즈니스/크리에이터 계정만 조회 가능 (개인 계정은 실패로 기록됨)
