# ModOne Core Vision & Long-Term Roadmap

**"산업계의 피그마(Figma) + 팩토리오(Factorio)"**
ModOne은 더 이상 책상 위에 무겁고 비싼 물리 PLC와 스위치 패널을 두지 않아도 되게 하는, **운영 SW(HMI/SCADA/Edge) 개발자 및 검증 엔지니어들을 위한 궁극의 인터랙티브 가상 테스트벤치(Virtual Testbench)**입니다.

---

## 1. Core Value Proposition (핵심 가치 제안)

### ❌ 우리가 하지 않는 것 (Anti-Goals)
- 오차 없는 완벽한 전기 회로도 및 BOM(자재 명세서)을 뽑아내는 무거운 정통 EDA (EPLAN, AutoCAD Electrical 대체 목적 아님)
- 공장 전체의 물류, 중력, 유체 역학 등을 수학적으로 계산하는 거대한 물리 세계 디지털 트윈 (Siemens SIMIT의 3D 역학 엔진 대체 아님)
- 물리적 결선 규칙을 엄격하게 강요하여 사용자를 피곤하게 만드는 시스템

### 🎯 우리가 집중하는 것 (Core Goals)
- **Extreme Agility:** HMI/SCADA 개발자가 1분 만에 앱을 켜고, 가상의 스위치, 램프, 모터를 마우스로 던져놓은 뒤 즉시 테스트할 수 있는 극강의 직관성.
- **Interactive Sandbox:** 단순한 도면을 넘어, 사용자의 마우스 클릭("딸깍")이 즉시 가상 PLC 접점을 타고 래더 로직을 거쳐 애니메이션(모터 회전 등)과 외부 통신(Modbus/OPC UA)으로 실시간 반응하는 동적 샌드박스.
- **Protocol Mocking Hub:** 외부 운영 SW가 실제 장비인 줄 알고 통신할 수 있도록 완벽하게 속이는 "산업용 통신계의 Postman". 장기적으로는 번거로운 주소 할당 방식(Modbus)을 넘어, HMI 개발자가 직관적으로 태그를 탐색하고 구독할 수 있는 **로컬 OPC UA Server (Gateway) 역할**을 수행하여 차세대 스마트 팩토리 개발의 핵심 인프라가 된다.

---

## 2. Target Persona & Usage Scenario

### Primary Persona: 운영 SW (HMI/웹/앱/SCADA) 개발자
- **Pain Point:** 테스트를 하려면 무거운 타사 PLC 시뮬레이터를 억지로 깔거나, 실제 PLC 하드웨어를 책상에 올려놓고 물리 스위치를 눌러야 함. 제어 엔지니어의 코드를 테스트 환경에 세팅하는 것 자체가 고통.
- **Scenario:** ModOne을 켜서 `가상 스위치`와 `램프` 위젯을 캔버스(OneCanvas)에 올림. 버튼 클릭 시 특정 Modbus 레지스터 값이 바뀌도록 5초 만에 세팅. 자신이 개발 중인 HMI 프로그램을 localhost 통신으로 ModOne에 연결하여 즉각적인 UI 상태 변화 테스트.

### Secondary Persona: 제어(PLC) 설계/테스트 엔지니어
- **Pain Point:** 기존 벤더(미쓰비시, LS, 지멘스) 툴 자체 시뮬레이터는 외부 상위 SW와의 통신(Modbus Server 등)을 매끄럽게 지원하지 못함.
- **Scenario:** 자신이 작화한 래더 로직(.gxw 등)을 ModOne에 Import하여, 복잡한 타이밍과 I/O 흐름이 상위 SW 플랫폼과 붙었을 때 어떻게 동작하는지 캔버스 인터랙션을 통해 시각적으로 검증.

---

## 3. Product Principles (제품 개발 원칙)

### Principle 1. "Canvas는 엄격한 도면이 아니라 반응형 놀이터다"
- EPLAN처럼 직렬 결선이나 전기 규칙을 엄격하게 따지지 않는다.
- 노드 연결이나 비주얼 스크립팅과 같이 직관적이고 게임 같은(Factorio) 경험을 제공한다.
- 유저와의 액티브한 상호작용(스위치 클릭, 슬라이더 조절)에 0.1ms의 지연 없이 반응(Reactive)해야 한다.

