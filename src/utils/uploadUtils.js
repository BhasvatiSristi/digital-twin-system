
export const supportedExtensions = ["glb", "stl", "step"];

export function getFileExtension(name) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function formatFileLabel(name) {
  const extension = getFileExtension(name);
  return extension ? extension.toUpperCase() : "FILE";
}

export function createUploadId(file, suffix = "") {
  return `${file.name}-${file.lastModified}-${file.size}-${suffix || "upload"}-${Math.random().toString(36).slice(2)}`;
}