# 인스타그램 수주 시스템 가이드

블로그 파이프라인과 같은 원칙(단일 진실 공급원 · 결정론 검증 · 사람이 직접 발행)으로 인스타그램을 운영합니다.
목표 지표는 팔로워가 아니라 **DM 문의 → 견적 → 수주**입니다. 전략 원문은 [`knowledge/instagram/playbook.md`](../knowledge/instagram/playbook.md).

---

## 순서

```
/setup                  회사 수치 (brand-facts.md) — 블로그와 공유
/insta-setup            프로필·문의 동선·포트폴리오 → profile.md / portfolio.md + 프로필 키트
/insta-trends           (선택) 업계 해시태그·경쟁 계정 업로드 동향
/insta-calendar         4주 게시 계획
/insta-new "주제"        캐러셀 패키지 → 자동 검증 → 이미지 → 업로드 어시스턴트
/insta-dm "받은 메시지"   DM 답장 초안
```

## 명령어

| 명령 | 하는 일 | 결과물 |
|------|---------|--------|
| `/insta-setup` | 10분 인터뷰 | `knowledge/instagram/profile.md`, `portfolio.md`, `output/instagram/_profile-kit.md` |
| `/insta-new "주제" --type portfolio` | 슬라이드 기획 + 캡션 + 4:5 이미지 | `output/instagram/<날짜>_<주제>/` |
| `/insta-calendar` | 퍼널 믹스 4주 계획 | `output/instagram/calendar-<날짜>.md` |
| `/insta-trends` | 공식 Graph API로 동향 수집 | `output/instagram/_trends/<날짜>/trends.md` |
| `/insta-dm "..."` | 문의 단계별 답장 2안 | 채팅 출력 |
| `/insta-preview <폴더>` | 업로드 어시스턴트 | `<폴더>/preview.html` |

## 게시물 폴더

```
output/instagram/2026-10-03_상세페이지리뉴얼/
├── slides.json        # 슬라이드 기획 (source: ai | real)
├── caption.md         # 붙여넣을 캡션 그대로
├── guide.md           # 실물 이미지 준비 · 사실 확인 · 스토리 문구
├── images/slide-01.png ...
├── insta-report.json  # 자동 검증 결과
└── preview.html       # 업로드 어시스턴트
```

`slides.json` 이나 `caption.md` 를 저장하면 훅이 `scripts/insta-check.js` 를 자동 실행합니다.

검사 항목: 캡션 길이 · 첫 줄 훅 ≤ 45자 · 해시태그 ≤ 5개 · DM 키워드 CTA · 캡션 URL 0건 · 금칙어 0건 ·
**knowledge/ 에 없는 수치** · 슬라이드 수 · 슬라이드 글자수 · 1장 hook / 마지막 cta · portfolio/review 의 실물 이미지 · 내 캡션끼리 유사도

## 실제 작업물 이미지

디자인 회사가 AI로 만든 가짜 작업물을 올리면 신뢰를 잃습니다. 그래서:

- 작업물·결과·후기 캡처는 `knowledge/instagram/assets/<사례ID>/` 에 넣고 `slides.json` 에서 `source: "real"` 로 연결
- `insta-images.js` 는 `source: "ai"` 슬라이드(텍스트·도식 카드)만 생성하고, 실물은 복사만 함
- `assets/` 는 gitignored — 클라이언트 작업물이 레포에 올라가지 않음

---

## 동향 수집 토큰 발급 (`/insta-trends` 용, 선택)

공식 Instagram Graph API(Facebook 로그인 방식)를 씁니다. 스크래핑이 아니라서 계정 제재 위험이 없습니다.
Meta 개발자 화면은 자주 바뀌니, 메뉴 이름이 다르면 비슷한 항목을 찾으세요.

1. **인스타 계정을 비즈니스(또는 크리에이터)로 전환**하고 Facebook 페이지와 연결
2. [developers.facebook.com](https://developers.facebook.com) → 앱 만들기 (비즈니스 유형) → 제품에 **Instagram** 추가
3. **Graph API 탐색기**에서 앱을 선택하고 권한 `instagram_basic`, `pages_show_list`, `pages_read_engagement` 로 사용자 토큰 생성
4. 탐색기에서 `GET /me/accounts?fields=instagram_business_account` 실행 → 나온 `instagram_business_account.id` 가 `IG_USER_ID`
5. 단기 토큰을 장기 토큰(약 60일)으로 교환 → `IG_ACCESS_TOKEN`
6. `.env` 에 입력

```
IG_USER_ID=1784...
IG_ACCESS_TOKEN=EAAG...
```

- 해시태그 검색은 앱이 개발 모드면 앱 역할이 있는 본인 계정으로 작동합니다. 실서비스 모드에서는 Meta 앱 검수(Instagram Public Content Access)가 필요할 수 있습니다.
- 토큰이 만료되면(약 60일) 5번만 다시 하면 됩니다.

### 수집되는 것 / 안 되는 것

| 수집됨 | 안 됨 |
|--------|-------|
| 해시태그 인기 게시물 + 최근 24시간 게시물 | 남의 게시물 조회수·저장수 |
| 경쟁 비즈니스 계정의 최근 게시물 50개, 팔로워 수 | 개인 계정 |
| 포맷(릴스/영상/캐러셀/이미지), 좋아요·댓글, 게시 시각, 캡션 | 7일에 고유 해시태그 30개 초과 조회 |

---

## 하지 않는 일

- 자동 게시, 자동 DM, 팔로우/좋아요 자동화
- 비공식 스크래핑 (Instaloader 등) — 회사 계정이 차단될 수 있음
