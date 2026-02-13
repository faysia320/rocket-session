const API_BASE = `http://${window.location.hostname}:8000`;

export async function createSession(workDir) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_dir: workDir || null }),
  });
  return res.json();
}

export async function listSessions() {
  const res = await fetch(`${API_BASE}/api/sessions`);
  return res.json();
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function stopSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/stop`, {
    method: 'POST',
  });
  return res.json();
}
