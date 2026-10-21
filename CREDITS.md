# Español Diario — credits

Course content (vocabulary, dialogues, exercises) and app code were written for this project.

Open-source components bundled here:

- **Speech scoring model** — NVIDIA NeMo `stt_es_fastconformer_hybrid_large_pc` (CTC branch, int8 ONNX export by k2-fsa/sherpa-onnx). License: CC-BY-4.0.
- **Voices** — Piper TTS voices `es_MX-claude-high` (dataset license Apache-2.0) and `es_MX-ald-medium` (dataset license Unlicense), via k2-fsa/sherpa-onnx.
- **Runtime** — onnxruntime-web 1.30.0 (MIT).
- **Spaced repetition** — FSRS v4.5 default parameters (open-spaced-repetition, MIT).
