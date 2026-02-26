# Long-Running Agent Best Practices

## Task Folder Structure

All task artifacts MUST follow this structure:

```
project-root/
├── tasks/                              # Root for all task artifacts
│   ├── task-20250113-143022/           # Session 1 - YYYYMMDD-HHMMSS
│   │   ├── feature-list.json           # Feature requirements and status
│   │   ├── claude-progress.txt         # Session progress log
│   │   ├── init.sh                    # Dev environment setup
│   │   ├── session-summary.md          # What was done
│   │   ├── changes.md                 # Files modified this session
│   │   ├── screenshots/                # E2E test evidence
│   │   │   ├── before-login.png
│   │   │   └── after-login.png
│   │   └── tests/                    # Test files created/modified
│   │       └── login.test.ts
│   ├── task-20250113-160545/           # Session 2
│   │   ├── feature-list.json
│   │   ├── claude-progress.txt
│   │   └── ...
│   └── task-latest                    # Symlink to most recent
        └── → task-20250113-160545
├── src/                                 # Actual source code
└── ...
```

## Session Startup Script

**Execute this at the START of EVERY session:**

```bash
#!/bin/bash
# session-start.sh - Run at the beginning of each session

set -e

# Create timestamped task folder
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TASK_DIR="tasks/task-$TIMESTAMP"
LATEST_SYMLINK="tasks/task-latest"

echo "=== Session Start: $TIMESTAMP ==="

# Create task folder structure
mkdir -p "$TASK_DIR"/{screenshots,tests}
echo "Created task folder: $TASK_DIR"

# Copy artifacts from previous session if they exist
if [ -L "$LATEST_SYMLINK" ]; then
    PREV_TASK=$(readlink "$LATEST_SYMLINK")
    echo "Previous task: $PREV_TASK"

    # Copy artifacts to new task folder
    if [ -f "$LATEST_SYMLINK/feature-list.json" ]; then
        cp "$LATEST_SYMLINK/feature-list.json" "$TASK_DIR/"
        echo "Copied feature-list.json"
    fi

    if [ -f "$LATEST_SYMLINK/claude-progress.txt" ]; then
        cp "$LATEST_SYMLINK/claude-progress.txt" "$TASK_DIR/"
        echo "Copied claude-progress.txt"
    fi

    if [ -f "$LATEST_SYMLINK/init.sh" ]; then
        cp "$LATEST_SYMLINK/init.sh" "$TASK_DIR/"
        echo "Copied init.sh"
    fi
else
    echo "No previous session - this is the initializer"
fi

# Update task-latest symlink
ln -sfn "$TASK_DIR" "$LATEST_SYMLINK"
echo "Updated $LATEST_SYMLINK → $TASK_DIR"

echo "=== Session ready ==="
echo "Task folder: $TASK_DIR"
echo "Latest link: $LATEST_SYMLINK"
```

## Progress File Template

`claude-progress.txt` in each task folder:

```text
# Project Progress Log

## Overview
**Project:** [Name]
**Started:** [Date]
**Last Updated:** [Date]
**Current Task:** task-YYYYMMDD-HHMMSS

## Completed Sessions

### Session 1 - [Date] - Initial Setup (task-20250113-143022)
- Created project structure
- Set up TypeScript, Jest, ESLint
- Created initial feature list (203 features)
- Status: 0/203 passing

### Session 2 - [Date] - Basic Architecture (task-20250113-150330)
- Set up Express server with TypeScript
- Created base routes structure
- Added CORS middleware
- Commit: feat(server): add Express base with CORS
- Status: 5/203 passing

### Session 3 - [Date] - User Registration (task-20250113-160545)
- Implemented registration endpoint
- Added password hashing with bcrypt
- Created unit tests for registration
- E2E tested registration flow with Puppeteer
- Commit: feat(auth): add user registration with password hashing
- Status: 12/203 passing

## In Progress
- Currently working on: User Login (auth-login-001)
- Blocked by: None

## Known Issues
- None

## Next Session Priorities
1. Complete login form validation (auth-login-002)
2. Add JWT session management (auth-session-001)
3. Implement logout functionality (auth-logout-001)

## Environment Commands
- Start dev server: ./init.sh
- Run tests: npm test
- Run E2E tests: npm run test:e2e
- Build: npm run build
```

## Feature List Template

`feature-list.json` in each task folder:

