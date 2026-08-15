# case_db.py — Case Law Database (ChromaDB + SQLite)
#
# This module manages the local database of uploaded legal cases.
# Two layers:
#   1. SQLite: stores metadata (case name, date, court, parties, tags)
#   2. ChromaDB: stores text chunks as vectors for semantic search
#
# When a lawyer uploads a PDF:
#   → We extract the text
#   → Split it into overlapping chunks (so context isn't lost at chunk boundaries)
#   → Store chunks in ChromaDB with embeddings (mathematical meaning)
#   → Store metadata in SQLite
#
# When a lawyer searches:
#   → We convert the query to a vector
#   → Find the most similar chunks in ChromaDB
#   → Return those chunks + metadata to the LLM for answering
#
# CONFIDENTIALITY: since v2, document text is passed through the PII shield
# BEFORE it is chunked and stored. ChromaDB only ever holds token-masked
# text ([PERSON_1], [NRIC_1]…); the reversible token map is kept per case in
# SQLite so search results can be displayed with real names. This keeps the
# vector store free of raw PII and means anything later fed from it into a
# RAG prompt is already shielded.

import sqlite3
import os
import sys
import json
import hashlib
from typing import List, Dict, Optional, Tuple
from datetime import datetime

import chromadb
from chromadb.utils import embedding_functions

from config import SQLITE_DB_PATH, CHROMA_DB_PATH, CASES_DIR, CHUNK_SIZE, CHUNK_OVERLAP, RAG_TOP_K
from pii_shield import anonymize, deanonymize

# The local embedding model. In the packaged app the model files are bundled
# (see legalbox.spec) so the first case upload never touches the internet;
# in dev mode sentence-transformers falls back to its normal download cache.
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


def _embedding_model_ref() -> str:
    """Path to the bundled embedding model if present, else the model name."""
    override = os.environ.get("LEGALBOX_EMBEDDING_MODEL_PATH")
    if override and os.path.isdir(override):
        return override
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        bundled = os.path.join(bundle_root, "embedding_model")
        if os.path.isdir(bundled):
            return bundled
    return EMBEDDING_MODEL_NAME


