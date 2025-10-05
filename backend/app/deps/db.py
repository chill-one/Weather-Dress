# backend/app/deps/db.py
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client


def _get_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return v


@lru_cache
def supabase_client() -> Client:
    """
    Returns a cached Supabase client built from env vars.

    Uses SUPABASE_URL and SUPABASE_ANON_KEY by default.
    If you prefer service role in backend, set SUPABASE_SERVICE_ROLE_KEY
    and change the selection below to prefer it.
    """
    url = _get_env("SUPABASE_URL")
    key: Optional[str] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_ANON_KEY"
    )
    if not key:
        raise RuntimeError(
            "Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in your environment."
        )
    return create_client(url, key)
