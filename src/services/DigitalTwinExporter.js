export function exportDigitalTwin({
  projectName = "Digital Twin",
  defaultModel,
  uploads,
  positions,
  rotations,
  modelSettings,
  attachmentParentByChild,
  visibleModelIds,
}) {
  const models = [defaultModel, ...uploads];

  const digitalTwin = {
    schema: "digital-twin-package",
    version: "1.0.0",

    metadata: {
      projectName,
      createdAt: new Date().toISOString(),
      totalModels: models.length,
      author: "Digital Twin Authoring Platform",
    },

    scene: {
      defaultModelId: defaultModel.id,
    },

    models: models.map((model) => {
      const settings = modelSettings[model.id] ?? {};

      return {
        id: model.id,
        name: model.name,
        url: model.url,

        convertedFrom: model.convertedFrom ?? null,
        sourceExtension: model.sourceExtension ?? "glb",
        isDefault: Boolean(model.isDefault),

        visible: visibleModelIds.has(model.id),

        transform: {
          position: positions[model.id] ?? [0, 0, 0],
          rotation: rotations[model.id] ?? [0, 0, 0, 1],
        },

        settings: {
          color: settings.color ?? "#cfd8dc",
          motion: settings.motion ?? {
            type: "none",
          },
          parameters: settings.parameters ?? [],
        },

        hierarchy: {
          parent: attachmentParentByChild[model.id] ?? null,
        },
      };
    }),
  };

  return digitalTwin;
}

export function downloadDigitalTwin(data, filename = "digital-twin.dtwin.json") {
  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}