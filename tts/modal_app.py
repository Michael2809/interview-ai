"""
Recrewt AI — VoxCPM2 text-to-speech service on Modal.

Why this exists
---------------
The interview previously used the browser's `window.speechSynthesis`, whose
voice ships with the candidate's operating system. A Mac candidate heard
"Samantha", a Windows candidate heard Microsoft Zira, a Linux candidate might
hear nothing at all. This service replaces that with one consistent, natural
voice for every candidate on every device.

Privacy
-------
VoxCPM2 is Apache-2.0 and runs entirely inside this container. Weights are
downloaded once from HuggingFace into a Modal Volume; after that no text ever
leaves this infrastructure. Nothing is sent to OpenBMB or any TTS vendor.

`load_denoiser=False` is deliberate: the denoiser pulls a model from
ModelScope, which we do not need for text-to-speech and would rather not add
as a dependency.

Deploy
------
    modal secret create recrewt-tts-auth AUTH_TOKEN=<long random string>
    modal deploy tts/modal_app.py
"""

from __future__ import annotations

import io
import os

import modal

APP_NAME = "recrewt-tts"

# VoxCPM2: 2B params, ~8 GB VRAM, 48 kHz, 30 languages.
# See tts/README.md for why this variant over VoxCPM1.5 / VoxCPM-0.5B.
MODEL_ID = "openbmb/VoxCPM2"

# Weights live in a Volume so a cold container mounts them rather than
# re-downloading several GB from HuggingFace on every start.
WEIGHTS_DIR = "/weights"
weights_volume = modal.Volume.from_name("voxcpm-weights", create_if_missing=True)

# The chosen interviewer voice clip. Generated once via tts/design_voice.py,
# then cloned from for every question — Voice Design output varies between
# runs, cloning from a fixed clip does not.
VOICE_DIR = "/voice"
voice_volume = modal.Volume.from_name("recrewt-voice", create_if_missing=True)
REFERENCE_WAV = f"{VOICE_DIR}/interviewer.wav"
REFERENCE_TXT = f"{VOICE_DIR}/interviewer.txt"

# Used only if no reference voice has been chosen yet, so the endpoint still
# works end-to-end before design_voice.py has been run.
DEFAULT_VOICE_DESCRIPTION = (
    "A warm, professional woman in her early thirties, calm and clear"
)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install("voxcpm", "soundfile", "numpy", "fastapi[standard]")
    .env({"HF_HOME": WEIGHTS_DIR})
)

# fastapi only exists inside the image, not on the machine running
# `modal deploy`. image.imports() defers these to container runtime.
#
# NOTE: do NOT use fastapi's Depends(...) as a default argument on the
# endpoints below. Default arguments are evaluated when the class body is
# executed, which happens LOCALLY during `modal deploy` — before this block
# has ever run — and deploy fails with NameError. We read the Authorization
# header off the Request instead. `from __future__ import annotations` at the
# top keeps the `Request` annotation itself lazy for the same reason.
with image.imports():
    from fastapi import HTTPException, Request, Response, status

app = modal.App(APP_NAME)


