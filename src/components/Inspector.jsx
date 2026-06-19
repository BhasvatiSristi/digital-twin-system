import React from "react";

const motionOptions = [
  { value: "none", label: "None" },
  { value: "translation", label: "Translation" },
  { value: "oscillation", label: "Auxilatory" },
  { value: "rotation", label: "Rotary" },
];

const speedUnitOptions = {
  translation: ["m/s", "cm/s", "mm/s"],
  oscillation: ["m/s", "cm/s", "mm/s"],
  rotation: ["rpm", "rps", "deg/s", "rad/s"],
};

const amplitudeUnitOptions = ["m", "cm", "mm"];

export default function Inspector({
  inspectorModelId,
  inspectorDraft,
  updateInspectorDraft,
  closeInspector,
  saveInspector,
  allModels,
  copyInspector,
  activeTab,
  setActiveTab,
  onSelectJoinParts,
  onMovePart,
}) {
  if (!inspectorModelId || !inspectorDraft) return null;

  const model = allModels.find((m) => m.id === inspectorModelId) || {};
  const currentSpeedUnits = speedUnitOptions[inspectorDraft.motion.type] ?? speedUnitOptions.rotation;

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
            Join parts
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === "motion" ? "active" : ""}`}
            onClick={() => setActiveTab("motion")}
          >
            Add motion
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === "move" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("move");
              onMovePart?.(inspectorModelId);
            }}
          >
            Move
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
            <p className="inspector-subtitle">Please enter the params in metric unit system.</p>

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
                  <div className="inspector-inline-row">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={inspectorDraft.motion.speed.value}
                      onChange={(event) => updateInspectorDraft({ motion: { speed: { value: Number(event.target.value) } } })}
                    />
                    <select
                      value={inspectorDraft.motion.speed.unit}
                      onChange={(event) => updateInspectorDraft({ motion: { speed: { unit: event.target.value } } })}
                    >
                      {currentSpeedUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                {inspectorDraft.motion.type !== "rotation" ? (
                  <label className="inspector-field">
                    <span>Amplitude</span>
                    <div className="inspector-inline-row">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={inspectorDraft.motion.amplitude.value}
                        onChange={(event) => updateInspectorDraft({ motion: { amplitude: { value: Number(event.target.value) } } })}
                      />
                      <select
                        value={inspectorDraft.motion.amplitude.unit}
                        onChange={(event) => updateInspectorDraft({ motion: { amplitude: { unit: event.target.value } } })}
                      >
                        {amplitudeUnitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {activeTab === "select" ? (
          <div className="inspector-field">
            <span>Join parts</span>
            <button type="button" className="library-action inspector-wide-action" onClick={onSelectJoinParts}>
              Select parts to join
            </button>
            <p className="inspector-help">Pick two or more parts, then choose which one is the parent and which one is the child.</p>
          </div>
        ) : null}

        {activeTab === "move" ? (
          <div className="inspector-field">
            <span>Move part</span>
            <p className="inspector-help">Enter a target position as x, y, z. The part will move there immediately.</p>
            <button type="button" className="library-action inspector-wide-action" onClick={() => onMovePart?.(inspectorModelId)}>
              Enter coordinates
            </button>
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
