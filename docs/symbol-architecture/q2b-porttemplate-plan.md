# Q2 트랙 B 설계 — 선언적 XML PortTemplate (Rust 경로 포함)

> 커스텀/builtin XML 심볼이 인스턴스 속성으로 포트 개수를 가변화할 수 있게 한다.
> 트랙 A(scope 코드 함수)에서 검증한 "속성 변경 → ports 재계산"을 선언적으로 일반화.
> 상태: **설계 확정, 구현 보류**(사용자 지시 2026-06-27).

## 1. 결정 (B-1~B-4)

- **B-1 위치 = 명시 속성.** 표현식 DSL 없음. `xStart/xStep` 또는 `yStart/yStep`로 등간격.
- **B-2 해석 = 순수 유틸.** `resolveInstancePorts(def, instanceProps): Port[]` 별도 파일, customSymbolBridge가 호출.
- **B-3 인스턴스 UI = IndustrialProperties 확장.** 커스텀 심볼 `instanceProperties` 편집 + ports 재계산.
- **B-4 저작 = XML 수기 먼저.** 심볼에디터 PortTemplate 저작 UI는 후속.

## 2. 아키텍처 사실 (코드 검증 2026-06-27) — 비용을 가르는 지점

심볼 XML 파서가 **세 경로**다.

| 경로 | 위치 | 용도 | PortTemplate 작업 |
|---|---|---|---|
| TS 서비스 파서/직렬화 | `services/symbolXmlParser.ts` `parseSymbolXml`(430)·`symbolToXml`(481) | **builtin 로딩**(`builtin-symbols/index.ts:19`) + 에디터 저작 | **수정 필요(핵심)** |
| TS lib 파서 | `lib/symbolXmlParse.ts`·`xmlElementParsers.ts` | 레거시/라운드트립 테스트용 | 선택(테스트 일관성용) |
| Rust 파서 | `src-tauri/src/symbols/xml_parser.rs` `parse_symbol_xml`(36) | **프로젝트 저장 커스텀 심볼 로드**(`blockRegistry.loadProjectSymbols`→ProjectBlockLoader) | Phase 5(보류) |

핵심 두 사실.
- **import는 프론트 XML을 그대로 기록.** `project_block_loader.rs:318 import_xml` → `fs::write(xml_content)` 그대로. **Rust 직렬화 불필요.** `symbolToXml`이 만든 `<ms:PortTemplate>`가 디스크에 그대로 보존됨.
- **Rust 파서는 모르는 요소를 스킵.** `parse_ports_section`(368)은 `<Port>`만 수집. `<PortTemplate>`는 무시 → **Rust 미수정 시 정적 포트만 로드되는 graceful degradation**(크래시 없음). 단, 동적 포트는 로드 안 됨.

결론. **프론트엔드만으로 builtin·에디터 심볼은 완전 동작.** 프로젝트 저장 커스텀 심볼의 "로드 시 동적 포트 복원"만 Rust 파서+타입이 필요(직렬화는 불필요). 그래서 프론트 먼저, Rust는 additive 패리티.

## 3. 스키마

```xml
<ms:Ports>
  <ms:Port id="trig" name="TRIG" .../>            <!-- 정적 포트 유지 -->
  <ms:PortTemplate repeat="channels" min="1" max="8"
    idPattern="ch{i}" namePattern="CH{i}" numberFrom="1"
    type="input" electricalType="input" functionalRole="general"
    orientation="left" shape="line"
    x="0" yStart="10" yStep="10"/>
</ms:Ports>
```
- `repeat` = 개수 제어 Property key. `min/max` 클램프.
- `{i}` 1-base 치환. 좌/우 엣지: `x` 고정 + `yStart+(i-1)*yStep`. 상/하: `y` 고정 + `xStart+(i-1)*xStep`.
- 개수 = `clamp(instanceProps[repeat] ?? def.properties[repeat] 기본값, min, max)`.

## 4. 타입 / 터치 포인트

### 타입
- TS: `types/symbol.ts` `SymbolDefinition`에 `portTemplates?: PortTemplate[]`(pins 다음, 280 근처). 신규 `PortTemplate` 인터페이스.
- Rust(Phase 5): `src-tauri/src/symbols/types.rs:250 SymbolDefinition`에 `#[serde(skip_serializing_if="Option::is_none")] pub port_templates: Option<Vec<PortTemplate>>` + `PortTemplate` 구조체(serde). 하위호환 OK.

### 함수 (프론트, Phase 1~3)
- 파싱: `services/symbolXmlParser.ts` — `<ms:Ports>` 파싱 시 `parsePortTemplate()` 추가, `parseSymbolXml`(430)이 `def.portTemplates` 채움.
- 직렬화: `symbolToXml`(481) 포트 블록(506-515) 뒤에 PortTemplate 출력.
- 해석: 신규 `resolveInstancePorts(def, instanceProps)` — 정적 pins + 펼친 템플릿 ports 병합(offset 기반, absolutePosition 미설정 = 트랙 A와 동일).
- 브릿지: `customSymbolBridge.ts` `getCustomSymbolPorts(symbolId, instanceProps?)` 확장 + `buildPorts`(151) 경로에서 해석 사용.
- UI: `panels/content/properties/IndustrialProperties.tsx` — custom_symbol에 `instanceProperties` 편집 + `repeat` key 변경 시 ports 재계산 저장.

### 함수 (Rust, Phase 5 — 보류)
- `xml_parser.rs parse_ports_section`(368): `<PortTemplate>` Empty 요소 인식 → `parse_port_template_from_attrs`.
- `types.rs`: 위 구조체 필드. **직렬화 함수 불필요**(import verbatim).

## 5. 단계 (각 단계 끝 검증)

- **Phase 1 — TS 데이터 레이어**: 타입 + services 파서 파싱 + symbolToXml 직렬화 + 라운드트립 테스트. 동작 변화 없음.
- **Phase 2 — TS 인스턴스 해석**: `resolveInstancePorts` + customSymbolBridge 인스턴스 인지 + 생성/렌더 배선. 단위 테스트.
- **Phase 3 — TS 인스턴스 UI**: IndustrialProperties 속성 편집 + ports 재계산. 컴포넌트 테스트 + 실앱.
- **Phase 4 — 데모 + 검증**: PortTemplate를 쓰는 builtin 샘플(가변 단자 스트립 / 멀티채널 커넥터). 배치 후 속성으로 포트 수 변경.
- **Phase 5 — Rust 패리티(보류)**: Rust 파서+타입으로 프로젝트 저장 커스텀 심볼 로드 시 동적 포트 복원. **Rust 재빌드 필요(메모리 `native-build-gotchas`: opcua 기본 feature로 openssl ~1h 가능 → `--no-default-features` + `with-perl.ps1` 검토).** 그전까지 프로젝트 저장 커스텀 심볼은 정적 포트만(graceful).

## 6. 리스크 / 비범위
- Rust 빌드 비용(Phase 5). 프론트(1~4)는 빠름.
- 채널 축소 시 사라진 포트의 dangling wire(트랙 A와 동일, 범위 밖).
- 비범위: 심볼에디터 PortTemplate 저작 UI(B-4 후속), 표현식 DSL(B-1), 불규칙/조건부 포트(T3).

## 7. 다음 세션 착수 지점
- Phase 1부터. `types/symbol.ts` PortTemplate 타입 → `services/symbolXmlParser.ts` parse/serialize → `src/__tests__/symbolXmlParser.test.ts`에 라운드트립 케이스.
