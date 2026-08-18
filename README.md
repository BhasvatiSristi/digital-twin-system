# TwinForge

TwinForge is a visual workspace for viewing and working with 3D parts and assemblies. It is built for loading models, inspecting them, arranging them, and keeping useful part information in one place.

## What this project is for

This app lets you:

- open and view 3D models
- upload new parts and assemblies
- switch between loaded files
- inspect part details in a side panel
- adjust part settings and saved parameters
- work with face-to-face part connections
- move connected parts together as a group

## What files you can use

The viewer accepts these file types:

- `.glb`
- `.stl`
- `.step`

GLB files open directly. STL and STEP files are prepared in the background so they can be shown in the viewer.

## What you see in the app

- The main area shows the 3D model.
- The sidebar helps you manage uploaded files and choose which model is active.
- The inspector shows part information and editing options.
- The part popup shows saved details for the selected item.

## Main features

- Model viewing with a clean 3D scene
- File upload and model switching
- Assembly and part relationship handling
- Face-based connection between parts
- Inspector controls for part information and parameters
- Saved parameter rows for keeping custom part data organized

## How to run it

1. Install the node modules required for this application with `npm install`. 
[Node version should be >= v.20 since using Vite+React.]
2. Create a new virtual environment and install the Python packages from `requirements.txt`.
3. Start the Python service with `uvicorn conversion_server:app --reload --port 8000`.
4. Start the web app with `npm run dev`.

## Basic workflow

1. Open the app in the browser.
2. Load a supported model file. [A default model is preloaded.]
3. Pick the part or assembly you want to work with.
4. Use the sidebar and inspector to review or change details.
5. Save any part-specific information you want to keep.

## Notes

- The app includes a fallback model if no uploaded model is active.
- The viewer is meant for working with parts visually rather than reading data in a technical format.
- If you add new model files, make sure they use one of the supported formats above.
