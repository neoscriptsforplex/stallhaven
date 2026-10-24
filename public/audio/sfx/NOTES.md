# Stallhaven SFX pack v1
All sounds were synthesized from scratch in Python (numpy/scipy) by generate_sfx.py, which is included and reproducible with seed 7. They were encoded with ffmpeg libvorbis q4: mono, 44.1 kHz. No samples were used, and nothing comes from RuneScape/OSRS or any other game.

**License:** original work, owned by Luke Young. All rights reserved by the owner.

## How each was made
- ui_click_01/02: a short sine blip (2.2 / 1.7 kHz) plus a band-passed noise tick.
- panel_open/close: a stepped band-pass noise sweep (up or down) followed by a small wooden knock.
- coin_01/02: 3–4 staggered inharmonic metal pings at about 3 kHz (partials 1, 2.7, 5.1, 7.3).
- sale_01: coins followed by a two-note bell (C5 to G5).
- customer_enter_01: a door thud and four decaying bell strikes. The bell model uses partials 1, 2, 2.76, 5.4, 8.9.
- anvil_hammer_01/02/03 (highlight, the original v1 clang, restored per Luke): a bright inharmonic anvil-plate model with six partials (1, 2.32, 3.91, 5.13, 6.8, 9.2 × 820 / 870 / 780 Hz) and staggered decays (ring-out about 1.2 s), a slight shimmer AM, a 2.5–12 kHz strike transient and a 90 Hz body thud. There is no lo-fi treatment.
- levelup_01: an original plucked-lute arpeggio (G4 C5 E5 G5) that resolves to a C major chord with a low C.
- quest_complete_01: an original 6-note lute phrase that ends on a sustained C chord plus a high bell.
- tree_fall_01: a creak (warbling 70 Hz tone with crackles), then a low-passed crash, a 55 Hz thump and a leaf rustle.
- mining_pick_01/02: a hard metallic tink plus a gravelly noise tail.
- fishing_splash_01: a plop, a noise splash and randomized rising-pitch bubbles.
- build_place_01: a heavy wooden thud with a small secondary knock.
- footstep_grass_01/02 (v2): 40 randomized grain impulses filtered to 0.5–4.5 kHz for crunch, plus a low heel thump. There is much less hiss than v1.
- footstep_wood_01/02: a wooden knock at 190 / 165 Hz plus a low scuff.
- purchase_01: a cascade of five coins, a wooden thunk and a three-note bell (C E G).

## Added in v2 (lo-fi style)
These sounds were lightly downsampled through 22.05 kHz and quantized to 12 bits for a gentle retro crunch without graininess (revised after feedback; v2 first used 16 kHz and 8-bit).
- potion_mix_01: about 22 rising-pitch bubbles, a liquid wash and a two-note glass clink at the end.
- furnace_01: a swelling roar of low-passed noise and a 50 Hz rumble. furnace_loop (3.5 s): roar, slow flicker and random crackles.
- cooking_range_01: a pan knock, then a sizzle (high noise plus pops). cooking_loop (3.0 s): sizzle bed.
- spinning_wheel_01 / spinning_wheel_loop (2.67 s = 4 rotations): band-passed whirr modulated at the wheel rate, plus wooden creaks once per rotation.
- loom_01/02: a shuttle swish, then a two-hit wooden clack (240 / 200 Hz).
- coin_sell_01/02: 3 or 5 coin drops, then a muffled leather pouch thump.

Loops are made seamless by generating extra audio and equal-power crossfading the last 0.25 s into the start. The loudness target for loops is -24 LUFS.

## Rebuilt in v3: sawmill and tree chop (all with light lo-fi: 22.05 kHz, 12-bit)
- sawmill_01 / sawmill_loop (3.0 s): push-pull saw strokes, 0.5 s each. Each stroke is a train of 6 ms tooth-rasp grains (band-passed 1–5 kHz). The tooth rate follows the stroke speed (25–120 grains/s on a sine velocity curve). Pull strokes are darker and softer than push strokes, and a 250–700 Hz plank resonance gives the wood body. The one-shot is two strokes ending in a wooden board-drop thunk. The loop is 6 strokes with a faint low motor bed, aligned to the stroke period and crossfaded for a seamless repeat.
- tree_chop_01 (v5, a high woodcutting tick): wood tones at 1.65, 2.45 and 3.3 kHz (decays of 8–16 ms), a 1.0 kHz body tone (25 ms) and a sharp 0.7 ms click at 3–10 kHz, high-passed at 400 Hz, with a 15 ms end fade. It is 0.13 s long. Light lo-fi treatment: 22.05 kHz, 12-bit. tree_chop_02 was removed from the pack per Luke.

MP3 copies of every OGG are in mp3/<name>.mp3 (96 kbps, mono).

## Added in v7 (light lo-fi: 22.05 kHz, 12-bit)
- ui_error_01: two detuned square waves (110/116 Hz), low-passed at 1.8 kHz, for a dull deny buzz.
- item_pickup_01: a cloth rustle and two soft rising blips (900 Hz to 1.35 kHz).
- item_drop_01: a pitch-dropping thump (140 to 70 Hz) and a dull ground noise.
- eat_01/02: two crunch bursts made of noise grains (a bite and a chew), each variant with its own random seed.
- combat_hit_01/02: a punchy pitch-dropping body thump (160 / 130 Hz), a slap and a sharp click.
- combat_miss_01: a falling band-pass noise swish.
- shop_ambience_loop (8.0 s, seamless with a 0.5 s crossfade, -24.0 LUFS): four slow-modulated band-passed murmur "voices", a low hearth roar, sparse crackles and two wooden creaks.

## Loudness
The targets were -18 LUFS and true peak at or below -1 dBTP. Each file was measured with ffmpeg ebur128 (peak=true), with files shorter than 0.4 s padded to 0.4 s. Every file has a true peak of -1.1 dBTP or lower. Integrated loudness is between -16.7 and -21.8 LUFS. Very short percussive sounds (clicks, steps, chops, panels) are peak-limited to around -20/-21 LUFS. Pushing them to -18 would mean clipping them past the -1 dBTP limit, so use the manifest volume or a small game-side gain if needed. The four loops measure -23.9 to -25.4 LUFS.

## Build
Run `python3 generate_sfx.py`. After encoding, it measures each OGG's true peak and re-encodes with a gain trim if needed, so every file stays at or below -1 dBTP. It also writes manifest.json, preview_all.mp3 (decoded from the final OGGs) and mp3/<name>.mp3 at 96 kbps.
