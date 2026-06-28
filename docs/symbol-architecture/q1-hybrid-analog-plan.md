# Q1 설계 — 단계적 하이브리드 시뮬레이션 (아날로그 끼움 인터페이스)

> 결정(Q1): **단계적 하이브리드**. 지금의 논리 수준 시뮬을 유지하되, 나중에 아날로그(실제 V/I) 솔버를
> 같은 자리에 끼울 수 있는 인터페이스만 연다. 이 문서는 그 seam 설계. 구현 보류, 설계 합의 단계.

## 1. 핵심 사실 — 토폴로지는 이미 있다 (코드 검증 2026-06-28)

현재 시뮬은 단순 boolean이 아니라 **회로 그래프 + 경로 + 넷**을 이미 만든다.

- 진입: `OneCanvas/utils/circuitSimulator.ts:295 simulateCircuit(components, wires, junctions, runtimeState, options)`.
- 그래프: `circuitGraph.ts` `CircuitGraph`(노드 `componentId:portId`, 엣지 wire/conductance/isSwitch, powerNodes/groundNodes/...). 전원 노드는 `sourceVoltage` 보유.
- 2-pass: 스위치 평가 → `findAllCircuitPaths`(전원→접지) → `propagateVoltage` → powered/reachable → 디바이스 상태 도출 → 재평가.
- 넷: `netBuilder.ts buildNets` Union-Find로 전기적 연결 그룹.
- 결과: `SimulationResult`에 `nodeVoltages: Map<string, number>`(현재는 source 전파 수준), `currentPaths`, `nets`, `graph`, `behaviorStates` 등 **이미 존재**.
- 상태 도출: `runtime/behaviorTemplates.ts:295 deriveComponentBehaviorState(block, runtimeState, powered, reachable, switchState)` → `ComponentBehaviorState`(boolean + visualState, 아날로그 필드 없음).
- 렌더: `renderers/SimulationRenderer.ts applySimulationSnapshot(behaviorStates, wireIds)` → tint + 애니메이션. 전압 표시 없음.
- 구동: `hooks/useSimulation.ts` ~20Hz rAF 루프가 매 틱 simulateCircuit 호출.
- 컴포넌트 전기 파라미터: `types/blocks.ts`에 타입별로 존재(PowerSource.voltage/maxCurrent, Led.forwardVoltage, Relay.coilVoltage, Fuse.ratingAmps, Transformer.primary/secondaryV ...). **솔버가 아직 안 읽음.**

결론. 아날로그로 가는 데 필요한 토폴로지·파라미터·결과 필드 자리가 대부분 이미 있다. 비어 있는 건 **"실제 V/I를 푸는 계산"** 한 칸뿐.

## 2. Seam — 단 하나의 교체 지점

`propagateVoltage(graph, paths)` 자리를 **Solver 인터페이스**로 추상화한다.

```ts
// 회로 그래프 + 컴포넌트 전기 모델 → 풀 입력
interface CircuitModel {
  graph: CircuitGraph;              // 기존 토폴로지 재사용
  sources: SourceSpec[];            // 전압/전류원 (노드, 값)
  branches: BranchSpec[];           // 엣지별 R/L/C (없으면 ideal wire/switch)
}

interface SolveOutput {
  nodeVoltages: Map<string, number>;   // 실제 해(또는 논리 레벨)
  branchCurrents?: Map<string, number>;
}

interface CircuitSolver {
  id: 'logic' | 'analog';
  solve(model: CircuitModel): SolveOutput;
}
```

- **LogicSolver**(기본, 지금) = 현재 `propagateVoltage` 로직을 이 인터페이스로 감싼 것. 동작 동일.
- **AnalogSolver**(나중) = MNA(modified nodal analysis) 선형 솔버. R/L/C/소스를 읽어 실제 노드 전압·가지 전류 계산.
- `simulateCircuit`는 `options.solver`(기본 'logic')로 솔버를 선택. 나머지 파이프라인(그래프·경로·상태도출)은 그대로.

## 3. 컴포넌트 전기 모델 — 어디서 읽나

- 1차: 기존 Block 타입 필드(voltage, coilVoltage, forwardVoltage, ratingAmps ...)를 `CircuitModel.sources/branches`로 매핑하는 **추출기** `buildCircuitModel(graph, components)`.
- 누락 파라미터(저항·임피던스)는 옵셔널 필드로 보강하거나 archetype 기본값 사용(예: 램프 = 고정 R, 릴레이 코일 = R+L). 심볼 properties로도 노출 가능(트랙 B와 만남).
- 핵심: 파라미터가 없으면 LogicSolver로 graceful fallback. 아날로그는 "값이 있으면 더 정확" 경로.

## 4. 출력 확장 (하위호환)

- `ComponentBehaviorState`에 옵셔널 `voltage?`, `current?` 추가. archetype은 boolean 대신 임계값 사용 가능(예: lamp lit = V ≥ Vth). 기본은 기존 boolean.
- `SimulationResult.branchCurrents?` 추가.
- 렌더: 전압/전류 오버레이(노드 색·라벨)는 후속. 지금 tint 경로 유지.

## 5. 단계 (각 단계 끝 검증)

- **Q1.1 — Seam만 (지금 권장 첫 구현)**: `CircuitSolver` 인터페이스 + `LogicSolver`(현재 로직 래핑) + `simulateCircuit`가 솔버 주입받게. **동작·테스트 전부 불변**(LogicSolver=기존). 회귀 0이 성공 기준. → 문이 열린다.
- **Q1.2 — 모델 추출**: `buildCircuitModel` — Block 파라미터를 sources/branches로. R/L/C 옵셔널 필드/기본값 정의. 단위 테스트.
- **Q1.3 — AnalogSolver (큰 작업)**: MNA 선형 솔버. DC 먼저(저항+소스), 이후 R/L/C·AC. 검증: 알려진 분압/직병렬 회로의 해.
- **Q1.4 — 하이브리드 소비 + 렌더**: archetype 임계값 도출, 전압/전류 오버레이. 솔버 선택 UI.

## 6. 결정 / 미결정
- **확정**: seam은 `propagateVoltage` 자리. 기존 그래프/넷 재사용. LogicSolver 기본, 회귀 0.
- **미결정 Q1-a**: 컴포넌트 R/L/C를 Block 필드 vs 심볼 properties vs archetype 기본값 중 어디에. (권장: archetype 기본값 + 옵션 override.)
- **미결정 Q1-b**: AnalogSolver를 DC만(저항) vs RLC/AC까지. (권장: DC 저항 먼저 PoC.)
- **미결정 Q1-c**: 선형 솔버 라이브러리(자체 가우스 소거 vs 의존성). (권장: 작은 자체 구현, 의존성 회피.)

## 7. 비범위
- 비선형 소자(다이오드 정밀 모델·트랜지스터)·과도 해석 정밀도. SPICE 완전 대체 아님.
- 멀티스레드/워커 솔버(지금 메인 스레드 rAF 유지).
