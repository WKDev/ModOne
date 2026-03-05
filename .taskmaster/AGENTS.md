# TASKMASTER KNOWLEDGE BASE

## OVERVIEW
`.taskmaster` stores TaskMaster planning/config state and workflow docs used by agent tooling in this repository.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Main workflow guide | `.taskmaster/CLAUDE.md` | Command catalog + workflow rules |
| Task data | `.taskmaster/tasks/tasks.json` | Task graph/state storage |
| TaskMaster config | `.taskmaster/config.json` | Model/tool settings |
| Supplemental docs | `.taskmaster/docs/*` | Process and reference docs |

## CONVENTIONS
- Operate TaskMaster state through commands/tools, not manual JSON editing.
- Keep command usage aligned with documented workflow in `.taskmaster/CLAUDE.md`.
- Treat this directory as workflow infrastructure; update deliberately.

## ANTI-PATTERNS (THIS DIRECTORY)
- Never manually edit `.taskmaster/tasks/tasks.json`.
- Never manually edit `.taskmaster/config.json`.
- Do not re-initialize TaskMaster in an already-initialized project without explicit migration intent.

## COMMANDS
```bash
task-master list
task-master next
task-master show <id>
task-master set-status --id=<id> --status=done
task-master update-subtask --id=<id> --prompt="notes"
```
