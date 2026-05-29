import { makeId, nowIso } from "../ids";
import type { EvalSet, EvalSetType } from "../types";
import { deleteObject, getJsonObject, putJsonObject, updateIndex } from "./storage";

const indexKey = "indexes/eval-sets.json";

export type EvalSetIndexItem = {
  id: string;
  type: EvalSetType;
  name: string;
  description: string;
  updatedAt: string;
};

export async function listEvalSets() {
  const items = await getJsonObject<Array<EvalSetIndexItem & { type?: EvalSetType }>>(
    indexKey,
    [],
  );
  return items.map((item) => ({
    ...item,
    type: item.type || "trigger",
  }));
}

export async function getEvalSet(id: string) {
  return getJsonObject<EvalSet | null>(`eval-sets/${id}.json`, null);
}

export async function saveEvalSet(input: Partial<EvalSet> & { id?: string }) {
  const now = nowIso();
  const existing = input.id ? await getEvalSet(input.id) : null;
  const evalSet: EvalSet = {
    id: input.id || makeId("eval"),
    type: input.type || existing?.type || "trigger",
    name: input.name || existing?.name || "未命名评测集",
    description: input.description ?? existing?.description ?? "",
    routingCases: input.routingCases ?? existing?.routingCases ?? [],
    executionCases: input.executionCases ?? existing?.executionCases ?? [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await putJsonObject(`eval-sets/${evalSet.id}.json`, evalSet);
  await updateIndex<EvalSetIndexItem>(indexKey, {
    id: evalSet.id,
    type: evalSet.type,
    name: evalSet.name,
    description: evalSet.description,
    updatedAt: evalSet.updatedAt,
  });

  return evalSet;
}

export async function deleteEvalSet(id: string) {
  await deleteObject(`eval-sets/${id}.json`);
  const existing = await listEvalSets();
  const next = existing.filter((item) => item.id !== id);
  await putJsonObject(indexKey, next);
  return { id };
}
