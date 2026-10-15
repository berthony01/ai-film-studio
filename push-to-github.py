#!/usr/bin/env python3
"""Push BidRight to a fresh empty repo: source -> main, dist -> gh-pages.
Run AFTER the repo berthony01/ai-film-studio exists (created by the owner).
Uses only api.github.com via the stored custom.github credential.
"""
import base64
import json
import os
import sys
import urllib.request
import urllib.error

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import (
    DynamicCredentialError,
    add_surrogate_to_request,
    read_json_response,
)

API = "https://api.github.com"
REPO = "berthony01/ai-film-studio"
CREDENTIAL_NAME = "custom.github-deploy"
SRC = "/home/hatch/workspace/ai-film-studio"
SKIP_DIRS = {"node_modules", ".git", "dist", "__pycache__"}


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(
        req, CREDENTIAL_NAME, allowed_hosts=["api.github.com", "github.com"]
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return read_json_response(resp)
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:800]
        except Exception:
            detail = "<unreadable>"
        raise RuntimeError(f"GitHub API {method} {path}: HTTP {e.code}: {detail}")


def collect(root, skip_dirs=()):
    entries = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            entries.append((rel, full))
    return sorted(entries)


def get_ref_branch(branch):
    try:
        ref = api("GET", f"/repos/{REPO}/git/ref/heads/{branch}")
        return ref["object"]["sha"]
    except RuntimeError as exc:
        if "HTTP 404" in str(exc):
            return None
        raise


def push_tree(local_root, branch, message, skip_dirs=()):
    blobs = []
    for rel, full in collect(local_root, skip_dirs):
        with open(full, "rb") as fh:
            content = base64.b64encode(fh.read()).decode("ascii")
        blob = api(
            "POST",
            f"/repos/{REPO}/git/blobs",
            {"content": content, "encoding": "base64"},
        )
        blobs.append(
            {"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]}
        )
    print(f"[{branch}] {len(blobs)} blobs", flush=True)
    tree = api("POST", f"/repos/{REPO}/git/trees", {"tree": blobs})
    parents = []
    existing = get_ref_branch(branch)
    if existing:
        parents = [existing]
    commit = api(
        "POST",
        f"/repos/{REPO}/git/commits",
        {"message": message, "tree": tree["sha"], "parents": parents},
    )
    if existing:
        api(
            "PATCH",
            f"/repos/{REPO}/git/refs/heads/{branch}",
            {"sha": commit["sha"]},
        )
        print(f"[{branch}] updated to {commit['sha'][:8]}", flush=True)
    else:
        api(
            "POST",
            f"/repos/{REPO}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": commit["sha"]},
        )
        print(f"[{branch}] created at {commit['sha'][:8]}", flush=True)


def main():
    try:
        push_tree(SRC, "main", "AI Film Studio v0.1 — scaffold: landing, studio shell, Supabase schema, generation pipeline", skip_dirs=SKIP_DIRS)
        print("OK: pushed main (source)")
    except DynamicCredentialError as exc:
        print(f"auth error: {exc}", file=sys.stderr)
        sys.exit(1)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
