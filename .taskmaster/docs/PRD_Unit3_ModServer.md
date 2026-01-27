# PRD Unit 3: ModServer (Modbus 서버)

## 개요
Modbus TCP 및 RTU 프로토콜을 지원하는 내장 서버를 구현합니다. OneSim과 연동하여 PLC 시뮬레이션의 I/O를 외부에 노출합니다.

---

## Modbus 프로토콜 개요

### 지원 Function Codes

| Code | 이름 | 설명 |
|------|------|------|
| 0x01 | Read Coils | Coil 읽기 (bit) |
| 0x02 | Read Discrete Inputs | Discrete Input 읽기 (bit) |
| 0x03 | Read Holding Registers | Holding Register 읽기 (16bit) |
| 0x04 | Read Input Registers | Input Register 읽기 (16bit) |
| 0x05 | Write Single Coil | 단일 Coil 쓰기 |
| 0x06 | Write Single Register | 단일 Register 쓰기 |
| 0x0F | Write Multiple Coils | 다중 Coil 쓰기 |
| 0x10 | Write Multiple Registers | 다중 Register 쓰기 |

### 메모리 맵 구조

```
┌─────────────────────────────────────────┐
│  Coils (0x0000 - 0xFFFF)               │ ← 읽기/쓰기, 1-bit
├─────────────────────────────────────────┤
│  Discrete Inputs (0x0000 - 0xFFFF)     │ ← 읽기 전용, 1-bit
├─────────────────────────────────────────┤
│  Holding Registers (0x0000 - 0xFFFF)   │ ← 읽기/쓰기, 16-bit
├─────────────────────────────────────────┤
│  Input Registers (0x0000 - 0xFFFF)     │ ← 읽기 전용, 16-bit
└─────────────────────────────────────────┘
```

---

## 아키텍처

### 모듈 구조

```rust
// src-tauri/src/modbus/
├── mod.rs
├── server.rs           // 서버 생명주기 관리
├── tcp.rs              // TCP 서버 구현
├── rtu.rs              // RTU (Serial) 서버 구현
├── memory.rs           // 메모리 맵 관리
├── protocol.rs         // 프로토콜 파싱/직렬화
└── types.rs            // 공통 타입 정의
```

### 핵심 구조체

```rust
/// Modbus 메모리 맵
pub struct ModbusMemory {
    coils: BitVec,
    discrete_inputs: BitVec,
    holding_registers: Vec<u16>,
    input_registers: Vec<u16>,
}

impl ModbusMemory {
    pub fn new(config: &MemoryConfig) -> Self;

    // Coil 접근
    pub fn read_coils(&self, start: u16, count: u16) -> Result<Vec<bool>>;
    pub fn write_coil(&mut self, address: u16, value: bool) -> Result<()>;
    pub fn write_coils(&mut self, start: u16, values: &[bool]) -> Result<()>;

    // Discrete Input 접근
    pub fn read_discrete_inputs(&self, start: u16, count: u16) -> Result<Vec<bool>>;
    pub fn write_discrete_input(&mut self, address: u16, value: bool) -> Result<()>;

    // Holding Register 접근
    pub fn read_holding_registers(&self, start: u16, count: u16) -> Result<Vec<u16>>;
    pub fn write_holding_register(&mut self, address: u16, value: u16) -> Result<()>;
    pub fn write_holding_registers(&mut self, start: u16, values: &[u16]) -> Result<()>;

    // Input Register 접근
    pub fn read_input_registers(&self, start: u16, count: u16) -> Result<Vec<u16>>;
    pub fn write_input_register(&mut self, address: u16, value: u16) -> Result<()>;

    // 스냅샷
    pub fn save_to_csv(&self, path: &Path) -> Result<()>;
    pub fn load_from_csv(&mut self, path: &Path) -> Result<()>;
}
```

### TCP 서버

```rust
pub struct ModbusTcpServer {
    config: TcpConfig,
    memory: Arc<RwLock<ModbusMemory>>,
    connections: Vec<TcpConnection>,
}

impl ModbusTcpServer {
    pub async fn new(config: TcpConfig, memory: Arc<RwLock<ModbusMemory>>) -> Self;
    pub async fn start(&mut self) -> Result<()>;
    pub async fn stop(&mut self) -> Result<()>;
    pub fn is_running(&self) -> bool;
    pub fn connection_count(&self) -> usize;
}
```

### RTU 서버 (Virtual COM)

```rust
pub struct ModbusRtuServer {
    config: RtuConfig,
    memory: Arc<RwLock<ModbusMemory>>,
    port: Option<SerialPort>,
}

impl ModbusRtuServer {
    pub async fn new(config: RtuConfig, memory: Arc<RwLock<ModbusMemory>>) -> Self;
    pub async fn start(&mut self) -> Result<()>;
    pub async fn stop(&mut self) -> Result<()>;
    pub fn list_available_ports() -> Vec<String>;
}
```

