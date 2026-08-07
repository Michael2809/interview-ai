# Recrewt interviewer voice (VoxCPM2 on Modal)

Replaces the browser's `window.speechSynthesis` — whose voice came from the
candidate's operating system — with one consistent, natural voice for every
candidate on every device.

## Why VoxCPM2

| | VoxCPM2 | VoxCPM1.5 | VoxCPM-0.5B |
|---|---|---|---|
| Audio | **48 kHz** | 44.1 kHz | 16 kHz |
| Languages | **30** | en, zh | en, zh |
| VRAM | ~8 GB | ~6 GB | ~5 GB |
| RTF (RTX 4090) | ~0.30 | ~0.15 | ~0.17 |
| Voice Design | **yes** | no | no |

48 kHz is the difference between "clearly synthetic" and "sounds like a real
interviewer", which is the entire point. Voice Design lets us specify the
interviewer voice in words instead of hiring a voice actor.

Apache-2.0 on both code and weights, commercial use explicitly permitted.

## Privacy

- The model runs **inside our own Modal container**. Weights are downloaded
  once from HuggingFace; after that no text leaves our infrastructure.
- Verified no telemetry in the VoxCPM source — no outbound calls in the
  inference path.
- The denoiser is disabled (`load_denoiser=False`) because it pulls a model
  from ModelScope, which we don't need for text-to-speech.
- Question text can contain candidate personal data (see
  `/api/generate-questions-from-resume`), so cached audio lives in a
  **private** Supabase bucket served via short-lived signed URLs.
- **Modal is a new subprocessor** — it must be added to section 5 of the
  privacy policy alongside Supabase, Anthropic, Resend, Cloudinary and
  AssemblyAI.

## Setup

### 1. Modal

```bash
pip install modal
modal token new                                    # once, on your machine

# any long random string; the Next.js app uses the same value
modal secret create recrewt-tts-auth AUTH_TOKEN=<random>

modal deploy tts/modal_app.py
```

Deploy prints two URLs, one per endpoint — `...-voxcpmservice-synthesize.modal.run`
and `...-voxcpmservice-design.modal.run`.

### 2. Choose the interviewer voice

```bash
export RECREWT_TTS_TOKEN=<the AUTH_TOKEN value>
export RECREWT_TTS_URL=<the design endpoint URL>

python tts/design_voice.py audition
```

Writes one sample per candidate voice into `tts/voice_samples/`. Listen to
them, then lock in your pick:

```bash
python tts/design_voice.py choose warm_professional_woman
```

Every question from then on is **cloned** from that clip. This matters: the
VoxCPM2 model card warns that Voice Design output "may vary between runs", so
describing a voice per question would drift mid-interview. Cloning a fixed
reference does not.

To change the voice later, run `audition` again, `choose` a different one, and
bump `VOICE_VERSION` in `app/api/tts/route.js` so old cached audio in the
previous voice is superseded.

Want different options? Edit `VOICE_CANDIDATES` in `tts/design_voice.py` —
the descriptions are just plain English.

### 3. Supabase storage

Create a bucket named `interview-audio`, set to **private**. No RLS policies
are needed: the API route uses the service-role client and hands the browser a
signed URL valid for one hour.

### 4. Environment variables

Add to Vercel (and `.env.local`):

```
RECREWT_TTS_URL=<the synthesize endpoint URL>
RECREWT_TTS_TOKEN=<the AUTH_TOKEN value>
```

If either is missing the route returns 503 and the interview automatically
falls back to browser speech — nothing breaks, it just sounds like it used to.

## How it behaves

- **Caching.** Audio is keyed by `sha256(VOICE_VERSION + text)`. The same
  question is synthesized once, ever, across all candidates and roles. Repeat
  plays and the "repeat question" button cost nothing.
- **Pacing.** `audio.playbackRate = 0.95`, the same value as the old
  `utterance.rate`. Tune it in `page.js` without regenerating anything.
- **Fallback.** Any failure — service down, env vars missing, autoplay
  blocked, network error — falls back to `speechSynthesis`. The interview
  never dies because TTS is unavailable.
- **Cost.** Generation happens on cache miss and scales to zero between
  interviews. Cold start is ~60s for the 2B model, which is why the next step
  below matters.

## Recommended next step: pre-generate at invite time

Right now the first candidate to hear a given question pays the generation
cost (and possibly a cold start). Calling `/api/tts` for each question when a
role's questions are generated would warm the cache ahead of time, so no
candidate ever waits. Since nobody is watching at that point, cold starts stop
mattering entirely.
