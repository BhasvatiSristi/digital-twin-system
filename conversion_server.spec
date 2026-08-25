# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all
import os
import casadi


# Collect CadQuery
cadquery_datas, cadquery_binaries, cadquery_hidden = collect_all("cadquery")

# Collect OCP
ocp_datas, ocp_binaries, ocp_hidden = collect_all("OCP")

# Collect CasADi
casadi_datas, casadi_binaries, casadi_hidden = collect_all("casadi")

# Explicitly include CasADi's native extension
casadi_dir = os.path.dirname(casadi.__file__)

casadi_binaries.append(
    (
        os.path.join(casadi_dir, "_casadi.pyd"),
        "casadi",
    )
)


a = Analysis(
    ["desktop_backend.py"],

    pathex=[],

    binaries=[
        *cadquery_binaries,
        *ocp_binaries,
        *casadi_binaries,
    ],

    datas=[
        *cadquery_datas,
        *ocp_datas,
        *casadi_datas,
    ],

    hiddenimports=[
        *cadquery_hidden,
        *ocp_hidden,
        *casadi_hidden,

        # Explicit CasADi imports
        "casadi",
        "casadi.casadi",
        "casadi._casadi",
    ],

    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)


pyz = PYZ(a.pure)


exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],

    name="conversion_server",

    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],

    runtime_tmpdir=None,
    console=True,

    disable_windowed_traceback=False,
    argv_emulation=False,

    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)