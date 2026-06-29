import React, { useEffect, useState } from "react";

function createParameterRow() {
  return { name: "", value: "", unit: "" };
}

export default function InspectorParameters({ open, parameters = [], onChange, onSave, onClose }) {
  const [draftParameters, setDraftParameters] = useState(parameters);

  useEffect(() => {
    if (open) {
      setDraftParameters(parameters.length ? parameters : [createParameterRow()]);
    }
  }, [open, parameters]);

  if (!open) {
    return null;
  }

  const visibleParameters = draftParameters.length ? draftParameters : [createParameterRow()];

  const updateParameter = (index, field, nextValue) => {
    const nextParameters = visibleParameters.map((parameter, currentIndex) => {
      if (currentIndex !== index) {
        return parameter;
      }

      return {
        ...parameter,
        [field]: nextValue,
      };
    });

    setDraftParameters(nextParameters);
    onChange?.(nextParameters);
  };

  const addParameter = () => {
    const nextParameters = [...visibleParameters, createParameterRow()];
    setDraftParameters(nextParameters);
    onChange?.(nextParameters);
  };

  const removeParameter = (index) => {
    const nextParameters = visibleParameters.filter((_, currentIndex) => currentIndex !== index);
    const normalizedParameters = nextParameters.length ? nextParameters : [createParameterRow()];
    setDraftParameters(normalizedParameters);
    onChange?.(normalizedParameters);
  };

  return (
    <div className="inspector-backdrop inspector-parameters-backdrop" onClick={() => onClose?.()}>
      <div className="inspector-panel inspector-parameters-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inspector-header">
          <div>
            <p className="inspector-kicker">Part inspector</p>
            <h2>Add parameters</h2>
          </div>
          <button type="button" className="inspector-close" onClick={() => onClose?.()}>
            Close
          </button>
        </div>

        <p className="inspector-subtitle">Enter one parameter per row. Leave the first row empty to start, then use New to add more.</p>

        <div className="inspector-parameter-list">
          {visibleParameters.map((parameter, index) => (
            <div className="inspector-parameter-row" key={`parameter-${index}`}>
              <input
                type="text"
                placeholder="Parameter name"
                value={parameter.name ?? ""}
                onChange={(event) => updateParameter(index, "name", event.target.value)}
              />
              <input
                type="number"
                step="any"
                placeholder="Value"
                value={parameter.value ?? ""}
                onChange={(event) => updateParameter(index, "value", event.target.value)}
              />
              <input
                type="text"
                placeholder="Units"
                value={parameter.unit ?? ""}
                onChange={(event) => updateParameter(index, "unit", event.target.value)}
              />
              <button type="button" className="inspector-parameter-remove" onClick={() => removeParameter(index)}>
                X
              </button>
            </div>
          ))}
        </div>

        <div className="inspector-parameter-actions">
          <button type="button" className="library-action inspector-parameter-new" onClick={addParameter}>
            New
          </button>
          <button type="button" className="library-action" onClick={() => onSave?.(draftParameters)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}