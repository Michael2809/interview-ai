"""
Pick the Recrewt interviewer voice.

You describe voices in plain English, this generates a sample of each, you
listen, and you promote the one you like to be THE interviewer voice. From
then on every question is cloned from that clip, so the voice is identical in
every interview, forever.

Why cloning rather than describing each time: the VoxCPM2 model card warns
that "Voice Design and Style Control results may vary between runs". Describing
a voice per question would drift the voice mid-interview. Cloning a fixed
reference clip does not.

Usage
-----
    # 1. Generate samples for every candidate voice below
    python tts/design_voice.py audition

    # 2. Listen to the .wav files written into tts/voice_samples/

    # 3. Lock in the one you liked (filename without .wav)
    python tts/design_voice.py choose warm_professional_woman

Requires:
    pip install modal requests
    modal token new                      # once, on your machine
    export RECREWT_TTS_TOKEN=<same value as the AUTH_TOKEN secret>
    export RECREWT_TTS_URL=<the .modal.run URL for the `design` endpoint>
"""

import os
import sys
from pathlib import Path

import requests

OUT_DIR = Path(__file__).parent / "voice_samples"

# The sentence every candidate voice reads, so you're comparing like with
# like. Deliberately a real interview line rather than "the quick brown fox" —
# you want to hear how it sounds saying the thing it will actually say.
SAMPLE_LINE = (
    "Thanks for joining today. To start, could you walk me through your "
    "experience and what drew you to this role?"
)

# The text itself shapes the delivery. A line written like a script gets read
# like a script. This one uses contractions, a false start, and commas placed
# where a person would actually breathe — the model picks up on all of it and
# the result sounds markedly less like narration.
SAMPLE_LINE_NATURAL = (
    "Hey, thanks for hopping on. So — I'd love to just start with you, really. "
    "Tell me a bit about what you've been working on lately, and, you know, "
    "what made this role jump out at you."
)

# For the assertive set. Still natural, but the sentences are shorter and land
# harder — a line full of soft hedges ("I'd love to just...") fights an
# assertive delivery, so the text has to carry the same intent as the voice.
SAMPLE_LINE_ASSERTIVE = (
    "Thanks for making the time. Let's get straight into it. "
    "Tell me what you've been working on, and why this role. "
    "Be specific — I'm interested in what you actually did."
)

# Per-set override. Sets not listed here use SAMPLE_LINE.
SET_SAMPLE_LINES = {
    "human": SAMPLE_LINE_NATURAL,
    "characters": SAMPLE_LINE_NATURAL,
    "assertive": SAMPLE_LINE_ASSERTIVE,
    "blend": SAMPLE_LINE_NATURAL,
}

