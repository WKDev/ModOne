# PRD Unit 1: 프로젝트 기반 구조

## 개요
ModOne 프로젝트의 기반이 되는 Tauri + Rust 구조와 .mop 프로젝트 파일 시스템을 정의합니다.

---

## 기술 스택

### 백엔드
- **Rust**: 핵심 로직 구현
- **Tauri 2.x**: 데스크톱 앱 프레임워크
- **tokio**: 비동기 런타임

### 프론트엔드
- **React 18+** 또는 **SolidJS**: UI 프레임워크
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Zustand** 또는 **Jotai**: 상태 관리

---

## .mop 프로젝트 파일 포맷

### 파일 구조
`.mop` 파일은 ZIP 압축된 디렉토리 구조입니다.

```
project.mop (ZIP 압축)
├── modone/
│   └── config.yml          # 프로젝트 설정
├── plc_csv/
│   ├── program1.csv        # 래더 프로그램 CSV
│   └── program2.csv
├── one_canvas/
│   ├── circuit.yaml        # 캔버스 회로 정의
│   └── last_state.yaml     # 마지막 상태 저장
├── mod_server_memory.csv   # Modbus 메모리 스냅샷
└── scenario.csv            # 시나리오 데이터
```

### config.yml 스키마

```yaml
version: "1.0"
project:
  name: "My PLC Project"
  description: "프로젝트 설명"
  created_at: "2024-01-15T10:30:00Z"
  updated_at: "2024-01-15T10:30:00Z"

plc:
  manufacturer: "LS"  # LS | Mitsubishi | Siemens
  model: "XGK"
  scan_time_ms: 10

modbus:
  tcp:
    enabled: true
    port: 502
    unit_id: 1
  rtu:
    enabled: false
    com_port: "COM3"
    baud_rate: 9600
    parity: "none"
    stop_bits: 1

memory_map:
  coil_start: 0
  coil_count: 1000
  discrete_input_start: 0
  discrete_input_count: 1000
  holding_register_start: 0
  holding_register_count: 1000
  input_register_start: 0
  input_register_count: 1000
```

---

## 핵심 기능

### 1. 프로젝트 생성 (New Project)
**입력:**
- 프로젝트 이름
- 저장 경로
- PLC 제조사/모델 선택

**동작:**
1. 새 .mop 파일 생성
2. 기본 config.yml 생성
3. 빈 디렉토리 구조 초기화
4. 프로젝트 열기

### 2. 프로젝트 열기 (Open Project)
**입력:**
- .mop 파일 경로

**동작:**
1. ZIP 압축 해제 (임시 디렉토리)
2. config.yml 파싱 및 검증
3. 각 서브시스템에 데이터 로드
4. UI 상태 복원

### 3. 프로젝트 저장 (Save Project)
**입력:**
- 저장 경로 (Save As인 경우)

**동작:**
1. 각 서브시스템에서 데이터 수집
2. 임시 디렉토리에 파일 작성
3. ZIP 압축
4. .mop 파일로 저장

### 4. 자동 저장 (Auto Save)
- 설정 가능한 간격 (기본: 5분)
- 백업 파일 생성 (.mop.bak)

---

## Tauri Command API

### 프로젝트 관련 Commands

```rust
// src-tauri/src/commands/project.rs

#[tauri::command]
async fn create_project(
    name: String,
    path: PathBuf,
    plc_manufacturer: String,
    plc_model: String,
) -> Result<ProjectInfo, String>;

#[tauri::command]
async fn open_project(path: PathBuf) -> Result<ProjectData, String>;

#[tauri::command]
async fn save_project(path: Option<PathBuf>) -> Result<(), String>;

#[tauri::command]
async fn close_project() -> Result<(), String>;

#[tauri::command]
async fn get_recent_projects() -> Result<Vec<RecentProject>, String>;
```

### 데이터 타입

```rust
#[derive(Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: PathBuf,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectData {
    pub info: ProjectInfo,
    pub config: ProjectConfig,
    pub canvas_data: Option<CanvasData>,
    pub scenario_data: Option<ScenarioData>,
    pub memory_snapshot: Option<MemorySnapshot>,
}
```

---

## 파일 시스템 구조 (개발)

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── project.rs      # 프로젝트 CRUD
│   │   ├── modbus.rs       # Modbus 명령
│   │   └── simulation.rs   # 시뮬레이션 제어
│   ├── project/
│   │   ├── mod.rs
│   │   ├── mop_file.rs     # .mop 파일 처리
│   │   └── config.rs       # 설정 관리
│   ├── modbus/
│   ├── parser/
│   └── simulator/

src/                        # 프론트엔드
├── App.tsx
├── main.tsx
├── components/
├── hooks/
├── stores/
└── types/
```

---

## 테스트 기준

### Unit Tests
- [ ] config.yml 파싱/직렬화
- [ ] .mop 파일 압축/해제
- [ ] 프로젝트 생성 로직

### Integration Tests
- [ ] 프로젝트 생성 → 저장 → 열기 사이클
- [ ] 대용량 CSV 파일 포함 프로젝트 처리
- [ ] 손상된 .mop 파일 에러 핸들링

### E2E Tests
- [ ] 새 프로젝트 생성 UI 플로우
- [ ] 최근 프로젝트 목록에서 열기
- [ ] 저장되지 않은 변경사항 경고

---

## 의존성
- 없음 (기반 모듈)

## 차단 항목
- Unit 2: UI 레이아웃 (프로젝트 데이터 표시)
- Unit 3: ModServer (설정 로드)
- Unit 5: OneCanvas (circuit.yaml 로드)
- Unit 6: Scenario Editor (scenario.csv 로드)

---

## 구현 우선순위
1. Tauri 프로젝트 초기화
2. config.yml 스키마 정의
3. .mop 파일 압축/해제
4. 프로젝트 CRUD API
5. 프론트엔드 연동