@app.cls(
    image=image,
    # L4: 24 GB VRAM, Ada architecture so bfloat16 is native (VoxCPM2 runs in
    # bf16). Roughly half the hourly cost of an A10G for this workload.
    gpu="L4",
    volumes={WEIGHTS_DIR: weights_volume, VOICE_DIR: voice_volume},
    secrets=[modal.Secret.from_name("recrewt-tts-auth")],
    # COST-CRITICAL. You pay for every second the container is alive, not just
    # the seconds it spends generating. This was originally 300s, which meant
    # five minutes of idle GPU billed after every single audition session —
    # that alone consumed most of a $1 credit allowance during voice testing.
    #
    # 60s keeps a batch of questions on one warm container (they arrive
    # back-to-back) while cutting idle waste fivefold. Lower it further if you
    # only ever pre-generate; raise it only if you see cold starts hurting
    # live follow-ups.
    scaledown_window=60,
    timeout=600,
)
class VoxCPMService:
    @modal.enter()
    def load_model(self):
        """Runs once per container, not per request."""
        from voxcpm import VoxCPM

        os.environ["HF_HOME"] = WEIGHTS_DIR
        self.model = VoxCPM.from_pretrained(MODEL_ID, load_denoiser=False)
        self.sample_rate = self.model.tts_model.sample_rate
        print(f"VoxCPM2 loaded. Sample rate: {self.sample_rate} Hz")

    # -- helpers -------------------------------------------------------

    def _wav_bytes(self, wav):
        import soundfile as sf

        buffer = io.BytesIO()
        sf.write(buffer, wav, self.sample_rate, format="WAV")
        buffer.seek(0)
        return buffer.read()

    def _mp3_bytes(self, wav):
        """Encode to MP3 before sending it over the network.

        WHY THIS MATTERS. VoxCPM2 outputs 48 kHz 16-bit mono WAV — roughly
        96 KB per SECOND of speech, so a typical interview question is ~290 KB
        uncompressed. Candidates on phone tethering or poor mobile data stall
        downloading that, and a stalled <audio> makes play() hang forever with
        no error. The first version of this service shipped raw WAV and that is
        exactly what happened in testing.

        Mono speech at 64 kbps is perceptually transparent and about six times
        smaller. ffmpeg is already in the image.
        """
        import subprocess

        wav_bytes = self._wav_bytes(wav)
        try:
            proc = subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-i", "pipe:0",
                    "-vn", "-ac", "1", "-b:a", "64k",
                    "-f", "mp3", "pipe:1",
                ],
                input=wav_bytes,
                capture_output=True,
                timeout=60,
                check=True,
            )
            if proc.stdout:
                return proc.stdout, "audio/mpeg"
        except Exception as exc:  # noqa: BLE001 - never fail a request over this
            print(f"mp3 encode failed, serving wav instead: {exc}")

        # Falling back to WAV is worse for the candidate but still works.
        return wav_bytes, "audio/wav"

    def _authorize(self, request):
        header = request.headers.get("authorization", "")
        scheme, _, credentials = header.partition(" ")
        if scheme.lower() != "bearer" or credentials != os.environ["AUTH_TOKEN"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def _generate(self, text, cfg_value, inference_timesteps):
        """Synthesize `text` in the chosen interviewer voice."""
        kwargs = {
            "text": text,
            "cfg_value": cfg_value,
            "inference_timesteps": inference_timesteps,
        }

        if os.path.exists(REFERENCE_WAV):
            kwargs["reference_wav_path"] = REFERENCE_WAV
            # Reference audio plus its transcript gives the highest fidelity
            # clone ("ultimate cloning" in the VoxCPM docs).
            if os.path.exists(REFERENCE_TXT):
                with open(REFERENCE_TXT) as f:
                    prompt_text = f.read().strip()
                if prompt_text:
                    kwargs["prompt_wav_path"] = REFERENCE_WAV
                    kwargs["prompt_text"] = prompt_text
        else:
            kwargs["text"] = f"({DEFAULT_VOICE_DESCRIPTION}){text}"

        return self.model.generate(**kwargs)

    # -- endpoints -----------------------------------------------------

    @modal.fastapi_endpoint(method="POST", docs=False)
    def synthesize(self, item: dict, request: Request):
        """Called by the interview app. Returns audio/wav bytes."""
        self._authorize(request)

        text = (item or {}).get("text", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="`text` is required")
        if len(text) > 2000:
            raise HTTPException(
                status_code=400, detail="`text` exceeds 2000 characters"
            )

        wav = self._generate(
            text,
            cfg_value=float((item or {}).get("cfg_value", 2.0)),
            inference_timesteps=int((item or {}).get("inference_timesteps", 10)),
        )
        # MP3, not WAV — see _mp3_bytes for why this matters on mobile data.
        audio, media_type = self._mp3_bytes(wav)
        return Response(content=audio, media_type=media_type)

    @modal.fastapi_endpoint(method="POST", docs=False)
    def design(self, item: dict, request: Request):
        """Audition a described voice. Used by tts/design_voice.py only."""
        self._authorize(request)

        description = (item or {}).get("description", "").strip()
        text = (item or {}).get("text", "").strip()
        if not description or not text:
            raise HTTPException(
                status_code=400,
                detail="`description` and `text` are both required",
            )

        wav = self.model.generate(
            text=f"({description}){text}",
            cfg_value=float((item or {}).get("cfg_value", 2.0)),
            inference_timesteps=int((item or {}).get("inference_timesteps", 10)),
        )
        return Response(content=self._wav_bytes(wav), media_type="audio/wav")

    @modal.fastapi_endpoint(method="POST", docs=False)
    def clone(self, item: dict, request: Request):
        """Synthesize text in the voice of a SUPPLIED reference clip.

        WHY THIS EXISTS. /design invents a new voice from a description on
        every call — the model card is explicit that "Voice Design results may
        vary between runs". That is fine for auditioning, and completely wrong
        for rendering a script: ten calls produce ten different speakers
        reading consecutive lines.

        Rendering a multi-line voiceover must clone ONE fixed clip. This
        endpoint takes that clip as base64 so the caller can pin any audition
        sample as the voice, without disturbing the saved interviewer voice on
        the volume.
        """
        import base64
        import tempfile

        self._authorize(request)

        text = (item or {}).get("text", "").strip()
        ref_b64 = (item or {}).get("reference_wav_b64", "")
        if not text or not ref_b64:
            raise HTTPException(
                status_code=400,
                detail="`text` and `reference_wav_b64` are both required",
            )

        try:
            ref_bytes = base64.b64decode(ref_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="reference_wav_b64 is not valid base64")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(ref_bytes)
            ref_path = f.name

        base = {
            "text": text,
            "cfg_value": float((item or {}).get("cfg_value", 2.0)),
            "inference_timesteps": int((item or {}).get("inference_timesteps", 10)),
        }
        prompt_text = (item or {}).get("reference_text", "").strip()

        # Try progressively simpler cloning modes.
        #
        # "Ultimate cloning" (reference + its transcript) gives the best match,
        # but VoxCPM compares target-text length against the reference and
        # rejects pairs it considers badly matched. A very short line — "One
        # open role." against a ~7s reference — trips that check and raises,
        # which surfaced as a 500 on exactly one line of the script every time.
        #
        # Falling back to reference-only cloning keeps the same voice; it just
        # forgoes the transcript alignment. Better a marginally less precise
        # clone than a missing line.
        attempts = []
        if prompt_text:
            attempts.append(
                dict(base, reference_wav_path=ref_path,
                     prompt_wav_path=ref_path, prompt_text=prompt_text)
            )
        attempts.append(dict(base, reference_wav_path=ref_path))

        wav, last_error = None, None
        for i, kwargs in enumerate(attempts):
            try:
                wav = self.model.generate(**kwargs)
                if i > 0:
                    print(f"clone: fell back to mode {i} for text={text[:40]!r}")
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                print(f"clone: mode {i} failed for text={text[:40]!r}: {exc}")

        try:
            os.unlink(ref_path)
        except OSError:
            pass

        if wav is None:
            raise HTTPException(
                status_code=500,
                detail=f"All cloning modes failed: {last_error}",
            )
        return Response(content=self._wav_bytes(wav), media_type="audio/wav")

    @modal.method()
    def save_reference(self, wav_bytes: bytes, transcript: str):
        """Promote an auditioned clip to THE interviewer voice."""
        os.makedirs(VOICE_DIR, exist_ok=True)
        with open(REFERENCE_WAV, "wb") as f:
            f.write(wav_bytes)
        with open(REFERENCE_TXT, "w") as f:
            f.write(transcript)
        voice_volume.commit()
        return {"saved": REFERENCE_WAV, "transcript_chars": len(transcript)}