---

## 설정

### TCP 설정
```yaml
tcp:
  enabled: true
  bind_address: "0.0.0.0"
  port: 502
  unit_id: 1
  max_connections: 10
  timeout_ms: 3000
```

### RTU 설정
```yaml
rtu:
  enabled: false
  com_port: "COM3"        # Windows
  # com_port: "/dev/ttyUSB0"  # Linux
  baud_rate: 9600         # 9600, 19200, 38400, 57600, 115200
  data_bits: 8            # 7, 8
  parity: "none"          # none, odd, even
  stop_bits: 1            # 1, 2
  unit_id: 1
  timeout_ms: 1000
```

---

## Tauri Command API

### 서버 제어

```rust
#[tauri::command]
async fn modbus_start_tcp(port: u16) -> Result<(), String>;

#[tauri::command]
async fn modbus_stop_tcp() -> Result<(), String>;

#[tauri::command]
async fn modbus_start_rtu(config: RtuConfig) -> Result<(), String>;

#[tauri::command]
async fn modbus_stop_rtu() -> Result<(), String>;

#[tauri::command]
async fn modbus_get_status() -> Result<ModbusStatus, String>;
```

### 메모리 접근 (내부 API)

```rust
#[tauri::command]
async fn modbus_read_coils(start: u16, count: u16) -> Result<Vec<bool>, String>;

#[tauri::command]
async fn modbus_write_coil(address: u16, value: bool) -> Result<(), String>;

#[tauri::command]
async fn modbus_read_registers(
    register_type: RegisterType,
    start: u16,
    count: u16
) -> Result<Vec<u16>, String>;

#[tauri::command]
async fn modbus_write_register(address: u16, value: u16) -> Result<(), String>;

#[tauri::command]
async fn modbus_bulk_write(operations: Vec<WriteOperation>) -> Result<(), String>;
```

### 이벤트 (Tauri Events)

```rust
// 프론트엔드로 브로드캐스트
app_handle.emit_all("modbus:memory-changed", MemoryChangeEvent {
    address: 100,
    register_type: RegisterType::Coil,
    old_value: 0,
    new_value: 1,
});

app_handle.emit_all("modbus:connection", ConnectionEvent {
    event_type: "connected",
    client_addr: "192.168.1.100:45678",
});
```

---

## 프론트엔드 인터페이스

### TypeScript 타입

```typescript
interface ModbusStatus {
  tcp: {
    running: boolean;
    port: number;
    connections: number;
  };
  rtu: {
    running: boolean;
    comPort: string;
    baudRate: number;
  };
}

interface MemoryBlock {
  type: 'coil' | 'discrete_input' | 'holding_register' | 'input_register';
  startAddress: number;
  values: number[];
}

interface WriteOperation {
  type: 'coil' | 'holding_register';
  address: number;
  value: number;
}
```

### React Hooks

```typescript
// 메모리 구독
function useModbusMemory(type: RegisterType, start: number, count: number) {
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    // 초기 로드
    invoke('modbus_read_registers', { registerType: type, start, count })
      .then(setValues);

    // 변경 이벤트 구독
    const unlisten = listen('modbus:memory-changed', (event) => {
      // 해당 범위 내 변경시 업데이트
    });

    return () => unlisten();
  }, [type, start, count]);

  return values;
}
```

---

## 테스트 기준

### Unit Tests
- [ ] 프로토콜 파싱 (각 Function Code)
- [ ] 메모리 읽기/쓰기 로직
- [ ] 범위 검증 (주소 범위 초과)
- [ ] CRC 계산 (RTU)

### Integration Tests
- [ ] TCP 서버 시작/종료
- [ ] 동시 다중 연결 처리
- [ ] 외부 Modbus 클라이언트와 통신
  - ModbusPoll
  - pymodbus

### Performance Tests
- [ ] 1000개 레지스터 연속 읽기 응답 시간
- [ ] 100개 동시 연결 안정성
- [ ] 메모리 누수 검사

---

## 의존성
- Unit 1: 프로젝트 기반 구조 (설정 로드)

## 차단 항목
- Unit 4: Memory Visualizer (메모리 표시)
- Unit 5: OneCanvas (I/O 연결)
- Unit 6: Scenario Editor (메모리 조작)
- Unit 9: OneSim (시뮬레이션 연동)

---

## 외부 라이브러리

```toml
# Cargo.toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-modbus = "0.9"          # Modbus 프로토콜
tokio-serial = "5"            # 시리얼 통신 (RTU)
bitvec = "1"                  # 비트 벡터 (Coil)
```

---

## 구현 우선순위
1. ModbusMemory 구조체 구현
2. TCP 서버 기본 구현 (Read/Write Holding Registers)
3. 나머지 Function Code 구현
4. Tauri Command 연동
5. RTU 서버 구현
6. 이벤트 시스템
7. 메모리 스냅샷 (CSV)
