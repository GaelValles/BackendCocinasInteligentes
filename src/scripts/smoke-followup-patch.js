#!/usr/bin/env node

/**
 * Smoke test for follow-up PATCH persistence.
 *
 * Required env vars:
 * - TOKEN: Bearer token for authRequired routes
 * - TAREA_ID: Task id to patch/read
 *
 * Optional env vars:
 * - BASE_URL: default http://localhost:3001
 * - COOKIE_TOKEN: if you want cookie auth instead of bearer
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TOKEN = process.env.TOKEN || '';
const COOKIE_TOKEN = process.env.COOKIE_TOKEN || '';
const TAREA_ID = process.env.TAREA_ID || '';

const required = [];
if (!TAREA_ID) required.push('TAREA_ID');
if (!TOKEN && !COOKIE_TOKEN) required.push('TOKEN or COOKIE_TOKEN');

if (required.length) {
  console.error('Missing required env vars:', required.join(', '));
  console.error('Example (PowerShell):');
  console.error('$env:BASE_URL="http://localhost:3001"; $env:TAREA_ID="<id>"; $env:TOKEN="<jwt>"; npm run test:followup-smoke');
  process.exit(1);
}

const buildHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (COOKIE_TOKEN) headers.Cookie = `token=${COOKIE_TOKEN}`;
  return headers;
};

const parseJsonSafe = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const request = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await parseJsonSafe(res);
  return { status: res.status, json };
};

const extractTask = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.data && payload.data.data) return payload.data.data; // wrapped + controller envelope
  if (payload.data) return payload.data; // controller envelope
  return payload;
};

const assertTaskState = (task, expected) => {
  if (!task) return { ok: false, reason: 'Task payload missing in response' };

  const actualStatus = task.followUpStatus;
  const actualEstado = task.estado;
  if (expected.followUpStatus && actualStatus !== expected.followUpStatus) {
    return {
      ok: false,
      reason: `followUpStatus mismatch. expected=${expected.followUpStatus} actual=${actualStatus}`
    };
  }
  if (expected.estado && actualEstado !== expected.estado) {
    return {
      ok: false,
      reason: `estado mismatch. expected=${expected.estado} actual=${actualEstado}`
    };
  }

  return { ok: true };
};

const runCase = async (label, patchBody, expectedGet) => {
  console.log(`\n--- ${label} ---`);
  console.log('PATCH body:', JSON.stringify(patchBody));

  const patchRes = await request('PATCH', `/api/tareas/${TAREA_ID}`, patchBody);
  if (patchRes.status >= 400) {
    return {
      ok: false,
      reason: `PATCH failed with status=${patchRes.status}`,
      patchRes
    };
  }

  const getRes = await request('GET', `/api/tareas/${TAREA_ID}`);
  if (getRes.status >= 400) {
    return {
      ok: false,
      reason: `GET failed with status=${getRes.status}`,
      getRes
    };
  }

  const task = extractTask(getRes.json);
  const assertRes = assertTaskState(task, expectedGet);
  if (!assertRes.ok) {
    return {
      ok: false,
      reason: assertRes.reason,
      task
    };
  }

  console.log('PASS');
  console.log(`Observed: followUpStatus=${task.followUpStatus}, estado=${task.estado}`);
  return { ok: true, task };
};

const main = async () => {
  console.log('Follow-up PATCH smoke test');
  console.log('BASE_URL:', BASE_URL);
  console.log('TAREA_ID:', TAREA_ID);

  const cases = [
    {
      label: 'Case A - Confirmar cliente',
      patchBody: { followUpStatus: 'confirmado', estado: 'completada' },
      expectedGet: { followUpStatus: 'confirmado', estado: 'completada' }
    },
    {
      label: 'Case B - Marcar inactivo',
      patchBody: { followUpStatus: 'inactivo', estado: 'completada' },
      expectedGet: { followUpStatus: 'inactivo', estado: 'completada' }
    },
    {
      label: 'Case C - Legacy descartado compatibility',
      patchBody: { followUpStatus: 'descartado' },
      expectedGet: { followUpStatus: 'inactivo' }
    }
  ];

  const results = [];
  for (const testCase of cases) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runCase(testCase.label, testCase.patchBody, testCase.expectedGet);
    results.push({ label: testCase.label, ...result });
    if (!result.ok) {
      console.error('FAIL:', result.reason);
      if (result.patchRes) console.error('PATCH response:', JSON.stringify(result.patchRes.json, null, 2));
      if (result.getRes) console.error('GET response:', JSON.stringify(result.getRes.json, null, 2));
      if (result.task) console.error('Observed task:', JSON.stringify(result.task, null, 2));
      break;
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log('\nSummary');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exit(1);
  process.exit(0);
};

main().catch((err) => {
  console.error('Unexpected error in smoke test:', err);
  process.exit(1);
});
