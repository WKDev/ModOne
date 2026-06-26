# Claude Code Instructions

## Development Environment
- **Platform:** windows, pnpm

## Code Organization — keep the codebase LLM/AI-readable (FIRST-CLASS RULE)
이 프로젝트는 **LLM/AI가 읽고 편집하기 쉬워야 한다.** 이건 선택이 아니라 규약이다.

LLMs read whole files into a limited context window — a 1,500-line file wastes
context, slows navigation, and makes edits error-prone (even with LSP symbol
outlines). So:

- **One file = one clear responsibility.** Name files and exported symbols
  descriptively so intent is obvious without reading the body.
- **Size limits:** aim for **< ~400 lines** per file. **> ~600 lines is a smell
  — split it. > ~800 lines must be split** unless there's a strong reason.
- **When you create or substantially edit a file that exceeds this, split it**
  in the same change: extract helpers, sub-renderers, per-concern modules, and
  types into their own focused files. Prefer many small files over few large
  ones.
- **No god objects / mega-modules.** Splitting by responsibility ≠ a god object;
  one cohesive responsibility per module is the goal.
- Tests follow the same spirit where practical.

There is a standing backlog of oversized files (1000+ lines: `stores/canvasStore`,
`lib/symbolXmlParser`, `LadderEditor/utils/gridConverter`, `SymbolEditor.tsx`,
`OneCanvas/types`, `InteractionController`, …). When you touch one, leave it
smaller than you found it (extract at least the part you came for).

## Obsidian Integration
- **Base Path:** `03_Projects/04_ModOne` in the connected Obsidian vault
- Use MCP Obsidian tools (`obsidian_append_content`, `obsidian_get_file_contents`, etc.)


## Work Logging & Git Workflow
작업 완료 시 반드시 다음 절차를 수행:

### 자동 커밋
- **태스크 완료 시 자동 커밋**: 태스크나 의미 있는 작업 단위 완료 시 자동으로 커밋 수행
- **커밋 타이밍**: 기능 구현 완료, 버그 수정 완료, 리팩토링 완료 등 논리적 작업 단위 기준

### 브랜치/워크트리 전략
- **기본은 main에서 바로 작업한다.** 사소한 수정이든 일반 작업이든 별도 지시가 없으면 main 위에서 진행하고 커밋한다.
- **워크트리는 사용자가 명시적으로 지시했을 때만 만든다.** 내가 임의로 워크트리/브랜치를 만들지 않는다. "워크트리에서 해줘" 류의 지시가 있을 때만 `EnterWorktree`로 워크트리+브랜치를 생성하고 그 안에서 작업한다.
- **워크트리 작업 마무리는 자동으로 한다.** 해당 작업이 끝나면 별도 확인 없이 다음을 수행한다.
  1. 변경 사항을 커밋한다.
  2. main으로 병합한다.
  3. `ExitWorktree`로 워크트리 폴더를 제거한다.

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
