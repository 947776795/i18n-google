---
name: long-running-agent
description: Use when working on tasks that span multiple sessions or require incremental progress over time. Essential for complex features, refactoring, or any work that cannot be completed in a single context window.
---

# Long-Running Agent Development

## Overview

Treat the LLM like an engineer working in shifts. Each session must leave clear artifacts for the next session to continue work effectively.

**Core principle:** Never leave the environment in a state where the next session has to guess what happened.

**Violating this principle wastes tokens and causes bugs.**

## Task Artifacts Management

**CRITICAL:** All task outputs MUST be organized in timestamped task folders.

```
project-root/
├── tasks/                    # ALL task artifacts go here
│   ├── task-20250113-143022/  # Session 1 - user-login
│   │   ├── feature-list.json
│   │   ├── claude-progress.txt
│   │   ├── init.sh
│   │   ├── screenshots/           # E2E test evidence
│   │   │   └── login-success.png
│   │   ├── tests/                # Test outputs
│   │   │   └── login.test.ts
│   │   └── session-summary.md    # What was done
│   ├── task-20250113-160545/  # Session 2 - password-reset
│   │   ├── feature-list.json
│   │   ├── claude-progress.txt
│   │   ├── screenshots/
│   │   ├── tests/
│   │   └── session-summary.md
│   └── task-latest/            # Symlink to most recent task
│       └── → task-20250113-160545
├── src/                      # Actual source code
│   └── ...
```

### Task Folder Rules

1. **Naming Convention:** `task-YYYYMMDD-HHMMSS` (ISO 8601 timestamp)
2. **Location:** ALWAYS under `./tasks/` directory at project root
3. **Contents:** Each task folder contains ALL artifacts for that session
4. **Symlink:** `task-latest` always points to the most recent task folder

<Good>
```
[Starting new session - creating task folder]
<bash mkdir -p tasks/task-$(date +%Y%m%d-%H%M%S)>
<bash ln -sfn tasks/task-$(date +%Y%m%d-%H%M%S) tasks/task-latest>
```
</Good>

<Bad>
```
[I'll just save files to the root directory]
```
</Bad>

## Session Startup Protocol

**Every session MUST:**

```
1. Create timestamped task folder: ./tasks/task-YYYYMMDD-HHMMSS/
2. Update task-latest symlink
3. Copy previous session's artifacts (feature-list.json, claude-progress.txt)
4. pwd → Know your working directory
5. Read task-latest/claude-progress.txt → Understand recent work
6. Read git log → See commit history
7. Read task-latest/feature-list.json → Find next undone feature
8. Run task-latest/init.sh → Start dev environment
9. Run basic E2E test → Verify nothing is broken
```

## Task Folder Contents

Each `task-YYYYMMDD-HHMMSS/` folder MUST contain:

```
task-YYYYMMDD-HHMMSS/
├── feature-list.json       # Feature requirements and status
├── claude-progress.txt     # Session progress log
├── init.sh                # Dev environment setup script
├── session-summary.md     # What was done this session
├── screenshots/            # E2E test evidence (REQUIRED)
│   ├── before-<feature>.png
│   └── after-<feature>.png
├── tests/                 # Test files created/modified
│   └── <feature>.test.ts
└── changes.md             # List of files modified
```

### session-summary.md Template

```markdown
# Session Summary - YYYY-MM-DD HH:MM:SS

## Context
- Previous Task: task-YYYYMMDD-HHMMSS
- Current Focus: <feature-id>
- Status: ✅ Complete | ⏳ In Progress

## Completed Features
- ✅ <feature-id-1>: <description>
- ✅ <feature-id-2>: <description>

## In Progress
- ⏳ <feature-id>: <description>
  - Status: <percentage>%
  - Remaining: <details>

## Next Session Priorities
1. <feature-id-next-1>: <description>
2. <feature-id-next-2>: <description>

## Artifacts
- Screenshots: ./screenshots/
- Tests: ./tests/
- Changes: ./changes.md

## Git Commit
- Hash: <commit-hash>
- Message: <commit-message>
```

## When to Use

**Always:**
- Features requiring multiple sessions
- Refactoring across many files
- Complex UI/application development
- Multi-step bug fixes

**Thinking "I'll just finish this real quick"?** Stop. Context windows are limited. Plan for handoff.

## The Iron Law

```
NEVER END A SESSION WITHOUT LEAVING A CLEAN STATE
AND ALL ARTIFACTS IN A TASK FOLDER
```

Leaving a broken or undocumented environment for "next time" is technical debt.

**Clean state means:**
- Code runs without errors
- Git commit with descriptive message
- All artifacts in task folder
- Tests pass (or failing tests are documented)

## Dual-Agent Architecture

### Session 1: Initializer Agent

The very first session sets up the foundation for **all** subsequent work.

**Responsibilities:**

