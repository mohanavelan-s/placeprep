# PlacePrep MCP Tool Catalogue

This document defines the LLM-facing tool and resource API exposed by the PlacePrep MCP server at `/mcp`.

Every tool is strictly user-scoped; the model's natural language request is never an authorization decision. User identity and permissions are resolved server-side from the validated OAuth bearer token.

---

## 1. Tool Summary Matrix

| Tool Name | Type | Scope Required | MCP App UI Support | Description |
|---|---|---|---|---|
| `get_profile` | Read | `placeprep.profile.read` | No | Student placement profile, target role, deadline, streak, and readiness metrics. |
| `get_progress_summary` | Read | `placeprep.progress.read` | No | Readiness analytics, topic strengths (DSA, Core, Project), coach directive. |
| `get_tasks` | Read | `placeprep.tasks.read` | No | List preparation tasks with date, status, and category filters. |
| `get_task` | Read | `placeprep.tasks.read` | No | Retrieve full details of a specific task owned by the student. |
| `task_setup` | Setup / Propose | `placeprep.tasks.read` | Yes (`ui://widget/task-setup.html`) | Interactive task creation and configuration before committing. |
| `prep_dashboard_view` | Read / Interactive | `placeprep.tasks.read` | Yes (`ui://widget/prep-dashboard.html`) | Today's preparation dashboard with live checklist and streak. |
| `create_task` | Mutation | `placeprep.tasks.write` | No | Persist a confirmed preparation task (rejects synthetic placeholders). |
| `update_task_status` | Mutation | `placeprep.tasks.write` | No | Update task status (`completed`, `in_progress`, etc.) and recalculate metrics. |
| `delete_task` | Destructive | `placeprep.tasks.write` | No | Explicitly delete a task owned by the student. |

---

## 2. Detailed Tool Contracts

### `get_profile`
- **Routing Purpose**: Retrieves the student's preparation profile, career target, target deadline, streak counter, readiness score, consistency score, and topic strengths.
- **Input Schema**: `{}` (No parameters required).
- **Output**: JSON object with student metrics and profile links.
- **Security**: Bound to `user.id` extracted from validated OAuth token.

### `get_progress_summary`
- **Routing Purpose**: Retrieves readiness metrics, topic strengths, and the latest AI coach directive. Use when advising the student on what to focus on next.
- **Input Schema**: `{}` (No parameters required).
- **Output**: JSON object with `readinessScore`, `streak`, `consistencyScore`, `topicStrengths`, and `coachCommand`.

### `get_tasks`
- **Routing Purpose**: Lists tasks matching filter criteria.
- **Input Schema**:
  - `date` (optional string): `'today'` or `'YYYY-MM-DD'`.
  - `status` (optional enum): `'pending'`, `'in_progress'`, `'completed'`, `'skipped'`.
  - `category` (optional enum): `'DSA'`, `'Core'`, `'Project'`, `'Aptitude'`, `'Resume'`, `'MockInterview'`, `'Other'`.
- **Output**: Array of task objects with metadata.

### `get_task`
- **Routing Purpose**: Retrieves a single task by ID.
- **Input Schema**:
  - `taskId` (required UUID string): Unique identifier of the task.
- **Security Check**: Enforces `task.user_id === user.id`. Returns 404 if not found or owned by another user.

### `task_setup` (MCP App Interactive Entry Point)
- **Routing Purpose**: User-facing entry point when the user wants to prepare, schedule, or configure a task. Prefills the interactive UI for review before mutating database state.
- **Input Schema**:
  - `title` (required string, 1-180 chars): Descriptive title (e.g. "Implement LRU Cache in Java").
  - `category` (optional enum): Subject category.
  - `difficulty` (optional integer 1-5): 1 (Fundamental) to 5 (Advanced).
  - `estimatedMinutes` (optional integer 5-480): Default 30.
  - `priority` (optional enum): `'low'`, `'medium'`, `'high'`.
  - `scheduledFor` (optional string): `YYYY-MM-DD`.
  - `description` (optional string): Problem description or reference link.
- **UI Resource**: Declares `_meta.ui.resourceUri = "ui://widget/task-setup.html"`.
- **Non-UI Fallback**: Returns structured text summarizing the draft and prompting the user to confirm creation via `create_task`.

### `create_task` (Narrow Persistence Mutation)
- **Routing Purpose**: Persists a confirmed preparation task after review.
- **Input Schema**:
  - `title` (required string, min 2 chars): Specific title. Rejects generic placeholders (`"New task"`, `"Task"`, `"Todo"`).
  - `category` (required enum): Subject category.
  - `difficulty` (optional integer 1-5, default 3).
  - `estimatedMinutes` (optional integer 5-480, default 30).
  - `priority` (optional enum, default `'medium'`).
  - `scheduledFor` (optional string, `YYYY-MM-DD`).
  - `description` (optional string).
- **Output**: Confirmation with created task ID and schedule.

### `update_task_status`
- **Routing Purpose**: Updates completion status and refreshes student consistency and streak stats.
- **Input Schema**:
  - `taskId` (required UUID string).
  - `status` (required enum): `'pending'`, `'in_progress'`, `'completed'`, `'skipped'`.
  - `actualMinutes` (optional integer 0-480).
- **Security Check**: Enforces ownership.

### `delete_task`
- **Routing Purpose**: Explicitly and permanently deletes a task.
- **Input Schema**:
  - `taskId` (required UUID string).
- **Security Check**: Enforces ownership. Cannot delete tasks belonging to other users.

### `prep_dashboard_view` (MCP App Interactive Checklist)
- **Routing Purpose**: Interactive view of today's schedule, readiness score, and task checklist.
- **Input Schema**:
  - `includeCompleted` (optional boolean, default `true`).
- **UI Resource**: `_meta.ui.resourceUri = "ui://widget/prep-dashboard.html"`.
- **Non-UI Fallback**: Returns markdown overview of today's plan and metrics.
