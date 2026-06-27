<!-- 멀티-CPU 설계 미결정 3건의 확정 결정 기록 (ADR) -->
# 멀티-CPU 결정 기록 (01-design-review §E 해소)

> [01-design-review.md](./01-design-review.md) §E의 미결정 3건을 확정한다.
> 이 결정들이 [00-design.md](./00-design.md) §D 개정의 입력이 된다.

## 결정 1 — 권위(authority) 모델: **기존 모델 재사용, 재발명 금지**

검토 C.1은 "area-aware authority를 새로 설계"라 했으나, **이미 존재한다.**
(`crates/modone-contract/src/types.rs:102-152`)

- `CanonicalAccess { ReadOnly, ReadWrite, InternalOnly }`
- `CanonicalWriteSource { InternalRuntime, Simulation, ExternalProtocol, ... }`
- `CanonicalAreaKind::default_access()`가 이미 area별 분류:
  Timer/Counter/System → `InternalOnly`(외부 프로토콜 쓰기 불가),
  Special → `ReadOnly`, 나머지(Input/Output/Internal/Retentive/Data 등) → `ReadWrite`.
- `CanonicalAccess::allows_write(source)`가 강제(`types.rs:110-119`).

→ "Modbus 클라이언트는 D엔 쓰되 타이머엔 못 쓴다"가 이미 구현됨. 일반
write-owner 태그 시스템(검토 §3의 초안)은 **폐기**.

**멀티-CPU가 더할 것 = 최소 2가지:**
1. **`CanonicalWriteSource::CpuLink` 변형 추가** — 링크 복사를 감사·구분 가능하게.
   접근 판정상 외부 취급(`is_internal()==false`) → InternalOnly 영역은 못 씀,
   ReadWrite 영역만 씀. (실 CPU 미러는 기존 `ExternalProtocol` 의미 재사용.)
2. **링크 타깃 정적(config-time) 검증** — 런타임 per-cell owner 시스템이 아니라
   설정 로드 시점 그래프 검증으로 충돌을 막는다. 비용이 훨씬 싸다.
   - 규칙 a: 같은 dst 셀에 2개 이상 링크 금지(겹침 거부).
   - 규칙 b: 가상 CPU dst는 그 CPU **래더가 쓰는 영역과 겹치면 거부**. 가상
     소비자는 컴파일된 프로그램에서 쓰기 대상(코일/MOV dest)을 정적 추출해 대조.
   - 관례: 링크는 소비 CPU의 **입력성 영역**(InputBit + 예약된 link DataWord
     영역)을 타깃으로 한다. PLC 관례상 래더는 자기 입력을 출력 위상에서 쓰지
     않으므로 싸움이 원천 차단됨.

→ 검토 C.4(순환 발진)도 이 규칙 a/b로 해소(dst가 read-only 성격 → 역방향
트리거 없음).

## 결정 2 — 커맨드 `cpu_id` 기본값: **Option + primary 규칙**

- 커맨드 시그니처: `cpu_id: Option<CpuId>`. `None` → 프로젝트 **primary CPU**.
- primary 선정: config에서 `primary: true` **명시 플래그**. 없으면 **선언
  순서 첫 CPU**가 primary.
- 단일 CPU 프로젝트: 그 CPU가 자동 primary → 기존 모든 sim_* 커맨드가
  `None`으로 동작하여 **완전 하위 호환**(기존 프론트 코드 무수정 동작).
- 프론트엔드는 점진 이행: 멀티-CPU UI가 붙기 전까지 cpu_id 생략 = primary.

## 결정 3 — v1 서버 노출: **단일 엔드포인트 + unit_id/네임스페이스 라우팅**

(유저 확정.) 내부는 N-CPU 구동, 외부 노출은 한 엔드포인트에서 논리 라우팅.

- **Modbus**: 한 TCP 리스너(502) + **`unit_id` → `CpuId` 디스패치**. 현재
  코덱은 단일 unit만 처리(`modbus/types.rs:51`, 코덱에 unit 디스패치 부재 확인)
  → **코덱 신규 작업 필요**(v1 범위에 포함).
- **OPC-UA**: 한 서버 + **CPU별 네임스페이스/폴더**로 노드 트리 분리.
- CPU별 별도 포트는 채택 안 함(검토 B.2 비추천 유지). 격리가 꼭 필요할 때의
  옵션으로만 문서에 남김.

**비용 메모**: 이 결정으로 v1에 modbus-codec의 멀티-unit 디스패치가 추가된다.
태그키 `(cpu_id, addr)`(검토 B.3)와 결합해 unit_id↔cpu_id 매핑 테이블이 필요.

## 00-design 개정 지시 (§D 갱신)
- §3 권위: "신규 area-aware 설계" → **"기존 CanonicalAccess/WriteSource 재사용
  + CpuLink 변형 + 정적 링크 검증"**으로 교체(결정 1).
- §2 서버: unit_id/네임스페이스 라우팅 확정(결정 3), modbus-codec 멀티-unit
  작업을 v1 범위로 명시.
- 커맨드 라우팅: `Option<CpuId>` + primary 규칙 명문화(결정 2).
