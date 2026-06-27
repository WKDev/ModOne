# Modbus Observability — 체크리스트

브랜치: `worktree-modbus-observability`
목표: Modbus 서버에 운영 가시성(트래픽 로그·클라이언트 통계) + 값 제너레이터를 추가해 상용 슬레이브 시뮬레이터(Modbus Slave, ModRSsim2/ModbusPal) 동등성+차별화 확보.

## P0 — 통신 트래픽 로그 (모든 경쟁사에 있고 우리만 없는 핵심 갭)
- [x] 백엔드: `telemetry.rs` — `ModbusTrafficEvent` + `modbus:traffic` + `from_exchange` 메타 추출
- [x] 백엔드: TCP `handle_connection`에서 매 요청 emit (app_handle/client_addr 스레딩)
- [x] 백엔드: RTU 루프에도 emit 배선 (port_name/unit)
- [x] 백엔드: 단위 테스트 4종 (telemetry)
- [x] 프론트: `types/modbus.ts`에 `ModbusTrafficEvent` + `TRAFFIC` 이벤트명
- [x] 프론트: `stores/modbusTrafficStore.ts` — 링버퍼(cap 500) + append/clear + pause
- [x] 프론트: `useModbusInit`에서 `modbus:traffic` 구독
- [x] 프론트: `TrafficLogPanel.tsx` — Wireshark-lite (시각·FC·클라이언트·unit·주소범위·OK/EX)
- [x] 프론트: ModbusPanel "Traffic" 섹션 장착

## P2 — 클라이언트 통계 (P0 스트림을 프론트에서 집계 → 거의 공짜)
- [x] `aggregateClientStats` — 클라이언트별 요청수·예외수·마지막활동·FC 분포
- [x] `ClientStatsPanel.tsx` — connections + 트래픽 통계 병합 (끊긴 클라이언트도 표시)
- [x] RTU 클라이언트도 표시 (protocol 필드)

## P1 — 레지스터 값 제너레이터 (차별화 + "동적 샌드박스" 비전)
- [x] 백엔드: `generator.rs` — sine/ramp/square/random/counter + 10Hz 틱 루프(Simulation 쓰기)
- [x] 백엔드: 커맨드 `modbus_set_generators`/`modbus_get_generators` + ModbusState + lib.rs 등록
- [x] 백엔드: 단위 테스트 5종 (파형 값 계산)
- [x] 프론트: `types`/`service` 배선 (GeneratorConfig)
- [x] 프론트: `GeneratorPanel.tsx` — 추가/편집/삭제/토글, 백엔드 동기화
- [x] 프론트: ModbusPanel "Value Generators" 섹션

## 마무리
- [x] 프론트 타입체크(tsc) 통과 · 프론트 전체 스위트 1766 통과
- [ ] 네이티브 `cargo test modbus::` (telemetry+generator) 통과 — 진행 중
- [ ] 의미 단위로 커밋
- [ ] main 병합 + 워크트리 제거
