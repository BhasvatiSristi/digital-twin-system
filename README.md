<!-- Comprehensive README generated from repository sources -->

# TwinForge — Digital Twin Authoring & Viewer

This repository contains a web-based Digital Twin authoring and viewing application that: accepts CAD exports (GLB, STL, STEP), converts non-GLB formats to GLB, displays parts and assemblies in a 3D scene, enables part inspection and motion/parameter annotations, supports face-to-face alignment and parent/child joins, and exports a packaged digital twin JSON.

## 1. Project Title

TwinForge — Digital Twin Authoring & Viewer

## 2. Project Overview

TwinForge is a single-page React application (Vite) using react-three-fiber and three.js for 3D rendering, combined with a lightweight conversion backend (FastAPI) that converts STEP and STL uploads to GLB for browser consumption. The app provides interactive tools to inspect parts, define motion and parameter metadata, join parts into hierarchies, align parts by face selection, and export a structured digital twin package as JSON.

## 3. Motivation / Problem Statement

Engineers and designers often need a lightweight, browser-based environment to review CAD parts and assemblies without full CAD software. STEP/STL files are not directly optimized for modern web rendering; a conversion pipeline and a focused UI for inspection, part joining, and metadata annotation help accelerate validation and digital twin authoring workflows.

## 4. Objectives

- Provide an interactive 3D viewer for parts and assemblies.
- Accept common CAD export formats and convert non-GLB inputs to GLB.
- Allow users to inspect parts, add parameters (for example: force), and set simple motions.
- Enable spatial workflows: move, nudge, join parts, and align parts via face selection.
- Generate a portable digital twin JSON package representing scene, models, transforms, and settings.

## 5. Scope of the Project

- Frontend: Full client-side app for loading, viewing, editing, and exporting digital twin data.
- Backend: Conversion service for STEP/STL → GLB (stateless file conversion; no persistent storage).
- Not included: cloud storage, user accounts, full CAD editing, or persistent server-side scene management.

## 6. System Overview / Architecture

1. Install the node modules required for this application with `npm install`. 
[Node version should be >= v.20 since using Vite+React.]
2. Create a new virtual environment and install the Python packages from `requirements.txt`.
3. Start the Python service with `uvicorn conversion_server:app --reload --port 8000`.
4. Start the web app with `npm run dev`.

## 7. Technology Stack

1. Open the app in the browser.
2. Load a supported model file. [A default model is preloaded.]
3. Pick the part or assembly you want to work with.
4. Use the sidebar and inspector to review or change details.
5. Save any part-specific information you want to keep.

- Backend
	- FastAPI conversion service implemented in `conversion_server.py`.
	- Dependencies: `cadquery`, `trimesh`, `python-multipart`, `uvicorn` (see `requirements.txt`).

- Model processing/conversion
	- STEP → STL via `cadquery` exporters, mesh loading and processing via `trimesh`, GLB export using trimesh.

- Libraries and utilities
	- Client-side utilities in `src/utils/` for model IDs, motions, force-based coloring, and upload helpers.
	- Key third-party libraries listed in `package.json` include `three`, `@react-three/fiber`, `@react-three/drei`, and `leva`.

## 8. Major Features

- File upload with client-side object URLs for GLB and server-side conversion for STEP/STL.
- 3D visualization of models with color, motion, and selection highlighting.
- Part inspector UI for color, motion, and parameter editing.
- Face-based alignment workflow to snap one part to another by selecting faces.
- Parent/child join workflow so parent motion carries attached children and subtree transforms are handled.
- Exportable digital twin JSON package describing models, transforms, visibility, settings, and hierarchy.

## 9. Detailed Functionalities

Only features implemented in the repository are described below.

- CAD/model upload
	- Supported extensions: `.glb`, `.stl`, `.step` (see `src/utils/uploadUtils.js`).
	- Upload handling and conversion orchestration: `src/hooks/useUploadManager.js` — converts non-GLB files by POSTing to the conversion endpoint, creates object URLs for returned GLB blobs, and initializes positions and model settings for newly added uploads.

- Model conversion
	- Conversion endpoint implemented in `conversion_server.py` using FastAPI.
	- STEP files are processed with `cadquery` (importStep + export to STL) then converted with `trimesh` to GLB. STL files are loaded by `trimesh` and exported to GLB. GLB uploads are passed through.

- 3D visualization
	- Scene implemented in `src/App.jsx` using a `Canvas` from `@react-three/fiber` and helpers from `@react-three/drei` (Environment, Bounds, OrbitControls).
	- Model rendering component: `src/components/CadModel.jsx` — uses `useGLTF`, applies material color, supports motion (translation, oscillation, rotation), shows warning indicator for critical parameter states, and exposes face click handlers.

