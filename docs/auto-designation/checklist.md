# 자동 넘버링 — 체크리스트

설정(앱 전역) 기반으로 구현. 심볼 XML/Rust 파서는 건드리지 않음.

## 1. 기본 prefix 테이블 + 정규화
- [x] `canonicalBlockType()` — 별칭을 심볼 id 기준으로 정규화 (`assets/builtin-symbols/index.ts`)
- [x] `DEFAULT_DESIGNATION_PREFIXES` — IEC 81346-2 기본표 (`utils/designation.ts`)
- [x] `relay_contact_*`, ground, net_label, off_page_connector, junction_box, text 는 prefix 미부여

## 2. 설정 override (앱 전역)
- [x] `AppSettings.designationPrefixOverrides: Record<string,string>` (`types/settings.ts` + default)
- [x] Rust `designation_prefix_overrides: HashMap` (`commands/settings.rs`, serde default + Default)
- [x] `resolveDesignationPrefix(type, overrides)` — override → 기본표 → undefined, 빈값=끔

## 3. 넘버링 로직
- [x] `nextDesignation(prefix, components)` — 최댓값+1, 앵커 고정, 수동값 포함
- [x] `nextAutoDesignation(type, components)` — 설정 읽어 prefix 해석 후 번호 부여
- [x] 단위 테스트 12개 (`__tests__/designation.test.ts`) 그린

## 4. 주입 (생성 경로 3곳)
- [x] `canvasStore.addComponent`
- [x] `useSchematicCanvasDocument.addComponent` (OneCanvas 라이브 경로)
- [x] `useCanvasDocument.addComponent`
- [x] `props.designation` 있으면 미주입 (붙여넣기·복제·로드 보존)

## 5. 설정 UI (기본)
- [x] `DesignationSettings.tsx` — 종류별 prefix 편집, 기본값 placeholder, 개별/전체 초기화
- [x] `SettingsPanel`에 "부품 넘버링" 카테고리 연결
- [x] SettingsDialog(레거시·미사용)는 미수정

## 6. 검증
- [x] `pnpm test` (vitest) — designation 12 + 관련 219 그린
- [x] `tsc --noEmit` — 타입 에러 없음
- [x] `cargo check` — Rust 컴파일 OK (settings 테스트 exe는 worktree DLL 환경 이슈로 미실행)
- [ ] 실제 앱에서 배치→자동 넘버링 육안 확인 (다음 기회)

## 미해결 / 후속
- [x] prefix 표준 표 — `designation-codes.md` (IEC 81346-2)
- [ ] 복제/붙여넣기 정책 — 현재 원본 designation 유지. "복제 시 새 번호" 원하면 별도
- [ ] `designationManual` 플래그 + Renumber All — 향후
- [ ] K 풀 세분(timer=KT 등) — 사용자가 설정에서 직접 override 가능, 기본은 통합 K
- [ ] netlist 추출 — 별개 작업
