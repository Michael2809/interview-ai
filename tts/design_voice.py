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

import base64
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
    # 'teaser' is resolved at runtime from tts/teaser_script.txt — see
    # resolve_sample_line(). Auditioning on placeholder copy is misleading:
    # the model mirrors the shape of the text it is given, so a voice judged
    # on a generic line can sound wrong reading the real script.
}

# Put the actual teaser voiceover script here, one line per shot/beat.
TEASER_SCRIPT_PATH = Path(__file__).parent / "teaser_script.txt"

# Used only if teaser_script.txt is missing, so the set still runs.
TEASER_FALLBACK = (
    "Hiring is messy. It doesn't have to be. "
    "Recrewt interviews every candidate, and gives your team the evidence to "
    "decide."
)


def resolve_sample_line(set_name):
    """The line a voice set reads while being auditioned."""
    if set_name in ("teaser", "saas", "teaser_calm", "vo", "explainer", "bright"):
        if TEASER_SCRIPT_PATH.exists():
            text = TEASER_SCRIPT_PATH.read_text(encoding="utf-8").strip()
            if text:
                # Audition on the opening beats only. Enough to judge the
                # voice, short enough to keep each sample quick and cheap.
                return " ".join(text.splitlines()[:4]).strip()
        return TEASER_FALLBACK
    return SET_SAMPLE_LINES.get(set_name, SAMPLE_LINE)

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
    # Voiceover for the product teaser film. A DIFFERENT job from the
    # interviewer voice: that one talks TO one nervous person, this one narrates
    # a brand to an audience. Slower, more composed, more space between phrases.
    #
    # Direction follows the brand book: restraint reads as confidence, order is
    # the product. Understated, never hyped — the film should feel like it is
    # letting the visuals lead rather than selling over the top of them.
    # PRIMARY: matches the script's own direction note — "energetic, warm,
    # confident, not hyped/shouty, natural pace, not rushed". That brief was
    # written against actual shots, so it outranks a generic tone preference.
    #
    # The hard part is "energetic but not hyped". Every description below says
    # what to avoid as well as what to do, because models drift toward
    # advertising-voice the moment you ask for energy.
    "teaser": {
        # --- female ---
        "vo_f_warm_confident": (
            "A woman in her early thirties narrating a product film, warm and "
            "confident, engaged and genuinely interested, natural pace, "
            "never salesy or over-excited"
        ),
        "vo_f_bright_direct": (
            "A woman in her early thirties narrating with bright clarity and "
            "easy confidence, articulate and direct, upbeat but completely "
            "controlled, never breathless"
        ),
        "vo_f_conversational": (
            "A woman in her thirties telling you about something she thinks is "
            "genuinely good, relaxed and natural, warm and unforced, like "
            "talking rather than presenting"
        ),
        "vo_f_low_assured": (
            "A woman in her late thirties with a low, grounded voice, warm and "
            "certain, understated confidence, unhurried but not slow"
        ),
        # --- male ---
        "vo_m_warm_confident": (
            "A man in his early thirties narrating a product film, warm and "
            "confident, engaged and genuinely interested, natural pace, "
            "never salesy or over-excited"
        ),
        "vo_m_conversational": (
            "A man in his thirties telling you about something he thinks is "
            "genuinely good, relaxed and natural, warm and unforced, like "
            "talking rather than presenting"
        ),
        "vo_m_deep_warm": (
            "A man in his late thirties with a deep, warm voice, assured and "
            "friendly, steady natural pace, grounded without being sleepy"
        ),
        "vo_m_bright_direct": (
            "A man in his early thirties, clear and direct, quick-witted and "
            "engaged, energetic but precise, never shouty"
        ),
    },
    # SaaS product-launch register — the Linear / Stripe / Vercel film voice.
    #
    # The key insight, learned the hard way: energy here comes from TEMPO and
    # ARTICULATION, not from enthusiasm. The word "warm" is deliberately absent
    # from every description below — warm reads as friendly, friendly reads as
    # an ad-read. This voice is cool-toned and matter-of-fact; it explains
    # something genuinely clever at a brisk clip and lets the product be the
    # exciting part. Every entry names what to avoid, because models slide
    # straight into advertising inflection the moment you ask for energy.
    "saas": {
        # --- female ---
        "saas_f_crisp": (
            "A woman in her early thirties presenting a technology product, "
            "crisp and precisely articulated, brisk and matter-of-fact, "
            "informative rather than persuasive, no advertising inflection"
        ),
        "saas_f_momentum": (
            "A woman in her early thirties speaking with forward momentum, "
            "quick and sharp but perfectly clear, energised by the ideas "
            "themselves, never breathless and never selling"
        ),
        "saas_f_explainer": (
            "A woman in her thirties explaining something clever to a smart "
            "colleague, engaged and direct, confident and factual, the tone of "
            "someone who assumes you will get it, never pitching"
        ),
        "saas_f_cool": (
            "A woman in her early thirties, cool and controlled, understated "
            "confidence, clean precise delivery with no emotional colour, "
            "letting the facts carry the weight"
        ),
        # --- male ---
        "saas_m_crisp": (
            "A man in his early thirties presenting a technology product, "
            "crisp and precisely articulated, brisk and matter-of-fact, "
            "informative rather than persuasive, no advertising inflection"
        ),
        "saas_m_momentum": (
            "A man in his early thirties speaking with forward momentum, "
            "quick and sharp but perfectly clear, energised by the ideas "
            "themselves, never breathless and never selling"
        ),
        "saas_m_explainer": (
            "A man in his thirties explaining something clever to a smart "
            "colleague, engaged and direct, confident and factual, the tone of "
            "someone who assumes you will get it, never pitching"
        ),
        "saas_m_cool": (
            "A man in his early thirties, cool and controlled, understated "
            "confidence, clean precise delivery with no emotional colour, "
            "letting the facts carry the weight"
        ),
    },
    # FEMALE-ONLY SaaS explainer voiceover. This is the live set for the launch
    # film — earlier sets are kept only for reference.
    #
    # Three rules learned across the previous rounds, applied to every entry:
    #
    #  1. Ask for imperfection explicitly. Naturalness is breaths, hesitation
    #     and uneven rhythm. A clean read sounds synthetic no matter how good
    #     the timbre.
    #  2. Say "downward inflection at the end of sentences". This is the single
    #     most effective anti-advertising instruction — rising ends are what
    #     make a read sound like it is selling.
    #  3. Name what to avoid. Models drift into ad-voice the moment energy is
    #     requested, so every description forbids it directly.
    #
    # The options differ along real axes — pitch, texture, pace, mic proximity,
    # polish — rather than being restatements of one idea.
    "vo": {
        "vo1_crisp_explainer": (
            "A woman in her early thirties explaining something she built, "
            "speaking not reading, crisp consonants and a brisk pace, "
            "matter-of-fact with downward inflection at the end of sentences, "
            "small natural hesitations and audible breaths, throws away the "
            "less important words, no advertising inflection, no smile in the "
            "voice"
        ),
        "vo2_husky_lowkey": (
            "A woman in her mid thirties with a slightly husky, textured "
            "voice, low-key and dry, explaining rather than presenting, "
            "relaxed and unforced with uneven natural rhythm, understated "
            "confidence, never selling, never rising at the end of sentences"
        ),
        "vo3_close_mic": (
            "A woman in her early thirties close to the microphone, speaking "
            "quietly as if to one person, breathy and intimate, thinking as "
            "she speaks with small pauses, emphasis only on the word that "
            "carries the meaning, downward inflection at the end of sentences, "
            "not performed, no emotional colour"
        ),
        "vo4_low_grounded": (
            "A woman in her late thirties with a low, grounded voice, calm "
            "and certain, precisely articulated but completely unforced, "
            "downward inflection throughout, assumes the listener is smart, "
            "no advertising inflection"
        ),
        "vo5_quick_sharp": (
            "A woman in her early thirties speaking quickly and sharply but "
            "with perfect clarity, forward momentum, energised by the ideas "
            "themselves rather than by enthusiasm, clipped and factual, "
            "never breathless, never pitching, never rising at the end of sentences"
        ),
        "vo6_dry_throwaway": (
            "A woman in her thirties with a dry, wry delivery, understated "
            "and slightly amused, throws lines away rather than landing them, "
            "relaxed and conversational, downward inflection at the end of "
            "sentences, no smile in the voice, never selling"
        ),
        "vo7_thinking_aloud": (
            "A woman in her early thirties thinking aloud as she talks, "
            "genuinely unscripted, hesitating slightly before some words, "
            "audible breaths and irregular pacing, warm intelligence without "
            "any performance, not reading from a script, never selling, downward "
            "inflection at the end of sentences"
        ),
        "vo8_precise_clear": (
            "A woman in her early thirties, precisely articulated and very "
            "clear, controlled and elegant, brisk but unhurried, factual and "
            "informative, downward inflection at the end of sentences, no "
            "advertising inflection"
        ),
    },
    # THE TARGET, from VO industry guidance on explainer narration:
    #
    #   "sounds like a friend who happens to know exactly what they are talking
    #    about — not a salesperson, not a corporate narrator, not a teacher"
    #
    # Those three negatives diagnose the three sets that missed before this one:
    #   - "warm and friendly"            -> salesperson
    #   - "calm, editorial, premium"     -> corporate narrator
    #   - "informative, explaining"      -> teacher
    #
    # So every description below states the target AND names all three failure
    # modes explicitly. The second finding that shapes these: good explainer VO
    # is not uniformly flat. It sits low and lifts slightly only where the
    # content earns it. A completely level read is the other way to sound
    # synthetic.
    #
    # One concept, six real variations — not six restatements.
    "explainer": {
        "ex1_friend_who_knows": (
            "A woman in her early thirties who sounds like a friend that "
            "happens to know exactly what she is talking about, easy and "
            "unforced, not a salesperson, not a corporate narrator, not a "
            "teacher, mostly level with a small lift only on the words that "
            "matter"
        ),
        "ex2_friend_dry": (
            "A woman in her mid thirties talking to a friend about something "
            "she finds quietly clever, dry and a little amused, understated, "
            "not a salesperson and not a narrator, throws away the ordinary "
            "words and lifts slightly on the good ones"
        ),
        "ex3_friend_quick": (
            "A woman in her early thirties telling a friend about something "
            "good at a natural quick clip, engaged and unpolished, real speech "
            "rhythm with breaths, not a presenter and not a narrator, energy "
            "from pace rather than enthusiasm, flat on the setup and lifting "
            "only on the payoff"
        ),
        "ex4_friend_lowpitch": (
            "A woman in her mid thirties with a lower, grounded voice speaking "
            "as a knowledgeable friend, relaxed and certain, no performance and "
            "no sales tone, level delivery that warms only on the payoff lines"
        ),
        "ex5_friend_closemic": (
            "A woman in her early thirties speaking close to the microphone as "
            "if to one friend across a table, quiet and natural with audible "
            "breaths, completely unscripted feeling, not a narrator and not a "
            "salesperson, subtle warmth only where it is earned"
        ),
        "ex6_friend_bright": (
            "A woman in her late twenties who clearly likes what she is "
            "describing, bright and quick but genuine rather than performed, "
            "speaks like a friend not a spokesperson, not a narrator, no "
            "advertising inflection, small natural hesitations, warmth only "
            "where the line earns it"
        ),
    },
    # Brighter and more feminine than the 'explainer' set.
    #
    # ex2_friend_dry measured 193.9 Hz — the low end of the female range — and
    # its description literally asked for "understated, throws lines away".
    # Over a full film that read as bland. These aim higher in pitch and ask
    # for MELODIC VARIATION.
    #
    # The distinction that keeps this out of advertising territory: pitch
    # movement WITHIN a sentence is expressiveness, pitch RISING AT THE END of
    # a sentence is an ad-read. Every entry asks for the first and forbids the
    # second, so the voice can be lively without sounding like it is selling.
    "bright": {
        "br1_light_lively": (
            "A woman in her late twenties with a light, higher-pitched, "
            "distinctly feminine voice, lively and expressive with plenty of "
            "melodic movement inside each sentence, still landing sentence "
            "endings downward, never an advertising read"
        ),
        "br2_bright_friend": (
            "A bright, feminine woman in her late twenties telling a friend "
            "about something she genuinely likes, higher pitched and animated, "
            "expressive and varied, warm and quick, no sales inflection and no "
            "rising sentence endings"
        ),
        "br3_soft_high": (
            "A woman in her mid twenties with a soft, high, gentle feminine "
            "voice, light and airy, expressive and musical, delicate rather "
            "than forceful, natural and unperformed"
        ),
        "br4_sparky": (
            "A woman in her late twenties, sparky and quick-witted, higher "
            "pitched with lots of natural pitch variation, playful and "
            "engaged, energetic without ever sounding like an advert"
        ),
        "br5_bright_crisp": (
            "A woman in her late twenties with a clear, bright, feminine voice, "
            "crisply articulated and expressive, higher pitched than average, "
            "confident and animated, sentence endings still falling"
        ),
        "br6_youthful_warm": (
            "A youthful woman in her mid twenties, higher pitched and feminine, "
            "warm and openly enthusiastic about what she is describing, "
            "expressive and melodic, genuine rather than performed"
        ),
    },
    # SECONDARY: the calm/editorial direction, kept for contrast so the choice
    # between "energetic warm" and "restrained premium" can be heard rather
    # than argued about.
    "teaser_calm": {
        "vo_f_editorial": (
            "A woman in her thirties narrating a premium brand film, calm and "
            "editorial, unhurried and composed, quietly confident, letting "
            "each phrase land"
        ),
        "vo_m_editorial": (
            "A man in his thirties narrating a premium brand film, calm and "
            "editorial, unhurried and composed, quietly confident, letting "
            "each phrase land"
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
    sample_line = resolve_sample_line(set_name)

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


# Timestamps each script line should START at, checked against the actual cut
# (recrewt_launch_music_v3.mp4, 61.500s). Used to report whether a rendered take
# fits its slot.
#
# Line 2 moved 3.6 -> 4.5. The on-screen counter animates upward and only
# reaches 312 at ~6.0s (it still reads 241 at 5.0s). Starting the line at 3.6
# meant "three hundred and twelve" was spoken around 5.1s, a full second before
# the number appeared. At 4.5s the spoken number lands as the counter locks.
TEASER_CUES = [0.5, 4.5, 9.0, 15.6, 22.6, 29.4, 37.0, 43.2, 50.2, 57.4]
TEASER_TOTAL = 61.5


def render(voice_key, out_name=None):
    """Render the teaser script as ONE FILE PER LINE, in a chosen voice.

    Per-line rather than one long take, because the film has fixed cues. A
    single clip forces you to accept the model's pacing for the whole script;
    separate files let each line sit at its own timestamp, and let you
    regenerate one awkward line without redoing the other nine.

    Reports each take's duration against the window before the next cue, so a
    line that will not fit is obvious here rather than in the edit.
    """
    import wave

    if voice_key not in {k for s in VOICE_SETS.values() for k in s}:
        sys.exit(
            f"Unknown voice '{voice_key}'.\n"
            "Run: python tts/design_voice.py sets"
        )
    # CLONE the audition sample rather than re-describing the voice.
    #
    # This is the whole point of render vs audition. /design invents a fresh
    # voice from the description on every call, so rendering ten lines through
    # it produced ten different speakers reading one script. Pinning the
    # approved .wav as a reference makes every line the same person.
    reference = OUT_DIR / f"{voice_key}.wav"
    if not reference.exists():
        sys.exit(
            f"No audition sample at {reference}.\n"
            f"Run: python tts/design_voice.py audition <set>  (to create it)"
        )
    ref_b64 = base64.b64encode(reference.read_bytes()).decode()
    ref_text_path = OUT_DIR / f"{voice_key}.txt"
    ref_text = ref_text_path.read_text(encoding="utf-8").strip() if ref_text_path.exists() else ""

    if not TEASER_SCRIPT_PATH.exists():
        sys.exit(f"No script at {TEASER_SCRIPT_PATH}")
    lines = [l.strip() for l in TEASER_SCRIPT_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]

    url, token = _config()
    # render clones, so it must hit /clone rather than /design.
    clone_url = url.replace("-design.modal.run", "-clone.modal.run")
    out_dir = OUT_DIR.parent / (out_name or f"teaser_{voice_key}")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Voice : {voice_key}  (cloned from {reference.name})")
    print(f"Lines : {len(lines)}")
    print(f"Out   : {out_dir}\n")

    problems = []
    for i, line in enumerate(lines):
        target = out_dir / f"{i + 1:02d}.wav"
        print(f"  {i + 1:02d} ... ", end="", flush=True)
        try:
            response = requests.post(
                clone_url,
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "text": line,
                    "reference_wav_b64": ref_b64,
                    "reference_text": ref_text,
                },
                timeout=300,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"FAILED ({exc})")
            problems.append((i + 1, "generation failed"))
            continue
        target.write_bytes(response.content)

        # Measure it and compare against the slot in the cut.
        try:
            with wave.open(str(target), "rb") as w:
                secs = w.getnframes() / float(w.getframerate())
        except Exception:
            secs = None

        if secs is None:
            print("written (duration unknown)")
            continue

        if i < len(TEASER_CUES):
            window = (
                TEASER_CUES[i + 1] - TEASER_CUES[i]
                if i + 1 < len(TEASER_CUES)
                else TEASER_TOTAL - TEASER_CUES[i]
            )
            slack = window - secs
            flag = "OK " if slack >= 0.25 else ("TIGHT" if slack >= 0 else "OVER ")
            print(f"{secs:5.2f}s / {window:4.1f}s window  [{flag}]")
            if slack < 0.25:
                problems.append((i + 1, f"{secs:.2f}s in a {window:.1f}s window"))
        else:
            print(f"{secs:5.2f}s")

    print(f"\nWritten to {out_dir}")
    if problems:
        print("\nLines that may not fit the cut:")
        for n, why in problems:
            print(f"  line {n}: {why}")
        print("\nOptions: trim the wording, move the cue, or re-render "
              "(delivery varies between runs).")
    else:
        print("Every line fits its slot.")


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
    elif command == "render":
        # python tts/design_voice.py render vo_f_warm_confident
        if len(sys.argv) < 3:
            sys.exit("Usage: python tts/design_voice.py render <voice> [out-folder]")
        render(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
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
