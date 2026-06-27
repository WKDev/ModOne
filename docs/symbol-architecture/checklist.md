# 체크리스트 — 심볼 아키텍처

## 설계 단계 (현재)
- [x] 현재 심볼 시스템 조사 (XML 스키마, 포트 정적성, 시뮬 계층)
- [x] archetype/behavior 계층이 코드 백드이고 OneCanvas 런타임 전용임을 확인
- [x] scope channels↔ports 불일치(정적 포트) 확인
- [x] 3-tier 모델 + 결정/미결정 정리 (`design.md`)
- [ ] **Q1 시뮬레이션 깊이 결정** (논리 확장 / SPICE급 / 단계적 하이브리드)
- [ ] **Q2 파라메트릭 포트 우선 위치 결정** (T2 선언 XML / T3 코드)
- [ ] **Q3 (2) 에디터 시맨틱 저작을 독립 선행할지 결정**

## 구현 단계 (결정 후 — 아직 시작 안 함)
- [ ] (Q3=yes 시) SymbolEditor: 핀 electricalType 셀렉터 추가
- [ ] (Q3=yes 시) SymbolEditor: Property 저작 패널 추가
- [ ] (Q2=T2 시) `<ms:PortTemplate repeat=...>` 스키마 + 로더 확장
- [ ] (Q2=T2 시) scope/terminal_block을 PortTemplate로 마이그레이션
- [ ] (Q2=T3 시) `behaviorTemplates.ts`에 구조 생성 훅(generatePorts) 추가
- [ ] (Q1=a 시) 논리 시뮬: archetype 추가 (counter/timer/contactor 등)
- [ ] (Q1=b/c 시) nodal 솔버 PoC, archetype 심에 끼울 인터페이스 설계
- [ ] 회귀 테스트: `builtinXmlRoundtrip.test.ts` 등 통과

## 마무리
- [ ] 변경 커밋
- [ ] main 병합 + 워크트리 제거 (ExitWorktree)