```json
{
  "metadata": {
    "project": "Project Name",
    "version": "1.0.0",
    "totalFeatures": 203,
    "completed": 12,
    "lastUpdated": "2025-01-13T10:30:00Z",
    "currentTask": "task-20250113-160545"
  },
  "features": [
    {
      "id": "auth-register-001",
      "category": "functional",
      "priority": "high",
      "description": "User can register with email and password",
      "acceptanceCriteria": [
        "Registration form accepts valid email format",
        "Password minimum 8 characters required",
        "Duplicate email shows error message",
        "Success redirects to login page"
      ],
      "steps": [
        "Navigate to /register",
        "Enter valid email: test@example.com",
        "Enter password: Test1234!",
        "Click register button",
        "Verify redirect to /login",
        "Verify user exists in database"
      ],
      "passes": true,
      "sessionId": 3,
      "taskFolder": "task-20250113-160545"
    },
    {
      "id": "auth-login-001",
      "category": "functional",
      "priority": "high",
      "description": "User can login with valid credentials",
      "acceptanceCriteria": [
        "Login form accepts email and password",
        "Invalid credentials show error",
        "Valid credentials create session",
        "Success redirects to dashboard"
      ],
      "steps": [
        "Navigate to /login",
        "Enter registered email",
        "Enter correct password",
        "Click login button",
        "Verify JWT token in localStorage",
        "Verify redirect to /dashboard"
      ],
      "passes": false,
      "blockedBy": [],
      "sessionId": 4,
      "taskFolder": "task-20250113-170000"
    }
  ]
}
```

## Session Summary Template

`session-summary.md` in each task folder:

```markdown
# Session Summary - 2025-01-13 16:05:45

## Metadata
- **Task Folder:** task-20250113-160545
- **Previous Task:** task-20250113-150330
- **Duration:** ~45 minutes
- **Status:** ✅ Complete

## Context
- **Focus:** User Registration Feature
- **Starting Point:** 12/203 features passing
- **Ending Point:** 15/203 features passing

## Completed Features
- ✅ auth-register-001: User can register with email and password
  - Implemented registration endpoint
  - Added password hashing with bcrypt
  - Created unit tests
  - E2E tested with Puppeteer
  - Evidence: screenshots/after-registration.png

## Test Results
- Unit Tests: ✅ PASS (12/12)
- E2E Tests: ✅ PASS (4/4)
- Screenshots: `screenshots/`

## Files Modified
See `changes.md` for complete list.

## Git Commit
- **Hash:** a1b2c3d4e5f6
- **Message:** feat(auth): add user registration with password hashing

## Next Session Priorities
1. **auth-login-001:** User login with email validation
   - Status: In Progress (20%)
   - Task Folder: task-20250113-170000

2. **auth-session-001:** JWT session management
   - Status: Pending

3. **auth-logout-001:** User logout functionality
   - Status: Pending

## Issues Found
- None

## Notes
- Initial bcrypt implementation working well
- Rate limiting needed for registration endpoint (future task)
```

## Changes.md Template

`changes.md` in each task folder:

```markdown
# Files Modified - Session task-20250113-160545

## Added Files
- `src/auth/register.ts` - Registration endpoint
- `src/auth/validators.ts` - Input validation utilities
- `src/auth/register.test.ts` - Unit tests
- `tests/e2e/registration.spec.ts` - E2E tests

## Modified Files
- `src/auth/index.ts` - Added register route
- `src/middleware/auth.ts` - Added password hashing helper
- `package.json` - Added bcrypt dependency

## Deleted Files
- None

## Configuration Changes
- None

## Database Changes
- Created `users` table with email/password_hash columns
```

## Commit Message Convention

Follow conventional commits with task folder reference:

```bash
# Format
<type>(<scope>): <description>

# Body (what was done, why, how tested)

# Task Reference
Task: task-YYYYMMDD-HHMMSS

# Examples
feat(auth): add user login with JWT token

- Implemented /auth/login endpoint
- Added JWT generation with 24h expiration
- Created login form validation tests
- E2E tested login flow with Puppeteer
- Screenshot: tasks/task-20250113-170000/screenshots/login-success.png

Task: task-20250113-170000
Session: 4 - 2025-01-13

refactor(user): extract validation to separate module

- Moved email/password validation to validators/auth.ts
- Updated auth routes to use extracted validators
- All existing tests still passing
- Reduced code duplication by 40%

Task: task-20250113-180000
Session: 5 - 2025-01-13
```

## Init.sh Template

`init.sh` in each task folder:

```bash
#!/bin/bash
set -e

PROJECT_DIR="$(pwd)"
LOG_FILE="$PROJECT_DIR/tasks/task-latest/dev-server.log"

echo "Starting development environment..."

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Kill existing dev server on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Killing existing dev server on port 3000..."
    kill -9 $(lsof -Pi :3000 -sTCP:LISTEN -t) || true
    sleep 1
fi

# Start dev server in background
echo "Starting dev server..."
npm run dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
timeout 30 bash -c "until curl -s http://localhost:3000 > /dev/null; do sleep 1; done" || {
    echo "Server failed to start. Check $LOG_FILE"
    cat "$LOG_FILE"
    exit 1
}

echo "Dev server started (PID: $DEV_PID)"
echo "Server URL: http://localhost:3000"
echo "Logs: $LOG_FILE"

# Run basic health check
echo "Running health check..."
curl -s http://localhost:3000/health || echo "Health check failed"

# Keep server running
echo "Press Ctrl+C to stop the server"
wait $DEV_PID
```

