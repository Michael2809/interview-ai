"""
Assemble the launch film: place the voiceover on the timeline, duck the music
under it, and mux everything back onto the picture.

Usage
-----
    python tts/assemble_teaser.py <video.mp4> <vo_folder> [output.mp4]

    python tts/assemble_teaser.py recrewt_launch_music_v3.mp4 \
        tts/teaser_ex2_friend_dry recrewt_launch_final.mp4

What it does, and why
---------------------
1. LAYS EACH LINE AT ITS CUE. Every NN.wav is delayed to the timestamp from the
   storyboard rather than played back to back, so the words land on the shots
   they were written for.

2. NORMALISES THE VOICE to -16 LUFS. That is the usual target for web video;
   without it the VO level depends on whatever the model happened to output.

3. DUCKS THE MUSIC UNDER THE VOICE using sidechain compression, keyed off the
   voice itself. The bed drops only while someone is speaking and comes back up
   in the gaps. This is the single thing that most separates a finished film
   from one with a voiceover laid on top — a static music level either buries
   the voice or leaves the film feeling empty between lines.

4. COPIES THE VIDEO STREAM UNTOUCHED. Only audio is re-encoded, so there is no
   generational quality loss on the picture.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

# Cue times must match TEASER_CUES in design_voice.py.
CUES = [0.5, 4.5, 9.0, 15.6, 22.6, 29.4, 37.0, 43.2, 50.2, 57.4]

VO_TARGET_LUFS = -16.0   # standard for web video narration
DUCK_RATIO = 8           # how hard the bed is pushed down under speech
DUCK_THRESHOLD = 0.05    # voice level at which ducking engages
DUCK_ATTACK_MS = 20      # fast enough not to clip the start of a word
DUCK_RELEASE_MS = 400    # slow enough that the bed does not pump between words


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("\nffmpeg failed:\n" + proc.stderr[-2500:])
        sys.exit(1)
    return proc


def duration_of(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    video = Path(sys.argv[1])
    vo_dir = Path(sys.argv[2])
    out = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("teaser_final.mp4")

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found. Install it and make sure it is on PATH.")
    if not video.exists():
        sys.exit(f"No video at {video}")

    clips = sorted(vo_dir.glob("[0-9][0-9].wav"))
    if not clips:
        sys.exit(f"No NN.wav files in {vo_dir} — run `design_voice.py render` first.")

    total = duration_of(video)
    print(f"Video : {video.name}  ({total:.2f}s)")
    print(f"Voice : {len(clips)} lines from {vo_dir.name}\n")

    # -- report fit, and warn rather than silently overlapping ---------
    overruns = []
    for i, clip in enumerate(clips):
        if i >= len(CUES):
            break
        secs = duration_of(clip)
        window = CUES[i + 1] - CUES[i] if i + 1 < len(CUES) else total - CUES[i]
        slack = window - secs
        state = "ok" if slack >= 0.25 else ("tight" if slack >= 0 else "OVER")
        print(f"  {clip.name}  {secs:5.2f}s / {window:4.1f}s  [{state}]")
        if slack < 0:
            overruns.append((clip.name, -slack))
    if overruns:
        print("\n  Lines that run past their next cue:")
        for name, over in overruns:
            print(f"    {name} by {over:.2f}s")
        print("  They will overlap the following line. Re-render or adjust cues.")

    # -- build the filter graph ---------------------------------------
    inputs = ["-i", str(video)]
    for clip in clips:
        inputs += ["-i", str(clip)]

    parts = []
    labels = []
    for i, _ in enumerate(clips):
        stream = i + 1                       # input 0 is the video
        delay_ms = int(round(CUES[i] * 1000)) if i < len(CUES) else 0
        parts.append(
            f"[{stream}:a]aresample=48000,aformat=channel_layouts=stereo,"
            f"adelay={delay_ms}|{delay_ms}[v{i}]"
        )
        labels.append(f"[v{i}]")

    # All VO lines onto one track. dropout_transition=0 stops amix from
    # rebalancing gain as clips start and stop, which would make the voice
    # audibly swell between lines.
    parts.append(
        "".join(labels)
        + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0[vomix]"
    )
    parts.append(f"[vomix]loudnorm=I={VO_TARGET_LUFS}:TP=-1.5:LRA=11[vo]")
    parts.append("[vo]asplit=2[vo_out][vo_key]")

    # Music ducked by the voice.
    parts.append("[0:a]aresample=48000,aformat=channel_layouts=stereo[music]")
    parts.append(
        f"[music][vo_key]sidechaincompress="
        f"threshold={DUCK_THRESHOLD}:ratio={DUCK_RATIO}:"
        f"attack={DUCK_ATTACK_MS}:release={DUCK_RELEASE_MS}[ducked]"
    )
    parts.append("[ducked][vo_out]amix=inputs=2:normalize=0:dropout_transition=0[mixed]")
    # apad before atrim guarantees the audio is at least as long as the picture.
    # loudnorm subtly alters duration, and without padding the mix came out
    # 0.57s short — which silently truncated the final wordmark. Never rely on
    # -shortest here for the same reason: it trims the video to match.
    parts.append(
        f"[mixed]alimiter=limit=0.97,apad,atrim=0:{total},asetpts=N/SR/TB[final]"
    )

    cmd = (
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        + inputs
        + ["-filter_complex", ";".join(parts),
           "-map", "0:v", "-map", "[final]",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
           # Explicit duration rather than -shortest, so the picture is never
           # trimmed to fit the audio.
           "-t", f"{total}", str(out)]
    )

    print("\nMixing…")
    run(cmd)

    print(f"\nWritten: {out}  ({duration_of(out):.2f}s)")
    print("Video stream copied untouched; only audio was re-encoded.")


if __name__ == "__main__":
    main()