1. **Create task folder structure:**
   ```bash
   mkdir -p tasks/task-$(date +%Y%m%d-%H%M%S)
   mkdir -p tasks/task-$(date +%Y%m%d-%H%M%S)/{screenshots,tests}
   ln -sfn tasks/task-$(date +%Y%m%d-%H%M%S) tasks/task-latest
   ```

2. **Create `init.sh`** - Script to start development environment
   ```bash
   #!/bin/bash
   npm install
   npm run dev
   ```

3. **Create `claude-progress.txt`** - Persistent log of all work done
   ```text
   ## Session Summary: [Date]
   - Created project structure
   - Set up TypeScript config
   - Installed dependencies

   ## Next Steps
   - Implement user authentication
   - Set up database schema
   ```

4. **Create `feature-list.json`** - Structured feature requirements
   ```json
   {
     "category": "functional",
     "description": "User can log in with email and password",
     "steps": [
       "Navigate to login page",
       "Enter email and password",
       "Click login button",
       "Verify redirect to dashboard",
       "Verify session token stored"
     ],
     "passes": false
   }
   ```

5. **Initial git commit** - Baseline to track all changes

### All Subsequent Sessions: Coding Agent

Each session makes **incremental progress** on ONE feature at a time.

**Session Start:**
1. Create new task folder with timestamp
2. Copy artifacts from `task-latest` to new task folder
3. Update `task-latest` symlink
4. Read copied artifacts to understand context
5. Work on ONE feature
6. Save all outputs to new task folder

## Feature List Management

**Why:** Prevents agent from declaring premature victory or losing track of scope.

**Rules:**
- Initializer creates comprehensive list (200+ features for a full app)
- Each feature has: category, description, steps, passes status
- Coding agents ONLY change `passes: false` → `passes: true`
- NEVER remove or modify feature definitions
- ALWAYS updated in task folder, then copied to next session

**Format (JSON - less likely to be corrupted):**
```json
{
  "features": [
    {
      "id": "auth-login-001",
      "category": "functional",
      "description": "Login form accepts valid credentials",
      "steps": [...],
      "passes": false,
      "priority": "high"
    }
  ]
}
```

## Incremental Progress

**One feature per session.** Not three. Not "related features." One.

<Good>
```
[Creating task folder for this session]
<bash mkdir -p tasks/task-$(date +%Y%m%d-%H%M%S)/{screenshots,tests}>
<bash cp tasks/task-latest/feature-list.json tasks/task-$(date +%Y%m%d-%H%M%S)/>
<bash cp tasks/task-latest/claude-progress.txt tasks/task-$(date +%Y%m%d-%H%M%S)/>
<bash ln -sfn tasks/task-$(date +%Y%m%d-%H%M%S) tasks/task-latest>

[Based on feature-list.json, I'll work on: User login with email]
[Implementing just the login form validation]
[Writing tests for email validation]
[Saving screenshot to tasks/task-latest/screenshots/after-login-validation.png]
[Committing: feat: add email validation to login form]
[Updating claude-progress.txt in tasks/task-latest/]
[Writing session-summary.md to tasks/task-latest/]
```
</Good>

<Bad>
```
[I'll implement the full auth system today]
[Login, registration, password reset, OAuth...]
```
</Bad>

## Testing Requirements

**Why:** Agents declare victory without testing. E2E testing is mandatory.

**Screenshot Evidence:**
All E2E tests MUST save screenshots to the task folder:

```bash
# Before making changes
screenshot: tasks/task-latest/screenshots/before-<feature>.png

# After implementing feature
screenshot: tasks/task-latest/screenshots/after-<feature>.png
```

**For web applications:**
- Use browser automation (Puppeteer, Playwright)
- Take screenshots during tests
- Test as a human user would click
- Save ALL screenshots to `tasks/task-latest/screenshots/`

**For APIs/libraries:**
- Write integration tests
- Test with real data (not just mocks)
- Verify error handling
- Copy test files to `tasks/task-latest/tests/`

**Before marking feature as passing:**
1. Start dev server
2. Run through all steps in feature definition
3. Fix any bugs found
4. Re-test until it works
5. Save screenshot evidence

<Good>
```
[Starting dev server with init.sh]
[Using Puppeteer to test login flow]
[Screenshot shows success - feature working]
[Saving screenshot to tasks/task-latest/screenshots/login-success.png]
[Updating feature-list.json: passes = true]
```
</Good>

<Bad>
```
[The code looks correct, marking as done]
```
</Bad>

## Session Handoff Protocol

**Before ending ANY session:**

1. **Run all tests** - Ensure nothing is broken
2. **Git commit** - Descriptive message with scope
   ```
   feat(auth): add email validation to login form

   - Added regex email validation
   - Added error message display
   - Added unit tests for edge cases
   ```
3. **Update `claude-progress.txt`** - Write what you did
   ```text
   ## Session Summary: [Date]
   Completed:
   - ✅ auth-login-001: Email validation

   In Progress:
   - ⏳ auth-login-002: Password validation

   Next Session:
   - Complete password validation
   - Add login API integration
   ```