# Voice sets. Run a whole set at once:
#     python tts/design_voice.py audition            -> the 'starter' set
#     python tts/design_voice.py audition variations -> nuances of the favourite
#     python tts/design_voice.py audition accents    -> same character, different accents
#
# Edit freely — add, remove, reword. The description is just plain English,
# so if you want something not covered here, write it and re-run.
VOICE_SETS = {
    # Five broad directions, to find which way to go.
    "starter": {
        "warm_professional_woman": (
            "A warm, professional woman in her early thirties, calm and clear, "
            "with a friendly but composed tone"
        ),
        "confident_woman": (
            "A confident woman in her late thirties, articulate and measured, "
            "with the assurance of a senior recruiter"
        ),
        "friendly_man": (
            "A friendly man in his thirties, relaxed and personable, "
            "with an easy conversational tone"
        ),
        "neutral_man": (
            "A professional man in his forties, neutral accent, steady and clear, "
            "understated and unhurried"
        ),
        "bright_young_woman": (
            "A bright young woman in her mid twenties, energetic and welcoming, "
            "warm without being casual"
        ),
    },
    # Nuances around "warm professional woman" — the winner of round one.
    # Same character, dialled differently.
    "variations": {
        "warm_slower": (
            "A warm, professional woman in her early thirties, speaking slowly "
            "and deliberately, unhurried and reassuring"
        ),
        "warm_younger": (
            "A warm, professional woman in her late twenties, bright and "
            "approachable, composed but with a little more energy"
        ),
        "warm_senior": (
            "A warm, professional woman in her early forties, experienced and "
            "assured, kind but authoritative"
        ),
        "warm_conversational": (
            "A warm, professional woman in her early thirties, natural and "
            "conversational, as if chatting across a table rather than reading"
        ),
        "warm_crisp": (
            "A warm, professional woman in her early thirties, crisp and highly "
            "articulate, every word clearly enunciated"
        ),
        "warm_reassuring": (
            "A warm, gentle woman in her early thirties, soft and calming, "
            "putting a nervous person at ease"
        ),
    },
    # Same warm professional character, different English accents. Worth
    # auditioning if you sell into specific markets.
    "accents": {
        "british_woman": (
            "A warm, professional British woman in her early thirties, "
            "refined southern English accent, calm and clear"
        ),
        "american_woman": (
            "A warm, professional American woman in her early thirties, "
            "neutral general American accent, clear and friendly"
        ),
        "indian_woman": (
            "A warm, professional Indian woman in her early thirties, "
            "clear neutral Indian English accent, articulate and composed"
        ),
        "australian_woman": (
            "A warm, professional Australian woman in her early thirties, "
            "relaxed and friendly, clear and personable"
        ),
        "canadian_woman": (
            "A warm, professional Canadian woman in her early thirties, "
            "neutral North American accent, gentle and welcoming"
        ),
    },
    # Aimed squarely at sounding like a PERSON rather than a narrator.
    # These descriptions ask for the imperfections real speech has:
    # breath, hesitation, uneven rhythm, relaxed enunciation.
    "human": {
        "natural_thinking": (
            "A woman in her thirties speaking naturally and spontaneously, "
            "thinking as she talks, with small hesitations and audible breaths, "
            "not reading from a script"
        ),
        "relaxed_videocall": (
            "A relaxed woman in her early thirties on a casual video call, "
            "informal and unpolished, uneven natural rhythm, sometimes "
            "trailing off slightly at the end of a sentence"
        ),
        "soft_close_mic": (
            "A softly spoken woman in her early thirties, close to the "
            "microphone, breathy and intimate, gentle and quiet as if speaking "
            "to one person in a quiet room"
        ),
        "husky_natural": (
            "A woman in her mid thirties with a slightly husky, textured voice, "
            "warm and lived-in, unhurried, speaking casually rather than "
            "performing"
        ),
        "friendly_guy_natural": (
            "A man in his early thirties speaking casually and naturally, "
            "relaxed and a little informal, with the easy rhythm of real "
            "conversation and the occasional breath"
        ),
        "understated_man": (
            "A quietly spoken man in his late thirties, understated and calm, "
            "low energy in a comfortable way, speaking softly and unhurriedly"
        ),
    },
    # Genuinely different people — nothing like the warm professional woman.
    # Some of these may be too much character for an interviewer, but they
    # show the range and one might surprise you.
    "characters": {
        "older_gentleman": (
            "A gentle man in his sixties with a soft gravelly voice, "
            "grandfatherly and kind, slow and thoughtful, quietly sharp"
        ),
        "deep_calm_man": (
            "A man with a deep, resonant, very calm voice, slow and steady, "
            "soothing and grounded, like a late-night radio host"
        ),
        "irish_woman": (
            "A woman in her thirties with a soft Irish lilt, musical and warm, "
            "friendly and natural"
        ),
        "scottish_man": (
            "A man in his forties with a gentle Scottish accent, warm and "
            "straightforward, relaxed and personable"
        ),
        "earnest_young_man": (
            "An earnest young man in his mid twenties, thoughtful and sincere, "
            "a little understated, genuinely curious"
        ),
        "smoky_woman": (
            "A woman in her forties with a low, smoky, slightly raspy voice, "
            "confident and unhurried, dry and warm"
        ),
    },
    # All female, all assertive — the register of a senior hiring manager:
    # direct, decisive, in control, but not cold. Several also carry the
    # natural/imperfect qualities from the 'human' set, since assertive and
    # human are not opposites.
    "assertive": {
        "assertive_warm": (
            "A confident woman in her mid thirties, assertive and direct, "
            "speaking with easy authority, warm but clearly in charge"
        ),
        "assertive_crisp": (
            "A decisive woman in her thirties, crisp and precise, gets straight "
            "to the point, confident and efficient without being cold"
        ),
        "assertive_executive": (
            "A senior executive woman in her early forties, commanding and "
            "measured, calm authority, the person who runs the room"
        ),
        "assertive_natural": (
            "A confident, assertive woman in her thirties speaking naturally "
            "and conversationally, direct and self-assured, with the small "
            "hesitations and breaths of real speech"
        ),
        "assertive_dry": (
            "A confident woman in her late thirties with a dry, slightly wry "
            "delivery, understated authority, direct and unbothered"
        ),
        "assertive_low": (
            "A woman in her thirties with a lower-pitched, grounded voice, "
            "firm and steady, calm and definite, quietly forceful"
        ),
        "assertive_driven": (
            "A driven woman in her early thirties, energetic and assertive, "
            "brisk and purposeful, engaged and clearly leading the conversation"
        ),
    },
    # THE BLEND SET.
    # Target: the timbre of 'warm_conversational' with the pauses and tonality
    # of 'natural_thinking'.
    #
    # Two levers are pulled here, not one:
    #   1. Descriptions merge both characters explicitly.
    #   2. All of these render the NATURAL sample line. 'warm_conversational'
    #      was originally generated against the scripted line, which is a large
    #      part of why it came out evenly paced — the model mirrors the shape of
    #      the text it is given.
    "blend": {
        "blend_base": (
            "A warm, professional woman in her early thirties, natural and "
            "conversational as if chatting across a table, thinking as she "
            "speaks, with small natural pauses"
        ),
        "blend_more_pauses": (
            "A warm, professional woman in her early thirties speaking "
            "spontaneously and unhurriedly, pausing to think mid-sentence, "
            "with audible breaths and uneven natural rhythm"
        ),
        "blend_thinking_led": (
            "A woman in her early thirties thinking aloud as she talks, warm "
            "and conversational, hesitating slightly before some words, "
            "relaxed and completely unscripted"
        ),
        "blend_softer": (
            "A warm, gentle woman in her early thirties, conversational and "
            "unhurried, soft natural delivery with thoughtful pauses and light "
            "breaths between phrases"
        ),
        "blend_assertive": (
            "A warm, confident woman in her early thirties, conversational and "
            "direct, thinking as she speaks with natural pauses, self-assured "
            "and clearly leading the conversation"
        ),
    },
}

