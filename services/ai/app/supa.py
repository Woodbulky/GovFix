"""Supabase plumbing: verify the caller's JWT, call PostgREST/Storage as the caller, and the ai_writer connection."""

import os
from dataclasses import dataclass

import httpx
import jwt
import psycopg
from fastapi import Header, HTTPException
from psycopg.rows import dict_row

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
# The anon key is public (it ships in the web bundle); PostgREST needs it next to the user's JWT.
ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")
_jwks = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json") if SUPABASE_URL else None


@dataclass
class User:
    id: str
    token: str


def current_user(authorization: str = Header(default="")) -> User:
    """FastAPI dependency. Asymmetric keys (ES256/RS256) via JWKS; legacy HS256 via SUPABASE_JWT_SECRET."""
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Sign in first.")
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            key = os.environ["SUPABASE_JWT_SECRET"]
        elif alg in ("ES256", "RS256") and _jwks:
            key = _jwks.get_signing_key_from_jwt(token).key
        else:
            raise ValueError(alg)
        claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except Exception:
        raise HTTPException(401, "Your session isn't valid. Sign in again.")
    return User(claims["sub"], token)


def as_user(u: User, method: str, path: str, **kw) -> httpx.Response:
    """Supabase REST/Storage call with the caller's own JWT, so RLS decides what they can see."""
    headers = {"apikey": ANON_KEY, "Authorization": f"Bearer {u.token}", **kw.pop("headers", {})}
    return httpx.request(method, f"{SUPABASE_URL}{path}", headers=headers, timeout=10, **kw)


def rows(u: User, path: str) -> list[dict]:
    r = as_user(u, "GET", f"/rest/v1/{path}")
    r.raise_for_status()
    return r.json()


def visible_request(u: User, request_id: str) -> None:
    """404 unless RLS lets the caller see this request."""
    if not rows(u, f"requests?id=eq.{request_id}&select=id"):
        raise HTTPException(404, "This request doesn't exist.")


def my_profile(u: User) -> dict:
    found = rows(u, f"profiles?id=eq.{u.id}&select=full_name,role,preferred_language")
    if not found:
        raise HTTPException(403, "No profile for this account.")
    return found[0]


def db() -> psycopg.Connection:
    """ai_writer: may INSERT ai_suggestions and UPDATE notifications.audio_path, nothing else (golden rule 3)."""
    return psycopg.connect(os.environ["AI_DATABASE_URL"], autocommit=True, row_factory=dict_row, connect_timeout=8)
