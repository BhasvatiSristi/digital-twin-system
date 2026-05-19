# TwinForge

This workspace includes a Vite React frontend and a small Python conversion service.

The viewer accepts only `.glb`, `.stl`, and `.step` files. GLB files load directly. STL and STEP files are converted to GLB by `conversion_server.py` before the model is added to the scene.

## Run locally

1. Install the Python packages from `requirements.txt`.
2. Start the conversion API with `uvicorn conversion_server:app --reload --port 8000`.
3. Start the frontend with `npm run dev`.

The Vite dev server proxies `/api/*` to the conversion API, so the frontend can call `/api/convert` without CORS setup.