- Part inspection
	- Inspector UI: `src/components/Inspector.jsx` and `src/components/InspectorParameters.jsx` allow editing color, motion, and parameter rows.
	- Inspector state and save logic: `src/hooks/useInspector.js` — normalizes motion and parameters and writes to `modelSettings`.
	- Parameter utilities: `src/utils/modelUtils.js` (parameter normalization, default settings) and `src/utils/motionUtils.js` (motion normalization and runtime conversion).

- Assembly/join workflows
	- Join/selection flow: `src/hooks/useHierarchy.js` supports a selection mode, choosing parent/child, and `confirmJoinSelection` which updates `attachmentParentByChild`.
	- Hierarchy helpers compute descendant IDs and expose `applySubtreeTransform` to move or rotate a subtree consistently.

- Hierarchy/navigation
	- Hierarchy mappings: `attachmentParentByChild` and `attachmentChildrenByParent` are derived in `useHierarchy.js`.
	- Local pose computation: `getModelLocalPose` returns a part's local transform relative to its parent.
	- Scene navigation helpers in `src/App.jsx` let users show/hide models and focus the camera on selected models.

- Motion/force-related utilities
	- Motion normalization and conversion to runtime units: `src/utils/motionUtils.js` — supports translation, oscillation, and rotation; unit conversion (rpm, deg/s, m/s, etc.).
	- Force-based color warning: `src/utils/forceUtils.js` returns a warning color when the `force` parameter exceeds thresholds (warning @80, critical @100) and marks `isForceCritical`.

- Digital Twin export
	- Exporter service: `src/services/DigitalTwinExporter.js` — `exportDigitalTwin()` packages the project name, models, transforms, settings, and hierarchy into a structured JSON object; `downloadDigitalTwin()` triggers browser download.

## 10. Project Workflow / End-to-End Pipeline

1. User selects files in the sidebar file picker (`src/components/Sidebar.jsx`).
2. `useUploadManager` processes file list, POSTs non-GLB files to the converter endpoint, and receives GLB blobs or uses `URL.createObjectURL` for GLB uploads.
3. New model entries are added to the in-memory `uploads` array; initial positions and `modelSettings` are created.
4. `CadModel` instances are rendered inside the scene. Users can select parts, open the inspector, and edit color/motion/parameters.
5. For face-based connections: `useFaceConnection.js` captures face picks and computes snap transforms (world → local conversions and quaternion math) to align source to target.
6. For joins: `useHierarchy.js` updates `attachmentParentByChild` and the UI reflects parent/child relationships; `applySubtreeTransform` ensures moving a parent moves descendants.
7. When done, `DigitalTwinExporter.exportDigitalTwin()` creates a JSON package; `downloadDigitalTwin()` writes the file locally.

## 11. Important Components and Modules

- `src/App.jsx` — root UI, scene composition, state orchestration, and connection of hooks and services.
- `src/components/CadModel.jsx` — GLB rendering, material handling, per-model motion, face picking helpers, visual warning indicator.
- `src/components/Sidebar.jsx` — file picker, model list, visibility controls, and export action.
- `src/components/Inspector.jsx` and `src/components/InspectorParameters.jsx` — part property editor and parameter editor.
- `src/hooks/useUploadManager.js` — upload lifecycle, conversion call, object URL management.
- `src/hooks/useHierarchy.js` — parent/child relationships, selection/joining, subtree transforms.
- `src/hooks/useFaceConnection.js` — face selection and alignment (snap) flow.
- `src/hooks/useInspector.js` — inspector open/save logic and parameter normalization.
- `src/utils/motionUtils.js`, `src/utils/modelUtils.js`, `src/utils/forceUtils.js`, `src/utils/uploadUtils.js` — utility functions for motion units, model IDs, color logic, and upload helpers.
- `src/services/DigitalTwinExporter.js` — package creation and download helper.
- `conversion_server.py` — conversion server for STEP/STL → GLB using cadquery + trimesh.

## 12. My Contributions

I cannot reliably determine authorship from the code alone. Below is a candidate list of files and areas that typically correspond to internship contributions; please mark which of these you personally implemented or significantly modified so the final internship report can attribute work accurately.

