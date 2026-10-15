// Shared Kie.ai helpers for edge functions.
// API shape verified Oct 2026: POST /api/v1/jobs/createTask {model, input}
// -> {code:200, data:{taskId}}; GET /api/v1/jobs/recordInfo?taskId=
// -> data.state in waiting|queuing|generating|success|fail;
// resultJson is a JSON string holding {resultUrls: [...]}.
// Result URLs expire in ~24h: always download to Supabase Storage.

export const KIE_BASE = "https://api.kie.ai/api/v1";

export interface KieTaskResponse {
  code: number;
  msg: string;
  data?: { taskId?: string; recordId?: string };
}

export interface KieRecordResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    state?: string;
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    progress?: number;
  };
}

export async function kieCreateTask(
  apiKey: string,
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    throw new Error(`Kie.ai createTask failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as KieTaskResponse;
  const taskId = body.data?.taskId ?? body.data?.recordId;
  if (body.code !== 200 || !taskId) {
    throw new Error(`Kie.ai createTask error: ${body.msg || "no taskId returned"}`);
  }
  return taskId;
}

export async function kieRecordInfo(
  apiKey: string,
  taskId: string
): Promise<KieRecordResponse["data"]> {
  const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Kie.ai recordInfo failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as KieRecordResponse;
  return body.data;
}

export function kieResultUrls(record: KieRecordResponse["data"]): string[] {
  if (!record?.resultJson) return [];
  try {
    const parsed = JSON.parse(record.resultJson) as { resultUrls?: string[] };
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls : [];
  } catch {
    return [];
  }
}
