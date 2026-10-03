---
description: 인스타그램 수주 셋업 (프로필·문의 동선·포트폴리오 인터뷰 → profile.md / portfolio.md + 프로필 키트)
argument-hint: (인자 없음)
---

# /insta-setup — 인스타그램 수주 셋업 (10분)

게시물보다 프로필이 먼저입니다. 의뢰자는 게시물 하나를 보고 프로필로 넘어와 "맡겨도 되나"를 판단합니다.

## 사전 조건 점검

- `knowledge/brand-facts.md`가 없거나 placeholder 상태면 → 먼저 `/setup` 안내 후 중단 (회사 수치는 거기서만 관리)
- `knowledge/instagram/profile.md`가 이미 있고 placeholder가 아니면 → "이미 셋업되어 있습니다. 다시 하시겠어요?" 확인
- `knowledge/instagram/playbook.md`를 Read로 읽고 시작

## 인터뷰 (한 번에 한 질문씩, 추정 금지)

1. **계정 핸들 + 계정 유형** (비즈니스/크리에이터 — 비즈니스가 아니면 전환 권장: 문의 버튼·자동응답·인사이트 필요)
2. **누가 의뢰하나** — 의뢰자 페르소나 1문장 (업종·규모·담당자 직급)
3. **의뢰 직전에 확인하는 것 3개** + **의뢰를 망설이게 하는 것** (가격/기간/수정 횟수/소통 등)
4. **판매 서비스 + 공개 가능한 가격 범위·기간** (가격 비공개면 "상담 후 안내")
5. **문의 동선** — DM 키워드 1개 (예: "견적"), 프로필 링크(견적 폼/카카오 채널), 응답 가능 시간, 첫 응답 목표 시간, 견적에 꼭 필요한 정보 3~4개
6. **게시 가능한 대표 사례 3~5건** — 사례마다: 업종 / 의뢰 내용 / 의뢰 전 문제 / 한 것 / 확인된 결과 / 고객 한마디(동의 받은 원문) / 공개 동의 범위
7. **피드 톤** — 참고하고 싶은 계정이 있으면 핸들, 없으면 "밝게/어둡게, 작업물 크게/텍스트 위주"

## 저장

- `knowledge/instagram/profile.template.md` → 답변으로 치환 → `knowledge/instagram/profile.md`
- `knowledge/instagram/portfolio.template.md` → 사례 채움 → `knowledge/instagram/portfolio.md`
- 사례 이미지 폴더 생성: `mkdir -p knowledge/instagram/assets/<사례ID>` (사용자가 작업물 이미지를 넣을 곳)
- 둘 다 gitignored — 회사 데이터는 커밋하지 않음

## 프로필 키트 생성 → `output/instagram/_profile-kit.md`

playbook.md 2장 공식에 따라:

1. **이름 필드** 3안 (30자 이내, 서비스 키워드 포함)
2. **소개(bio)** 3안 — 4줄 공식 (무엇을 / 누구를 / 증거 / 행동), 150자 이내, 수치는 brand-facts.md에서만
3. **고정 게시물 3개 기획** — 각각 `/insta-new` 로 바로 만들 수 있게 주제 + type 명시
4. **하이라이트 5개** — 이름(한 단어) + 커버 문구 + 들어갈 스토리 목록
5. **DM 자동응답 문구** — DM 키워드 수신 시 첫 메시지 (견적 필요 정보 질문 포함)
6. **프로필 링크 페이지 구성안** — 견적 폼 항목

## 완료 후 안내

```
✅ 인스타 셋업 완료
- 프로필 키트: output/instagram/_profile-kit.md (앱에서 프로필 수정)
- 작업물 이미지: knowledge/instagram/assets/<사례ID>/ 에 넣어주세요
다음 단계:
  /insta-new "<고정 게시물 1번 주제>" --type portfolio
  /insta-calendar   (4주 게시 계획)
```
