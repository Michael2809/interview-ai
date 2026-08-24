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


MIN_GAP = 0.30  # breathing room between lines when a cue has to slide


def trailing_silence(path, thresh_db=-45, min_dur=0.08):
    """Seconds of silence after the last word. TTS pads every clip."""
    import re

    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
         "-af", f"silencedetect=n={thresh_db}dB:d={min_dur}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", proc.stderr)]
    if not starts:
        return 0.0
    total = duration_of(path)
    # Only counts if the final silence actually runs to the end of the file.
    return total - starts[-1] if starts[-1] > total - 1.5 else 0.0


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

    # -- plan the timeline ---------------------------------------------
    #
    # Two things happen here, and the order matters.
    #
    # 1. TRAILING SILENCE IS TRIMMED. Every clip came back with 0.14-0.28s of
    #    padding after the last word. Left in, it counts against the line's
    #    window and forces cues to move further than they need to.
    #
    # 2. CUES SLIDE ONLY WHEN THEY MUST. Each line starts at its storyboard cue
    #    unless the previous line is still speaking, in which case it waits for
    #    a short gap. Shots here hold still for seconds at a time, so a line
    #    arriving a second or two late still lands on the shot it was written
    #    for — far less visible than speeding the voice up.
    durs = []
    for clip in clips:
        raw = duration_of(clip)
        durs.append(max(0.2, raw - trailing_silence(clip)))

    cues, prev_end = [], 0.0
    for i, (cue, d) in enumerate(zip(CUES, durs)):
        start = cue if i == 0 else max(cue, prev_end + MIN_GAP)
        cues.append(start)
        prev_end = start + d
    # The last line must finish inside the film.
    if cues[-1] + durs[-1] > total:
        cues[-1] = total - durs[-1] - 0.05

    print(f"  {'line':<5}{'speech':<9}{'cue':<9}{'shift':<9}{'ends'}")
    for i, (clip, d) in enumerate(zip(clips, durs)):
        shift = cues[i] - CUES[i]
        mark = "" if abs(shift) < 0.01 else f"  <- moved"
        print(f"  {i+1:<5}{d:<9.2f}{cues[i]:<9.2f}{shift:<+9.2f}{cues[i]+d:.2f}{mark}")

    clashes = [i for i in range(len(cues) - 1) if cues[i] + durs[i] > cues[i + 1] + 0.01]
    if clashes:
        print(f"\n  OVERLAP on lines: {[i+1 for i in clashes]}")
    else:
        print(f"\n  No overlaps. Last line ends {cues[-1]+durs[-1]:.2f}s of {total:.1f}s.")

    # -- build the filter graph ---------------------------------------
    inputs = ["-i", str(video)]
    for clip in clips:
        inputs += ["-i", str(clip)]

    parts = []
    labels = []
    for i, _ in enumerate(clips):
        stream = i + 1                       # input 0 is the video
        delay_ms = int(round(cues[i] * 1000))
        parts.append(
            # atrim removes the trailing padding; adelay places the line on the
            # timeline at its computed cue.
            f"[{stream}:a]atrim=0:{durs[i]:.4f},asetpts=N/SR/TB,"
            f"aresample=48000,aformat=channel_layouts=stereo,"
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
