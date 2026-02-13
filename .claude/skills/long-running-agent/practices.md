# Long-Running Agent Best Practices

## Progress File Template

`claude-progress.txt` should follow this structure:

```text
# Project Progress Log

## Overview
**Project:** [Name]
**Started:** [Date]
**Last Updated:** [Date]

## Completed Sessions

### Session 1 - [Date] - Initial Setup
- Created project structure
- Set up TypeScript, Jest, ESLint
- Created initial feature list (203 features)
- Status: 0/203 passing

### Session 2 - [Date] - Basic Architecture
- Set up Express server with TypeScript
- Created base routes structure
- Added CORS middleware
- Commit: feat(server): add Express base with CORS
- Status: 5/203 passing

### Session 3 - [Date] - User Registration
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

`feature-list.json` should follow this structure:

```json
{
  "metadata": {
    "project": "Project Name",
    "version": "1.0.0",
    "totalFeatures": 203,
    "completed": 12,
    "lastUpdated": "2025-01-15T10:30:00Z"
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
      "sessionId": 3
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
      "blockedBy": []
    }
  ]
}
```

## Commit Message Convention

Follow conventional commits with session context:

```bash
# Format
<type>(<scope>): <description>

# Body (what was done, why, how tested)

# Session
Session: X - Date

# Examples
feat(auth): add user login with JWT token

- Implemented /auth/login endpoint
- Added JWT generation with 24h expiration
- Created login form validation tests
- E2E tested login flow with Puppeteer
- Screenshot: docs/session3-login-success.png

Session: 4 - 2025-01-15

refactor(user): extract validation to separate module

- Moved email/password validation to validators/auth.ts
- Updated auth routes to use extracted validators
- All existing tests still passing
- Reduced code duplication by 40%

Session: 5 - 2025-01-16
```

## Init.sh Template

```bash
#!/bin/bash
set -e

PROJECT_DIR="$(pwd)"
LOG_FILE="$PROJECT_DIR/dev-server.log"

echo "Starting development environment..."

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Kill existing dev server on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
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

## Session Checklist Printable

```
┌─────────────────────────────────────────────────────────────┐
│  LONG-RUNNING AGENT SESSION CHECKLIST                      │
├─────────────────────────────────────────────────────────────┤
│  SESSION START                                               │
│  □ pwd - Confirm working directory                         │
│  □ Read claude-progress.txt - Know what's been done       │
│  □ Read git log - See recent commits                        │
│  □ Read feature-list.json - Choose next feature            │
│  □ Run init.sh - Start dev environment                    │
│  □ Run basic test - Verify nothing broken                 │
├─────────────────────────────────────────────────────────────┤
│  DURING WORK                                                │
│  □ Work on ONE feature only                               │
│  □ Write/update tests as you go                            │
│  □ Run tests frequently                                   │
│  □ Don't skip to "quick fixes"                            │
├─────────────────────────────────────────────────────────────┤
│  SESSION END                                                 │
│  □ Run ALL tests - Ensure nothing broken                  │
│  □ E2E test feature - Verify it actually works             │
│  □ Git commit - Descriptive message                       │
│  □ Update claude-progress.txt - Document work             │
│  □ Update feature-list.json - Mark feature complete       │
│  □ Verify tests still pass - Final check                   │
└─────────────────────────────────────────────────────────────┘
```

## Example Session Transcript

### Start
```
[ASSISTANT] I'll start by getting my bearings for this session.

[TOOL] <bash pwd>
/Users/developer/project/myapp

[TOOL] <read claude-progress.txt>
...content showing Session 3 completed registration form...

[TOOL] <bash git log --oneline -10>
a1b2c3d feat(auth): add user registration with password hashing
9f8e7d6 refactor(server): extract middleware to separate module
4b5c6d7 feat(server): add Express base with CORS

[TOOL] <read feature-list.json>
...showing 12 passing, 191 remaining...
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

[TOOL] <write src/auth/login.test.ts>
...tests...
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
[ASSISTANT] E2E test passing. Screenshot confirms login flow works correctly.
```

### Handoff
```
[ASSISTANT] Feature is complete. Let me commit the changes.

[TOOL] <bash git add src/auth/login.ts src/auth/login.test.ts>

[TOOL] <bash git commit -m "feat(auth): add user login with JWT validation

- Implemented /auth/login endpoint
- Added bcrypt password verification
- Added JWT token generation with 24h expiration
- Created unit tests for all login scenarios
- E2E tested login flow with Puppeteer

Session: 4 - 2025-01-15">

[TOOL] <edit claude-progress.txt>
...updating with Session 4 summary...

[TOOL] <edit feature-list.json>
...updating auth-login-001 passes to true...

[ASSISTANT] Session complete. The next agent will find:
- Clean working state with all tests passing
- Updated progress file showing login feature complete
- Feature list showing 13/203 features passing
- Clear next priority: auth-login-002 (password reset request)
```

## Common Pitfalls

### Pitfall 1: The "I'll remember" Fallacy
```
❌ [This session I'll just fix these 3 quick bugs]
→ Next session has no idea which 3 bugs
→ Bugs get half-fixed and forgotten

✅ [I'll update feature-list.json with 3 new bug-fix features]
→ Next session sees all 3 clearly defined
→ Each bug gets proper attention and testing
```

### Pitfall 2: The "No Time to Test" Trap
```
❌ [Feature implemented, out of time, will test next session]
→ Next session finds feature doesn't actually work
→ Wastes time debugging broken implementation

✅ [Reducing scope to fit testing in this session]
→ Feature tested and verified before handoff
→ Next session can confidently move to next feature
```

### Pitfall 3: The "It's Just a Small Change" Slip
```
❌ [While implementing feature A, noticed B needs fixing too]
→ Session ends with both A and B half-done
→ Context confused for next session

✅ [Noted B in feature-list.json for later session]
→ A completed cleanly
→ B properly planned and executed next time
```
