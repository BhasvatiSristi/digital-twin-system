import React from "react";

export default function JoinDialog({
  open,
  partIds,
  parentId,
  childId,
  allModels,
  onParentChange,
  onChildChange,
  onCancel,
  onConfirm,
}) {
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
    <div
      className="inspector-backdrop join-backdrop"
      onClick={onCancel}
    >
      <div
        className="inspector-panel join-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="inspector-header">
          <div>
            <p className="inspector-kicker">
              Join parts
            </p>

            <h2>
              Choose parent and child
            </h2>
          </div>

          <button
            className="inspector-close"
            type="button"
            onClick={onCancel}
          >
            Close
          </button>
        </div>

        <label className="inspector-field">
          <span>Parent part</span>

          <select
            value={parentId ?? ""}
            onChange={(event) =>
              onParentChange(event.target.value)
            }
          >
            {options.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span>Child part</span>

          <select
            value={childId ?? ""}
            onChange={(event) =>
              onChildChange(event.target.value)
            }
          >
            {options.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="inspector-help">
          Parent motion propagates to the child.
          The child can still move on its own
          without driving the parent.
        </p>

        <div className="inspector-actions">
          <button
            type="button"
            className="library-action"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="library-action"
            onClick={onConfirm}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}