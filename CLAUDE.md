# Claude Code Instructions

## Development Environment
- **Platform:** Windows
- **Package Manager:** pnpm (use `pnpm` instead of `npm` for all package operations)
- **Commands:** Use `pnpm install`, `pnpm add`, `pnpm run` etc.

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Obsidian Integration
- **Base Path:** `03_Projects/04_ModOne` in the connected Obsidian vault
- Use MCP Obsidian tools (`obsidian_append_content`, `obsidian_get_file_contents`, etc.)

### 폴더 구조 및 용도
```
03_Projects/04_ModOne/
├── 00_Overview.md          # 프로젝트 허브 (항상 최신 상태 유지)
├── 01_PRDs/                # PRD 문서
├── 02_Architecture/        # 시스템 설계, 컴포넌트 구조
├── 03_DevLogs/             # 일일 개발 로그 (YYYY-MM-DD.md)
├── 04_Decisions/           # ADR (ADR-XXX-제목.md)
├── 05_Tasks/               # 수동 태스크 관리
├── 06_TroubleShooting/     # 문제 해결 기록 (TS-XXX-문제요약.md)
└── 07_Canvas/              # 다이어그램, 플로우차트 (.canvas)
```

### 언제 어디에 기록할 것인가
| 상황 | 기록 위치 | 예시 |
|------|----------|------|
| 작업 시작/종료 | `03_DevLogs/YYYY-MM-DD.md` | 오늘 한 일, 내일 할 일 |
| 기술 선택 이유 | `04_Decisions/ADR-XXX.md` | 왜 Tauri를 선택했는가 |
| 버그/에러 해결 | `06_TroubleShooting/TS-XXX.md` | 빌드 에러 해결 과정 |
| 시스템 구조 변경 | `02_Architecture/` | 컴포넌트 구조도 |
| 복잡한 플로우 | `07_Canvas/*.canvas` | 데이터 흐름도 |

## Work Logging & Git Workflow
작업 완료 시 반드시 다음 절차를 수행:

### 자동 커밋 정책
- **태스크 완료 시 자동 커밋**: 태스크나 의미 있는 작업 단위 완료 시 자동으로 커밋 수행
- **커밋 타이밍**: 기능 구현 완료, 버그 수정 완료, 리팩토링 완료 등 논리적 작업 단위 기준
- **커밋 전 확인**: 빌드 성공 여부 확인 후 커밋

### 1. 브랜치 분기 (대규모 기능 작업 시)
```bash
git checkout -b <type>/<name>
```
- 새로운 기능: `feature/<기능명>`
- 버그 수정: `fix/<버그명>`
- 리팩토링: `refactor/<대상>`
- 문서 작업: `docs/<문서명>`
- 작은 수정이나 연속 작업은 main/master에 직접 커밋 가능

### 2. 커밋 규칙
```
<type>: <subject>

<body>
```
- feat: 새로운 기능 추가
- fix: 버그 수정
- refactor: 코드 리팩토링
- docs: 문서 수정
- style: 코드 포맷팅
- test: 테스트 코드 추가/수정
- chore: 빌드, 설정 파일 등 수정

### 3. 작업 완료 후 기록 (필수)
1. **DevLog 업데이트:** `03_DevLogs/YYYY-MM-DD.md`에 작업 내용 추가
2. **관련 문서 업데이트:** 필요시 `02_Architecture/`, `04_Decisions/` 등 업데이트
3. **Task Master 상태 변경:** 해당 태스크 `done` 처리
4. **00_Overview.md 갱신:** 프로젝트 상태 반영

## Obsidian Logging Guide

### 필수 Frontmatter
모든 노트에 반드시 포함:
```yaml
---
date: YYYY-MM-DD
tags: [modone, 관련태그]
project: ModOne
---
```

### 파일별 추가 Frontmatter
**ADR (04_Decisions/):**
```yaml
status: proposed | accepted | deprecated
```

**TroubleShooting (06_TroubleShooting/):**
```yaml
resolved: true | false
```

### 연결 규칙
- 모든 새 노트는 **최소 2개** 기존 노트와 `[[링크]]` 연결
- 관련 코드 경로는 백틱으로 표시: `` `src/components/Button.tsx` ``

### 시각화
- 복잡한 로직/플로우는 `07_Canvas/*.canvas` 파일로 작성
- Mermaid 다이어그램도 활용 가능
