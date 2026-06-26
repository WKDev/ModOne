# Designation prefix 매핑표 (확정)

ModOne 부품 종류 ↔ designation prefix. IEC 81346-2:2019를 기준으로 하되,
전기회로 도면 관례가 표준보다 합리적인 곳은 관례를 따른다(아래 "이탈" 참고).
이 표가 각 `.symbol.xml`의 `<ms:DesignationPrefix>` 값이 된다.

## 확정 매핑

| 부품(symbol) | prefix | 근거 |
|------|:---:|------|
| powersource, power_source_dc_2p, power_source_ac_1p/2p | **G** | 에너지 공급원 (81346) |
| motor | **M** | 구동 기계 에너지 (81346) |
| relay | **K** | 신호 처리(릴레이) (81346) |
| contactor | **K** | 제어회로 관례 ※81346 엄격은 Q |
| timer_on_delay, timer_off_delay | **K** | 시간지연 = 신호 처리 |
| counter_up, counter_down | **K** | 정보 처리 |
| plc_in, plc_out | **K** | I/O 채널 = 신호 처리 풀 |
| fuse | **F** | 보호 (81346) |
| overload_relay | **F** | 과부하 보호 |
| circuit_breaker | **F** | 보호 ※모터차단기는 Q가 맞을 수 있음 |
| sensor | **B** | 물리량→신호 (81346) |
| pilot_lamp, scope | **P** | 정보 표시/계측 (81346) |
| led | **P** | 표시등 ※광원으로 보면 E |
| capacitor | **C** | 에너지 저장 (81346) |
| transformer | **T** | 에너지 변환(종류 보존) (81346) |
| resistor | **R** | 저항 (81346 R) |
| inductor | **L** | 전기회로 관례 ※81346 엄격은 R |
| diode | **D** | 전기회로 관례 ※IEC 반도체 관례는 V |
| push_button_no/nc, button, selector_switch | **S** | 수동 조작→신호 (81346) |
| switch_no, switch_nc, switch_changeover | **S** | 수동 스위치 |
| emergency_stop | **S** | 수동→신호 ※안전기능으로 보면 F |
| terminal, terminal_block, connector | **X** | 연결 (81346) |
| disconnect_switch | **Q** | 에너지 흐름 차단/절체 (81346) |
| solenoid_valve | **Q** | 유체 흐름 제어 스위칭 (81346) |

## prefix 미부여 (자동 넘버링 스킵, prefix `undefined`)

- ground — 접지 기준점, refdes 없음
- net_label — 라벨이지 디바이스 아님
- off_page_connector — 교차참조
- text — 주석
- custom_symbol — 사용자 정의(기본 prefix 없음)
- junction_box — 정션박스(확정: 스킵. 필요 시 X로)
- **relay_contact_no, relay_contact_nc** — 아래 caveat 참고

## 81346 표준에서 의도적으로 이탈한 항목 (사용자 확정)

| 부품 | 적용값 | 81346 엄격 | 이유 |
|------|:---:|:---:|------|
| contactor | K | Q | 모터제어 도면 관례(릴레이와 같은 풀) |
| inductor | L | R | 전기회로 가독성 |
| diode | D | R(또는 V) | 전기회로 가독성, R/L/C와 짝 |
| plc_in/out | K | A | I/O를 신호처리 풀로 통일 |

## 표준 기본값으로 적용(미질문, 바꾸기 쉬움)

led=P, emergency_stop=S, circuit_breaker=F, disconnect_switch=Q,
solenoid_valve=Q. 원하면 한 줄로 교체 가능.

## Caveat — relay_contact_* 는 자동 넘버링 제외

릴레이 접점(relay_contact_no/nc)은 새 디바이스가 아니라 어떤 릴레이(K1)의
*접점*이다. 표준상 코일 K1과 그 접점은 **같은 designation K1**을 공유한다.
단순 자동 넘버링은 접점에 새 번호(K2…)를 줘서 의미가 틀어진다.
→ 이번엔 relay_contact_*에 prefix를 부여하지 않는다(자동 넘버링 스킵).
coil↔contact 링크는 netlist 영역으로 별도 작업. **이번 범위 밖.**

## prefix 그룹 요약 (카운터 풀)

같은 prefix = 같은 카운터. 즉 아래 묶음끼리 번호를 공유한다.

- **K** (가장 큼): relay, contactor, timer×2, counter×2, plc_in, plc_out
- **G**: power source 4종
- **F**: fuse, overload_relay, circuit_breaker
- **S**: push_button×2, button, selector_switch, switch×3, emergency_stop
- **P**: pilot_lamp, scope, led
- **Q**: disconnect_switch, solenoid_valve
- **X**: terminal, terminal_block, connector
- 단독: M, B, C, T, R, L, D

> 주의: K 풀이 매우 크다. relay·contactor·timer·counter·PLC가 모두 K1,K2,K3…를
> 공유하므로 번호가 빠르게 커진다. 종류별로 번호를 분리하고 싶으면(예: 릴레이는 K,
> 타이머는 KT, 카운터는 KC) prefix를 2글자로 세분하면 된다 — 추후 조정 가능.
