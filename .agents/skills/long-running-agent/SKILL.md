---
name: long-running-agent
description: Use when working on tasks that span multiple sessions or require incremental progress over time. Essential for complex features, refactoring, or any work that cannot be completed in a single context window.
---

# Long-Running Agent Development

## Overview

Treat the LLM like an engineer working in shifts. Each session must leave clear artifacts for the next session to continue work effectively.

**Core principle:** Never leave the environment in a state where the next session has to guess what happened.

**Violating this principle wastes tokens and causes bugs.**

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
```

Leaving a broken or undocumented environment for "next time" is technical debt.

**Clean state means:**
- Code runs without errors
- Git commit with descriptive message
- Progress file updated
- Tests pass (or failing tests are documented)

## Dual-Agent Architecture

### Session 1: Initializer Agent

The very first session sets up the foundation for **all** subsequent work.

**Responsibilities:**

1. **Create `init.sh`** - Script to start development environment
   ```bash
   #!/bin/bash
   npm install
   npm run dev
   ```

2. **Create `claude-progress.txt`** - Persistent log of all work done
   ```
   ## Session Summary: [Date]
   - Created project structure
   - Set up TypeScript config
   - Installed dependencies

   ## Next Steps
   - Implement user authentication
   - Set up database schema
   ```

3. **Create `feature-list.json`** - Structured feature requirements
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

4. **Initial git commit** - Baseline to track all changes

### All Subsequent Sessions: Coding Agent

Each session makes **incremental progress** on ONE feature at a time.

## Session Startup Checklist

Every session MUST start with:

```
1. pwd → Know your working directory
2. Read claude-progress.txt → Understand recent work
3. Read git log → See commit history
4. Read feature-list.json → Find next undone feature
5. Run init.sh → Start dev environment
6. Run basic E2E test → Verify nothing is broken
```

<Good>
```
[I'll start by getting my bearings]
<bash pwd>
<read claude-progress.txt>
<bash git log --oneline -10>
<read feature-list.json>
<run init.sh>
```
</Good>

<Bad>
```
[Let me just start coding the new feature]
```
</Bad>

## Feature List Management

**Why:** Prevents agent from declaring premature victory or losing track of scope.

**Rules:**
- Initializer creates comprehensive list (200+ features for a full app)
- Each feature has: category, description, steps, passes status
- Coding agents ONLY change `passes: false` → `passes: true`
- NEVER remove or modify feature definitions

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
[Based on feature-list.json, I'll work on: User login with email]
[Implementing just the login form validation]
[Writing tests for email validation]
[Committing: feat: add email validation to login form]
[Updating claude-progress.txt]
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

**For web applications:**
- Use browser automation (Puppeteer, Playwright)
- Take screenshots during tests
- Test as a human user would click

**For APIs/libraries:**
- Write integration tests
- Test with real data (not just mocks)
- Verify error handling

**Before marking feature as passing:**
1. Start dev server
2. Run through all steps in feature definition
3. Fix any bugs found
4. Re-test until it works

<Good>
```
[Starting dev server with init.sh]
[Using Puppeteer to test login flow]
[Screenshot shows success - feature working]
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
   ```
   ## Session Summary: [Date]
   Completed:
   - ✅ auth-login-001: Email validation

   In Progress:
   - ⏳ auth-login-002: Password validation

   Next Session:
   - Complete password validation
   - Add login API integration
   ```
4. **Verify tests still pass** - Final check

## Failure Modes and Solutions

| Problem | Initializer Fix | Coding Agent Fix |
|---------|------------------|------------------|
| Agent declares victory too early | Create detailed `feature-list.json` with 200+ granular features | Read feature list, choose ONE unfinished feature |
| Agent leaves broken code | Set up git repo + progress notes file | Start session by reading progress + git log, run basic test |
| Agent marks done prematurely | Set up feature list | E2E test before marking passes=true |
| Agent wastes time figuring setup | Write `init.sh` script | Read and run `init.sh` first thing |

## Why This Matters

**Without clean handoff:**
- Next session guesses what happened
- Time wasted debugging broken state
- Features get half-implemented and forgotten
- Context window wasted on rediscovery

**With clean handoff:**
- Next session picks up where you left off
- Progress is always visible
- Nothing gets lost
- Efficiency compounds over sessions

## Example Session Flow

### Start
```
[Getting my bearings for this session]
pwd → /Users/dev/project
cat claude-progress.txt → "Session 3 completed user registration form"
git log → "feat: add registration form validation"
cat feature-list.json → 5 features passing, 195 remaining

Next priority: user-login-001 (password validation)
```

### Work
```
[Running init.sh to start dev server]
[Reading current password validation code]
[Writing tests for password requirements]
[Implementing validation logic]
```

### Verify
```
[Running tests]
[Testing manually in browser]
[Screenshot showing validation works]
[All tests passing]
```

### Handoff
```
[Committing: feat(auth): add password validation with length & complexity rules]
[Updating claude-progress.txt with summary]
[Updating feature-list.json: auth-login-002 passes = true]
[Session complete - clean state ready for next agent]
```

## Red Flags - STOP and Fix

Before starting new work:
- [ ] Did I read claude-progress.txt?
- [ ] Did I read git log to understand recent changes?
- [ ] Did I verify existing functionality still works?
- [ ] Did I choose ONE feature from feature-list.json?

Before ending session:
- [ ] Did I run all tests?
- [ ] Did I commit with descriptive message?
- [ ] Did I update claude-progress.txt?
- [ ] Did I update feature-list.json?
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
</Bad>

## Final Rule

```
IF YOU CAN'T EXPLAIN YOUR WORK IN A COMMIT MESSAGE
AND PROGRESS FILE ENTRY
YOU DIDN'T DO IT RIGHT
```

Every session is a shift change. Be the engineer you'd want to follow.
