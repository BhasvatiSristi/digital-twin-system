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
  name: "Default model (BWEAssembly.glb)",
  url: "/model/BWEAssembly.glb",
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

function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)} %</Html>;
}

export default function App() {
  const [uploads, setUploads] = useState([]);
  // start with no models visible by default
  const [visibleModelIds, setVisibleModelIds] = useState(() => new Set());
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [faceSelection, setFaceSelection] = useState(null);
  const [status, setStatus] = useState("No model loaded.");
  const objectUrlsRef = useRef([]);
  const [positions, setPositions] = useState({});
  const [rotations, setRotations] = useState({});
  const [modelSettings, setModelSettings] = useState(() => ({}));
  const [inspectorModelId, setInspectorModelId] = useState(null);
  const [inspectorDraft, setInspectorDraft] = useState(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

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

    setPositions((current) => ({
      ...current,
      [sourcePick.modelId]: [nextPosition.x, nextPosition.y, nextPosition.z],
    }));
    setRotations((current) => ({
      ...current,
      [sourcePick.modelId]: [nextQuaternion.x, nextQuaternion.y, nextQuaternion.z, nextQuaternion.w],
    }));

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
    setInspectorModelId(normalizedModelId);
    setInspectorDraft({
      color: settings.color,
      motion: { ...defaultMotion, ...settings.motion },
    });
    handleSelectModel(normalizedModelId);
  };

  const closeInspector = () => {
    setInspectorModelId(null);
    setInspectorDraft(null);
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

    setModelSettings((currentSettings) => ({
      ...currentSettings,
      [inspectorModelId]: {
        color: inspectorDraft.color,
        motion: { ...defaultMotion, ...inspectorDraft.motion },
      },
    }));
    setStatus(`Updated ${allModels.find((model) => model.id === inspectorModelId)?.name ?? "model"}.`);
    closeInspector();
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
    if (!selectedModelId) {
      setStatus("No model selected to move.");
      return;
    }

    setPositions((current) => {
      const cur = current[selectedModelId] ?? [0, 0, 0];
      const next = [cur[0] + dx, cur[1] + dy, cur[2] + dz];
      return { ...current, [selectedModelId]: next };
    });
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
              {visibleModels.map((model, index) => (
                <CadModel
                  key={model.id}
                  id={model.id}
                  url={model.url}
                  color={modelSettings[model.id]?.color ?? palette[index % palette.length]}
                  motion={modelSettings[model.id]?.motion ?? defaultMotion}
                  selected={selectedModelId === model.id}
                  position={positions[model.id] ?? [index * 70 - (visibleModels.length - 1) * 35, 0, 0]}
                  quaternion={rotations[model.id] ?? [0, 0, 0, 1]}
                  onSelect={handleSelectModel}
                  onEdit={openInspector}
                  onMove={handleModelMove}
                  onFaceDoubleClick={handleFaceDoubleClick}
                  onFaceClick={handleFaceClick}
                  faceSelection={faceSelection}
                />
              ))}
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
        />
      </div>
    </div>
  );
}