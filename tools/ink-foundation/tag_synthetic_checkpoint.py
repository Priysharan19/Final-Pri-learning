#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    args = p.parse_args()

    path = Path(args.checkpoint)
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("not a V4 checkpoint")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("refusing checkpoint that claims production readiness")

    ckpt["stage"] = "structural-synthetic-pretrain"
    ckpt["production_ready"] = False
    ckpt["synthetic_pretraining"] = True
    ckpt["evidence"] = (
        "synthetic structural pretraining only; never real-handwriting, writer-disjoint, "
        "or production evidence"
    )
    torch.save(ckpt, path)

    manifest = path.with_suffix(".json")
    data = {}
    if manifest.exists():
        try:
            data = json.loads(manifest.read_text())
        except Exception:
            data = {}
    data.update({
        "architectureVersion": 4,
        "stage": "structural-synthetic-pretrain",
        "productionReady": False,
        "syntheticPretraining": True,
        "evidence": ckpt["evidence"],
    })
    manifest.write_text(json.dumps(data, indent=2) + "\n")
    print(f"tagged synthetic-only checkpoint: {path}")


if __name__ == "__main__":
    main()
