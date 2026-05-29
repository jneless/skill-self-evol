import type { TaskKind, TaskRecord } from "../types";
import { makeId, nowIso } from "../ids";
import { getEnv } from "./env";
import { getJsonObject, putJsonObject, updateIndex } from "./storage";

const currentTaskKey = "tasks/current.json";
const tasksIndexKey = "indexes/tasks.json";

export async function createTask(kind: TaskKind, total = 1) {
  await releaseStaleTask();
  const running = await getCurrentTask();
  if (running && ["queued", "running"].includes(running.status)) {
    throw new Error("已有任务正在运行，请等待完成");
  }

  const now = nowIso();
  const task: TaskRecord = {
    id: makeId("task"),
    kind,
    status: "queued",
    progress: { completed: 0, total, label: "已创建任务" },
    createdAt: now,
    updatedAt: now,
  };

  await saveTask(task);
  return task;
}

export async function getTask(id: string) {
  return getJsonObject<TaskRecord | null>(`tasks/${id}/status.json`, null);
}

export async function getCurrentTask() {
  return getJsonObject<TaskRecord | null>(currentTaskKey, null);
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<TaskRecord, "id" | "createdAt">>,
) {
  const existing = await getTask(id);
  if (!existing) throw new Error("Task not found");
  const next: TaskRecord = {
    ...existing,
    ...patch,
    id,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  await saveTask(next);
  return next;
}

export async function completeTask(id: string, resultRef: string) {
  return updateTask(id, {
    status: "succeeded",
    resultRef,
    progress: { completed: 1, total: 1, label: "已完成" },
  });
}

export async function failTask(id: string, errorMessage: string) {
  return updateTask(id, {
    status: "failed",
    errorMessage,
    progress: { completed: 1, total: 1, label: "失败" },
  });
}

async function saveTask(task: TaskRecord) {
  await putJsonObject(`tasks/${task.id}/status.json`, task);
  await putJsonObject(currentTaskKey, task);
  await updateIndex(tasksIndexKey, {
    id: task.id,
    kind: task.kind,
    status: task.status,
    updatedAt: task.updatedAt,
  });
}

async function releaseStaleTask() {
  const current = await getCurrentTask();
  if (!current || !["queued", "running"].includes(current.status)) return;

  const env = getEnv();
  const staleMs = env.TASK_STALE_TIMEOUT_MINUTES * 60 * 1000;
  const updatedAt = new Date(current.updatedAt).getTime();
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt > staleMs) {
    await failTask(
      current.id,
      `Task became stale after ${env.TASK_STALE_TIMEOUT_MINUTES} minutes without status updates.`,
    );
  }
}
