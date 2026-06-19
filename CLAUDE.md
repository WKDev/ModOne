# Claude Code Instructions

## Development Environment
- **Platform:** windows, pnpm

## Obsidian Integration
- **Base Path:** `03_Projects/04_ModOne` in the connected Obsidian vault
- Use MCP Obsidian tools (`obsidian_append_content`, `obsidian_get_file_contents`, etc.)


## Work Logging & Git Workflow
작업 완료 시 반드시 다음 절차를 수행:

### 자동 커밋
- **태스크 완료 시 자동 커밋**: 태스크나 의미 있는 작업 단위 완료 시 자동으로 커밋 수행
- **커밋 타이밍**: 기능 구현 완료, 버그 수정 완료, 리팩토링 완료 등 논리적 작업 단위 기준

<!-- ooo:START -->
<!-- ooo:VERSION:0.14.0 -->
# Ouroboros — Specification-First AI Development

> Before telling AI what to build, define what should be built.
> As Socrates asked 2,500 years ago — "What do you truly know?"
> Ouroboros turns that question into an evolutionary AI workflow engine.

Most AI coding fails at the input, not the output. Ouroboros fixes this by
**exposing hidden assumptions before any code is written**.

1. **Socratic Clarity** — Question until ambiguity ≤ 0.2
2. **Ontological Precision** — Solve the root problem, not symptoms
3. **Evolutionary Loops** — Each evaluation cycle feeds back into better specs

```
Interview → Seed → Execute → Evaluate
    ↑                           ↓
    └─── Evolutionary Loop ─────┘
```

## ooo Commands

Each command loads its agent/MCP on-demand. Details in each skill file.

| Command | Loads |
|---------|-------|
| `ooo` | — |
| `ooo interview` | `ouroboros:socratic-interviewer` |
| `ooo seed` | `ouroboros:seed-architect` |
| `ooo run` | MCP required |
| `ooo evolve` | MCP: `evolve_step` |
| `ooo evaluate` | `ouroboros:evaluator` |
| `ooo unstuck` | `ouroboros:{persona}` |
| `ooo status` | MCP: `session_status` |
| `ooo setup` | — |
| `ooo help` | — |

## Agents

Loaded on-demand — not preloaded.

**Core**: socratic-interviewer, ontologist, seed-architect, evaluator,
wonder, reflect, advocate, contrarian, judge
**Support**: hacker, simplifier, researcher, architect
<!-- ooo:END -->