DEFAULT_SET = "starter"


def _config():
    url = os.environ.get("RECREWT_TTS_URL")
    token = os.environ.get("RECREWT_TTS_TOKEN")
    if not url or not token:
        sys.exit(
            "Set RECREWT_TTS_URL and RECREWT_TTS_TOKEN first.\n"
            "  RECREWT_TTS_URL   the .modal.run URL of the `design` endpoint\n"
            "  RECREWT_TTS_TOKEN the AUTH_TOKEN value from your Modal secret"
        )
    return url.rstrip("/"), token


def audition(set_name=DEFAULT_SET):
    if set_name not in VOICE_SETS:
        sys.exit(
            f"No voice set called '{set_name}'.\n"
            f"Available sets: {', '.join(VOICE_SETS)}"
        )
    candidates = VOICE_SETS[set_name]
    sample_line = SET_SAMPLE_LINES.get(set_name, SAMPLE_LINE)

    url, token = _config()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(candidates)} voice samples from the '{set_name}' set.")
    print("If the container is cold the first one takes a minute; the rest are quick.\n")

    for name, description in candidates.items():
        target = OUT_DIR / f"{name}.wav"
        print(f"  {name} ... ", end="", flush=True)
        try:
            response = requests.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={"description": description, "text": sample_line},
                timeout=300,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"FAILED ({exc})")
            continue
        target.write_bytes(response.content)
        # Store the transcript PER SAMPLE, not once per run. Different sets
        # use different sample lines, so a single shared file would attach the
        # wrong transcript to a voice from an earlier set — which would quietly
        # degrade the clone, since cloning uses the transcript to align.
        (OUT_DIR / f"{name}.txt").write_text(sample_line, encoding="utf-8")
        print(f"{len(response.content) // 1024} KB")

    print(f"\nSamples written to {OUT_DIR}")
    print("Listen, then run:  python tts/design_voice.py choose <name>")


