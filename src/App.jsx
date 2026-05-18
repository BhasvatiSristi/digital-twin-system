import { Bounds, Html, OrbitControls, useProgress } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";

import "./App.css";
import CadModel from "./components/CadModel";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";

const supportedExtensions = ["glb", "gltf", "stl", "obj"];
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

function normalizeModelId(modelId) {
  return String(modelId);
}

function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)} %</Html>;
}

export default function App() {
  const [uploads, setUploads] = useState([]);
  const [visibleModelIds, setVisibleModelIds] = useState(() => new Set([defaultModel.id]));
  const [selectedModelId, setSelectedModelId] = useState(defaultModel.id);
  const [status, setStatus] = useState("Showing the default model from public/model.");
  const objectUrlsRef = useRef([]);
  const [positions, setPositions] = useState({ [defaultModel.id]: [0, 0, 0] });
  const [modelSettings, setModelSettings] = useState(() => ({
    [defaultModel.id]: createDefaultSettings(0),
  }));
  const [inspectorModelId, setInspectorModelId] = useState(null);
  const [inspectorDraft, setInspectorDraft] = useState(null);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  const allModels = [defaultModel, ...uploads];
  const visibleModels = allModels.filter((model) => visibleModelIds.has(model.id));

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const validFiles = files.filter((file) => supportedExtensions.includes(getFileExtension(file.name)));
    const rejectedCount = files.length - validFiles.length;

    if (!validFiles.length) {
      setStatus("Unsupported file type. Use .glb, .gltf, .stl, or .obj.");
      return;
    }

    const nextUploads = validFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);

      return {
        id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        url,
        isDefault: false,
      };
    });

    setUploads((currentUploads) => {
      const updated = [...currentUploads, ...nextUploads];
      // initialize positions for new uploads spaced along X
      setPositions((p) => {
        const next = { ...p };
        const baseIndex = 0; // keep default at center
        updated.forEach((m, i) => {
          if (!next[m.id]) {
            const x = (i + 1) * 70; // simple spacing
            next[m.id] = [x, 0, 0];
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

    const addedMessage = nextUploads.length === 1 ? `${nextUploads[0].name} added.` : `${nextUploads.length} files added.`;
    const rejectedMessage = rejectedCount ? ` ${rejectedCount} unsupported file(s) skipped.` : "";
    setStatus(`${addedMessage}${rejectedMessage}`);
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

          <Suspense fallback={<Loader />}>
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
                  onSelect={handleSelectModel}
                  onEdit={openInspector}
                  onMove={handleModelMove}
                />
              ))}
            </Bounds>
          </Suspense>

          <axesHelper args={[10]} />
          <OrbitControls />
        </Canvas>

        <Inspector
          inspectorModelId={inspectorModelId}
          inspectorDraft={inspectorDraft}
          updateInspectorDraft={updateInspectorDraft}
          closeInspector={closeInspector}
          saveInspector={saveInspector}
          allModels={allModels}
        />
      </div>
    </div>
  );
}