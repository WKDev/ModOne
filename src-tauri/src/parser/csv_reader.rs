//! CSV Reader for XG5000 Ladder Logic Exports
//!
//! Parses CSV files exported from LS Electric XG5000 software,
//! handling quoted fields and Korean character comments.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use thiserror::Error;

/// Errors that can occur during CSV parsing
#[derive(Error, Debug)]
pub enum CsvParseError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid CSV format at line {line}: {message}")]
    InvalidFormat { line: usize, message: String },

    #[error("Missing required field at line {line}: {field}")]
    MissingField { line: usize, field: String },
}

/// Serializable result for Tauri commands
pub type CsvParseResult<T> = Result<T, CsvParseError>;

/// CSV Row from XG5000 export
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvRow {
    /// Row number in CSV
    pub no: u32,
    /// Network/Rung number (step)
    pub step: u32,
    /// Instruction mnemonic
    pub instruction: String,
    /// First operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand1: Option<String>,
    /// Second operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand2: Option<String>,
    /// Third operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand3: Option<String>,
    /// Comment (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

/// CSV Reader for XG5000 ladder logic exports
pub struct CsvReader<R: Read> {
    reader: BufReader<R>,
    skip_header: bool,
    line_number: usize,
}

impl<R: Read> CsvReader<R> {
    /// Create a new CSV reader
    pub fn new(reader: R) -> Self {
        Self {
            reader: BufReader::new(reader),
            skip_header: true,
            line_number: 0,
        }
    }

    /// Create a new CSV reader without header skipping
    pub fn without_header(reader: R) -> Self {
        Self {
            reader: BufReader::new(reader),
            skip_header: false,
            line_number: 0,
        }
    }

    /// Read all rows from the CSV
    pub fn read_all(&mut self) -> CsvParseResult<Vec<CsvRow>> {
        let mut rows = Vec::new();
        let mut line = String::new();

        while self.reader.read_line(&mut line)? > 0 {
            self.line_number += 1;

            // Skip header row
            if self.line_number == 1 && self.skip_header {
                let lower = line.to_lowercase();
                if lower.contains("no") && (lower.contains("step") || lower.contains("instruction"))
                {
                    line.clear();
                    continue;
                }
            }

            // Skip empty lines
            if line.trim().is_empty() {
                line.clear();
                continue;
            }

            // Parse line
            match self.parse_line(&line) {
                Ok(Some(row)) => rows.push(row),
                Ok(None) => {} // Skip malformed lines
                Err(e) => {
                    log::warn!("Skipping line {}: {}", self.line_number, e);
                }
            }

            line.clear();
        }

        Ok(rows)
    }

    /// Parse a single CSV line into a CsvRow
    fn parse_line(&self, line: &str) -> CsvParseResult<Option<CsvRow>> {
        let fields = self.split_csv_line(line);

        // Need at least no, step, instruction
        if fields.len() < 3 {
            return Ok(None);
        }

        // Parse no and step
        let no = match fields[0].parse::<u32>() {
            Ok(n) => n,
            Err(_) => return Ok(None), // Skip invalid rows
        };

        let step = match fields[1].parse::<u32>() {
            Ok(n) => n,
            Err(_) => return Ok(None),
        };

        let instruction = fields[2].to_uppercase();
        if instruction.is_empty() {
            return Ok(None);
        }

        Ok(Some(CsvRow {
            no,
            step,
            instruction,
            operand1: Self::optional_field(&fields, 3),
            operand2: Self::optional_field(&fields, 4),
            operand3: Self::optional_field(&fields, 5),
            comment: Self::optional_field(&fields, 6),
        }))
    }

    /// Get optional field from array
    fn optional_field(fields: &[String], index: usize) -> Option<String> {
        fields
            .get(index)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    }

    /// Split a CSV line into fields, handling quoted values
    fn split_csv_line(&self, line: &str) -> Vec<String> {
        let mut fields = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut chars = line.trim().chars().peekable();

        while let Some(ch) = chars.next() {
            match ch {
                '"' => {
                    if in_quotes && chars.peek() == Some(&'"') {
                        // Escaped quote
                        current.push('"');
                        chars.next();
                    } else {
                        in_quotes = !in_quotes;
                    }
                }
                ',' if !in_quotes => {
                    fields.push(current.trim().to_string());
                    current.clear();
                }
                _ => current.push(ch),
            }
        }

        // Don't forget the last field
        fields.push(current.trim().to_string());

        fields
    }
}

/// Parse CSV content string and return all rows
pub fn parse_csv_content(content: &str) -> CsvParseResult<Vec<CsvRow>> {
    let cursor = std::io::Cursor::new(content);
    let mut reader = CsvReader::new(cursor);
    reader.read_all()
}

/// Parse CSV content and group by step
pub fn parse_csv_grouped(content: &str) -> CsvParseResult<HashMap<u32, Vec<CsvRow>>> {
    let rows = parse_csv_content(content)?;
    let mut groups: HashMap<u32, Vec<CsvRow>> = HashMap::new();

    for row in rows {
        groups.entry(row.step).or_default().push(row);
    }

    Ok(groups)
}

/// Parse CSV file and return all rows
pub fn parse_csv_file(path: &str) -> CsvParseResult<Vec<CsvRow>> {
    let file = std::fs::File::open(path)?;
    let mut reader = CsvReader::new(file);
    reader.read_all()
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_CSV: &str = r#"NO,STEP,INSTRUCTION,OPERAND1,OPERAND2,OPERAND3,COMMENT
1,0,LOAD,M0000,,,Start condition
2,0,AND,M0001,,,
3,0,OUT,P0000,,,Output
4,1,LOAD,M0010,,,
5,1,TON,T0000,100,,Timer 100ms
"#;

    #[test]
    fn test_parse_csv_content() {
        let rows = parse_csv_content(SAMPLE_CSV).unwrap();
        assert_eq!(rows.len(), 5);
        assert_eq!(rows[0].no, 1);
        assert_eq!(rows[0].step, 0);
        assert_eq!(rows[0].instruction, "LOAD");
        assert_eq!(rows[0].operand1, Some("M0000".to_string()));
        assert_eq!(rows[0].comment, Some("Start condition".to_string()));
    }

    #[test]
    fn test_parse_csv_grouped() {
        let groups = parse_csv_grouped(SAMPLE_CSV).unwrap();
        assert_eq!(groups.len(), 2);
        assert_eq!(groups.get(&0).unwrap().len(), 3);
        assert_eq!(groups.get(&1).unwrap().len(), 2);
    }

    #[test]
    fn test_quoted_fields() {
        let csv = r#"NO,STEP,INSTRUCTION,OPERAND1,OPERAND2,OPERAND3,COMMENT
1,0,LOAD,M0000,,,"Comment with, comma"
2,0,AND,M0001,,,"Say ""hello"""
"#;
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows[0].comment, Some("Comment with, comma".to_string()));
        assert_eq!(rows[1].comment, Some("Say \"hello\"".to_string()));
    }

    #[test]
    fn test_korean_comments() {
        let csv = r#"NO,STEP,INSTRUCTION,OPERAND1,OPERAND2,OPERAND3,COMMENT
1,0,LOAD,M0000,,,시작 조건
2,0,OUT,P0000,,,출력
"#;
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows[0].comment, Some("시작 조건".to_string()));
        assert_eq!(rows[1].comment, Some("출력".to_string()));
    }

    #[test]
    fn test_empty_optional_fields() {
        let csv = r#"NO,STEP,INSTRUCTION,OPERAND1,OPERAND2,OPERAND3,COMMENT
1,0,ORB,,,,
"#;
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows[0].instruction, "ORB");
        assert!(rows[0].operand1.is_none());
        assert!(rows[0].operand2.is_none());
        assert!(rows[0].operand3.is_none());
        assert!(rows[0].comment.is_none());
    }

    #[test]
    fn test_malformed_rows_skipped() {
        let csv = r#"NO,STEP,INSTRUCTION,OPERAND1
invalid,row,here
1,0,LOAD,M0000
,,,
2,0,OUT,P0000
"#;
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 2);
    }
}
