import { Bounds, Html, OrbitControls, useProgress, Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import "./App.css";
import CadModel from "./components/CadModel";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";
import PartInfoPopup from "./components/PartInfoPopup";

const supportedExtensions = ["glb", "stl", "step"];
const converterEndpoint = import.meta.env.VITE_CONVERTER_ENDPOINT ?? "/api/convert";
const defaultModel = {
  id: "default-model",
  name: "House model (3d_house.glb)",
  url: "/model/3d_house.glb",
  isDefault: true,
};

const palette = [
  "#6bc1ff",
  "#ffd56b",
  "#7effa3",
  "#b98cff",
];

const defaultMotion = {
  type: "none",
  axis: "x",
  direction: "positive",
  speed: { value: 1, unit: "m/s" },
  amplitude: { value: 20, unit: "m" },
};

function createMotionParameter(value, unit) {
  return { value, unit };
}

function createParameterDraft(name = "", value = "", unit = "") {
  return { name, value, unit };
}

function getSpeedUnitOptions(type) {
  if (type === "rotation") {
    return ["rpm", "rps", "deg/s", "rad/s"];
  }

  if (type === "oscillation") {
    return ["m/s", "cm/s", "mm/s"];
  }

  return ["m/s", "cm/s", "mm/s"];
}

function getAmplitudeUnitOptions() {
  return ["m", "cm", "mm"];
}

function normalizeMotionParameter(parameter, fallbackValue, fallbackUnit, allowedUnits) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    const nextValue = Number(parameter.value);
    return {
      value: Number.isFinite(nextValue) ? nextValue : fallbackValue,
      unit: allowedUnits.includes(parameter.unit) ? parameter.unit : fallbackUnit,
    };
  }

  const nextValue = Number(parameter);
  return createMotionParameter(Number.isFinite(nextValue) ? nextValue : fallbackValue, fallbackUnit);
}

function normalizeMotionDraft(motion = {}) {
  const type = motion.type ?? defaultMotion.type;
  const speedUnit = type === "rotation" ? "rpm" : "m/s";

  return {
    ...defaultMotion,
    ...motion,
    type,
    axis: motion.axis ?? defaultMotion.axis,
    direction: motion.direction ?? defaultMotion.direction,
    speed: normalizeMotionParameter(motion.speed, defaultMotion.speed.value, speedUnit, getSpeedUnitOptions(type)),
    amplitude: normalizeMotionParameter(motion.amplitude, defaultMotion.amplitude.value, "m", getAmplitudeUnitOptions()),
  };
}

function normalizeParameterDraft(parameter = {}) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    return {
      name: String(parameter.name ?? ""),
      value: String(parameter.value ?? ""),
      unit: String(parameter.unit ?? ""),
    };
  }

  return createParameterDraft();
}

function normalizeParameterDrafts(parameters = []) {
  if (!Array.isArray(parameters)) {
    return [];
  }

  return parameters.map((parameter) => normalizeParameterDraft(parameter));
}

function compactParameterDrafts(parameters = []) {
  return normalizeParameterDrafts(parameters).filter((parameter) => parameter.name || parameter.value || parameter.unit);
}

function convertSpeedToBaseUnits(speed, type) {
  const value = Number(speed?.value ?? speed ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = speed?.unit ?? "m/s";

  if (type === "translation") {
    if (unit === "cm/s") return value / 100;
    if (unit === "mm/s") return value / 1000;
    return value;
  }

  if (unit === "deg/s") return (value * Math.PI) / 180;
  if (unit === "rpm") return (value * 2 * Math.PI) / 60;
  if (unit === "rps") return value * 2 * Math.PI;
  return value;
}

function convertAmplitudeToBaseUnits(amplitude) {
  const value = Number(amplitude?.value ?? amplitude ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = amplitude?.unit ?? "m";

  if (unit === "cm") return value / 100;
  if (unit === "mm") return value / 1000;
  return value;
}

function toRuntimeMotion(motion = {}) {
  const normalized = normalizeMotionDraft(motion);

  if (normalized.type === "translation") {
    const amplitude = convertAmplitudeToBaseUnits(normalized.amplitude);
    const speed = convertSpeedToBaseUnits(normalized.speed, normalized.type);

    return {
      ...normalized,
      speed: amplitude > 0 ? speed / amplitude : 0,
      amplitude,
    };
  }

  return {
    ...normalized,
    speed: convertSpeedToBaseUnits(normalized.speed, normalized.type),
    amplitude: convertAmplitudeToBaseUnits(normalized.amplitude),
  };
}

function createDefaultSettings(index = 0) {
  return {
    color: palette[index % palette.length],
    motion: normalizeMotionDraft(),
    parameters: [],
  };
}

function getFileExtension(name) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatFileLabel(name) {
  const extension = getFileExtension(name);
  return extension ? extension.toUpperCase() : "FILE";
}

function createUploadId(file, suffix = "") {
  return `${file.name}-${file.lastModified}-${file.size}-${suffix || "upload"}-${Math.random().toString(36).slice(2)}`;
}

function normalizeModelId(modelId) {
  return String(modelId);
}

function normalizeVector(arrayLike) {
  return new THREE.Vector3(arrayLike[0], arrayLike[1], arrayLike[2]);
}

function quaternionFromArray(arrayLike = [0, 0, 0, 1]) {
  return new THREE.Quaternion(arrayLike[0], arrayLike[1], arrayLike[2], arrayLike[3]);
}

function vectorFromArray(arrayLike = [0, 0, 0]) {
  return new THREE.Vector3(arrayLike[0], arrayLike[1], arrayLike[2]);
}

function collectDescendantIds(modelId, childrenByParent = {}) {
  const descendantIds = [];
  const queue = [...(childrenByParent[modelId] ?? [])];

  while (queue.length) {
    const nextId = queue.shift();
    descendantIds.push(nextId);
    queue.push(...(childrenByParent[nextId] ?? []));
  }

  return descendantIds;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)} %</Html>;
}

