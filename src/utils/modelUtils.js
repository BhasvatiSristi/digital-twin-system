import * as THREE from "three";
import { normalizeMotionDraft } from "./motionUtils";

export const palette = [
  "#6bc1ff",
  "#ffd56b",
  "#7effa3",
  "#b98cff",
];

export function createParameterDraft(name = "", value = "", unit = "") {
  return { name, value, unit };
}

export function normalizeParameterDraft(parameter = {}) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    return {
      name: String(parameter.name ?? ""),
      value: String(parameter.value ?? ""),
      unit: String(parameter.unit ?? ""),
    };
  }

  return createParameterDraft();
}

export function normalizeParameterDrafts(parameters = []) {
  if (!Array.isArray(parameters)) {
    return [];
  }

  return parameters.map((parameter) => normalizeParameterDraft(parameter));
}

export function compactParameterDrafts(parameters = []) {
  return normalizeParameterDrafts(parameters).filter((parameter) => parameter.name || parameter.value || parameter.unit);
}

export function createDefaultSettings(index = 0) {
  return {
    color: palette[index % palette.length],
    motion: normalizeMotionDraft(),
    parameters: [],
  };
}

export function normalizeModelId(modelId) {
  return String(modelId);
}

export function normalizeVector(arrayLike) {
  return new THREE.Vector3(arrayLike[0], arrayLike[1], arrayLike[2]);
}

export function quaternionFromArray(arrayLike = [0, 0, 0, 1]) {
  return new THREE.Quaternion(arrayLike[0], arrayLike[1], arrayLike[2], arrayLike[3]);
}

export function vectorFromArray(arrayLike = [0, 0, 0]) {
  return new THREE.Vector3(arrayLike[0], arrayLike[1], arrayLike[2]);
}

export function collectDescendantIds(modelId, childrenByParent = {}) {
  const descendantIds = [];
  const queue = [...(childrenByParent[modelId] ?? [])];

  while (queue.length) {
    const nextId = queue.shift();
    descendantIds.push(nextId);
    queue.push(...(childrenByParent[nextId] ?? []));
  }

  return descendantIds;
}


