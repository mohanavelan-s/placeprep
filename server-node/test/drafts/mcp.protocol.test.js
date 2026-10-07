const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
const oauth = require('../src/services/oauth.service');

function base64url(buffer) {
  return buffer.toString('base64url');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function getAccessTokenForUser(user, baseUrl) {
  const { verifier, challenge } = generatePkcePair();
  const tx = await oauth.begin({
    query: {
      response_type: 'code',
      client_id: 'local-mcp-test',
      redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
      state: 'mcp-test-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'placeprep.profile.read placeprep.tasks.read placeprep.tasks.write placeprep.progress.read',
    },
    protocol: 'http',
    get: (h) => (h === 'host' ? new URL(baseUrl).host : null),
  });

  await oauth.authenticateTransaction(tx.id, user.id);
  const approval = await oauth.approve(tx.id, user.id, true);

  const tokenRes = await oauth.exchange({
    body: {
      grant_type: 'authorization_code',
      code: approval.code,
      client_id: 'local-mcp-test',
      redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
      code_verifier: verifier,
    },
    protocol: 'http',
    get: (h) => (h === 'host' ? new URL(baseUrl).host : null),
  });

  return tokenRes.access_token;
}

test('Level 3: MCP Protocol & Tool Execution Tests', async (t) => {
  let server;
  let baseUrl;
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  t.before(async () => {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const ts = Date.now();

    userA = await userRepository.createUser({
      name: 'Student Alice',
      email: `alice-${ts}@placeprep.test`,
      username: `alice-${ts.toString().slice(-6)}`,
      passwordHash,
      timezone: 'Asia/Calcutta',
      role: 'user',
      tier: 'free',
      targetRole: 'Full Stack Engineer',
      placementDate: '2026-12-01',
    });

    userB = await userRepository.createUser({
      name: 'Student Bob',
      email: `bob-${ts}@placeprep.test`,
      username: `bob-${ts.toString().slice(-6)}`,
      passwordHash,
      timezone: 'Asia/Calcutta',
      role: 'user',
      tier: 'free',
      targetRole: 'Data Engineer',
      placementDate: '2026-11-15',
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    tokenA = await getAccessTokenForUser(userA, baseUrl);
    tokenB = await getAccessTokenForUser(userB, baseUrl);
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    const ids = [userA?.id, userB?.id].filter(Boolean);
    if (ids.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    }
    // Allow pending background tasks to settle before closing pool
    await new Promise((r) => setTimeout(r, 200));
    await pool.end();
  });

  async function callMcp(token, method, params = {}, id = 1) {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    });

    const rawText = await res.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      const dataMatch = rawText.match(/data:\s*({.+})/);
      if (dataMatch && dataMatch[1]) {
        try {
          body = JSON.parse(dataMatch[1]);
        } catch {
          body = { raw: rawText };
        }
      } else {
        body = { raw: rawText };
      }
    }

    return {
      status: res.status,
      headers: res.headers,
      body,
    };
  }

  await t.test('3.1: Protocol initialize handshake', async () => {
    const res = await callMcp(tokenA, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.result?.serverInfo?.name, 'PlacePrep MCP');
    assert.ok(res.body.result?.capabilities?.tools);
    assert.ok(res.body.result?.capabilities?.resources);
  });

  await t.test('3.2: tools/list returns complete catalogue and UI metadata', async () => {
    const res = await callMcp(tokenA, 'tools/list');
    assert.equal(res.status, 200);
    const tools = res.body.result?.tools;
    assert.ok(Array.isArray(tools));

    const toolNames = tools.map((t) => t.name);
    assert.ok(toolNames.includes('get_profile'));
    assert.ok(toolNames.includes('get_progress_summary'));
    assert.ok(toolNames.includes('get_tasks'));
    assert.ok(toolNames.includes('get_task'));
    assert.ok(toolNames.includes('task_setup'));
    assert.ok(toolNames.includes('create_task'));
    assert.ok(toolNames.includes('update_task_status'));
    assert.ok(toolNames.includes('delete_task'));
    assert.ok(toolNames.includes('prep_dashboard_view'));

    // Check UI metadata on app tools
    const taskSetup = tools.find((t) => t.name === 'task_setup');
    assert.equal(taskSetup._meta?.ui?.resourceUri, 'ui://widget/task-setup.html');

    const prepDashboard = tools.find((t) => t.name === 'prep_dashboard_view');
    assert.equal(prepDashboard._meta?.ui?.resourceUri, 'ui://widget/prep-dashboard.html');
  });

  await t.test('3.3: resources/list and resources/read return valid MCP App UI HTML', async () => {
    const listRes = await callMcp(tokenA, 'resources/list');
    assert.equal(listRes.status, 200);
    const resources = listRes.body.result?.resources;
    assert.ok(Array.isArray(resources));
    const uris = resources.map((r) => r.uri);
    assert.ok(uris.includes('ui://widget/task-setup.html'));
    assert.ok(uris.includes('ui://widget/prep-dashboard.html'));

    // Read task setup widget
    const readRes = await callMcp(tokenA, 'resources/read', {
      uri: 'ui://widget/task-setup.html',
    });
    assert.equal(readRes.status, 200);
    const contents = readRes.body.result?.contents;
    assert.ok(Array.isArray(contents) && contents.length > 0);
    assert.equal(contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.ok(contents[0].text.includes('PlacePrep Task Setup'));
    assert.ok(contents[0].text.includes('ui/initialize'));
  });

  let createdTaskId;

  await t.test('3.4: tools/call get_profile returns user-scoped profile', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'get_profile',
      arguments: {},
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text);
    const parsed = JSON.parse(text);
    assert.equal(parsed.name, 'Student Alice');
    assert.equal(parsed.targetRole, 'Full Stack Engineer');
  });

  await t.test('3.5: tools/call task_setup returns draft details for review', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'task_setup',
      arguments: {
        title: 'Practice Binary Search on Rotated Array',
        category: 'DSA',
        difficulty: 3,
        estimatedMinutes: 45,
      },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text.includes('Task Setup Draft'));
    assert.ok(text.includes('Practice Binary Search on Rotated Array'));
    assert.ok(text.includes('45 mins'));
  });

  await t.test('3.6: tools/call create_task persists task and rejects synthetic placeholders', async () => {
    // Negative test: synthetic placeholder rejection
    const badRes = await callMcp(tokenA, 'tools/call', {
      name: 'create_task',
      arguments: {
        title: 'New task',
        category: 'DSA',
      },
    });
    assert.ok(badRes.body.error || badRes.body.result?.isError, 'Synthetic placeholder must be rejected');

    // Positive test: valid creation
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'create_task',
      arguments: {
        title: 'Solve Minimum Window Substring',
        category: 'DSA',
        difficulty: 4,
        estimatedMinutes: 60,
        priority: 'high',
      },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text.includes('Task created successfully'));

    const match = text.match(/ID:\s+([a-f0-9-]+)/i);
    assert.ok(match && match[1], 'Task ID must be in output');
    createdTaskId = match[1];
  });

  await t.test('3.7: tools/call get_tasks lists created task for Alice', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'get_tasks',
      arguments: { category: 'DSA' },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    const parsed = JSON.parse(text);
    assert.ok(parsed.tasks.some((t) => t.id === createdTaskId));
  });

  await t.test('3.8: tools/call update_task_status marks task completed', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'update_task_status',
      arguments: {
        taskId: createdTaskId,
        status: 'completed',
        actualMinutes: 50,
      },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text.includes('completed'));
  });

  await t.test('3.9: Cross-user authorization negative test: Bob cannot access or delete Alice task', async () => {
    // Bob attempts to get Alice's task
    const getRes = await callMcp(tokenB, 'tools/call', {
      name: 'get_task',
      arguments: { taskId: createdTaskId },
    });

    assert.ok(getRes.body.error || getRes.body.result?.isError, 'Bob must not be able to get Alice task');

    // Bob attempts to delete Alice's task
    const delRes = await callMcp(tokenB, 'tools/call', {
      name: 'delete_task',
      arguments: { taskId: createdTaskId },
    });

    assert.ok(delRes.body.error || delRes.body.result?.isError, 'Bob must not be able to delete Alice task');
  });

  await t.test('3.10: tools/call delete_task allows Alice to explicitly delete own task', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'delete_task',
      arguments: { taskId: createdTaskId },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text.includes('Deleted task'));

    // Verify task is gone
    const checkRes = await callMcp(tokenA, 'tools/call', {
      name: 'get_task',
      arguments: { taskId: createdTaskId },
    });
    assert.ok(checkRes.body.error || checkRes.body.result?.isError, 'Deleted task should no longer exist');
  });

  await t.test('3.11: tools/call prep_dashboard_view returns daily overview', async () => {
    const res = await callMcp(tokenA, 'tools/call', {
      name: 'prep_dashboard_view',
      arguments: { includeCompleted: true },
    });

    assert.equal(res.status, 200);
    const text = res.body.result?.content?.[0]?.text;
    assert.ok(text.includes('PlacePrep Daily Plan'));
    assert.ok(text.includes('Readiness'));
  });
});
