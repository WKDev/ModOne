//! Shared Modbus PDU (Protocol Data Unit) processing
//!
//! This module contains the transport-agnostic PDU handling logic
//! shared by both TCP and RTU servers. The PDU format is identical
//! regardless of the transport framing (MBAP header for TCP, CRC16 for RTU).

use super::memory::ModbusMemory;
use super::types::ChangeSource;

/// Process a Modbus request PDU and return the response PDU.
///
/// The `pdu` slice starts with the function code byte.
/// Returns the response PDU (also starting with the function code or exception).
pub fn process_request(memory: &ModbusMemory, function_code: u8, pdu: &[u8]) -> Vec<u8> {
    match function_code {
        // Function Code 0x01: Read Coils
        0x01 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03); // Illegal Data Value
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_coils(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() + 7) / 8;
                    let mut response = vec![function_code, byte_count as u8];
                    response.extend(pack_bits(&values));
                    response
                }
                Err(_) => exception_response(function_code, 0x02), // Illegal Data Address
            }
        }

        // Function Code 0x02: Read Discrete Inputs
        0x02 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_discrete_inputs(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() + 7) / 8;
                    let mut response = vec![function_code, byte_count as u8];
                    response.extend(pack_bits(&values));
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x03: Read Holding Registers
        0x03 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_holding_registers(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() * 2) as u8;
                    let mut response = vec![function_code, byte_count];
                    for value in values {
                        response.extend_from_slice(&value.to_be_bytes());
                    }
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x04: Read Input Registers
        0x04 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_input_registers(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() * 2) as u8;
                    let mut response = vec![function_code, byte_count];
                    for value in values {
                        response.extend_from_slice(&value.to_be_bytes());
                    }
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x05: Write Single Coil
        0x05 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let value = u16::from_be_bytes([pdu[3], pdu[4]]);
            let coil_value = value == 0xFF00;

            match memory.write_coil_with_source(addr, coil_value, ChangeSource::External) {
                Ok(_) => {
                    // Echo the request
                    pdu.to_vec()
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x06: Write Single Register
        0x06 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let value = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.write_holding_register_with_source(addr, value, ChangeSource::External) {
                Ok(_) => {
                    // Echo the request
                    pdu.to_vec()
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x0F: Write Multiple Coils
        0x0F => {
            if pdu.len() < 6 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);
            let byte_count = pdu[5] as usize;

            if pdu.len() < 6 + byte_count {
                return exception_response(function_code, 0x03);
            }

            let values = unpack_bits(&pdu[6..6 + byte_count], quantity as usize);

            match memory.write_coils_with_source(start_addr, &values, ChangeSource::External) {
                Ok(_) => {
                    vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]]
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x10: Write Multiple Registers
        0x10 => {
            if pdu.len() < 6 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);
            let byte_count = pdu[5] as usize;

            if pdu.len() < 6 + byte_count || byte_count != (quantity as usize) * 2 {
                return exception_response(function_code, 0x03);
            }

            let values: Vec<u16> = (0..quantity as usize)
                .map(|i| u16::from_be_bytes([pdu[6 + i * 2], pdu[7 + i * 2]]))
                .collect();

            match memory.write_holding_registers_with_source(
                start_addr,
                &values,
                ChangeSource::External,
            ) {
                Ok(_) => {
                    vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]]
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Unsupported function code
        _ => exception_response(function_code, 0x01), // Illegal Function
    }
}

/// Create a Modbus exception response
pub fn exception_response(function_code: u8, exception_code: u8) -> Vec<u8> {
    vec![function_code | 0x80, exception_code]
}

/// Pack boolean values into bytes (LSB first within each byte)
pub fn pack_bits(values: &[bool]) -> Vec<u8> {
    let byte_count = (values.len() + 7) / 8;
    let mut bytes = vec![0u8; byte_count];

    for (i, &value) in values.iter().enumerate() {
        if value {
            bytes[i / 8] |= 1 << (i % 8);
        }
    }

    bytes
}

/// Unpack bytes into boolean values (LSB first within each byte)
pub fn unpack_bits(bytes: &[u8], count: usize) -> Vec<bool> {
    let mut values = Vec::with_capacity(count);

    for i in 0..count {
        let byte_idx = i / 8;
        let bit_idx = i % 8;
        if byte_idx < bytes.len() {
            values.push((bytes[byte_idx] >> bit_idx) & 1 == 1);
        } else {
            values.push(false);
        }
    }

    values
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::types::MemoryMapSettings;

    #[test]
    fn test_pack_bits() {
        assert_eq!(
            pack_bits(&[true, false, true, false, false, false, false, false]),
            vec![0b00000101]
        );
        assert_eq!(
            pack_bits(&[true, true, true, true, true, true, true, true]),
            vec![0xff]
        );
        assert_eq!(
            pack_bits(&[false, false, false, false, false, false, false, false, true]),
            vec![0x00, 0x01]
        );
    }

    #[test]
    fn test_unpack_bits() {
        assert_eq!(
            unpack_bits(&[0b00000101], 8),
            vec![true, false, true, false, false, false, false, false]
        );
        assert_eq!(unpack_bits(&[0xff], 4), vec![true, true, true, true]);
    }

    #[test]
    fn test_pack_unpack_roundtrip() {
        let values = vec![true, false, true, false, false, false, false, false];
        let packed = pack_bits(&values);
        assert_eq!(packed, vec![0b00000101]);
        let unpacked = unpack_bits(&packed, 8);
        assert_eq!(unpacked, values);
    }

    #[test]
    fn test_exception_response() {
        let response = exception_response(0x03, 0x02);
        assert_eq!(response, vec![0x83, 0x02]);
    }

    #[test]
    fn test_process_read_holding_registers() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        memory.write_holding_register(0, 1234).unwrap();
        memory.write_holding_register(1, 5678).unwrap();

        // Function code 0x03, start=0, quantity=2
        let request = vec![0x03, 0x00, 0x00, 0x00, 0x02];
        let response = process_request(&memory, 0x03, &request);

        // Response: FC, byte_count, data
        assert_eq!(response[0], 0x03);
        assert_eq!(response[1], 4); // 2 registers * 2 bytes
        assert_eq!(u16::from_be_bytes([response[2], response[3]]), 1234);
        assert_eq!(u16::from_be_bytes([response[4], response[5]]), 5678);
    }

    #[test]
    fn test_process_write_single_register() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());

        // Function code 0x06, addr=10, value=4321
        let request = vec![0x06, 0x00, 0x0A, 0x10, 0xE1];
        let response = process_request(&memory, 0x06, &request);

        // Response should echo the request
        assert_eq!(response, request);

        // Verify value was written
        assert_eq!(memory.read_holding_registers(10, 1).unwrap(), vec![4321]);
    }

    #[test]
    fn test_process_read_coils() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        memory.write_coil(0, true).unwrap();
        memory.write_coil(2, true).unwrap();

        let request = vec![0x01, 0x00, 0x00, 0x00, 0x03];
        let response = process_request(&memory, 0x01, &request);

        assert_eq!(response[0], 0x01);
        assert_eq!(response[1], 1); // 1 byte for 3 coils
        assert_eq!(response[2], 0b00000101); // coil 0 and 2 are ON
    }

    #[test]
    fn test_process_unsupported_function() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        let request = vec![0x99];
        let response = process_request(&memory, 0x99, &request);
        assert_eq!(response, vec![0x99 | 0x80, 0x01]); // Illegal Function
    }

    #[test]
    fn test_process_short_pdu() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        // Too short for read coils (needs 5 bytes)
        let request = vec![0x01, 0x00];
        let response = process_request(&memory, 0x01, &request);
        assert_eq!(response, vec![0x81, 0x03]); // Illegal Data Value
    }
}
