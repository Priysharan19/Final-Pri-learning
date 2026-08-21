# PRI native handwriting models

This directory is intentionally empty of model weights in source until a real writer-separated V2 corpus has produced a trained **and calibration-backed** Core ML export.

Expected production candidate name:

`PriInkOnline.mlpackage`

Generate it with `tools/ink-native-train/export_coreml.py` only after training and locked calibration. Do not add placeholder/random weights: the runtime treats model absence as normal and falls back to the existing structural recognizer.
