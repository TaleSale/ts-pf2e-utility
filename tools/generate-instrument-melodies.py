"""Render original short instrument performances. No external samples required."""
from pathlib import Path
import numpy as np
import random
import wave
from concurrent.futures import ProcessPoolExecutor

ROOT = Path(__file__).resolve().parents[1] / "audio" / "instruments"
RATE = 22050
TIERS = ["natural1", "minus15", "minus10", "minus5", "dc", "plus5", "plus10", "plus15", "natural20"]
OUTCOMES = ["criticalFailure", "failure", "success", "criticalSuccess"]
PHRASES = {
    "piano": [60, 64, 67, 72, 71, 67, 65, 64, 62, 67, 64, 60],
    "grandPiano": [48, 55, 60, 64, 67, 76, 74, 71, 67, 62, 59, 60],
    "harp": [60, 67, 72, 76, 79, 76, 74, 69, 65, 69, 72, 60],
    "drums": [36, 42, 38, 42, 36, 36, 38, 42, 36, 42, 38, 49],
}

def tone(instrument, note, time, rng):
    freq = 440 * 2 ** ((note - 69) / 12)
    if instrument == "drums":
        # Medieval skin drums: low tabor, tenor, hand drum and wooden rim.
        # Membrane modes replace the modern kick/snare/hi-hat/cymbal sounds.
        pitch = {36: 72, 38: 112, 42: 158, 49: 225}.get(note, 112)
        decay = {36: 8, 38: 12, 42: 17, 49: 28}.get(note, 12)
        modes = [(1, 1), (1.594, .45), (2.136, .23), (2.653, .10)]
        body = sum(weight * np.sin(2 * np.pi * pitch * ratio * time)
                   * np.exp(-time * decay * (1 + ratio * .12)) for ratio, weight in modes)
        strike = np.random.default_rng(rng.randrange(2 ** 32)).uniform(-1, 1, time.shape) * .18 * np.exp(-time * 150)
        return (body * .65 + strike) * np.minimum(1, time / .001)
    # Harp strings have a clean pluck, weak upper partials and almost no inharmonicity.
    # Hammered piano strings retain stronger upper partials and a longer resonant body.
    harmonics = [(1, 1), (2, .22), (3, .10), (4, .04)] if instrument == "harp" else [(1, 1), (2, .38), (3, .19), (4, .08), (6, .035)]
    decay = 3.8 if instrument == "harp" else 3.6 if instrument == "piano" else 2.2
    inharmonicity = .00001 if instrument == "harp" else .00012
    attack = np.minimum(1, time / .006)
    signal = sum(weight * np.sin(2 * np.pi * freq * partial * (1 + partial * inharmonicity) * time)
                 * np.exp(-time * decay * (1 + partial * .18)) for partial, weight in harmonics)
    return attack * signal * (0.65 if instrument == "harp" else .55)

def render(instrument, tier_index, outcome):
    rng = random.Random(f"{instrument}:{tier_index}:{outcome}")
    quality = tier_index / 8
    count = (18 if outcome == "criticalFailure" else 8 if outcome == "failure" else 12 if outcome == "success" else 20) + tier_index % 3 * 2
    step = .29 if instrument == "drums" else .32 - quality * .045
    duration = count * step + 1.4
    samples = np.zeros(int(duration * RATE))
    phrase = PHRASES[instrument]
    for index in range(count):
        note = phrase[index % len(phrase)]
        jitter = .035 if outcome == "failure" else .008 if outcome == "success" else .002
        start = max(0, index * step + rng.uniform(-jitter, jitter))
        notes = [note]
        if outcome == "criticalFailure":
            # Erratic attacks, semitone clusters and tritones: unmistakable cacophony.
            start = rng.uniform(0, count * step)
            note = rng.choice(phrase) + rng.choice([-12, -6, -1, 1, 6, 13])
            notes = [36, 38, rng.choice([42, 49])] if instrument == "drums" else [note, note + 1, note + 6, note + 13]
        if instrument in ("piano", "grandPiano") and outcome == "success" and index % 4 == 0:
            notes += [note - 12]
        if instrument == "harp" and outcome == "success" and index % 3 == 0:
            notes += [note - 12]
        if outcome == "criticalSuccess" and instrument != "drums":
            # Diatonic thirds, octave bass and a resolved cadence, without dissonant clusters.
            scale = [0, 2, 4, 5, 7, 9, 11]
            degree = scale.index(note % 12)
            third = (note // 12 + (degree + 2) // 7) * 12 + scale[(degree + 2) % 7]
            notes += [third]
            if index % 4 == 0:
                notes += [note - 12]
            if index == count - 1:
                notes = [48, 60, 64, 67, 72] if instrument != "harp" else [60, 64, 67, 72, 76]
        if outcome == "criticalSuccess" and instrument == "drums" and index % 4 == 3:
            notes = [38, 42] if index != count - 1 else [36, 49]
        for pitch in notes:
            offset = int(start * RATE)
            length = int((.55 if instrument == "drums" else 1.3) * RATE)
            frames = np.arange(min(length, len(samples) - offset))
            time = frames / RATE
            fade = np.minimum(1, (length - frames) / (RATE * .05))
            samples[offset:offset + len(frames)] += tone(instrument, pitch, time, rng) * fade
    if outcome == "criticalSuccess" and instrument != "drums":
        dry = samples.copy()
        for delay, gain in [(.16, .14), (.32, .07)]:
            offset = int(delay * RATE)
            samples[offset:] += dry[:-offset] * gain
    peak = np.max(np.abs(samples)) or 1
    fade = np.minimum(1, (len(samples) - np.arange(len(samples))) / (RATE * .08))
    data = np.rint(samples / peak * 24000 * fade).astype("<i2").tobytes()
    path = ROOT / instrument / outcome / f"{TIERS[tier_index]}.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(data)
    return path

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=4) as executor:
        jobs = [executor.submit(render, instrument, index, outcome) for instrument in PHRASES for outcome in OUTCOMES for index in range(9)]
        paths = [job.result() for job in jobs]
    # Retire the old degree-independent melodies only after the complete new set exists.
    for instrument in PHRASES:
        for tier in TIERS:
            legacy = ROOT / instrument / f"{tier}.wav"
            if legacy.is_file():
                legacy.unlink()
    print(f"Generated {len(paths)} melodies ({sum(path.stat().st_size for path in paths):,} bytes)")
