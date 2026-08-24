import { Canvas } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";


import {
  Bounds, Html,
  OrbitControls,
  Environment,
} from "@react-three/drei";

import "./App.css";
import CadModel from "./components/CadModel";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";
import PartInfoPopup from "./components/PartInfoPopup";
import Loader from "./components/Loader";
import JoinDialog from "./components/JoinDialog";
import useUploadManager from "./hooks/useUploadManager";
import useFaceConnection from "./hooks/useFaceConnection";
import useHierarchy from "./hooks/useHierarchy";
import useInspector from "./hooks/useInspector";

import {
  defaultMotion,
  toRuntimeMotion,
} from "./utils/motionUtils";

import {
  createDefaultSettings,
  normalizeModelId,
  normalizeVector,
  quaternionFromArray,
  vectorFromArray,
} from "./utils/modelUtils";

import {
  getForceBasedColor,
  isForceCritical,
} from "./utils/forceUtils";

import {
  exportDigitalTwin,
  downloadDigitalTwin,
} from "./services/DigitalTwinExporter";

const converterEndpoint = import.meta.env.VITE_CONVERTER_ENDPOINT ?? "/api/convert";
const defaultModel = {
  id: "default-model",
  name: "House model (3d_house.glb)",
  url: "/3d_house.glb",
  isDefault: true,
};

export default function App() {
  // start with no models visible by default
  const [visibleModelIds, setVisibleModelIds] = useState(() => new Set([defaultModel.id]));
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [status, setStatus] = useState("House model loaded.");
  const [positions, setPositions] = useState({});
  const [rotations, setRotations] = useState({});
  const [modelSettings, setModelSettings] = useState(() => ({}));
  const [partPopupModelId, setPartPopupModelId] = useState(null);
  const [nudgeDistance, setNudgeDistance] = useState(5);
  const controlsRef = useRef(null);

  const focusOn = (pos) => {
    if (!pos) return;
    const v = pos.isVector3 ? pos : normalizeVector(pos);
    if (controlsRef.current) {
      controlsRef.current.target.copy(v);
      controlsRef.current.update();
    }
  };

  const {
    uploads,
    setUploads,
    handleFileChange,
    releaseUploadUrl,
  } = useUploadManager({
    defaultModelId: defaultModel.id,
    converterEndpoint,
    createDefaultSettings,
    setPositions,
    setModelSettings,
    setVisibleModelIds,
    setStatus,
  });

  const allModels = [defaultModel, ...uploads];

  const {
    inspectorModelId,
    inspectorDraft,
    inspectorTab,
    setInspectorTab,
    openInspector: openInspectorState,
    closeInspector,
    updateInspectorDraft,
    saveInspector,
    saveInspectorParameters,
  } = useInspector({
    modelSettings,
    setModelSettings,
    setStatus,
    getModelName: (modelId) => allModels.find((model) => model.id === modelId)?.name,
  });

  const {
    attachmentParentByChild,
    attachmentChildrenByParent,
    selectionModeActive,
    selectionDraftIds,
    joinDialog,
    startJoinSelection,
    openJoinDialogFromSelection,
    closeJoinDialog,
    applySubtreeTransform,
    confirmJoinSelection,
    handleJoinSelectionChange,
    getModelLocalPose,
    handleJoinSelectionToggle,
    handleInspectorTabChange: handleHierarchyInspectorTabChange,
    cleanupHierarchyForDeletedModel,
  } = useHierarchy({
    positions,
    rotations,
    setPositions,
    setRotations,
    setSelectedModelId,
    setStatus,
    getModelName: (modelId) => allModels.find((model) => model.id === modelId)?.name,
    closeInspector,
  });

  const {
    faceSelection,
    startFaceConnection,
    clearFaceSelection,
    handleFaceClick,
  } = useFaceConnection({
    setSelectedModelId,
    setStatus,
    focusOn,
    getModelPose: (modelId) => ({
      position: normalizeVector(positions[modelId] ?? [0, 0, 0]),
      quaternion: new THREE.Quaternion(...(rotations[modelId] ?? [0, 0, 0, 1])),
    }),
    applySubtreeTransform,
  });

  const visibleModels = allModels.filter((model) => visibleModelIds.has(model.id));
  const renderModelNode = (modelId, index = 0) => {
    const model = allModels.find((item) => item.id === modelId);
    if (!model || !visibleModelIds.has(modelId)) {
      return null;
    }

    const localPose = getModelLocalPose(modelId);
    const settings =
      modelSettings[model.id] ?? createDefaultSettings();

    const modelColor = getForceBasedColor(settings);
    const critical = isForceCritical(settings);
    const modelMotion = toRuntimeMotion(settings.motion);

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

  const openInspector = (modelId) => {
    const normalizedModelId = normalizeModelId(modelId);
    setPartPopupModelId(null);
    openInspectorState(normalizedModelId);
    handleSelectModel(normalizedModelId);
  };

  const handleSelectModel = (modelId) => {
    if (selectionModeActive) {
      const normalizedModelId = normalizeModelId(modelId);
      handleJoinSelectionToggle(normalizedModelId);
      focusOn(positions[modelId] ?? [0, 0, 0]);
      return;
    }

    setSelectedModelId(modelId);
    setPartPopupModelId(null);
    const m = allModels.find((mm) => mm.id === modelId);
    if (m) setStatus(`Selected ${m.name}`);
    focusOn(positions[modelId] ?? [0, 0, 0]);
  };

  const handleInspectorTabChange = (tab) => {
    setInspectorTab(tab);
    handleHierarchyInspectorTabChange(tab);
  };

  const closePartPopup = () => {
    setPartPopupModelId(null);
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
    cleanupHierarchyForDeletedModel(normalizedModelId);

    if (faceSelection) {
      if (faceSelection.source?.modelId === normalizedModelId || faceSelection.target?.modelId === normalizedModelId) {
        clearFaceSelection();
      }
    }

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

    releaseUploadUrl(
      modelToDelete.url,
      allModels
        .filter((model) => model.id !== normalizedModelId)
        .map((model) => model.url),
    );
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

  const handleExportDigitalTwin = () => {
    const twin = exportDigitalTwin({
      projectName: "Mining Excavator",
      defaultModel,
      uploads,
      positions,
      rotations,
      modelSettings,
      attachmentParentByChild,
      visibleModelIds,
    });
    downloadDigitalTwin(twin, "MiningExcavator.dtwin.json");
    setStatus("Digital Twin exported successfully.");
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

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
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
        handleExportDigitalTwin={handleExportDigitalTwin}
        status={status}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
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
          onSelectJoinParts={startJoinSelection}
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