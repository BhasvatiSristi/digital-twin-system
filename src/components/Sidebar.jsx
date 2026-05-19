import React from "react";

export default function Sidebar({
  defaultModel,
  allModels,
  uploads,
  visibleModels,
  visibleModelIds,
  selectedModelId,
  handleFileChange,
  handleShowAllModels,
  handleShowOnlyModel,
  handleToggleModel,
  handleSelectModel,
  openInspector,
  status,
}) {
  return (
    <div className="upload-panel">
      <p className="eyebrow">CAD viewer</p>
      <h1>Upload a model and inspect the part.</h1>
      <p className="description">
        Drop in a supported CAD export and the app will convert STEP and STL files to GLB before loading them.
      </p>
      <p className="hint">Supported formats: GLB, STL, STEP. Only GLB renders directly.</p>

      <label className="file-picker">
        <span>Choose GLB, STL, or STEP files</span>
        <input multiple type="file" accept=".glb,.stl,.step" onChange={handleFileChange} />
      </label>

      <div className="library-panel">
        <div className="library-header">
          <span>Files</span>
          <span>{visibleModels.length} visible</span>
        </div>

        <div className="library-actions">
          <button type="button" className="library-action" onClick={handleShowAllModels}>
            Show all
          </button>
          <button type="button" className="library-action" onClick={() => handleShowOnlyModel(defaultModel.id)}>
            Reset view
          </button>
        </div>

        <div className={`model-item ${selectedModelId === defaultModel.id ? "selected" : ""}`}>
          <div className="model-label" onClick={() => handleSelectModel(defaultModel.id)}>
            <span>{defaultModel.name}</span>
            <small style={{ marginLeft: 8 }}>{visibleModelIds.has(defaultModel.id) ? "Visible" : "Hidden"}</small>
          </div>
          <div className="model-actions">
            <button className="vis-btn" onClick={() => handleToggleModel(defaultModel.id)}>{visibleModelIds.has(defaultModel.id) ? "👁" : "🚫"}</button>
            <button className="only-btn" onClick={() => handleShowOnlyModel(defaultModel.id)}>Only</button>
            <button className="only-btn" onClick={() => openInspector(defaultModel.id)}>Edit</button>
          </div>
        </div>

        {uploads.length ? (
          uploads.map((model) => (
            <div key={model.id} className={`model-item ${selectedModelId === model.id ? "selected" : ""}`}>
              <div className="model-label" onClick={() => handleSelectModel(model.id)}>
                <span>{model.name}</span>
                <small style={{ marginLeft: 8 }}>
                  {visibleModelIds.has(model.id)
                    ? model.convertedFrom
                      ? `${model.convertedFrom.toUpperCase()} → GLB`
                      : "GLB"
                    : "Hidden"}
                </small>
              </div>
              <div className="model-actions">
                <button className="vis-btn" onClick={() => handleToggleModel(model.id)}>{visibleModelIds.has(model.id) ? "👁" : "🚫"}</button>
                <button className="only-btn" onClick={() => handleShowOnlyModel(model.id)}>Only</button>
                <button className="only-btn" onClick={() => openInspector(model.id)}>Edit</button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No uploaded files yet.</p>
        )}
      </div>

      <p className="status">{status}</p>
      <p className="active-model">Visible now: {visibleModels.length ? visibleModels.map((model) => model.name).join(", ") : "None"}</p>
    </div>
  );
}
