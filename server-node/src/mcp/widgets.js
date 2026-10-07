function getTaskSetupHtml(baseUrl) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlacePrep Task Setup</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #131d35;
      --border: #23314f;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --input-bg: #0f172a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    }
    .widget-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      max-width: 520px;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    .widget-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    input, select, textarea {
      width: 100%;
      padding: 8px 10px;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    .row {
      display: flex;
      gap: 10px;
    }
    .col { flex: 1; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      transition: background 0.15s ease;
    }
    .btn:hover:not(:disabled) { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .status-msg {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      display: none;
    }
    .status-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
      display: block;
    }
    .status-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      display: block;
    }
  </style>
</head>
<body>
  <div class="widget-container" id="app">
    <div class="widget-header">
      <div class="widget-title">
        <span>⚡ PlacePrep</span>
        <span class="badge" id="categoryBadge">DSA</span>
      </div>
      <span style="color: var(--muted); font-size: 12px;">Task Setup</span>
    </div>

    <form id="taskForm">
      <div class="form-group">
        <label for="taskTitle">Task Title</label>
        <input id="taskTitle" name="title" required placeholder="e.g. Solve Binary Tree Maximum Path Sum">
      </div>

      <div class="row">
        <div class="col form-group">
          <label for="taskCategory">Category</label>
          <select id="taskCategory" name="category">
            <option value="DSA">DSA</option>
            <option value="Core">Core Subjects</option>
            <option value="Project">Project Work</option>
            <option value="Aptitude">Aptitude</option>
            <option value="Resume">Resume Prep</option>
            <option value="MockInterview">Mock Interview</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="col form-group">
          <label for="taskDifficulty">Difficulty (1-5)</label>
          <select id="taskDifficulty" name="difficulty">
            <option value="1">1 - Fundamental</option>
            <option value="2">2 - Easy</option>
            <option value="3" selected>3 - Medium</option>
            <option value="4">4 - Hard</option>
            <option value="5">5 - Advanced</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div class="col form-group">
          <label for="taskMinutes">Estimated Mins</label>
          <input id="taskMinutes" name="estimatedMinutes" type="number" min="5" max="480" value="30">
        </div>
        <div class="col form-group">
          <label for="taskPriority">Priority</label>
          <select id="taskPriority" name="priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="col form-group">
          <label for="taskDate">Date</label>
          <input id="taskDate" name="scheduledFor" type="date">
        </div>
      </div>

      <div class="form-group">
        <label for="taskDesc">Notes / Description (Optional)</label>
        <textarea id="taskDesc" name="description" rows="2" placeholder="Key concepts, edge cases, or problem link"></textarea>
      </div>

      <button type="submit" class="btn" id="submitBtn">Save Preparation Task</button>
      <div id="statusAlert" class="status-msg"></div>
    </form>
  </div>

  <script>
    (function() {
      const todayStr = new Date().toISOString().slice(0, 10);
      document.getElementById('taskDate').value = todayStr;

      let callId = 1;
      const pendingCalls = new Map();

      function notifySize() {
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        const width = document.documentElement.scrollWidth || document.body.scrollWidth;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            jsonrpc: '2.0',
            method: 'ui/notifications/size-changed',
            params: { width, height: Math.min(height + 10, 800) }
          }, '*');
        }
      }

      function callServerTool(name, args) {
        return new Promise((resolve, reject) => {
          const id = 'call-' + (callId++);
          pendingCalls.set(id, { resolve, reject });
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              jsonrpc: '2.0',
              id: id,
              method: 'callServerTool',
              params: { name: name, arguments: args }
            }, '*');
          } else {
            console.log('[Dev mode] Simulated callServerTool:', name, args);
            setTimeout(() => resolve({ content: [{ type: 'text', text: 'Simulated created task' }] }), 500);
          }
        });
      }

      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        // JSON-RPC Handshake: ui/initialize
        if (data.method === 'ui/initialize') {
          if (data.id) {
            window.parent.postMessage({
              jsonrpc: '2.0',
              id: data.id,
              result: {
                protocolVersion: '2026-01-26',
                capabilities: {}
              }
            }, '*');
          }
          window.parent.postMessage({
            jsonrpc: '2.0',
            method: 'ui/notifications/initialized',
            params: {}
          }, '*');
          notifySize();
          return;
        }

        // Handle tool input / initial values
        if (data.method === 'ui/notifications/tool-input') {
          const input = data.params?.arguments || {};
          if (input.title) document.getElementById('taskTitle').value = input.title;
          if (input.category) {
            document.getElementById('taskCategory').value = input.category;
            document.getElementById('categoryBadge').textContent = input.category;
          }
          if (input.difficulty) document.getElementById('taskDifficulty').value = input.difficulty;
          if (input.estimatedMinutes) document.getElementById('taskMinutes').value = input.estimatedMinutes;
          if (input.priority) document.getElementById('taskPriority').value = input.priority;
          if (input.scheduledFor) document.getElementById('taskDate').value = input.scheduledFor;
          if (input.description) document.getElementById('taskDesc').value = input.description;
          notifySize();
          return;
        }

        // Handle tool result
        if (data.method === 'ui/notifications/tool-result') {
          notifySize();
          return;
        }

        // Response to pending callServerTool
        if (data.id && pendingCalls.has(data.id)) {
          const { resolve, reject } = pendingCalls.get(data.id);
          pendingCalls.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message || 'Tool call failed'));
          } else {
            resolve(data.result);
          }
        }
      });

      document.getElementById('taskCategory').addEventListener('change', (e) => {
        document.getElementById('categoryBadge').textContent = e.target.value;
      });

      const form = document.getElementById('taskForm');
      const submitBtn = document.getElementById('submitBtn');
      const statusAlert = document.getElementById('statusAlert');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Task...';
        statusAlert.className = 'status-msg';
        statusAlert.style.display = 'none';

        const payload = {
          title: document.getElementById('taskTitle').value.trim(),
          category: document.getElementById('taskCategory').value,
          difficulty: parseInt(document.getElementById('taskDifficulty').value, 10),
          estimatedMinutes: parseInt(document.getElementById('taskMinutes').value, 10),
          priority: document.getElementById('taskPriority').value,
          scheduledFor: document.getElementById('taskDate').value,
          description: document.getElementById('taskDesc').value.trim() || undefined,
        };

        try {
          await callServerTool('create_task', payload);
          statusAlert.textContent = '✅ Task created and scheduled successfully!';
          statusAlert.className = 'status-msg status-success';
          submitBtn.textContent = 'Saved!';
        } catch (err) {
          statusAlert.textContent = '❌ Failed to create task: ' + err.message;
          statusAlert.className = 'status-msg status-error';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Preparation Task';
        }
        notifySize();
      });

      const observer = new ResizeObserver(() => notifySize());
      observer.observe(document.body);
      window.addEventListener('load', notifySize);
      setTimeout(notifySize, 100);
    })();
  </script>