# ──────────────────────────────────────────────
# TEXT EXTRACTION
# ──────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract plain text from a document via the shared pluggable pipeline.

    Delegates to document_parser.parse_document so the case database uses the
    same engines (fast / accurate / OCR) and licensing as every other tool —
    no more duplicated, AGPL-licensed PyMuPDF extraction here.
    """
    from document_parser import parse_document
    return parse_document(pdf_path).text


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split long text into overlapping chunks.
    Overlap ensures that a sentence cut at a chunk boundary isn't lost.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        # Try to break at a sentence boundary (period + space)
        if end < len(text):
            last_period = chunk.rfind(". ")
            if last_period > chunk_size // 2:  # only if the break is in the second half
                chunk = chunk[:last_period + 1]
                end = start + last_period + 1
        # Never split a [CATEGORY_N] placeholder across two chunks — a
        # broken token could not be restored at display time.
        if end < len(text):
            last_open = chunk.rfind("[")
            if last_open != -1 and "]" not in chunk[last_open:]:
                close = text.find("]", end)
                if close != -1 and close - (start + last_open) <= 40:
                    end = close + 1
                    chunk = text[start:end]
        chunks.append(chunk.strip())
        start = end - overlap  # Step back by overlap amount
    return [c for c in chunks if c]  # Remove any empty chunks


# ──────────────────────────────────────────────
# CASE DATABASE
# ──────────────────────────────────────────────

class CaseDatabase:
    """Manages the local case law database (metadata + vector search)."""

    def __init__(self):
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        os.makedirs(CASES_DIR, exist_ok=True)

        # ChromaDB: persistent vector database stored locally.
        # anonymized_telemetry=False: Chroma's posthog telemetry is opt-out
        # and would phone home — this product must never emit ANY egress.
        self._chroma = chromadb.PersistentClient(
            path=CHROMA_DB_PATH,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )

        # The embedding model and its ChromaDB collection are built lazily on
        # first use. Loading sentence-transformers is slow and only matters
        # for upload/search — health checks and case listing (SQLite only)
        # must not pay that cost or fail if the model isn't present yet.
        self._embedder = None
        self._collection_cache = None
        self._migrated = False

        # SQLite: metadata database
        self._db_path = SQLITE_DB_PATH
        self._init_sqlite()

    @property
    def _collection(self):
        """Build the embedder + vector collection on first access, then
        run the one-time v1→v2 migration."""
        if self._collection_cache is None:
            self._embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=_embedding_model_ref()  # 80MB model, fast and good enough for legal search
            )
            # "cases_v2": chunks are PII-anonymized at ingest. The v1 "cases"
            # collection stored raw text and is migrated once, here.
            self._collection_cache = self._chroma.get_or_create_collection(
                name="cases_v2",
                embedding_function=self._embedder,
                metadata={"hnsw:space": "cosine"},  # cosine similarity is best for text
            )
            if not self._migrated:
                self._migrated = True
                self._migrate_v1_if_needed()
        return self._collection_cache

    def _init_sqlite(self):
        """Create the SQLite tables if they don't exist yet."""
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cases (
                    id          TEXT PRIMARY KEY,
                    filename    TEXT NOT NULL,
                    case_name   TEXT,
                    court       TEXT,
                    date        TEXT,
                    parties     TEXT,
                    practice_area TEXT,
                    tags        TEXT,
                    file_path   TEXT,
                    chunk_count INTEGER DEFAULT 0,
                    uploaded_at TEXT NOT NULL
                )
            """)
            # pii_map: reversible token map (JSON) for chunks stored in
            # ChromaDB — added in v2 (anonymize-at-ingest)
            try:
                conn.execute("ALTER TABLE cases ADD COLUMN pii_map TEXT")
            except sqlite3.OperationalError:
                pass  # column already exists
            conn.commit()

    def _migrate_v1_if_needed(self):
        """Re-index v1 cases (raw text in ChromaDB) into the shielded v2 store.

        v1 rows are identified by pii_map IS NULL. Each is re-extracted from
        its stored PDF, anonymized, and re-chunked into cases_v2; the old
        raw-text "cases" collection is then dropped.
        """
        with sqlite3.connect(self._db_path) as conn:
            conn.row_factory = sqlite3.Row
            pending = conn.execute(
                "SELECT id, filename, file_path, case_name FROM cases WHERE pii_map IS NULL"
            ).fetchall()

        for row in pending:
            try:
                if not row["file_path"] or not os.path.exists(row["file_path"]):
                    print(f"[CaseDB] v2 migration: source PDF missing for {row['id']}; "
                          f"removing stale entry (re-upload to restore).")
                    self.delete_case(row["id"])
                    continue
                self._index_case(
                    case_id=row["id"],
                    pdf_path=row["file_path"],
                    filename=row["filename"],
                    case_name=row["case_name"] or row["filename"],
                )
                print(f"[CaseDB] v2 migration: re-indexed {row['id']} with PII shielding.")
            except Exception as e:
                print(f"[CaseDB] v2 migration failed for {row['id']}: {e}")

        # Drop the v1 raw-text collection once nothing references it
        try:
            self._chroma.delete_collection("cases")
            print("[CaseDB] v2 migration: removed v1 raw-text collection.")
        except Exception:
            pass  # never existed or already removed

    def _index_case(self, case_id: str, pdf_path: str, filename: str, case_name: str) -> Tuple[int, Dict]:
        """Extract, SHIELD, chunk, and store a case's text. Returns (chunk_count, pii_summary).

        The PII shield runs on the full text before chunking, so ChromaDB
        only ever stores token-masked text. The token map is persisted to
        SQLite (pii_map) for display-time restoration.
        """
        text = extract_text_from_pdf(pdf_path)
        pii_result = anonymize(text)
        chunks = chunk_text(pii_result.anonymized_text)

        if not chunks:
            raise ValueError("No text could be extracted from this PDF.")

        # Replace any previous chunks for this case (migration / re-index)
        try:
            existing = self._collection.get(where={"case_id": case_id})
            if existing["ids"]:
                self._collection.delete(ids=existing["ids"])
        except Exception:
            pass

        chunk_ids = [f"{case_id}_chunk_{i}" for i in range(len(chunks))]
        chunk_metadatas = [
            {
                "case_id": case_id,
                "filename": filename,
                "chunk_index": i,
                "case_name": case_name,
            }
            for i in range(len(chunks))
        ]

        # ChromaDB has a batch size limit — add in batches of 100
        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            batch_end = min(i + batch_size, len(chunks))
            self._collection.add(
                documents=chunks[i:batch_end],
                ids=chunk_ids[i:batch_end],
                metadatas=chunk_metadatas[i:batch_end],
            )

        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                "UPDATE cases SET pii_map = ?, chunk_count = ? WHERE id = ?",
                (json.dumps(pii_result.token_map), len(chunks), case_id),
            )
            conn.commit()

        return len(chunks), pii_result.pii_summary

    def add_case(
        self,
        pdf_path: str,
        filename: str,
        metadata: Optional[Dict] = None,
    ) -> str:
        """
        Add a case PDF to the database.
        1. Extract text from the PDF
        2. Split into chunks
        3. Store chunks in ChromaDB
        4. Store metadata in SQLite
        Returns the case ID.
        """
        # Generate a stable ID from the file content (so re-uploading same file doesn't duplicate)
        with open(pdf_path, "rb") as f:
            file_hash = hashlib.md5(f.read()).hexdigest()
        case_id = f"case_{file_hash[:16]}"

        # Check if already indexed
        with sqlite3.connect(self._db_path) as conn:
            existing = conn.execute("SELECT id FROM cases WHERE id = ?", (case_id,)).fetchone()
            if existing:
                return case_id  # Already in database

        # Store metadata first (pii_map is set by _index_case; a NULL map
        # marks an unfinished index, which the startup migration repairs)
        meta = metadata or {}
        case_name = meta.get("case_name", filename)
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                INSERT INTO cases (id, filename, case_name, court, date, parties,
                                   practice_area, tags, file_path, chunk_count, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                case_id,
                filename,
                case_name,
                meta.get("court", ""),
                meta.get("date", ""),
                meta.get("parties", ""),
                meta.get("practice_area", ""),
                json.dumps(meta.get("tags", [])),
                pdf_path,
                0,
                datetime.now().isoformat(),
            ))
            conn.commit()

        try:
            self._index_case(
                case_id=case_id,
                pdf_path=pdf_path,
                filename=filename,
                case_name=case_name,
            )
        except Exception:
            # Don't leave a metadata row pointing at nothing
            with sqlite3.connect(self._db_path) as conn:
                conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
                conn.commit()
            raise

        return case_id

    def search(self, query: str, top_k: int = RAG_TOP_K) -> List[Dict]:
        """
        Semantic search over all indexed case chunks.
        Returns the most relevant excerpts + their metadata.

        Stored chunks are token-masked; each excerpt is restored using its
        case's own pii_map before being returned, so callers always receive
        readable text with real names. (Anything sent onward to the LLM is
        re-shielded by the endpoint — see /api/search-cases.)

        Pass the ANONYMIZED form of the user's query: the stored chunks are
        token-masked, so a masked query embeds into the same space.
        """
        results = self._collection.query(
            query_texts=[query],
            n_results=min(top_k, self._collection.count() or 1),
        )

        if not results["documents"] or not results["documents"][0]:
            return []

        pii_maps = {}  # case_id → token map, loaded once per case

        def map_for(case_id: str) -> Dict:
            if case_id not in pii_maps:
                with sqlite3.connect(self._db_path) as conn:
                    row = conn.execute(
                        "SELECT pii_map FROM cases WHERE id = ?", (case_id,)
                    ).fetchone()
                pii_maps[case_id] = json.loads(row[0]) if row and row[0] else {}
            return pii_maps[case_id]

        output = []
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            distance = results["distances"][0][i] if results.get("distances") else None
            case_id = meta.get("case_id", "")
            output.append({
                "text": deanonymize(doc, map_for(case_id)),
                "case_id": case_id,
                "case_name": meta.get("case_name", ""),
                "filename": meta.get("filename", ""),
                "chunk_index": meta.get("chunk_index", 0),
                "relevance_score": round(1 - distance, 3) if distance is not None else None,
            })

        return output

    def list_cases(self) -> List[Dict]:
        """Return all cases in the database."""
        with sqlite3.connect(self._db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT id, filename, case_name, court, date, parties,
                       practice_area, tags, chunk_count, uploaded_at
                FROM cases ORDER BY uploaded_at DESC
            """).fetchall()
            return [dict(row) for row in rows]

    def delete_case(self, case_id: str) -> bool:
        """Remove a case from both databases."""
        # Remove from ChromaDB (find all chunks for this case)
        try:
            results = self._collection.get(where={"case_id": case_id})
            if results["ids"]:
                self._collection.delete(ids=results["ids"])
        except Exception:
            pass

        # Remove from SQLite
        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_case_count(self) -> int:
        """Return total number of cases in the database."""
        with sqlite3.connect(self._db_path) as conn:
            result = conn.execute("SELECT COUNT(*) FROM cases").fetchone()
            return result[0] if result else 0


# Module-level singleton
_db: Optional[CaseDatabase] = None

def get_db() -> CaseDatabase:
    """Get or create the shared database instance."""
    global _db
    if _db is None:
        _db = CaseDatabase()
    return _db