## Screenshot Naming Convention

Screenshots in `tasks/task-latest/screenshots/`:

```
before-<feature-id>.png          # Before implementing feature
after-<feature-id>.png           # After implementing feature
fail-<feature-id>-<step>.png     # Test failure evidence
success-<feature-id>-<step>.png   # Test success evidence
```

Examples:
```
before-login-validation.png
after-login-validation.png
fail-registration-password-too-short.png
success-registration-complete.png
```

## Session Checklist Printable

```
┌─────────────────────────────────────────────────────────────┐
│  LONG-RUNNING AGENT SESSION CHECKLIST                      │
├─────────────────────────────────────────────────────────────┤
│  SESSION START                                               │
│  □ Create task folder: task-YYYYMMDD-HHMMSS               │
│  □ Copy artifacts from task-latest to new task folder       │
│  □ Update task-latest symlink                              │
│  □ pwd - Confirm working directory                         │
│  □ Read task-latest/claude-progress.txt                   │
│  □ Read git log - See recent commits                        │
│  □ Read task-latest/feature-list.json                   │
│  □ Run task-latest/init.sh - Start dev environment        │
│  □ Run basic test - Verify nothing broken                 │
├─────────────────────────────────────────────────────────────┤
│  DURING WORK                                                │
│  □ Work on ONE feature only                               │
│  □ Write/update tests to task-latest/tests/                │
│  □ Run tests frequently                                   │
│  □ Save screenshots to task-latest/screenshots/             │
│  □ Don't skip to "quick fixes"                            │
├─────────────────────────────────────────────────────────────┤
│  SESSION END                                                 │
│  □ Run ALL tests - Ensure nothing broken                  │
│  □ E2E test feature - Verify it actually works             │
│  □ Save all screenshots                                    │
│  □ Git commit - Include task folder reference              │
│  □ Update task-latest/claude-progress.txt                │
│  □ Update task-latest/feature-list.json                │
│  □ Write task-latest/session-summary.md                 │
│  □ Write task-latest/changes.md                         │
│  □ Verify tests still pass - Final check                   │
└─────────────────────────────────────────────────────────────┘
```

## Example Session Transcript

### Start
```
[ASSISTANT] I'll start by creating a new task folder for this session.

[TOOL] <bash mkdir -p tasks/task-20250113-170000/{screenshots,tests}>
[TOOL] <bash cp tasks/task-latest/feature-list.json tasks/task-20250113-170000/>
[TOOL] <bash cp tasks/task-latest/claude-progress.txt tasks/task-20250113-170000/>
[TOOL] <bash cp tasks/task-latest/init.sh tasks/task-20250113-170000/>
[TOOL] <bash ln -sfn tasks/task-20250113-170000 tasks/task-latest>

[ASSISTANT] New task folder created: task-20250113-170000
Now reading the progress and feature list to understand context.

[TOOL] <read tasks/task-latest/claude-progress.txt>
...content showing Session 3 completed user registration form...

[TOOL] <bash git log --oneline -10>
a1b2c3d feat(auth): add user registration with password hashing
9f8e7d6 refactor(server): extract middleware to separate module
4b5c6d7 feat(server): add Express base with CORS

[TOOL] <read tasks/task-latest/feature-list.json>
...showing 15 passing, 188 remaining...
Next priority: auth-login-001 (password validation)

[ASSISTANT] Based on the progress file, Session 3 completed the user registration.
The next high-priority feature is auth-login-001: User login with email validation.
Let me start the dev server and verify existing functionality works.
```

### Work
```
[ASSISTANT] Let me read the current auth module to understand the structure.

[TOOL] <read src/auth/login.ts>
...shows incomplete implementation...

[ASSISTANT] I'll implement the login endpoint with:
1. Email format validation
2. Password verification using bcrypt
3. JWT token generation
4. Error handling for invalid credentials

[TOOL] <write src/auth/login.ts>
...implementation...

[ASSISTANT] Now I'll write tests for the login functionality.

[TOOL] <write tasks/task-latest/tests/login.test.ts>
...tests...

[ASSISTANT] Saving test file to task folder.
```

