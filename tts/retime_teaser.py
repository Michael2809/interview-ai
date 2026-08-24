"""
Retime the picture so the voiceover never has to rush.

Usage
-----
    python tts/retime_teaser.py <video.mp4> <vo_folder> <output.mp4>

The idea
--------
Three lines of the voiceover run past their cue and several others finish far
too early. Rather than speeding the voice up (which is instantly audible) or
slowing whole shots (which makes motion graphics feel sluggish), this borrows
time between HOLDS — stretches of picture where nothing is moving.

A still frame stretched or compressed is visually identical, so the edits
cannot be seen. Time removed from generous holds is given to tight ones, so the
film stays exactly its original length and the music never has to be stretched.

Every edit region below was found by measuring frame-to-frame scene change on
the actual cut, not guessed.
"""

import json
import subprocess
import sys
from pathlib import Path

# (start, end, new_duration) — all regions verified still.
# Negative net = time freed, positive = time consumed. They must balance.
EDITS = [
    # --- give time back (over-generous holds) -------------------------
    (0.80, 1.53, 0.33),    # after "One open role." — long silent hold
    (2.23, 2.77, 0.24),
    (6.33, 7.40, 0.47),    # before the counter shot resolves
    (9.73, 15.00, 4.67),   # line 3 has 1.6s spare
    (47.23, 47.93, 0.40),  # line 8 uses only 3.8s of a 7.0s window
    (48.00, 49.50, 0.70),
    # --- take time (tight lines) --------------------------------------
    (25.13, 29.00, 4.41),  # line 5: needs +0.24s, given 0.54s
    (38.43, 39.30, 1.57),  # line 7 needs +1.80s, spread over three holds
    (40.33, 41.13, 1.50),
    (41.20, 42.03, 1.53),
    (57.43, 61.47, 4.40),  # line 10: needs +0.22s, given 0.37s
]

ORIGINAL_CUES = [0.5, 4.5, 9.0, 15.6, 22.6, 29.4, 37.0, 43.2, 50.2, 57.4]


def duration_of(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def shifted(t, edits):
    """Where a moment in the original lands after retiming."""
    delta = 0.0
    for start, end, new_dur in edits:
        if t >= end:
            delta += new_dur - (end - start)
        elif t > start:
            # Inside an edited region: scale proportionally.
            frac = (t - start) / (end - start)
            return start + delta + frac * new_dur
    return t + delta


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    video, vo_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])

    total = duration_of(video)
    edits = sorted(EDITS)

    # Sanity: edits must not overlap, or the segment maths breaks silently.
    for a, b in zip(edits, edits[1:]):
        if a[1] > b[0]:
            sys.exit(f"Edit regions overlap: {a} and {b}")

    net = sum(new - (e - s) for s, e, new in edits)
    print(f"Source        : {total:.2f}s")
    print(f"Net time change: {net:+.2f}s  ->  {total + net:.2f}s")
    if abs(net) > 0.15:
        print("  (film length changes; music would need stretching)")

    # -- build segment list: untouched, edited, untouched, ... ---------
    segs, cursor = [], 0.0
    for start, end, new_dur in edits:
        if start > cursor:
            segs.append((cursor, start, None))     # pass through
        segs.append((start, end, new_dur))         # retimed
        cursor = end
    if cursor < total:
        segs.append((cursor, total, None))

    print(f"\nSegments      : {len(segs)}  ({len(edits)} retimed)")
    print("\nCue movement:")
    new_cues = []
    for i, cue in enumerate(ORIGINAL_CUES):
        nc = shifted(cue, edits)
        new_cues.append(round(nc, 3))
        print(f"  line {i+1:2d}  {cue:6.2f}s -> {nc:6.2f}s   ({nc - cue:+.2f})")

    # Render each segment to its own file, then concat.
    #
    # A single filter_complex with a trim per segment reads [0:v] once per
    # trim, which makes ffmpeg decode the whole input repeatedly — it stalled
    # completely on this 61s 1080p file. Extracting segments individually lets
    # each one fast-seek with -ss before -i, so the decoder only touches the
    # frames it needs.
    tmp = out.parent / (out.stem + "_segs")
    tmp.mkdir(exist_ok=True)
    for f in tmp.glob("*.mp4"):
        f.unlink()

    print("\nRendering segments…")
    seg_files = []
    for i, (start, end, new_dur) in enumerate(segs):
        src_len = end - start
        seg_path = tmp / f"{i:03d}.mp4"
        vf = "setpts=PTS-STARTPTS"
        if new_dur is not None:
            # Still picture: scaling PTS is indistinguishable from holding or
            # dropping frames, because there is no motion to smear.
            vf = f"setpts=(PTS-STARTPTS)*{new_dur / src_len:.6f}"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{start:.4f}", "-t", f"{src_len:.4f}", "-i", str(video),
            "-vf", f"{vf},fps=30", "-an",
            # veryfast at CRF 17: flat motion graphics with large areas of solid
            # colour, visually lossless, and far quicker than medium.
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-pix_fmt", "yuv420p",
            str(seg_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print(proc.stderr[-1500:])
            sys.exit(1)
        seg_files.append(seg_path)
        tag = "retimed" if new_dur is not None else "as-is  "
        print(f"  {i:02d} {tag}  {start:6.2f}-{end:6.2f}  -> {duration_of(seg_path):5.2f}s")

    listing = tmp / "list.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in seg_files))

    print("\nJoining…")
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "concat", "-safe", "0", "-i", str(listing),
         "-c", "copy", str(out)],
        capture_output=True, text=True, cwd=str(tmp),
    )
    if proc.returncode != 0:
        print(proc.stderr[-2000:])
        sys.exit(1)

    print(f"Written: {out}  ({duration_of(out):.2f}s)")

    cue_file = out.with_suffix(".cues.json")
    cue_file.write_text(json.dumps(new_cues, indent=1))
    print(f"New cues: {cue_file.name}")


if __name__ == "__main__":
    main()
