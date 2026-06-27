// 태그별 OPC UA 매핑 설정(데이터타입/바이트오더/스케일링/데드밴드)의 프론트엔드 타입
// 백엔드 OpcUaMappingConfig(serde camelCase)와 1:1 대응한다.

export type OpcUaDataTypeName =
  | 'Boolean'
  | 'SByte'
  | 'Byte'
  | 'Int16'
  | 'UInt16'
  | 'Int32'
  | 'UInt32'
  | 'Int64'
  | 'UInt64'
  | 'Float'
  | 'Double'
  | 'String';

export type ByteOrderName =
  | 'BigEndian'
  | 'LittleEndian'
  | 'BigEndianWordSwap'
  | 'LittleEndianWordSwap';

export type MappingAccessLevelName = 'ReadOnly' | 'ReadWrite';

export type ScalingKindName = 'None' | 'Linear' | 'SquareRoot';
export type DeadbandKindName = 'None' | 'Absolute' | 'Percent';

export interface ScalingConfig {
  kind: ScalingKindName;
  rawLow: number;
  rawHigh: number;
  engLow: number;
  engHigh: number;
  clamp: boolean;
}

export interface DeadbandConfig {
  kind: DeadbandKindName;
  /** Absolute: 노출 단위. Percent: 0..100(스케일링 eng 폭 대비). */
  value: number;
}

export interface OpcUaMappingConfig {
  opcuaDataType: OpcUaDataTypeName;
  wordCount: number;
  byteOrder: ByteOrderName;
  accessLevel: MappingAccessLevelName;
  description?: string | null;
  /** 비활성 시 백엔드가 생략하므로 optional. */
  scaling?: ScalingConfig;
  /** 비활성 시 백엔드가 생략하므로 optional. */
  deadband?: DeadbandConfig;
}

/** OPC UA 표준 데이터타입과 차지하는 최소 레지스터(워드) 수. */
export const OPCUA_DATA_TYPES: ReadonlyArray<{ name: OpcUaDataTypeName; words: number }> = [
  { name: 'Boolean', words: 1 },
  { name: 'SByte', words: 1 },
  { name: 'Byte', words: 1 },
  { name: 'Int16', words: 1 },
  { name: 'UInt16', words: 1 },
  { name: 'Int32', words: 2 },
  { name: 'UInt32', words: 2 },
  { name: 'Int64', words: 4 },
  { name: 'UInt64', words: 4 },
  { name: 'Float', words: 2 },
  { name: 'Double', words: 4 },
  { name: 'String', words: 1 },
];

export const NUMERIC_DATA_TYPES: ReadonlyArray<OpcUaDataTypeName> = [
  'SByte', 'Byte', 'Int16', 'UInt16', 'Int32', 'UInt32', 'Int64', 'UInt64', 'Float', 'Double',
];

export function isNumericDataType(t: OpcUaDataTypeName): boolean {
  return NUMERIC_DATA_TYPES.includes(t);
}

export function defaultScaling(): ScalingConfig {
  return { kind: 'None', rawLow: 0, rawHigh: 0, engLow: 0, engHigh: 0, clamp: true };
}

export function defaultDeadband(): DeadbandConfig {
  return { kind: 'None', value: 0 };
}