### Verify
```
[ASSISTANT] Let me run the tests to ensure everything works.

[TOOL] <bash npm test -- src/auth/login.test.ts>
PASS  src/auth/login.test.ts
  Login Endpoint
    ✓ accepts valid email and password
    ✓ rejects invalid email format
    ✓ rejects wrong password
    ✓ returns JWT token on success

[ASSISTANT] Tests passing. Now I'll do an E2E test with Puppeteer.

[TOOL] <bash npm run test:e2e -- login.spec.ts>
...Puppeteer automation...

[ASSISTANT] E2E test passing. Saving screenshots to task folder.

[TOOL] <bash cp screenshots/login-success.png tasks/task-latest/screenshots/after-login.png>
```

### Handoff
```
[ASSISTANT] Feature is complete. Let me commit the changes.

[TOOL] <bash git add src/auth/login.ts>
[TOOL] <bash git add tasks/task-latest/tests/login.test.ts>

[TOOL] <bash git commit -m "feat(auth): add user login with JWT validation

- Implemented /auth/login endpoint
- Added bcrypt password verification
- Added JWT token generation with 24h expiration
- Created unit tests for all login scenarios
- E2E tested login flow with Puppeteer
- Screenshot: tasks/task-20250113-170000/screenshots/after-login.png

Task: task-20250113-170000
Session: 4 - 2025-01-13">

[ASSISTANT] Now updating the task artifacts.

[TOOL] <edit tasks/task-latest/claude-progress.txt>
...updating with Session 4 summary...

[TOOL] <edit tasks/task-latest/feature-list.json>
...updating auth-login-001 passes to true...

[ASSISTANT] Writing session summary and changes.

[TOOL] <write tasks/task-latest/session-summary.md>
...complete session summary...

[TOOL] <write tasks/task-latest/changes.md>
...complete list of changes...

[ASSISTANT] Session complete. The next agent will find:
- Clean working state with all tests passing
- Updated progress file showing login feature complete
- Feature list showing 16/203 features passing
- Complete artifacts in task-20250113-170000/
- Clear next priority: auth-login-002 (password reset request)
- task-latest symlink pointing to this task folder
```

## Common Pitfalls

### Pitfall 1: The "I'll remember" Fallacy

```
❌ [This session I'll just fix these 3 quick bugs]
→ Next session has no idea which 3 bugs
→ Bugs get half-fixed and forgotten
→ No audit trail to review what happened

✅ [I'll create a task folder and update feature-list.json]
→ Next session sees all 3 clearly defined
→ Each bug gets proper attention and testing
→ Complete history in tasks/ folder
```

### Pitfall 2: The "No Time to Test" Trap

```
❌ [Feature implemented, out of time, will test next session]
→ Next session finds feature doesn't actually work
→ Wastes time debugging broken implementation
→ No evidence of what was attempted

✅ [Reducing scope to fit testing in this session]
→ Feature tested and verified before handoff
→ Screenshots saved to task folder
→ Next session can confidently move to next feature
```

### Pitfall 3: The "Artifacts Everywhere" Trap

```
❌ [I'll save screenshots to ./screenshots and tests to ./test-output]
→ Artifacts scattered across directories
→ Hard to find what was done when
→ Audit trail broken
→ Next session confused about file locations

✅ [ALL artifacts go to tasks/task-latest/]
→ Predictable file locations
→ Complete audit trail
→ Easy to review and handoff
```

### Pitfall 4: The "Reuse Task Folder" Trap

```
❌ [I'll just use the same task folder for multiple sessions]
→ Confusion about what was done when
→ Timestamps meaningless
→ Can't track progress per session
→ Defeats the purpose of task folders

✅ [Each session gets its own timestamped task folder]
→ Clear temporal boundaries
→ Easy to track what was done when
→ Meaningful timestamps for review
```

### Pitfall 5: The "No Symlink" Trap

```
❌ [No task-latest symlink, always use full path]
→ Harder to reference "current" task
→ More verbose commands
→ Easy to reference wrong task folder

✅ [Always maintain task-latest symlink]
→ Short predictable reference: tasks/task-latest/
→ Always points to most recent task
→ Easy to write and maintain
```

## Task Folder Migration Guide

If you have an existing project without task folders:

```bash
#!/bin/bash
# migrate-to-task-folders.sh

set -e

# Create tasks directory
mkdir -p tasks

# Create initial task folder with current timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
INIT_TASK="tasks/task-$TIMESTAMP"
mkdir -p "$INIT_TASK"/{screenshots,tests}

# Move existing artifacts if they exist
if [ -f claude-progress.txt ]; then
    mv claude-progress.txt "$INIT_TASK/"
fi

if [ -f feature-list.json ]; then
    mv feature-list.json "$INIT_TASK/"
fi

if [ -f init.sh ]; then
    mv init.sh "$INIT_TASK/"
fi

# Create symlink
ln -sfn "$INIT_TASK" tasks/task-latest

echo "Migrated to task folder structure:"
echo "Initial task: $INIT_TASK"
echo "Symlink: tasks/task-latest → $INIT_TASK"
```
