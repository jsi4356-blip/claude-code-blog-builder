---
description: 주제 하나로 수주형 인스타 캐러셀 패키지 생성 (슬라이드 기획→캡션→이미지→검증→업로드 어시스턴트)
argument-hint: <주제> [--type portfolio|tip|process|price|review|faq|offer]
---

사용자가 "$ARGUMENTS" 로 인스타그램 게시물을 만들어달라고 요청했습니다.

> ⚠️ **사전 체크**: `knowledge/brand-facts.md` 또는 `knowledge/instagram/profile.md`가 없거나 placeholder 상태면 `/setup` → `/insta-setup` 순서로 안내하고 중단하세요.

## 0. 사전 로드 (생략 금지)
1. `knowledge/instagram/playbook.md` — 7유형·캐러셀 구조·캡션 공식
2. `knowledge/instagram/profile.md` — DM 키워드, 문의 동선, 가격 공개 범위, 의뢰자 반론
3. `knowledge/instagram/portfolio.md` — 실제 사례 (portfolio/review 유형은 여기서 사례 선택)
4. `knowledge/brand-facts.md` — 수치 (**이 파일과 portfolio.md 외의 숫자 사용 금지**)
5. `knowledge/banned-words.json` — 금칙어
6. `knowledge/tone-samples/real-blog-posts.txt` — 회사 문체 (있을 경우)
7. `output/instagram/_index.json` — 최근 게시 유형·훅 (같은 유형 연속 2회 금지, 최근 훅과 다른 패턴)

## 1. 유형 결정
- `--type` 이 있으면 그대로, 없으면 `_index.json`의 최근 유형과 playbook 4주 믹스를 보고 선택
- portfolio / review 인데 `portfolio.md`에 맞는 사례나 `knowledge/instagram/assets/<사례ID>/` 이미지가 없으면 → 사용자에게 요청하고 멈춤 (AI로 작업물 대체 금지)

## 2. 패키지 작성
폴더: `output/instagram/$(date +%Y-%m-%d)_<주제 공백제거>/`

`insta-writer` 서브에이전트에 위임하거나 직접 작성:
- `slides.json` — 아래 스키마
- `caption.md` — 붙여넣을 캡션 그대로 (첫 줄 훅 ≤ 45자, 마지막 CTA, 해시태그 ≤ 5개)
- `guide.md` — 실물 이미지 준비 목록, 사실 확인 체크, 스토리 공유 문구 1개, 첫 댓글 대응 문구

```json
{
  "topic": "주제",
  "type": "portfolio",
  "funnel": "trust",
  "cta_keyword": "<profile.md DM 키워드>",
  "case_id": "<portfolio.md 사례ID 또는 null>",
  "slides": [
    { "no": 1, "role": "hook",    "source": "ai",   "headline": "≤30자", "body": "≤90자" },
    { "no": 2, "role": "content", "source": "real", "headline": "Before", "asset": "knowledge/instagram/assets/<사례ID>/before.jpg" },
    { "no": 3, "role": "content", "source": "ai",   "headline": "...", "body": "...", "visual": "비교 표" },
    { "no": 6, "role": "cta",     "source": "ai",   "headline": "...", "body": "DM으로 '견적' 보내주세요" }
  ]
}
```
저장하면 훅이 `scripts/insta-check.js`를 자동 실행합니다. 경고가 나오면 수정 후 재저장.

## 3. 이미지 생성
```bash
set -a && . ./.env && set +a && node scripts/insta-images.js --folder "output/instagram/<폴더>"
```
- `source: "ai"` 슬라이드만 4:5로 생성, `source: "real"` 은 작업물 파일을 `images/slide-NN.*`으로 복사
- 특정 장만 다시: `--only 1,6`

## 4. 업로드 어시스턴트
```bash
node scripts/insta-preview.js --folder "output/instagram/<폴더>"
```

## 5. 인덱스 갱신
`output/instagram/_index.json` 에 추가 (없으면 생성):
```json
{ "posts": [ { "folder": "...", "date": "YYYY-MM-DD", "type": "portfolio", "hook": "1장 헤드라인", "case_id": "...", "posted_at": null } ] }
```
portfolio 유형이면 `portfolio.md` 해당 사례의 `마지막 게시일`도 갱신 (사용자가 실제 업로드 후).

## 완료 후 보고
- 유형 / 퍼널 / 슬라이드 수 (AI n장 · 실물 n장)
- insta-check 결과 (경고 항목)
- 사람이 준비·확인할 것: 실물 이미지, 수치, 클라이언트 공개 동의
- 업로드 팁: 앱에서 직접 업로드, 업로드 후 1시간 안에 댓글·DM 응답
