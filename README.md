# TwinForge — Digital Twin Authoring & 3D Viewer

TwinForge is a web and desktop Digital Twin authoring and visualization application for viewing and working with CAD parts and assemblies.

The application supports **GLB, STL, and STEP** model files. GLB files can be loaded directly, while STL and STEP files are converted into browser-renderable GLB models through a Python-based conversion backend.

TwinForge provides interactive 3D visualization, part inspection, motion and parameter configuration, face-based alignment, and parent/child assembly relationships.

---

## Features

- Upload and visualize **GLB, STL, and STEP** files
- Convert STL and STEP files into GLB
- Interactive 3D model visualization
- Orbit, zoom, and camera navigation
- Part selection and inspection
- Change model colors
- Configure model parameters
- Configure translation, oscillation, and rotation motions
- Face-based part alignment
- Parent/child part relationships
- Move and rotate connected part hierarchies
- Visibility controls for individual models
- Web deployment
- Standalone Windows desktop application
- Bundled local conversion backend for the desktop application

---

## Project Overview

TwinForge consists of three main layers:

```text
                    TwinForge
                       │
          ┌────────────┴────────────┐
          │                         │
       Web App                Desktop App
          │                         │
    React + Vite               Electron
          │                         │
          ▼                         ▼
      Vercel                  Packaged React UI
          │                         │
          ▼                         ▼
      Render API          conversion_server.exe
          │                         │
          └────────────┬────────────┘
                       ▼
                STEP / STL → GLB
```

### Web Application

The web version consists of:

- React + Vite frontend
- Three.js / React Three Fiber 3D viewer
- FastAPI conversion backend
- Dockerized backend deployment
- Vercel frontend deployment
- Render backend deployment

### Desktop Application
## Download

### Windows Desktop Application

Download the latest Windows installer:

