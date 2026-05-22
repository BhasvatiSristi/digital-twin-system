import React, { useState } from "react";

const motionOptions = [
  { value: "none", label: "None" },
  { value: "translation", label: "Translation" },
  { value: "oscillation", label: "Auxilatory" },
  { value: "rotation", label: "Rotary" },
];

export default function Inspector({
  inspectorModelId,
  inspectorDraft,
  updateInspectorDraft,
  closeInspector,
  saveInspector,
  allModels,
  copyInspector,
}) {
  if (!inspectorModelId || !inspectorDraft) return null;

  const [activeTab, setActiveTab] = useState(null);

  const model = allModels.find((m) => m.id === inspectorModelId) || {};

  return (
    <div className="inspector-backdrop" onClick={closeInspector}>
      <div className="inspector-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inspector-header">
          <div>
            <p className="inspector-kicker">Part inspector</p>
            <h2>{model.name ?? "Selected part"}</h2>
          </div>
          <button className="inspector-close" type="button" onClick={closeInspector}>Close</button>
        </div>

        <div className="inspector-tabs">
          <button
            type="button"
            className={`inspector-tab ${activeTab === "color" ? "active" : ""}`}
            onClick={() => setActiveTab("color")}
          >
            Change color
          </button>
          <button
            type="button"
            className="inspector-tab"
            onClick={() => {
              // perform copy immediately when user clicks this option
              copyInspector?.(inspectorModelId);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === "select" ? "active" : ""}`}
            onClick={() => setActiveTab("select")}
          >
            Select others
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === "motion" ? "active" : ""}`}
            onClick={() => setActiveTab("motion")}
          >
            Add motion
          </button>
        </div>

        {activeTab === "color" ? (
          <label className="inspector-field">
            <span>Color</span>
            <input
              type="color"
              value={inspectorDraft.color}
              onChange={(event) => updateInspectorDraft({ color: event.target.value })}
            />
          </label>
        ) : null}

        {activeTab === "motion" ? (
          <>
            <label className="inspector-field">
              <span>Motion type</span>
              <select
                value={inspectorDraft.motion.type}
                onChange={(event) => updateInspectorDraft({ motion: { type: event.target.value } })}
              >
                {motionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {inspectorDraft.motion.type !== "none" ? (
              <>
                <label className="inspector-field">
                  <span>Axis</span>
                  <select
                    value={inspectorDraft.motion.axis}
                    onChange={(event) => updateInspectorDraft({ motion: { axis: event.target.value } })}
                  >
                    <option value="x">X</option>
                    <option value="y">Y</option>
                    <option value="z">Z</option>
                  </select>
                </label>

                <label className="inspector-field">
                  <span>Direction</span>
                  <select
                    value={inspectorDraft.motion.direction}
                    onChange={(event) => updateInspectorDraft({ motion: { direction: event.target.value } })}
                  >
                    {inspectorDraft.motion.type === "translation" ? (
                      <>
                        <option value="positive">Positive</option>
                        <option value="negative">Negative</option>
                      </>
                    ) : (
                      <>
                        <option value="clockwise">Clockwise</option>
                        <option value="anticlockwise">Anticlockwise</option>
                      </>
                    )}
                  </select>
                </label>

                <label className="inspector-field">
                  <span>Speed</span>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={inspectorDraft.motion.speed}
                    onChange={(event) => updateInspectorDraft({ motion: { speed: Number(event.target.value) } })}
                  />
                </label>

                {inspectorDraft.motion.type !== "rotation" ? (
                  <label className="inspector-field">
                    <span>Amplitude</span>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={inspectorDraft.motion.amplitude}
                      onChange={(event) => updateInspectorDraft({ motion: { amplitude: Number(event.target.value) } })}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {activeTab === "select" ? (
          <div className="inspector-field">
            <span>Select others</span>
            <p className="inspector-help">Use the sidebar to choose other parts to inspect or select them in the viewer.</p>
          </div>
        ) : null}

        <p className="inspector-help">
          Right-click a part to open this box. Color changes apply to the selected part, and motion runs while the model stays visible.
        </p>

        <div className="inspector-actions">
          <button type="button" className="library-action" onClick={closeInspector}>Cancel</button>
          <button type="button" className="library-action" onClick={saveInspector}>Apply</button>
        </div>
      </div>
    </div>
  );
}
