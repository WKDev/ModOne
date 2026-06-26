// 다중 레지스터 값의 바이트(워드) 순서 정의 및 논리/주소 순서 재배열 헬퍼

use serde::{Deserialize, Serialize};

/// Byte order used when assembling multi-register values.
///
/// Determines the order in which consecutive U16 registers are combined into
/// wider types (32-bit, 64-bit, etc.).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ByteOrder {
    /// Big-endian (most-significant word first) — default for most PLCs.
    BigEndian,
    /// Little-endian (least-significant word first).
    LittleEndian,
    /// Big-endian with swapped adjacent words (BA-DC pattern).
    BigEndianWordSwap,
    /// Little-endian with swapped adjacent words (CD-AB pattern).
    LittleEndianWordSwap,
}

impl Default for ByteOrder {
    fn default() -> Self {
        Self::BigEndian
    }
}

impl std::fmt::Display for ByteOrder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::BigEndian => "BigEndian",
            Self::LittleEndian => "LittleEndian",
            Self::BigEndianWordSwap => "BigEndianWordSwap",
            Self::LittleEndianWordSwap => "LittleEndianWordSwap",
        };
        write!(f, "{}", name)
    }
}

// ---------------------------------------------------------------------------
// Byte-order helpers: arrange U16 registers into a canonical word array
// ---------------------------------------------------------------------------

impl ByteOrder {
    /// Reorder a slice of U16 registers into *logical* order (MSW first)
    /// according to this byte order.
    ///
    /// The returned `Vec` always has most-significant word at index 0.
    /// Input `regs` are in address order (register N, N+1, …).
    /// `LittleEndianWordSwap`의 다중 레지스터 해석 규약 전환 플래그.
    ///
    /// "리틀엔디안 + 워드스왑"의 정확한 레지스터 배열은 벤더/게이트웨이마다 정의가
    /// 달라 단일 정답이 없다. 내부 플래그로 언제든 전환할 수 있게 둔다.
    /// - `false`(기본, 권장): 인접 워드쌍 스왑 후 전체 반전.
    ///   `[1,2,3,4] → [3,4,1,2]`. `LittleEndian`(`[4,3,2,1]`)과 구별되고
    ///   `to`/`from`이 서로 역함수라 round-trip이 일관된다.
    /// - `true`: 전체 반전만. `[1,2,3,4] → [4,3,2,1]`. 단 이 결과는 평범한
    ///   `LittleEndian`과 동일해져 워드스왑 변형이 사실상 무의미해진다.
    ///   (특정 레거시 장비 호환이 필요할 때만 켠다.)
    const LITTLE_ENDIAN_WORD_SWAP_FULL_REVERSE: bool = false;

    pub fn to_logical_order(&self, regs: &[u16]) -> Vec<u16> {
        match self {
            ByteOrder::BigEndian => regs.to_vec(),
            ByteOrder::LittleEndian => {
                let mut v = regs.to_vec();
                v.reverse();
                v
            }
            // Big-endian but adjacent word-pairs are swapped (AB-CD → BA-DC).
            ByteOrder::BigEndianWordSwap => {
                let mut v = regs.to_vec();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }
            // Little-endian but adjacent word-pairs are swapped (CD-AB → DC-BA).
            ByteOrder::LittleEndianWordSwap => {
                let mut v = regs.to_vec();
                if !Self::LITTLE_ENDIAN_WORD_SWAP_FULL_REVERSE {
                    for chunk in v.chunks_exact_mut(2) {
                        chunk.swap(0, 1);
                    }
                }
                v.reverse();
                v
            }
        }
    }

    /// Convert a logical-order word array (MSW first) back into address-order
    /// registers according to this byte order.
    pub fn from_logical_order(&self, logical: &[u16]) -> Vec<u16> {
        match self {
            ByteOrder::BigEndian => logical.to_vec(),
            ByteOrder::LittleEndian => {
                let mut v = logical.to_vec();
                v.reverse();
                v
            }
            ByteOrder::BigEndianWordSwap => {
                let mut v = logical.to_vec();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }
            ByteOrder::LittleEndianWordSwap => {
                let mut v = logical.to_vec();
                v.reverse();
                if !Self::LITTLE_ENDIAN_WORD_SWAP_FULL_REVERSE {
                    for chunk in v.chunks_exact_mut(2) {
                        chunk.swap(0, 1);
                    }
                }
                v
            }
        }
    }
}

/// Splits a U16 register into two bytes according to byte order.
/// Returns `(first_byte, second_byte)` where "first" is the byte at
/// the lower string offset.
pub(crate) fn split_register(reg: u16, byte_order: ByteOrder) -> (u8, u8) {
    match byte_order {
        ByteOrder::BigEndian | ByteOrder::BigEndianWordSwap => {
            ((reg >> 8) as u8, (reg & 0xFF) as u8)
        }
        ByteOrder::LittleEndian | ByteOrder::LittleEndianWordSwap => {
            ((reg & 0xFF) as u8, (reg >> 8) as u8)
        }
    }
}

/// Combines two bytes into a U16 register according to byte order.
/// `b0` is the first character byte (lower string offset).
pub(crate) fn combine_bytes(b0: u8, b1: u8, byte_order: ByteOrder) -> u16 {
    match byte_order {
        ByteOrder::BigEndian | ByteOrder::BigEndianWordSwap => {
            ((b0 as u16) << 8) | (b1 as u16)
        }
        ByteOrder::LittleEndian | ByteOrder::LittleEndianWordSwap => {
            ((b1 as u16) << 8) | (b0 as u16)
        }
    }
}