</body>
</html>`;
}

function getPrepDashboardHtml(baseUrl) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlacePrep Dashboard</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #131d35;
      --border: #23314f;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --input-bg: #0f172a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    }
    .dashboard-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      max-width: 540px;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-row {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .stat-card {
      flex: 1;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .stat-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      margin-top: 2px;
      color: var(--text);
    }
    .coach-card {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 12px;
      color: #bfdbfe;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .task-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .task-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
      transition: border-color 0.15s ease;
    }
    .task-item:hover {
      border-color: var(--primary);
    }
    .task-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }
    .task-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .task-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
    }
    .task-completed .task-title {
      text-decoration: line-through;
      color: var(--muted);
    }
    .task-pill {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--muted);
      font-weight: 600;
    }
    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="dashboard-container" id="app">
    <div class="header">
      <div class="header-title">
        <span>🎯 PlacePrep</span>
      </div>
      <span style="color: var(--muted); font-size: 12px;">Daily Prep Plan</span>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Readiness</div>
        <div class="stat-value" id="readinessScore">--%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Current Streak</div>
        <div class="stat-value" id="currentStreak">🔥 --</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Consistency</div>
        <div class="stat-value" id="consistencyScore">--%</div>
      </div>
    </div>

    <div class="coach-card" id="coachCard">
      <span>💡</span>
      <span id="coachText">Loading placement coach recommendations...</span>
    </div>

    <div class="section-title">Today's Tasks</div>
    <ul class="task-list" id="taskList">
      <div class="empty-state">No tasks scheduled for today. Ask your AI to plan your day!</div>
    </ul>
  </div>

  <script>
    (function() {
      let callId = 1;
      const pendingCalls = new Map();
      let currentTasks = [];

      function notifySize() {
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        const width = document.documentElement.scrollWidth || document.body.scrollWidth;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            jsonrpc: '2.0',
            method: 'ui/notifications/size-changed',
            params: { width, height: Math.min(height + 10, 800) }
          }, '*');
        }
      }

      function callServerTool(name, args) {
        return new Promise((resolve, reject) => {
          const id = 'call-' + (callId++);
          pendingCalls.set(id, { resolve, reject });
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              jsonrpc: '2.0',
              id: id,
              method: 'callServerTool',
              params: { name: name, arguments: args }
            }, '*');
          } else {
            console.log('[Dev mode] Simulated callServerTool:', name, args);
            setTimeout(() => resolve({ content: [{ type: 'text', text: 'Simulated success' }] }), 300);
          }
        });
      }

      function renderDashboard(data) {
        if (!data) return;

        if (data.readinessScore !== undefined) {
          document.getElementById('readinessScore').textContent = data.readinessScore + '%';
        }
        if (data.currentStreak !== undefined) {
          document.getElementById('currentStreak').textContent = '🔥 ' + data.currentStreak;
        }
        if (data.consistencyScore !== undefined) {
          document.getElementById('consistencyScore').textContent = data.consistencyScore + '%';
        }
        if (data.coachDirective) {
          document.getElementById('coachText').textContent = data.coachDirective;
        }

        if (Array.isArray(data.tasks)) {
          currentTasks = data.tasks;
          const listEl = document.getElementById('taskList');
          if (!currentTasks.length) {
            listEl.innerHTML = '<div class="empty-state">All caught up for today! Plan more tasks or rest up.</div>';
          } else {
            listEl.innerHTML = currentTasks.map(t => {
              const isDone = t.status === 'completed';
              return '<li class="task-item ' + (isDone ? 'task-completed' : '') + '" id="task-' + t.id + '">' +
                '<div class="task-left">' +
                  '<input type="checkbox" class="task-checkbox" ' + (isDone ? 'checked' : '') + ' data-id="' + t.id + '">' +
                  '<span class="task-title">' + escapeHtml(t.title) + '</span>' +
                '</div>' +
                '<span class="task-pill">' + escapeHtml(t.category || 'DSA') + '</span>' +
              '</li>';
            }).join('');

            // Attach checkbox handlers
            listEl.querySelectorAll('.task-checkbox').forEach(cb => {
              cb.addEventListener('change', async (e) => {
                const taskId = e.target.getAttribute('data-id');
                const nextStatus = e.target.checked ? 'completed' : 'pending';
                const itemEl = document.getElementById('task-' + taskId);
                if (itemEl) {
                  if (nextStatus === 'completed') itemEl.classList.add('task-completed');
                  else itemEl.classList.remove('task-completed');
                }
                try {
                  await callServerTool('update_task_status', { taskId, status: nextStatus });
                } catch (err) {
                  console.error('Failed to update status:', err);
                  // revert
                  e.target.checked = !e.target.checked;
                }
              });
            });
          }
        }
        notifySize();
      }

      function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        // JSON-RPC Handshake: ui/initialize
        if (data.method === 'ui/initialize') {
          if (data.id) {
            window.parent.postMessage({
              jsonrpc: '2.0',
              id: data.id,
              result: {
                protocolVersion: '2026-01-26',
                capabilities: {}
              }
            }, '*');
          }
          window.parent.postMessage({
            jsonrpc: '2.0',
            method: 'ui/notifications/initialized',
            params: {}
          }, '*');
          notifySize();
          return;
        }

        // Handle tool result
        if (data.method === 'ui/notifications/tool-result') {
          const structured = data.params?.structuredContent || data.params?.result;
          if (structured) {
            renderDashboard(structured);
          } else if (data.params?.content?.[0]?.text) {
            try {
              const parsed = JSON.parse(data.params.content[0].text);
              renderDashboard(parsed);
            } catch {}
          }
          notifySize();
          return;
        }

        // Response to pending callServerTool
        if (data.id && pendingCalls.has(data.id)) {
          const { resolve, reject } = pendingCalls.get(data.id);
          pendingCalls.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message || 'Tool call failed'));
          } else {
            resolve(data.result);
          }
        }
      });

      const observer = new ResizeObserver(() => notifySize());
      observer.observe(document.body);
      window.addEventListener('load', notifySize);
      setTimeout(notifySize, 100);
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  getTaskSetupHtml,
  getPrepDashboardHtml,
};
