# legalbox.spec — PyInstaller configuration
#
# This file tells PyInstaller how to bundle the Python backend
# into a single standalone binary (no Python installation required).
#
# Usage (run from the backend/ directory with venv activated):
#   pyinstaller legalbox.spec
#
# Output: ../backend-dist/legalbox-backend (Mac/Linux) or legalbox-backend.exe (Windows)
#
# The resulting binary is then bundled into the Electron app by electron-builder.

import sys
import os
from pathlib import Path

# Get path to the venv site-packages so we can include spacy models
venv_path = Path(os.path.dirname(SPEC)) / 'venv'
if sys.platform == 'win32':
    site_packages = venv_path / 'Lib' / 'site-packages'
else:
    # Find the python version directory (e.g. python3.11)
    lib_path = venv_path / 'lib'
    python_dirs = list(lib_path.glob('python3.*')) if lib_path.exists() else []
    site_packages = python_dirs[0] / 'site-packages' if python_dirs else lib_path

block_cipher = None

# SpaCy NER model for the PII shield: bundle the best one installed.
# Run `python -m spacy download en_core_web_lg` (or _sm) before building.
_spacy_model = None
for _candidate in ('en_core_web_lg', 'en_core_web_sm'):
    if (site_packages / _candidate).exists():
        _spacy_model = _candidate
        break
if _spacy_model is None:
    raise SystemExit(
        'No spaCy NER model found in the venv — run '
        '"python -m spacy download en_core_web_lg" before building, or the '
        'packaged app would silently ship without name masking.'
    )

# Files to include that PyInstaller can't auto-detect
added_files = [
    (str(site_packages / _spacy_model), _spacy_model),
    # Presidio analyzer config (recognizer registry YAML) — Presidio (MIT,
    # https://github.com/data-privacy-stack/presidio) powers PII detection
    (str(site_packages / 'presidio_analyzer' / 'conf'), 'presidio_analyzer/conf'),
    # Legal AI prompt library (markdown files)
    ('prompts', 'prompts'),
]

# The sentence-transformers embedding model, saved by the build script with:
#   python -c "from sentence_transformers import SentenceTransformer; \
#              SentenceTransformer('all-MiniLM-L6-v2').save('embedding_model')"
# Required for a fully-offline packaged app — the runtime egress guard blocks
# any attempt to download it, so it must ship in the bundle.
_embed_dir = Path(os.path.dirname(SPEC)) / 'embedding_model'
if _embed_dir.exists():
    added_files.append((str(_embed_dir), 'embedding_model'))
else:
    print('WARNING: backend/embedding_model not found — case search will not '
          'work offline in this build. See scripts/build-app.sh.')

a = Analysis(
    ['main.py'],
    pathex=[str(Path(os.path.dirname(SPEC)))],
    binaries=[],
    datas=added_files,
    hiddenimports=[
        # FastAPI and ASGI
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'pydantic',
        # SpaCy NER
        'spacy',
        'spacy.lang.en',
        'thinc',
        # Presidio PII detection engine (MIT)
        'presidio_analyzer',
        'presidio_analyzer.nlp_engine',
        'presidio_analyzer.predefined_recognizers',
        'phonenumbers',
        'tldextract',
        'regex',
        'yaml',
        # ChromaDB
        'chromadb',
        'chromadb.db.impl.sqlite',
        'chromadb.segment.impl.metadata',
        'chromadb.segment.impl.vector',
        # Sentence transformers (embeddings)
        'sentence_transformers',
        'torch',
        # Document parsing
        'pdfplumber',   # PDF text extraction (MIT)
        'markitdown',   # DOCX/PPTX/XLSX/HTML (MIT)
        'pypdf',        # PDF assembly (BSD)
        'reportlab',    # Bundle cover/TOC/page numbers (BSD)
        'docx',         # python-docx
        # Async HTTP
        'httpx',
        'anyio',
        'anyio._backends._asyncio',
        # Routers
        'routers.contracts',
        'routers.bundles',
        'routers.chronology',
        'routers.drafting',
        'routers.redline',
        'routers.audit',
        'routers.models',
        'routers.users',
        # Core modules
        'prompt_library',
        'audit_logger',
        # System info
        'psutil',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude test frameworks to reduce size
        'pytest', 'unittest', 'doctest',
        # Exclude GUI frameworks we don't need
        'tkinter', 'wx', 'PyQt5',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='legalbox-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # Keep console for logging — Electron hides it anyway
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='legalbox-backend',
)
