import React from "react";

function formatVector(values = []) {
  if (!Array.isArray(values) || values.length < 3) {
    return "—";
  }

  return values.map((value) => Number(value).toFixed(2)).join(", ");
}

function formatMotion(motion = {}) {
  if (!motion || motion.type === "none") {
    return "None";
  }

  const pieces = [motion.type];

  if (motion.axis) pieces.push(`axis ${motion.axis.toUpperCase()}`);
  if (motion.direction) pieces.push(motion.direction);
  if (motion.speed?.value != null) pieces.push(`${motion.speed.value} ${motion.speed.unit ?? ""}`.trim());
  if (motion.amplitude?.value != null) pieces.push(`${motion.amplitude.value} ${motion.amplitude.unit ?? ""}`.trim());

  return pieces.join(" • ");
}

export default function PartInfoPopup({ part, onClose, onEdit }) {
  if (!part) {
    return null;
  }

  return (
    <div className="part-popup-backdrop" onClick={onClose}>
      <div className="part-popup-panel" onClick={(event) => event.stopPropagation()}>
        <div className="part-popup-header">
          <div>
            <p className="part-popup-kicker">Part details</p>
            <h2>{part.name}</h2>
          </div>
          <button type="button" className="inspector-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="part-popup-meta">
          <span className="part-popup-chip">{part.visible ? "Visible" : "Hidden"}</span>
          {part.isDefault ? <span className="part-popup-chip">Default</span> : null}
          {part.sourceLabel ? <span className="part-popup-chip">{part.sourceLabel}</span> : null}
        </div>

        <div className="part-popup-grid">
          <div>
            <span>Part ID</span>
            <strong>{part.id}</strong>
          </div>
          <div>
            <span>Color</span>
            <strong>{part.color}</strong>
          </div>
          <div>
            <span>Local position</span>
            <strong>{formatVector(part.position)}</strong>
          </div>
          <div>
            <span>Local rotation</span>
            <strong>{formatVector(part.quaternion)}</strong>
          </div>
          <div>
            <span>Parent</span>
            <strong>{part.parentName ?? "None"}</strong>
          </div>
          <div>
            <span>Children</span>
            <strong>{part.childrenCount}</strong>
          </div>
          <div className="part-popup-span-2">
            <span>Motion</span>
            <strong>{formatMotion(part.motion)}</strong>
          </div>
        </div>

        {part.childrenNames?.length ? (
          <div className="part-popup-list">
            <span>Child parts</span>
            <p>{part.childrenNames.join(", ")}</p>
          </div>
        ) : null}

        <div className="part-popup-actions">
          <button type="button" className="library-action" onClick={onClose}>
            Keep viewing
          </button>
          <button type="button" className="library-action" onClick={() => onEdit?.(part.id)}>
            Edit part
          </button>
        </div>
      </div>
    </div>
  );
}