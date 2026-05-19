from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import cadquery as cq
import trimesh
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


app = FastAPI(title="TwinForge conversion server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def mesh_from_path(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(str(path), force="mesh")

    if isinstance(loaded, trimesh.Trimesh):
        return loaded

    if isinstance(loaded, trimesh.Scene):
        meshes = [geometry for geometry in loaded.dump() if hasattr(geometry, "faces")]
        if not meshes:
            raise ValueError("The input file did not produce any mesh geometry.")
        return trimesh.util.concatenate(meshes)

    raise ValueError("Unsupported mesh data returned by trimesh.")


def convert_step_to_glb(source_path: Path, output_path: Path) -> None:
    shape = cq.importers.importStep(str(source_path))
    temp_stl_path = source_path.with_suffix(".stl")
    cq.exporters.export(shape, str(temp_stl_path))
    mesh = mesh_from_path(temp_stl_path)
    mesh.export(str(output_path))


def convert_stl_to_glb(source_path: Path, output_path: Path) -> None:
    mesh = mesh_from_path(source_path)
    mesh.export(str(output_path))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/convert")
async def convert_model(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    extension = get_extension(file.filename or "")
    if extension not in {"glb", "stl", "step"}:
      raise HTTPException(status_code=400, detail="Only GLB, STL, and STEP files are supported.")

    temp_dir = Path(tempfile.mkdtemp(prefix="twinforge-convert-"))
    background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)

    source_name = Path(file.filename or f"upload.{extension}").name
    source_path = temp_dir / source_name
    with source_path.open("wb") as destination:
        shutil.copyfileobj(file.file, destination)

    output_path = temp_dir / f"{Path(source_name).stem}.glb"

    try:
        if extension == "step":
            convert_step_to_glb(source_path, output_path)
        elif extension == "stl":
            convert_stl_to_glb(source_path, output_path)
        else:
            shutil.copyfile(source_path, output_path)
    except Exception as error:  # noqa: BLE001 - surface the conversion failure to the frontend
        raise HTTPException(status_code=500, detail=f"Conversion failed: {error}") from error

    return FileResponse(
        output_path,
        media_type="model/gltf-binary",
        filename=f"{Path(source_name).stem}.glb",
        background=background_tasks,
    )