### Principle 2. "렌더링은 무조건 DOM/React LifeCycle을 우회한다"
- 1만 개의 I/O와 수백 개의 램프/모터 상태가 초당 수십 번(10ms~ 단위) 바뀌는 것을 React `setState`나 Zustand에 태우면 브라우저 스레드가 터진다.
- **UI 상태(React)와 시뮬레이션 상태(Rust Sim Engine)의 철저한 디커플링.**
- 고빈도/대용량 데이터 스트림은 WebAssembly, SharedArrayBuffer, WebGL(Pixi.js) 등으로 직결시켜 60FPS 이상의 스무스한 인터랙션을 보장한다.

### Principle 3. "레거시 수용 래더 컴파일러는 수단일 뿐, 목적이 아니다"
- GX Works나 LS산전의 래더를 직접 Import하여 파싱/컴파일하는 놀라운 기술력은 **"더 완벽한 에뮬레이터를 만들기 위해서"**가 아니라, **"타겟 유저(HMI/테스트)가 귀찮은 로직 세팅(Mocking) 없이 현장 장비를 1초 만에 가상화하게 만들기 위한 강력한 유입 수단"**이다.
- 컴파일러 역공학과 Bug-for-bug 호환성에 매몰되지 않고, "상위 통신 테스트"라는 본질에 충실해야 한다.
- 추후 래더를 전혀 모르는 HMI 개발자를 위해 직관적인 "상태 머신(FSM)" 기반 시나리오 에디팅/스크립팅 기능 등을 확충한다.

### Principle 4. "확장성을 고려한 통합 태그 아키텍처 (Beyond Modbus & Toward OPC UA)"
- 초기 GTM(Go-To-Market)은 레거시 호환성과 가벼움을 위해 가장 범용적인 Modbus(TCP/RTU) 서버 기능으로 장악한다.
- **궁극의 목표는 OPC UA Server:** 주소 엑셀 테이블(Modbus)을 보며 노가다하는 HMI 개발자의 고통을 끝내기 위해, 객체 지향 노드 탐색(Browsing)과 이벤트 구독(Pub/Sub) 및 강력한 보안을 지원하는 OPC UA 환경을 전면 지원한다.
- 이를 위해 시스템 코어는 Modbus 특유의 메모리 주소 체계에 강결합되지 않은 **Protocol-Agnostic 통합 태그 딕셔너리(Tag Dictionary)** 구조여야 한다. OneCanvas에 펌프를 올리고 이름을 정하면, 자동으로 `Root/ModOne/Pump/Run` 형태의 OPC UA 노드 트리가 생성되는 쾌감을 제공해야 한다.

---

## 4. Long-Term Roadmaps

### Phase 1: Local Interactive Sandbox (현재~초기 PMF)
- Rust 기반의 고속 시뮬레이션 엔진 안정화.
- OneCanvas의 WebGL/Canvas 렌더링 최적화  (병목 제거).
- 직관적인 Generic 위젯 라이브러리(스위치, 모터, 램프 등) 구축 및 드래그 앤 드롭 결선.
- 내장 Modbus Server를 통한 외부 HMI 어플리케이션과의 로컬 통합 테스트.
- LS/GX Works 기본 래더 Import 및 실행 정합성 확보.

### Phase 2: Protocol Expansion & Scenario Engine (성장기)
- OPC UA Server / Client 모듈 통합.
- 래더(Ladder)를 넘어서는 대안적 행위(Behavior) 정의 UI : 비주얼 FSM(Finite State Machine) 에디터 또는 JS/TS 스크립팅(Scenario Editor) 고도화.
- 심볼(Component) 내부에 고유의 상태 및 딜레이 시간을 캡슐화한 'Smart Component' 시스템.

### Phase 3: Headless Collaboration & Team Workspace (엔터프라이즈 B2B)
- 프로젝트 ファイル(.mop) 공유를 넘어서, ModOne 플랫폼 아키텍처 자체를 Host/Client 구조로 고도화.
- 프론트엔드(OneCanvas) 그래픽과 무관하게, Rust 백엔드만 분리 구동되는 **Headless ModOne Runtime / Docker 컨테이너화**.
- 클라우드 혹은 로컬 서버에 런타임을 띄워놓고, HMI 개발자, 제어 엔지니어, UI 디자이너가 실시간으로 동시 접속하여 컴포넌트 상태를 조작하고 관찰하는 협업 시뮬레이션 환경 구축.