4. **Write `session-summary.md`** - Complete session documentation
5. **Write `changes.md`** - List all files modified
6. **Verify tests still pass** - Final check
7. **Update `task-latest` symlink** - Ensure it points to current task

## Failure Modes and Solutions

| Problem | Initializer Fix | Coding Agent Fix |
|---------|------------------|------------------|
| Agent declares victory too early | Create detailed `feature-list.json` with 200+ granular features | Read feature list, choose ONE unfinished feature |
| Agent leaves broken code | Set up git repo + progress notes file | Start session by reading progress + git log, run basic test |
| Agent marks done prematurely | Set up feature list | E2E test + screenshot before marking passes=true |
| Agent wastes time figuring setup | Write `init.sh` script | Read and run `init.sh` first thing |
| Artifacts scattered everywhere | Create `./tasks/` structure | ALL outputs to `tasks/task-latest/` |

## Why This Matters

**Without clean handoff:**
- Next session guesses what happened
- Time wasted debugging broken state
- Features get half-implemented and forgotten
- Context window wasted on rediscovery
- Artifacts lost or hard to find

**With clean handoff:**
- Next session picks up where you left off
- Progress is always visible
- Nothing gets lost
- Efficiency compounds over sessions
- Complete audit trail in task folders

## Example Session Flow

### Start
```
[Creating new task folder]
<bash mkdir -p tasks/task-20250113-143022/{screenshots,tests}>
<bash cp tasks/task-latest/feature-list.json tasks/task-20250113-143022/>
<bash cp tasks/task-latest/claude-progress.txt tasks/task-20250113-143022/>
<bash ln -sfn tasks/task-20250113-143022 tasks/task-latest>

[Reading context from task-latest]
<read tasks/task-latest/claude-progress.txt>
→ "Session 3 completed user registration form"

<bash git log --oneline -10>
→ "feat: add registration form validation"

<read tasks/task-latest/feature-list.json>
→ 5 features passing, 195 remaining
Next priority: user-login-001 (password validation)
```

### Work
```
[Running task-latest/init.sh to start dev server]
[Reading current password validation code]
[Writing tests for password requirements]
[Implementing validation logic]
[Saving test to tasks/task-latest/tests/password.test.ts]
```

### Verify
```
[Running tests]
[Testing manually in browser]
[Saving before screenshot: tasks/task-latest/screenshots/before-password-validation.png]
[Saving after screenshot: tasks/task-latest/screenshots/after-password-validation.png]
[All tests passing]
```

### Handoff
```
[Committing: feat(auth): add password validation with length & complexity rules]

[Updating tasks/task-latest/claude-progress.txt with summary]

[Updating tasks/task-latest/feature-list.json: auth-login-002 passes = true]

[Writing tasks/task-latest/session-summary.md]

[Writing tasks/task-latest/changes.md with all modified files]

[Session complete - clean state ready for next agent]
```

## Red Flags - STOP and Fix

Before starting new work:
- [ ] Did I create a new task folder with timestamp?
- [ ] Did I copy artifacts from task-latest to new task folder?
- [ ] Did I read task-latest/claude-progress.txt?
- [ ] Did I read git log to understand recent changes?
- [ ] Did I verify existing functionality still works?
- [ ] Did I choose ONE feature from task-latest/feature-list.json?

Before ending session:
- [ ] Did I run all tests?
- [ ] Did I save screenshots to tasks/task-latest/screenshots/?
- [ ] Did I save test outputs to tasks/task-latest/tests/?
- [ ] Did I commit with descriptive message?
- [ ] Did I update task-latest/claude-progress.txt?
- [ ] Did I update task-latest/feature-list.json?
- [ ] Did I write task-latest/session-summary.md?
- [ ] Did I write task-latest/changes.md?
- [ ] Is the next agent able to continue without guessing?

Can't check all boxes? You're breaking the chain. Fix it now.

## Anti-Patterns

<Bad>
**The "I'll just quick fix" trap**
```
[This session I'll quickly add the settings page and the admin panel]
```
Result: Both half-done, bugs introduced, next session confused.

**The "testing is for later" trap**
```
[I'll implement all features then test at the end]
```
Result: 50 features, 20 broken, which one caused the bug?

**The "no need to document" trap**
```
[The code is self-explanatory]
```
Result: Next session spends 30k tokens understanding what you did.

**The "artifacts everywhere" trap**
```
[I'll save screenshots to ./screenshots and tests to ./test-output]
```
Result: Artifacts scattered, hard to find, audit trail broken.

**The "reuse task folder" trap**
```
[I'll just use the same task folder for multiple sessions]
```
Result: Confusion about what was done when, timestamps meaningless.
</Bad>

## Final Rule

```
IF YOU CAN'T EXPLAIN YOUR WORK IN A COMMIT MESSAGE,
PROGRESS FILE ENTRY, AND TASK FOLDER SUMMARY
YOU DIDN'T DO IT RIGHT
```

Every session is a shift change. Be the engineer you'd want to follow.