**[Download TwinForge for Windows](https://github.com/BhasvatiSristi/digital-twin-system/releases/tag/v1.0.0)**

The desktop application includes the local CAD conversion backend and does not require a separate Python installation.

### Web Application

**[Open TwinForge Web App](https://digital-twin-system-kappa.vercel.app/)**

The Windows desktop version consists of:

- Electron
- Packaged React/Vite frontend
- Bundled `conversion_server.exe`
- Local FastAPI conversion service
- Electron Builder Windows installer

The desktop application does **not** require Python, Vite, or a separately running backend after installation.

---

## Supported File Formats

| Format | Supported | Processing |
|---|---|---|
| `.glb` | Yes | Loaded directly |
| `.stl` | Yes | Converted to GLB |
| `.step` | Yes | STEP → STL → GLB |

> `.stp` is currently not included in the supported extension list.

---

## Architecture

### Web Deployment

```text
User
 │
 ▼
React / Vite Frontend
 │
 │ HTTPS
 ▼
Vercel
 │
 │ Conversion request
 ▼
Render
 │
 ▼
FastAPI Conversion Server
 │
 ├── GLB → pass through
 ├── STL → trimesh → GLB
 └── STEP → CadQuery → STL → trimesh → GLB
 │
 ▼
GLB response
 │
 ▼
Three.js Viewer
```

### Desktop Deployment

```text
User
 │
 ▼
TwinForge.exe
 │
 ▼
Electron
 │
 ├── React/Vite production build
 │
 └── Starts bundled conversion_server.exe
                         │
                         ▼
                  127.0.0.1:8000
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
             STL                   STEP
              │                     │
              │                  CadQuery
              │                     │
              └──────────┬──────────┘
                         ▼
                       GLB
                         │
                         ▼
                  Three.js Viewer
```

---

## Technology Stack

### Frontend

- React
- Vite
- Three.js
- React Three Fiber
- React Three Drei
- Leva

### Backend

- Python
- FastAPI
- Uvicorn
- CadQuery
- Trimesh
- Python Multipart

### Desktop

- Electron
- Electron Builder
- PyInstaller
- Windows

### Deployment

- Vercel — frontend hosting
- Render — backend hosting
- Docker — backend containerization

---

## Core Functionality

### 1. CAD Model Upload

Users can upload:

```text
GLB
STL
STEP
```

GLB files are loaded directly in the browser.

STL and STEP files are sent to the conversion backend and returned as GLB files.

The upload lifecycle is managed by:

```text
src/hooks/useUploadManager.js
```

---

### 2. Model Conversion

The conversion service is implemented in:

```text
conversion_server.py
```

#### GLB

GLB files are passed through without conversion.

#### STL

```text
STL
 ↓
trimesh
 ↓
GLB
```

#### STEP

```text
STEP
 ↓
CadQuery
 ↓
STL
 ↓
trimesh
 ↓
GLB
```

The resulting GLB file is returned to the frontend and displayed using Three.js.

---

## 3D Visualization

The main 3D scene is implemented using:

```text
@react-three/fiber
three.js
@react-three/drei
```

Important files include:

```text
src/App.jsx
src/components/CadModel.jsx
```

The viewer supports:

- Model rendering
- Camera controls
- Selection
- Visibility
- Material/color changes
- Motion
- Model focusing
- Scene navigation

---

## Part Inspection

The inspector system allows users to configure properties of individual parts.

Relevant files:

```text
src/components/Inspector.jsx
src/components/InspectorParameters.jsx
src/hooks/useInspector.js
```

Supported functionality includes:

- Model color
- Motion configuration
- Parameters
- Part-specific settings

---

## Motion System

TwinForge supports several motion types:

- Translation
- Oscillation
- Rotation

Motion-related utilities are implemented in:

```text
src/utils/motionUtils.js
```

The motion system also handles unit conversion such as:

- RPM
- Degrees per second
- Meters per second

---

## Force-Based Visualization

The application includes force-related parameter handling.

Force thresholds can trigger visual warnings on models.

The relevant utility is:

```text
src/utils/forceUtils.js
```

The system supports warning and critical states based on configured force values.

---

## Face-Based Alignment

TwinForge supports aligning two parts using selected faces.

The workflow is:

```text
Select source face
        ↓
Select target face
        ↓
Calculate face normals
        ↓
Calculate rotation
        ↓
Calculate translation
        ↓
Apply transform
```

The implementation uses vector, quaternion, world/local coordinate, and transform calculations.

Relevant file:

```text
src/hooks/useFaceConnection.js
```

---

## Parent / Child Assembly Relationships

TwinForge supports creating relationships between parts.

For example:

```text
Assembly
 ├── Base
 ├── Wheel
 │    └── WheelCover
 └── Frame
```

When a parent part is moved or rotated, its child hierarchy can be transformed consistently.

Relevant file:

```text
src/hooks/useHierarchy.js
```

The hierarchy system maintains:

```text
attachmentParentByChild
attachmentChildrenByParent
```

and calculates local poses relative to parent models.

---

## Project Workflow

The general application workflow is:

```text
1. Launch TwinForge
        ↓
2. Upload GLB / STL / STEP
        ↓
3. Convert STL / STEP when required
        ↓
4. Display model in 3D scene
        ↓
5. Select and inspect parts
        ↓
6. Configure parameters and motion
        ↓
7. Align parts using face selection
        ↓
8. Create parent/child relationships
        ↓
9. Manipulate the resulting assembly
```

---

# Backend API

The FastAPI conversion server exposes the following main endpoint:

```text
POST /api/convert
```

It accepts a multipart file upload and returns a GLB file.

Health check:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

The backend is stateless and does not require persistent database storage.

---

# Running Locally

## Prerequisites

### Node.js

Use a modern Node.js version compatible with the current Vite setup.

### Python

Create a Python virtual environment and install the packages listed in:

```text
requirements.txt
```

---

## 1. Install Frontend Dependencies

```bash
npm install
```

---

## 2. Create Python Virtual Environment

Windows:

```bash
python -m venv venv
```

Activate it:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## 3. Start the Conversion Backend

```bash
python -m uvicorn conversion_server:app --host 127.0.0.1 --port 8000
```

The backend will be available at:

```text
127.0.0.1:8000
```

---

## 4. Start the Web Application

In another terminal:

```bash
npm run dev
```

The Vite development server will run on the configured development port.

The Vite development configuration proxies conversion requests to:

```text
127.0.0.1:8000
```

---

# Running the Electron Desktop Application During Development

The development Electron workflow uses two processes:

### Terminal 1

```bash
npm run dev
```

### Terminal 2

```bash
npm run electron
```

Electron loads the Vite development server while the conversion backend is started from:

```text
backend-dist/conversion_server.exe
```

---

# Building the Desktop Application

The desktop application uses a pre-built Python executable.

The conversion backend executable is generated separately and stored locally in:

```text
backend-dist/conversion_server.exe
```

The Electron application packages this executable as an additional resource.

The packaged application uses:

```text
resources/backend/conversion_server.exe
```

for the local conversion service.

---

## Build the Frontend

```bash
npm run build
```

---

## Build the Windows Installer

```bash
npm run electron:build
```

The installer is generated inside:

```text
release/
```

The resulting installer can be used to install TwinForge on Windows.

---

# Desktop Application Runtime

After installation, the user only needs to launch:

```text
TwinForge
```

The application automatically:

1. Starts Electron.
2. Loads the packaged React frontend.
3. Starts the bundled conversion backend.
4. Runs the conversion service locally.
5. Allows STEP and STL files to be converted without requiring Python or Vite.

The desktop application therefore works as a standalone Windows application.

---

# Deployment

## Web Frontend

The production frontend is deployed using:

```text
Vercel
```

The frontend communicates with the production conversion backend through the configured converter endpoint.

## Web Backend

The conversion backend is deployed using:

```text
Render
```

The backend is containerized using:

```text
Dockerfile
```

The production architecture is therefore:

```text
Browser
   │
   ▼
Vercel
   │
   ▼
Render
   │
   ▼
FastAPI
   │
   ├── STEP → GLB
   └── STL → GLB
```

---

# Project Structure

```text
twin-system/
│
├── electron/
│   └── main.mjs
│
├── public/
│   ├── logo.png
│   ├── twinforge_logo.png
│   └── twinforge_logo2.png
│
├── src/
│   ├── components/
│   │   ├── CadModel.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Inspector.jsx
│   │   ├── InspectorParameters.jsx
│   │   ├── PartInfoPopup.jsx
│   │   └── Loader.jsx
│   │
│   ├── hooks/
│   │   ├── useUploadManager.js
│   │   ├── useHierarchy.js
│   │   ├── useFaceConnection.js
│   │   └── useInspector.js
│   │
│   ├── utils/
│   │   ├── modelUtils.js
│   │   ├── motionUtils.js
│   │   ├── forceUtils.js
│   │   └── uploadUtils.js
│   │
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── conversion_server.py
├── desktop_backend.py
├── Dockerfile
├── requirements.txt
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── .gitignore
└── README.md
```

Generated files and local development environments such as `node_modules`, `venv`, build outputs, and packaged release files should not be committed to the repository.

---

# Important Modules

| File | Purpose |
|---|---|
| `src/App.jsx` | Root UI, scene composition, and application state |
| `src/components/CadModel.jsx` | 3D model rendering and model interaction |
| `src/components/Sidebar.jsx` | File upload, model list, and visibility controls |
| `src/components/Inspector.jsx` | Part inspection interface |
| `src/components/InspectorParameters.jsx` | Parameter editing |
| `src/hooks/useUploadManager.js` | Upload and conversion lifecycle |
| `src/hooks/useHierarchy.js` | Parent/child relationships and subtree transforms |
| `src/hooks/useFaceConnection.js` | Face selection and alignment |
| `src/hooks/useInspector.js` | Inspector state and settings |
| `src/utils/motionUtils.js` | Motion normalization and unit conversion |
| `src/utils/modelUtils.js` | Model and parameter utilities |
| `src/utils/forceUtils.js` | Force-based warning logic |
| `src/utils/uploadUtils.js` | Upload validation and helpers |
| `electron/main.mjs` | Electron window and desktop backend lifecycle |
| `conversion_server.py` | STEP/STL to GLB conversion service |
| `desktop_backend.py` | Desktop/backend support logic |

---

# Technical Challenges and Solutions

## CAD File Conversion

STEP and STL files are not directly used by the Three.js viewer.

The conversion pipeline was implemented as:

```text
STEP
 ↓
CadQuery
 ↓
STL
 ↓
Trimesh
 ↓
GLB
```

and:

```text
STL
 ↓
Trimesh
 ↓
GLB
```

This keeps the browser-side application focused on visualization while the computationally heavier CAD conversion is handled by Python.

---

## Browser and Desktop Conversion Endpoints

The application uses different conversion endpoints depending on its environment.

### Web development

The Vite development server proxies conversion requests to the local FastAPI backend.

### Desktop application

The Electron production build directly communicates with:

```text
http://127.0.0.1:8000/api/convert
```

The bundled conversion server is started automatically by Electron.

This allows the same React application to work in both browser and desktop environments.

---

## Face Alignment

Face alignment requires converting between world-space and local-space coordinates.

The system uses:

- Face normals
- Vector operations
- Quaternions
- World/local transformation matrices

to calculate the required rotation and translation.

---

## Hierarchical Transformations

Moving a parent part should also move its children.

The hierarchy system therefore calculates descendant models and applies transformations consistently throughout the subtree.

---

## Desktop Packaging

The desktop application required packaging two separate systems:

```text
React/Vite application
+
Python conversion backend
```

PyInstaller is used to create:

```text
conversion_server.exe
```

Electron Builder then packages the executable with the desktop application.

The final user experience is a standalone Windows installer.

---

# Deployment Results

TwinForge is available in two deployment forms:

### Web Application

```text
React/Vite frontend
        +
FastAPI conversion backend
```

### Windows Desktop Application

```text
Electron
        +
React/Vite production build
        +
Bundled conversion_server.exe
```

Both deployments support:

- GLB viewing
- STL conversion and viewing
- STEP conversion and viewing
- Interactive 3D visualization
- Part inspection
- Motion configuration
- Face-based alignment
- Parent/child assembly relationships

---

# Current Limitations

- Only `.glb`, `.stl`, and `.step` extensions are currently supported.
- `.stp` is not currently included.
- Conversion is currently file-based and stateless.
- No user authentication or account system.
- No persistent cloud project storage.
- No full CAD editing functionality.
- No undo/redo system yet.
- Large CAD models may require significant conversion and rendering resources.
- Conversion progress feedback can be improved.

---

# Future Scope

Potential future improvements include:

- Support for additional CAD formats
- `.stp` extension support
- Persistent digital twin project storage
- Project save/load functionality
- Cloud-based project management
- Undo/redo for transformations
- More advanced motion definitions
- Richer engineering parameters
- Improved conversion progress reporting
- Large-model performance optimization
- Automated testing
- CI/CD pipelines
- Authentication and multi-user collaboration
- More advanced assembly and constraint systems

---

# Development Notes

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
venv\Scripts\activate
python -m uvicorn conversion_server:app --host 127.0.0.1 --port 8000
```

### Production Frontend Build

```bash
npm run build
```

### Electron Development

```bash
npm run dev
npm run electron
```

### Windows Installer

```bash
npm run electron:build
```

---

# License

This project is currently developed as an academic/internship project.

Add the appropriate license here if the repository is later released under an open-source license.