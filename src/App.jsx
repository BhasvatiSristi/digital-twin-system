import { Bounds, Html, OrbitControls, useProgress, Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import "./App.css";
import CadModel from "./components/CadModel";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";

const supportedExtensions = ["glb", "stl", "step"];
const converterEndpoint = import.meta.env.VITE_CONVERTER_ENDPOINT ?? "/api/convert";
const defaultModel = {
  id: "default-model",
  name: "House model (3d_house.glb)",
  url: "/model/3d_house.glb",
  isDefault: true,
};

const palette = [
  "#ff6b6b",
  "#6bc1ff",
  "#ffd56b",
  "#7effa3",
  "#b98cff",
  "#ff9fbf",
];

const defaultMotion = {
  type: "none",
  axis: "x",
  direction: "positive",
  speed: 1,
  amplitude: 20,
};

function createDefaultSettings(index = 0) {
  return {
    color: palette[index % palette.length],
    motion: { ...defaultMotion },
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
  const [status, setStatus] = useState("House model loaded.");
  const objectUrlsRef = useRef([]);
  const [positions, setPositions] = useState({});
  const [rotations, setRotations] = useState({});
  const [modelSettings, setModelSettings] = useState(() => ({}));
  const [inspectorModelId, setInspectorModelId] = useState(null);
  const [inspectorDraft, setInspectorDraft] = useState(null);
  const [inspectorTab, setInspectorTab] = useState(null);
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

  const renderModelNode = (modelId, index = 0) => {
    const model = allModels.find((item) => item.id === modelId);
    if (!model || !visibleModelIds.has(modelId)) {
      return null;
    }

    const localPose = getModelLocalPose(modelId);
    const modelColor = modelSettings[model.id]?.color ?? palette[index % palette.length];
    const modelMotion = modelSettings[model.id]?.motion ?? defaultMotion;
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
        selected={
          selectionModeActive ? selectionDraftIds.includes(model.id) : selectedModelId === model.id
        }
        position={localPose.position}
        quaternion={localPose.quaternion}
        onSelect={handleSelectModel}
        onEdit={openInspector}
        onMove={handleModelMove}
        onFaceDoubleClick={handleFaceDoubleClick}
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

  const handleFaceDoubleClick = (facePick) => {
    if (!facePick?.modelId) {
      return;
    }

    selectSourceFace(facePick);
  };

  const handleFaceClick = (facePick) => {
    if (!facePick?.modelId || faceSelection?.phase !== "waiting-for-target") {
      return;
    }

    applyFaceSnap(faceSelection.source, facePick);
  };

  const openInspector = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);
    const settings = modelSettings[normalizedModelId] ?? createDefaultSettings();
    const motion = { ...defaultMotion, ...settings.motion };
    setInspectorModelId(normalizedModelId);
    setInspectorTab(null);
    setInspectorDraft({
      color: settings.color,
      motion,
    });
    handleSelectModel(normalizedModelId);
  };

  const closeInspector = () => {
    setInspectorModelId(null);
    setInspectorDraft(null);
    setInspectorTab(null);
  };

  const updateInspectorDraft = (patch) => {
    setInspectorDraft((current) => ({
      ...current,
      ...patch,
      motion: {
        ...(current?.motion ?? defaultMotion),
        ...(patch.motion ?? {}),
      },
    }));
  };

  const saveInspector = () => {
    if (!inspectorModelId || !inspectorDraft) {
      closeInspector();
      return;
    }

    const nextMotion = { ...defaultMotion, ...inspectorDraft.motion };
    const nextSettings = {
      color: inspectorDraft.color,
      motion: nextMotion,
    };

    setModelSettings((currentSettings) => ({
      ...currentSettings,
      [inspectorModelId]: nextSettings,
    }));

    setStatus(`Updated ${allModels.find((model) => model.id === inspectorModelId)?.name ?? "model"}.`);
    closeInspector();
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

  const handleModelMove = (modelId, nextPosition) => {
    setPositions((currentPositions) => ({
      ...currentPositions,
      [modelId]: nextPosition,
    }));
  };

  const NUDGE_STEP = 5;

  const handleNudge = (dx, dy, dz) => {
    handleMoveSelectedOrAttached(dx, dy, dz);
  };

  const handleShowAllModels = () => {
    setVisibleModelIds(new Set(allModels.map((model) => model.id)));
    setStatus(`Showing all ${allModels.length} models.`);
  };

  const activeInspectorMotionType = inspectorDraft?.motion?.type ?? "none";
  const faceHintText = faceSelection?.phase === "waiting-for-target" ? "Select the next face to connect" : null;
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
        openInspector={openInspector}
        status={status}
      />

      <div className="viewer-panel">
        <div className="axis-controls" aria-hidden={false}>
          {selectionModeActive ? (
            <button
              type="button"
              className="axis-group-btn"
              onClick={openJoinDialogFromSelection}
            >
              Join selected parts
            </button>
          ) : null}
          <div className="axis-grid">
            <button className="axis-btn" title="+X" onClick={() => handleNudge(NUDGE_STEP, 0, 0)}>+X</button>
            <button className="axis-btn" title="-X" onClick={() => handleNudge(-NUDGE_STEP, 0, 0)}>-X</button>
            <button className="axis-btn" title="+Y" onClick={() => handleNudge(0, NUDGE_STEP, 0)}>+Y</button>
            <button className="axis-btn" title="-Y" onClick={() => handleNudge(0, -NUDGE_STEP, 0)}>-Y</button>
            <button className="axis-btn" title="+Z" onClick={() => handleNudge(0, 0, NUDGE_STEP)}>+Z</button>
            <button className="axis-btn" title="-Z" onClick={() => handleNudge(0, 0, -NUDGE_STEP)}>-Z</button>
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
          closeInspector={closeInspector}
          saveInspector={saveInspector}
          copyInspector={copyInspectorModel}
          allModels={allModels}
          activeTab={inspectorTab}
          setActiveTab={handleInspectorTabChange}
          onSelectJoinParts={handleSelectJoinParts}
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