def custom(name, description, line):
    """Generate one voice from a description typed on the command line.

    Lets you iterate on wording without editing this file. The result lands in
    voice_samples/ like any other sample, so `choose <name>` works on it.
    """
    url, token = _config()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"  description : {description}")
    print(f"  line        : {line}")
    print(f"  {name} ... ", end="", flush=True)

    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json={"description": description, "text": line},
            timeout=300,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        sys.exit(f"FAILED ({exc})")

    (OUT_DIR / f"{name}.wav").write_bytes(response.content)
    (OUT_DIR / f"{name}.txt").write_text(line, encoding="utf-8")
    print(f"{len(response.content) // 1024} KB")
    print(f"\nWritten to {OUT_DIR / f'{name}.wav'}")


def choose(name):
    import modal

    wav_path = OUT_DIR / f"{name}.wav"
    if not wav_path.exists():
        available = sorted(p.stem for p in OUT_DIR.glob("*.wav"))
        sys.exit(
            f"No sample called '{name}'.\n"
            f"Available: {', '.join(available) if available else '(none — run audition first)'}"
        )

    # Prefer the per-sample transcript; fall back to the shared file written
    # by older versions of this script, then to the default line.
    transcript_path = OUT_DIR / f"{name}.txt"
    legacy_path = OUT_DIR / "sample_line.txt"
    if transcript_path.exists():
        transcript = transcript_path.read_text(encoding="utf-8").strip()
    elif legacy_path.exists():
        transcript = legacy_path.read_text(encoding="utf-8").strip()
    else:
        transcript = SAMPLE_LINE

    service = modal.Cls.from_name("recrewt-tts", "VoxCPMService")()
    result = service.save_reference.remote(wav_path.read_bytes(), transcript)
    print(f"Interviewer voice set to '{name}'.")
    print(f"  {result}")
    print("\nEvery question from now on will be cloned from this clip.")
    print("To change it later, run audition again and choose a different one.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    command = sys.argv[1]
    if command == "audition":
        audition(sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SET)
    elif command == "custom":
        # Fine-tune without editing the file:
        #   python tts/design_voice.py custom mytake "A warm woman who..."
        #   python tts/design_voice.py custom mytake "A warm woman who..." "Line to read"
        if len(sys.argv) < 4:
            sys.exit(
                'Usage: python tts/design_voice.py custom <name> "<description>" '
                '["<line to read>"]'
            )
        custom(
            sys.argv[2],
            sys.argv[3],
            sys.argv[4] if len(sys.argv) > 4 else SAMPLE_LINE_NATURAL,
        )
    elif command == "sets":
        for name, voices in VOICE_SETS.items():
            print(f"{name} ({len(voices)} voices)")
            for voice in voices:
                print(f"    {voice}")
    elif command == "choose":
        if len(sys.argv) < 3:
            sys.exit("Usage: python tts/design_voice.py choose <name>")
        choose(sys.argv[2])
    else:
        sys.exit(f"Unknown command '{command}'. Use 'audition' or 'choose'.")