function JoinDialog({ open, partIds, parentId, childId, allModels, onParentChange, onChildChange, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  const options = partIds.map((partId) => {
    const model = allModels.find((item) => item.id === partId);
    return {
      id: partId,
      label: model?.name ?? partId,
    };
  });

  return (
    <div className="inspector-backdrop join-backdrop" onClick={onCancel}>
      <div className="inspector-panel join-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inspector-header">
          <div>
            <p className="inspector-kicker">Join parts</p>
            <h2>Choose parent and child</h2>
          </div>
          <button className="inspector-close" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <label className="inspector-field">
          <span>Parent part</span>
          <select value={parentId ?? ""} onChange={(event) => onParentChange(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span>Child part</span>
          <select value={childId ?? ""} onChange={(event) => onChildChange(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="inspector-help">Parent motion propagates to the child. The child can still move on its own without driving the parent.</p>

        <div className="inspector-actions">
          <button type="button" className="library-action" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="library-action" onClick={onConfirm}>
            Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [uploads, setUploads] = useState([]);
  // start with no models visible by default
  const [visibleModelIds, setVisibleModelIds] = useState(() => new Set([defaultModel.id]));
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [selectionDraftIds, setSelectionDraftIds] = useState([]);
  const [attachmentParentByChild, setAttachmentParentByChild] = useState({});
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const [joinDialog, setJoinDialog] = useState(null);
  const [faceSelection, setFaceSelection] = useState(null);
  const [faceConnectMode, setFaceConnectMode] = useState(false);
  const [status, setStatus] = useState("House model loaded.");
  const objectUrlsRef = useRef([]);
  const [positions, setPositions] = useState({});
  const [rotations, setRotations] = useState({});
  const [modelSettings, setModelSettings] = useState(() => ({}));
  const [inspectorModelId, setInspectorModelId] = useState(null);
  const [inspectorDraft, setInspectorDraft] = useState(null);
  const [inspectorTab, setInspectorTab] = useState(null);
  const [partPopupModelId, setPartPopupModelId] = useState(null);
  const [nudgeDistance, setNudgeDistance] = useState(5);
  const controlsRef = useRef(null);

  const isSelectingParts = selectionModeActive;

  const attachmentChildrenByParent = (() => {
    const map = {};

    Object.entries(attachmentParentByChild).forEach(([childId, parentId]) => {
      if (!map[parentId]) {
        map[parentId] = [];
      }
      map[parentId].push(childId);
    });

    return map;
  })();

  const openJoinDialogFromSelection = () => {
    if (!selectionModeActive || selectionDraftIds.length < 2) {
      setStatus("Select at least two parts before joining.");
      return;
    }

    const uniquePartIds = [...new Set(selectionDraftIds)];
    setJoinDialog({
      partIds: uniquePartIds,
      parentId: uniquePartIds[0],
      childId: uniquePartIds[1] ?? uniquePartIds[0],
    });
    setStatus("Choose the parent and child, then confirm the join.");
  };

  const closeJoinDialog = () => {
    setJoinDialog(null);
  };

  const resetJoinSelection = () => {
    setSelectionModeActive(false);
    setSelectionDraftIds([]);
    setJoinDialog(null);
  };

  const applySubtreeTransform = (rootId, nextRootPosition, nextRootQuaternion) => {
    const oldRootPosition = vectorFromArray(positions[rootId] ?? [0, 0, 0]);
    const oldRootQuaternion = quaternionFromArray(rotations[rootId] ?? [0, 0, 0, 1]);
    const rootInverseQuaternion = oldRootQuaternion.clone().invert();
    const affectedIds = [rootId, ...collectDescendantIds(rootId, attachmentChildrenByParent)];

    setPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };

      affectedIds.forEach((modelId) => {
        if (modelId === rootId) {
          nextPositions[modelId] = [nextRootPosition.x, nextRootPosition.y, nextRootPosition.z];
          return;
        }

        const currentPosition = vectorFromArray(currentPositions[modelId] ?? [0, 0, 0]);
        const relativePosition = currentPosition.clone().sub(oldRootPosition).applyQuaternion(rootInverseQuaternion.clone());
        const nextPosition = relativePosition.applyQuaternion(nextRootQuaternion.clone()).add(nextRootPosition);
        nextPositions[modelId] = [nextPosition.x, nextPosition.y, nextPosition.z];
      });

      return nextPositions;
    });

    setRotations((currentRotations) => {
      const nextRotations = { ...currentRotations };

      affectedIds.forEach((modelId) => {
        if (modelId === rootId) {
          nextRotations[modelId] = [nextRootQuaternion.x, nextRootQuaternion.y, nextRootQuaternion.z, nextRootQuaternion.w];
          return;
        }

        const currentQuaternion = quaternionFromArray(currentRotations[modelId] ?? [0, 0, 0, 1]);
        const relativeQuaternion = rootInverseQuaternion.clone().multiply(currentQuaternion);
        const nextQuaternion = nextRootQuaternion.clone().multiply(relativeQuaternion).normalize();
        nextRotations[modelId] = [nextQuaternion.x, nextQuaternion.y, nextQuaternion.z, nextQuaternion.w];
      });

      return nextRotations;
    });
  };

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Enter" || !selectionModeActive || !selectionDraftIds.length) {
        return;
      }

      event.preventDefault();
      openJoinDialogFromSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionDraftIds, selectionModeActive]);

  const convertToGlb = async (file) => {
    const extension = getFileExtension(file.name);

    if (extension === "glb") {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);

      return {
        id: createUploadId(file, "glb"),
        name: file.name,
        url,
        isDefault: false,
        sourceExtension: "glb",
      };
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(converterEndpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed to convert ${file.name}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);

    return {
      id: createUploadId(file, "glb"),
      name: `${file.name.replace(/\.(step|stl)$/i, "")}.glb`,
      url,
      isDefault: false,
      sourceExtension: extension,
      convertedFrom: extension,
    };
  };

  const allModels = [defaultModel, ...uploads];
  const visibleModels = allModels.filter((model) => visibleModelIds.has(model.id));

  const getModelLocalPose = (modelId) => {
    const worldPosition = vectorFromArray(positions[modelId] ?? [0, 0, 0]);
    const worldQuaternion = quaternionFromArray(rotations[modelId] ?? [0, 0, 0, 1]);
    const parentId = attachmentParentByChild[modelId];

    if (!parentId) {
      return {
        position: [worldPosition.x, worldPosition.y, worldPosition.z],
        quaternion: [worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w],
      };
    }

    const parentWorldPosition = vectorFromArray(positions[parentId] ?? [0, 0, 0]);
    const parentWorldQuaternion = quaternionFromArray(rotations[parentId] ?? [0, 0, 0, 1]);
    const parentInverseQuaternion = parentWorldQuaternion.clone().invert();

    const localPosition = worldPosition.clone().sub(parentWorldPosition).applyQuaternion(parentInverseQuaternion);
    const localQuaternion = parentInverseQuaternion.multiply(worldQuaternion).normalize();

    return {
      position: [localPosition.x, localPosition.y, localPosition.z],
      quaternion: [localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w],
    };
  };

  const getForceBasedColor = (model) => {
  const settings = modelSettings[model.id] ?? createDefaultSettings();

  const force = settings.parameters?.find(
    (p) => p.name?.trim().toLowerCase() === "force"
  );

  if (!force) {
    return settings.color;
  }

  const value = Number(force.value);

  const WARNING_LIMIT = 80;
  const CRITICAL_LIMIT = 100;

  if (value >= CRITICAL_LIMIT) {
    return "#ff6b6b";
  }

  if (value >= WARNING_LIMIT) {
    return "#ff9fbf";
  }

  return settings.color;
};

  const isForceCritical = (model) => {
  const settings = modelSettings[model.id] ?? createDefaultSettings();

  const force = settings.parameters?.find(
    (p) => p.name?.trim().toLowerCase() === "force"
  );

  if (!force) return false;

  return Number(force.value) >= 100;
};

  const renderModelNode = (modelId, index = 0) => {
    const model = allModels.find((item) => item.id === modelId);
    if (!model || !visibleModelIds.has(modelId)) {
      return null;
    }

    const localPose = getModelLocalPose(modelId);
    const modelColor = getForceBasedColor(model);
    const critical = isForceCritical(model);
    const modelMotion = toRuntimeMotion(modelSettings[model.id]?.motion ?? defaultMotion);
    const children = (attachmentChildrenByParent[modelId] ?? []).map((childId, childIndex) =>
      renderModelNode(childId, index + childIndex + 1),
    );

    return (
      <CadModel
        key={model.id}
        id={model.id}
        url={model.url}
        color={modelColor}
        motion={modelMotion}
        isCritical={critical}
        selected={
          selectionModeActive ? selectionDraftIds.includes(model.id) : selectedModelId === model.id
        }
        position={localPose.position}
        quaternion={localPose.quaternion}
        onSelect={handleSelectModel}
        onTap={setPartPopupModelId}
        onEdit={openInspector}
        onMove={handleModelMove}
        onFaceClick={handleFaceClick}
        faceSelection={faceSelection}
      >
        {children}
      </CadModel>
    );
  };

  const topLevelVisibleModels = visibleModels.filter((model) => !attachmentParentByChild[model.id]);

  const getMoveTargets = (modelId) => {
    return [modelId, ...collectDescendantIds(modelId, attachmentChildrenByParent)];
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const validFiles = files.filter((file) => supportedExtensions.includes(getFileExtension(file.name)));
    const rejectedCount = files.length - validFiles.length;

    if (!validFiles.length) {
      setStatus("Unsupported file type. Use .glb, .stl, or .step.");
      return;
    }

    setStatus(`Converting ${validFiles.length} file${validFiles.length === 1 ? "" : "s"}...`);

    const results = await Promise.allSettled(validFiles.map((file) => convertToGlb(file)));
    const nextUploads = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedFiles = results
      .map((result, index) => ({ result, file: validFiles[index] }))
      .filter(({ result }) => result.status === "rejected");

    if (!nextUploads.length) {
      const firstFailure = failedFiles[0]?.result.reason?.message ?? "Conversion failed.";
      setStatus(firstFailure);
      return;
    }

    setUploads((currentUploads) => {
      const updated = [...currentUploads, ...nextUploads];
      // initialize positions for new uploads spaced along X
      setPositions((p) => {
        const next = { ...p };
        nextUploads.forEach((model, index) => {
          if (!next[model.id]) {
            const x = (currentUploads.length + index + 1) * 70;
            next[model.id] = [x, 0, 0];
          }
        });
        return next;
      });

      return updated;
    });
    setModelSettings((currentSettings) => {
      const nextSettings = { ...currentSettings };
      nextUploads.forEach((model, index) => {
        nextSettings[model.id] = createDefaultSettings(uploads.length + index + 1);
      });
      return nextSettings;
    });
    setVisibleModelIds((currentVisibleIds) => {
      const nextVisibleIds = new Set(currentVisibleIds);

      if (nextVisibleIds.size === 1 && nextVisibleIds.has(defaultModel.id)) {
        nextVisibleIds.delete(defaultModel.id);
      }

      nextUploads.forEach((model) => nextVisibleIds.add(model.id));

      return nextVisibleIds;
    });

    const addedMessage =
      nextUploads.length === 1
        ? `${nextUploads[0].convertedFrom ? `${nextUploads[0].convertedFrom.toUpperCase()} converted to GLB` : "GLB uploaded"}: ${nextUploads[0].name}.`
        : `${nextUploads.length} files ready for viewing.`;
    const rejectedMessage = rejectedCount ? ` ${rejectedCount} unsupported file(s) skipped.` : "";
    const failedMessage = failedFiles.length ? ` ${failedFiles.length} file(s) could not be converted.` : "";
    setStatus(`${addedMessage}${rejectedMessage}${failedMessage}`);
  };

  const handleToggleModel = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);

    setVisibleModelIds((currentVisibleIds) => {
      const nextVisibleIds = new Set(currentVisibleIds);

      if (nextVisibleIds.has(normalizedModelId)) nextVisibleIds.delete(normalizedModelId);
      else nextVisibleIds.add(normalizedModelId);

      if (!nextVisibleIds.size) nextVisibleIds.add(defaultModel.id);

      return nextVisibleIds;
    });
  };

  const handleSelectModel = (modelId) => {
    if (isSelectingParts) {
      const normalizedModelId = normalizeModelId(modelId);

      setSelectionDraftIds((current) => {
        const next = current.includes(normalizedModelId)
          ? current.filter((id) => id !== normalizedModelId)
          : [...current, normalizedModelId];

        setSelectedModelId(normalizedModelId);
        setStatus(`${next.length} part${next.length === 1 ? "" : "s"} selected for joining. Press Enter to choose parent and child.`);
        return next;
      });

      focusOn(positions[modelId] ?? [0, 0, 0]);
      return;
    }

    setSelectedModelId(modelId);
    setPartPopupModelId(null);
    const m = allModels.find((mm) => mm.id === modelId);
    if (m) setStatus(`Selected ${m.name}`);
    // focus camera on the model's base position
    focusOn(positions[modelId] ?? [0, 0, 0]);
  };

  const getModelPose = (modelId) => ({
    position: normalizeVector(positions[modelId] ?? [0, 0, 0]),
    quaternion: new THREE.Quaternion(...(rotations[modelId] ?? [0, 0, 0, 1])),
  });

  const focusOn = (pos) => {
    if (!pos) return;
    const v = pos.isVector3 ? pos : normalizeVector(pos);
    if (controlsRef.current) {
      controlsRef.current.target.copy(v);
      controlsRef.current.update();
    }
  };

  const applyFaceSnap = (sourcePick, targetPick) => {
    if (!sourcePick || !targetPick) {
      return;
    }

    if (sourcePick.modelId === targetPick.modelId) {
      setStatus("Pick a face on a different part.");
      return;
    }

    const sourcePose = getModelPose(sourcePick.modelId);
    const targetPose = getModelPose(targetPick.modelId);

    const sourceWorldNormal = sourcePick.localNormal.clone().applyQuaternion(sourcePose.quaternion).normalize();
    const targetWorldNormal = targetPick.localNormal.clone().applyQuaternion(targetPose.quaternion).normalize();
    const snapQuaternion = new THREE.Quaternion().setFromUnitVectors(sourceWorldNormal, targetWorldNormal.clone().negate());

    const nextQuaternion = snapQuaternion.multiply(sourcePose.quaternion.clone()).normalize();
    const targetWorldPoint = targetPick.localPoint.clone().applyQuaternion(targetPose.quaternion).add(targetPose.position);
    const sourcePointAfterRotation = sourcePick.localPoint.clone().applyQuaternion(nextQuaternion);
    const nextPosition = targetWorldPoint.sub(sourcePointAfterRotation);

    applySubtreeTransform(sourcePick.modelId, nextPosition, nextQuaternion);

    setStatus(`Aligned ${sourcePick.modelId} to ${targetPick.modelId}.`);
    // focus camera on the moved source part
    focusOn(nextPosition);
    clearFaceSelection();
  };

  const clearFaceSelection = () => {
    setFaceSelection(null);
    setFaceConnectMode(false);
  };

  const startFaceConnection = () => {
  setFaceConnectMode(true);

  setFaceSelection({
    phase: "waiting-for-source",
    source: null,
    target: null,
  });

  setStatus("Click the SOURCE face.");
};

  const selectSourceFace = (facePick) => {
    setFaceSelection({
      phase: "waiting-for-target",
      source: facePick,
      target: null,
    });
    setSelectedModelId(facePick.modelId);
    setStatus("Select the next face to connect.");
    // focus camera on the picked face point
    focusOn(facePick.worldPoint ?? facePick.localPoint ?? [0, 0, 0]);
  };

  const handleFaceClick = (facePick) => {
    if (!faceConnectMode || !facePick?.modelId) {
      return;
    }

    // First face
    if (faceSelection?.phase === "waiting-for-source") {
      setFaceSelection({
        phase: "waiting-for-target",
        source: facePick,
      });

      setSelectedModelId(facePick.modelId);

      setStatus("Source selected. Click the TARGET face.");

      return;
    }

  // Second face
  if (faceSelection?.phase === "waiting-for-target") {
    applyFaceSnap(faceSelection.source, facePick);
  }
};

  const openInspector = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);
    const settings = modelSettings[normalizedModelId] ?? createDefaultSettings();
    setPartPopupModelId(null);
    setInspectorModelId(normalizedModelId);
    setInspectorTab(null);
    setInspectorDraft({
      color: settings.color,
      motion: normalizeMotionDraft(settings.motion),
      parameters: normalizeParameterDrafts(settings.parameters),
    });
    handleSelectModel(normalizedModelId);
  };

  const closeInspector = () => {
    setInspectorModelId(null);
    setInspectorDraft(null);
    setInspectorTab(null);
  };

  const closePartPopup = () => {
    setPartPopupModelId(null);
  };

  const updateInspectorDraft = (patch) => {
    const hasParameters = Object.prototype.hasOwnProperty.call(patch, "parameters");

    setInspectorDraft((current) => ({
      ...current,
      ...patch,
      motion: patch.motion ? normalizeMotionDraft({ ...(current?.motion ?? defaultMotion), ...patch.motion }) : current?.motion ?? defaultMotion,
      parameters: hasParameters ? normalizeParameterDrafts(patch.parameters) : current?.parameters ?? [],
    }));
  };

  const saveInspector = () => {
    if (!inspectorModelId || !inspectorDraft) {
      closeInspector();
      return;
    }

    const nextMotion = normalizeMotionDraft(inspectorDraft.motion ?? defaultMotion);
    const nextSettings = {
      color: inspectorDraft.color,
      motion: nextMotion,
      parameters: compactParameterDrafts(inspectorDraft.parameters ?? []),
    };

    setModelSettings((currentSettings) => ({
      ...currentSettings,
      [inspectorModelId]: nextSettings,
    }));

    setStatus(`Updated ${allModels.find((model) => model.id === inspectorModelId)?.name ?? "model"}.`);
    closeInspector();
  };

  const saveInspectorParameters = (parameters = []) => {
    if (!inspectorModelId) {
      return;
    }

    const nextParameters = compactParameterDrafts(parameters);
    const modelName = allModels.find((model) => model.id === inspectorModelId)?.name ?? "model";

    setInspectorDraft((current) =>
      current
        ? {
            ...current,
            parameters: normalizeParameterDrafts(nextParameters),
          }
        : current,
    );

    setModelSettings((currentSettings) => ({
      ...currentSettings,
      [inspectorModelId]: {
        ...(currentSettings[inspectorModelId] ?? createDefaultSettings()),
        parameters: nextParameters,
      },
    }));

    setStatus(`Saved parameters for ${modelName}.`);
    setInspectorTab("motion");
  };

  const parseMoveCoordinates = (input) => {
    if (typeof input !== "string") {
      return null;
    }

    const values = input
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value));

    if (values.length !== 3 || values.some((value) => Number.isNaN(value))) {
      return null;
    }

    return values;
  };

  const handleInspectorMove = (modelId = inspectorModelId) => {
    const normalizedModelId = normalizeModelId(modelId);
    const currentPosition = vectorFromArray(positions[normalizedModelId] ?? [0, 0, 0]);
    const currentLabel = `${currentPosition.x}, ${currentPosition.y}, ${currentPosition.z}`;
    const input = window.prompt("Enter target coordinates as x, y, z", currentLabel);

    if (input == null) {
      setStatus("Move canceled.");
      return;
    }

    const parsedCoordinates = parseMoveCoordinates(input);
    if (!parsedCoordinates) {
      setStatus("Enter coordinates in the form x, y, z.");
      return;
    }

    const nextPosition = new THREE.Vector3(parsedCoordinates[0], parsedCoordinates[1], parsedCoordinates[2]);
    const currentQuaternion = quaternionFromArray(rotations[normalizedModelId] ?? [0, 0, 0, 1]);

    applySubtreeTransform(normalizedModelId, nextPosition, currentQuaternion);
    setSelectedModelId(normalizedModelId);
    setStatus(`Moved ${allModels.find((model) => model.id === normalizedModelId)?.name ?? "model"} to ${parsedCoordinates.join(", ")}.`);
    focusOn(nextPosition);
  };

  const handleSelectJoinParts = () => {
    setSelectionModeActive(true);
    setSelectionDraftIds([]);
    setSelectedModelId(null);
    setJoinDialog(null);
    setStatus("Click two or more parts to join, then press Enter to choose parent and child.");
    closeInspector();
  };

  const handleInspectorTabChange = (tab) => {
    setInspectorTab(tab);

    if (tab !== "select") {
      setSelectionDraftIds([]);
      setSelectionModeActive(false);
      setJoinDialog(null);
    }
  };

  const handleJoinSelectionChange = (kind, modelId) => {
    setJoinDialog((current) => ({
      ...(current ?? {}),
      [kind]: normalizeModelId(modelId),
    }));
  };

  const confirmJoinSelection = () => {
    if (!joinDialog) {
      return;
    }

    const parentId = normalizeModelId(joinDialog.parentId);
    const childId = normalizeModelId(joinDialog.childId);
    const selectedPartIds = joinDialog.partIds ?? [];

    if (!selectedPartIds.includes(parentId) || !selectedPartIds.includes(childId)) {
      setStatus("Choose both parent and child from the selected parts.");
      return;
    }

    if (parentId === childId) {
      setStatus("Choose two different parts for the join.");
      return;
    }

    const childDescendants = collectDescendantIds(childId, attachmentChildrenByParent);
    if (childDescendants.includes(parentId)) {
      setStatus("Choose a parent that is not inside the child subtree.");
      return;
    }

    setAttachmentParentByChild((current) => ({
      ...current,
      [childId]: parentId,
    }));
    setSelectedModelId(parentId);
    resetJoinSelection();

    const parentName = allModels.find((model) => model.id === parentId)?.name ?? parentId;
    const childName = allModels.find((model) => model.id === childId)?.name ?? childId;
    setStatus(`Joined ${childName} under ${parentName}. Parent motion now carries the child.`);
  };

  const handleMoveSelectedOrAttached = (dx, dy, dz) => {
    if (!selectedModelId) {
      setStatus("No model selected to move.");
      return;
    }

    const currentPosition = vectorFromArray(positions[selectedModelId] ?? [0, 0, 0]);
    const nextPosition = currentPosition.clone().add(new THREE.Vector3(dx, dy, dz));
    const currentQuaternion = quaternionFromArray(rotations[selectedModelId] ?? [0, 0, 0, 1]);

    applySubtreeTransform(selectedModelId, nextPosition, currentQuaternion);
  };
  const copyInspectorModel = (modelId) => {
    const src = allModels.find((m) => m.id === modelId);
    if (!src) return;

    const newId = `${modelId}-copy-${Math.random().toString(36).slice(2, 8)}`;
    const newName = `${src.name ?? "Model"} (copy)`;
    const newModel = { ...src, id: newId, name: newName, isDefault: false };

    setUploads((current) => [...current, newModel]);

    // compute new position from current positions so we can focus after creating
    const srcPos = positions[modelId] ?? [0, 0, 0];
    const offsetX = 10; // place copy further away along X
    const newPos = [srcPos[0] + offsetX, srcPos[1], srcPos[2]];

    setPositions((p) => ({ ...p, [newId]: newPos }));


    setRotations((r) => {
      const srcRot = r[modelId] ?? [0, 0, 0, 1];
      return { ...r, [newId]: srcRot };
    });

    setModelSettings((s) => {
      const srcSettings = s[modelId] ?? createDefaultSettings();
      return { ...s, [newId]: { ...srcSettings } };
    });

    setVisibleModelIds((v) => {
      const next = new Set(v);
      next.add(newId);
      return next;
    });

    setStatus(`Copied ${src.name} to ${newName}.`);
    setSelectedModelId(newId);
    focusOn(newPos);
    closeInspector();
  };
  

  const handleShowOnlyModel = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);
    setVisibleModelIds(new Set([normalizedModelId]));
    setSelectedModelId(normalizedModelId);

    const selectedModel = allModels.find((model) => model.id === normalizedModelId);
    if (selectedModel) {
      setStatus(`Showing only ${selectedModel.name}.`);
    }
  };

  const handleDeleteModel = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);

    if (normalizedModelId === defaultModel.id) {
      setStatus("The default model cannot be deleted.");
      return;
    }

    const modelToDelete = allModels.find((model) => model.id === normalizedModelId);
    if (!modelToDelete) {
      return;
    }

    setUploads((currentUploads) => currentUploads.filter((model) => model.id !== normalizedModelId));
    setModelSettings((currentSettings) => {
      const nextSettings = { ...currentSettings };
      delete nextSettings[normalizedModelId];
      return nextSettings;
    });
    setPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      delete nextPositions[normalizedModelId];
      return nextPositions;
    });
    setRotations((currentRotations) => {
      const nextRotations = { ...currentRotations };
      delete nextRotations[normalizedModelId];
      return nextRotations;
    });
    setVisibleModelIds((currentVisibleIds) => {
      const nextVisibleIds = new Set(currentVisibleIds);
      nextVisibleIds.delete(normalizedModelId);
      if (!nextVisibleIds.size) nextVisibleIds.add(defaultModel.id);
      return nextVisibleIds;
    });
    setAttachmentParentByChild((currentAttachments) => {
      const nextAttachments = {};

      Object.entries(currentAttachments).forEach(([childId, parentId]) => {
        if (childId === normalizedModelId || parentId === normalizedModelId) {
          return;
        }

        nextAttachments[childId] = parentId;
      });

      return nextAttachments;
    });

    setSelectionDraftIds((currentSelection) => currentSelection.filter((id) => id !== normalizedModelId));
    setFaceSelection((currentSelection) => {
      if (!currentSelection) return currentSelection;
      if (currentSelection.source?.modelId === normalizedModelId || currentSelection.target?.modelId === normalizedModelId) {
        return null;
      }

      return currentSelection;
    });
    setJoinDialog((currentJoinDialog) => {
      if (!currentJoinDialog) return currentJoinDialog;
      if (currentJoinDialog.partIds?.includes(normalizedModelId) || currentJoinDialog.parentId === normalizedModelId || currentJoinDialog.childId === normalizedModelId) {
        return null;
      }

      return currentJoinDialog;
    });

    if (inspectorModelId === normalizedModelId) {
      closeInspector();
    }

    if (partPopupModelId === normalizedModelId) {
      setPartPopupModelId(null);
    }

    if (selectedModelId === normalizedModelId) {
      setSelectedModelId(null);
    }

    const remainingCount = allModels.length - 1;
    setStatus(`Deleted ${modelToDelete.name}. ${remainingCount} model${remainingCount === 1 ? "" : "s"} remain.`);

    const deletedUrls = new Set(objectUrlsRef.current.filter((url) => url === modelToDelete.url));
    if (deletedUrls.size) {
      const stillUsedUrls = new Set(
        allModels
          .filter((model) => model.id !== normalizedModelId)
          .map((model) => model.url),
      );

      deletedUrls.forEach((url) => {
        if (!stillUsedUrls.has(url)) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current = objectUrlsRef.current.filter((currentUrl) => currentUrl !== url);
        }
      });
    }
  };

  const handleModelMove = (modelId, nextPosition) => {
    setPositions((currentPositions) => ({
      ...currentPositions,
      [modelId]: nextPosition,
    }));
  };

  const handleNudge = (dx, dy, dz) => {
    const distance = Number(nudgeDistance);

    if (!Number.isFinite(distance) || distance <= 0) {
      setStatus("Enter a positive move distance.");
      return;
    }

    handleMoveSelectedOrAttached(dx * distance, dy * distance, dz * distance);
  };

  const handleShowAllModels = () => {
    setVisibleModelIds(new Set(allModels.map((model) => model.id)));
    setStatus(`Showing all ${allModels.length} models.`);
  };

  const activeInspectorMotionType = inspectorDraft?.motion?.type ?? "none";
  const faceHintText = faceSelection?.phase === "waiting-for-target" ? "Select the next face to connect" : null;
  const selectedPart = partPopupModelId ? allModels.find((model) => model.id === partPopupModelId) : null;
  const selectedPartSettings = partPopupModelId ? modelSettings[partPopupModelId] ?? createDefaultSettings() : null;
  const selectedPartPose = partPopupModelId ? getModelLocalPose(partPopupModelId) : null;
  const selectedPartParentId = partPopupModelId ? attachmentParentByChild[partPopupModelId] : null;
  const selectedPartChildren = partPopupModelId ? attachmentChildrenByParent[partPopupModelId] ?? [] : [];
  const selectedPartPopup = selectedPart
    ? {
        id: selectedPart.id,
        name: selectedPart.name ?? selectedPart.id,
        color: selectedPartSettings?.color ?? "#cfd8dc",
        motion: selectedPartSettings?.motion ?? defaultMotion,
        parameters: selectedPartSettings?.parameters ?? [],
        position: selectedPartPose?.position ?? [0, 0, 0],
        quaternion: selectedPartPose?.quaternion ?? [0, 0, 0, 1],
        visible: visibleModelIds.has(selectedPart.id),
        isDefault: Boolean(selectedPart.isDefault),
        sourceLabel: selectedPart.convertedFrom ? `${selectedPart.convertedFrom.toUpperCase()} → GLB` : null,
        parentName: selectedPartParentId ? allModels.find((model) => model.id === selectedPartParentId)?.name ?? selectedPartParentId : null,
        childrenCount: selectedPartChildren.length,
        childrenNames: selectedPartChildren.map((childId) => allModels.find((model) => model.id === childId)?.name ?? childId),
      }
    : null;
  const motionOptions = [
    { value: "none", label: "None" },
    { value: "translation", label: "Translation" },
    { value: "oscillation", label: "Auxilatory" },
    { value: "rotation", label: "Rotary" },
  ];

  return (
    <div className="app-shell">
      <Sidebar
        defaultModel={defaultModel}
        allModels={allModels}
        uploads={uploads}
        visibleModels={visibleModels}
        visibleModelIds={visibleModelIds}
        selectedModelId={selectedModelId}
        handleFileChange={handleFileChange}
        handleShowAllModels={handleShowAllModels}
        handleShowOnlyModel={handleShowOnlyModel}
        handleToggleModel={handleToggleModel}
        handleSelectModel={handleSelectModel}
        handleDeleteModel={handleDeleteModel}
        openInspector={openInspector}
        status={status}
      />

      <div className="viewer-panel">
        <div className="axis-controls" aria-hidden={false}>
          <div className="axis-controls-row">
            {selectionModeActive ? (
              <button
                type="button"
                className="axis-group-btn"
                onClick={openJoinDialogFromSelection}
              >
                Join selected parts
              </button>
            ) : null}
            <label className="axis-distance-input">
              <span>Step</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={nudgeDistance}
                onChange={(event) => setNudgeDistance(event.target.value === "" ? "" : Number(event.target.value))}
              />
            </label>
          </div>
          <div className="axis-grid">
            <button className="axis-btn" title="+X" onClick={() => handleNudge(1, 0, 0)}>+X</button>
            <button className="axis-btn" title="-X" onClick={() => handleNudge(-1, 0, 0)}>-X</button>
            <button className="axis-btn" title="+Y" onClick={() => handleNudge(0, 1, 0)}>+Y</button>
            <button className="axis-btn" title="-Y" onClick={() => handleNudge(0, -1, 0)}>-Y</button>
            <button className="axis-btn" title="+Z" onClick={() => handleNudge(0, 0, 1)}>+Z</button>
            <button className="axis-btn" title="-Z" onClick={() => handleNudge(0, 0, -1)}>-Z</button>
          </div>
        </div>

        <Canvas className="viewer-canvas" camera={{ position: [100, 50, 0], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 10]} intensity={1.5} />

          {faceHintText ? (
            <Html center>
              <div className="face-hint">{faceHintText}</div>
            </Html>
          ) : null}

          <Suspense fallback={<Loader />}>
            <Environment preset="city" background={false} />
            <Bounds fit clip observe margin={1.2}>
              {topLevelVisibleModels.map((model, index) => renderModelNode(model.id, index))}
            </Bounds>
          </Suspense>

          <axesHelper args={[10]} />
          <OrbitControls ref={controlsRef} />
        </Canvas>

        <Inspector
          inspectorModelId={inspectorModelId}
          inspectorDraft={inspectorDraft}
          updateInspectorDraft={updateInspectorDraft}
          saveInspectorParameters={saveInspectorParameters}
          closeInspector={closeInspector}
          saveInspector={saveInspector}
          copyInspector={copyInspectorModel}
          allModels={allModels}
          activeTab={inspectorTab}
          setActiveTab={handleInspectorTabChange}
          onSelectJoinParts={handleSelectJoinParts}
          onMovePart={handleInspectorMove}
          startFaceConnection={startFaceConnection}
        />

        <PartInfoPopup
          part={selectedPartPopup}
          onClose={closePartPopup}
          onEdit={(modelId) => {
            closePartPopup();
            openInspector(modelId);
          }}
        />

        <JoinDialog
          open={Boolean(joinDialog)}
          partIds={joinDialog?.partIds ?? []}
          parentId={joinDialog?.parentId}
          childId={joinDialog?.childId}
          allModels={allModels}
          onParentChange={(value) => handleJoinSelectionChange("parentId", value)}
          onChildChange={(value) => handleJoinSelectionChange("childId", value)}
          onCancel={closeJoinDialog}
          onConfirm={confirmJoinSelection}
        />
      </div>
    </div>
  );
}
