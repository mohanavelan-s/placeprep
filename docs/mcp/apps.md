# PlacePrep MCP Apps Architecture & Specification

## 1. Overview

PlacePrep integrates interactive MCP Apps using the official `@modelcontextprotocol/ext-apps` SDK (version `2.0.3`) adhering to the **2026-01-26** stable specification.

Instead of embedding the entire PlacePrep website into an iframe, PlacePrep exposes dedicated, compact, purpose-built conversational widgets:
1. **Task Setup View** (`ui://widget/task-setup.html`)
2. **Daily Prep Dashboard View** (`ui://widget/prep-dashboard.html`)

---

## 2. Progressive Enhancement Contract

Every MCP App operates under a strict progressive enhancement contract:
- **With UI Support**: The host inspects `_meta.ui.resourceUri`, fetches the HTML via `resources/read`, initializes the sandboxed iframe, and displays interactive controls. User interactions dispatch `callServerTool` through the postMessage bridge to invoke backend tools directly.
- **Without UI Support**: The underlying tool (`task_setup` or `prep_dashboard_view`) returns full structured JSON and formatted markdown text. Non-UI conversational hosts remain fully functional.

---

## 3. Protocol Lifecycle

```
Host (AI Client)                     Sandboxed View (Iframe)             PlacePrep Server
       |                                       |                                 |
       |-- tools/call (task_setup) --------------------------------------------->|
       |<-- { _meta: { ui: { resourceUri: 'ui://widget/task-setup.html' } } } --|
       |                                       |                                 |
       |-- resources/read (ui://widget/task-setup.html) ------------------------>|
       |<-- { contents: [{ mimeType: 'text/html;profile=mcp-app', text: ... }] }--|
       |                                       |                                 |
       |-- render iframe --------------------->|                                 |
       |-- ui/initialize --------------------->|                                 |
       |<-- { result: { protocolVersion } } ---|                                 |
       |<-- ui/notifications/initialized ------|                                 |
       |                                       |                                 |
       |-- ui/notifications/tool-input ------->| (prefills form fields)          |
       |<-- ui/notifications/size-changed -----| (reports height to prevent clip)|
       |                                       |                                 |
       | (User clicks "Save Task")             |                                 |
       |<-- callServerTool('create_task') -----|                                 |
       |-- tools/call ('create_task') ------------------------------------------>|
       |<-- result --------------------------------------------------------------|
       |-- send tool result ------------------>| (displays success state)        |
```

---

## 4. Widget Details

### Widget 1: Task Setup View (`ui://widget/task-setup.html`)
- **Primary Tool**: `task_setup`.
- **Interactions**:
  - Prefills form based on arguments detected from natural language intent (e.g. title, category, difficulty, duration).
  - Allows user adjustment (category pills, difficulty selector 1-5, priority, date).
  - Clicking "Save Task" issues `callServerTool('create_task', payload)` via the bridge.
  - Dynamically resizes via `ResizeObserver` and dispatches `ui/notifications/size-changed`.

### Widget 2: Daily Prep Dashboard (`ui://widget/prep-dashboard.html`)
- **Primary Tool**: `prep_dashboard_view`.
- **Interactions**:
  - Displays current readiness score ring, consistency percentage, and streak counter.
  - Displays today's active task checklist.
  - Toggling a task checkbox immediately issues `callServerTool('update_task_status', { taskId, status })` through the bridge.
  - Updates task state and streaks in real-time.

---

## 5. Mobile & Iframe Sizing Rules

To prevent clipping issues observed in mobile clients:
1. `ResizeObserver` monitors `document.body` and `document.documentElement`.
2. Any DOM alteration triggers `ui/notifications/size-changed` with current `scrollHeight`.
3. CSS uses responsive fluid layouts (`max-width: 540px; margin: 0 auto; width: 100%`).
4. Fixed-pixel heights (`height: 600px`) are avoided in favor of content-driven flow.