- Core app and orchestration: `src/App.jsx` ([src/App.jsx](src/App.jsx#L1-L800))
- Components: `src/components/CadModel.jsx` ([src/components/CadModel.jsx](src/components/CadModel.jsx#L1-L400)), `src/components/Sidebar.jsx` ([src/components/Sidebar.jsx](src/components/Sidebar.jsx#L1-L500)), `src/components/Inspector.jsx` ([src/components/Inspector.jsx](src/components/Inspector.jsx#L1-L400)), `src/components/InspectorParameters.jsx` ([src/components/InspectorParameters.jsx](src/components/InspectorParameters.jsx#L1-L400)), `src/components/PartInfoPopup.jsx` ([src/components/PartInfoPopup.jsx](src/components/PartInfoPopup.jsx#L1-L400)), `src/components/Loader.jsx` ([src/components/Loader.jsx](src/components/Loader.jsx#L1-L200)), `src/components/JoinDialog.jsx` (if present)
- Hooks: `src/hooks/useUploadManager.js` ([src/hooks/useUploadManager.js](src/hooks/useUploadManager.js#L1-L400)), `src/hooks/useHierarchy.js` ([src/hooks/useHierarchy.js](src/hooks/useHierarchy.js#L1-L400)), `src/hooks/useFaceConnection.js` ([src/hooks/useFaceConnection.js](src/hooks/useFaceConnection.js#L1-L200)), `src/hooks/useInspector.js` ([src/hooks/useInspector.js](src/hooks/useInspector.js#L1-L400))
- Utilities: `src/utils/motionUtils.js` ([src/utils/motionUtils.js](src/utils/motionUtils.js#L1-L400)), `src/utils/modelUtils.js` ([src/utils/modelUtils.js](src/utils/modelUtils.js#L1-L200)), `src/utils/forceUtils.js` ([src/utils/forceUtils.js](src/utils/forceUtils.js#L1-L200)), `src/utils/uploadUtils.js` ([src/utils/uploadUtils.js](src/utils/uploadUtils.js#L1-L200))
- Services and backend: `src/services/DigitalTwinExporter.js` ([src/services/DigitalTwinExporter.js](src/services/DigitalTwinExporter.js#L1-L200)), `conversion_server.py` ([conversion_server.py](conversion_server.py#L1-L200))

Please reply with a short confirmation specifying which of the above files you implemented (or add any missing files you authored). If you prefer, I can mark this README with your confirmation after you reply.

## 13. Technical Challenges and Solutions

- File conversion and browser rendering: STEP/STL files are converted server-side to GLB using `cadquery` → STL → `trimesh` → GLB, avoiding heavy client-side parsing.
- Face alignment math: `useFaceConnection.js` computes world/local normals and uses quaternion math to create a snap rotation and position, then applies the transform to the source subtree.
- Hierarchy transforms: `useHierarchy.js` computes descendant IDs and applies subtree transforms that rotate/translate children consistently using quaternion math and inverse parent transforms.
- Resource cleanup: `useUploadManager.js` maintains object URLs and revokes them when models are removed or on unmount to avoid memory leaks.

## 14. Output / Results

- Interactive GLB-based viewing of uploaded and converted models inside the browser.
- Face alignment and parent/child joins produce consistent local transforms maintained in `positions` and `rotations` state.
- Exported digital twin JSON generated by `DigitalTwinExporter.exportDigitalTwin()` contains metadata, model listings, transforms, settings, and hierarchy suitable for downstream tooling.

## 15. Future Scope

- Persist authored digital twins to a backend or cloud storage and provide project load/save functionality.
- Improve conversion robustness and add progress/preview while conversion runs (streaming conversion updates).
- Add undo/redo for transform and join operations.
- Add validation and richer parameter types (e.g., structured force vectors, material properties).
- Add unit tests, CI, and a production-ready Docker deployment for the conversion service.

## 16. Project Structure

- conversion_server.py — FastAPI conversion service (STEP/STL → GLB)
- package.json, vite.config.js — frontend tooling and dependencies
- requirements.txt — Python dependencies for the conversion server
- public/ — static assets and fallback models
- src/
	- App.jsx — root application and scene
	- main.jsx — app bootstrap
	- components/
		- CadModel.jsx
		- Sidebar.jsx
		- Inspector.jsx
		- InspectorParameters.jsx
		- PartInfoPopup.jsx
		- Loader.jsx
		- JoinDialog.jsx
	- hooks/
		- useUploadManager.js
		- useHierarchy.js
		- useFaceConnection.js
		- useInspector.js
	- services/
		- DigitalTwinExporter.js
	- utils/
		- modelUtils.js
		- motionUtils.js
		- forceUtils.js
		- uploadUtils.js

---

If you'd like, I can now: (a) mark the files you confirm in the "My Contributions" section, (b) generate an author-ready outline for a 5–6 page internship report using this README as source, or (c) produce a shorter abstract for your thesis — tell me which next step you prefer.
