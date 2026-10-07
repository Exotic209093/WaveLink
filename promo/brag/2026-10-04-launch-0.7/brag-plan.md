# WaveLink 0.7 — export in seconds, data you can trust

21 seconds, 1920×1080, 30 fps. Music and SFX, no narration. Built for the
v0.7.x Chrome Web Store launch.

## Answers

- **What is it?** A free, open-source Chrome extension that exports Salesforce
  data with SOQL to CSV, Excel, JSON, or XML from the tab you're already logged into.
- **Who is it for?** Salesforce admins, developers, and consultants.
- **What sets it apart?** No Java, no desktop Data Loader install, no server:
  records stay in the browser.
- **Most impressive claim?** v0.7 ships every fix from the August audit; every
  production write needs a typed confirmation; the listing is in 9 languages.
- **Visual hook?** The plain promise: Salesforce data to CSV, right in the browser.
- **Real UI/flow?** SOQL query → results → export formats; Dry Run Passed toast
  and the "Confirm Production Data Push" typed phrase `INSERT 2 Account`.
- **Tone?** Default, punchy and clean, with v3's kinetic typography.
- **Share caption?** See `share-copy.txt`.

## Angle

Open on the pain in one line, answer it with the product working, then give
the two v0.7 reasons to trust it now: real safety rails and nine languages.

## Storyboard

| Time | Scene | Picture and motion | Readable payoff |
| --- | --- | --- | --- |
| 0–3.0 | Hook (dark) | Masked type lands by 0.9s and holds; note follows at 1.1s | Salesforce data → CSV, / right in your browser. · No Data Loader. Nothing to install. |
| 3.0–9.6 | Query (paper) | v3 perspective board; SOQL types in; cursor clicks Run; rows cascade, resolving on the 8.74 cue | QUERY. → PREVIEW. Write SOQL. See your records. |
| 9.6–12.6 | Formats (cyan) | Four format cards fan in and level on the 10.93 cue | YOUR DATA. Your format. CSV · JSON · Excel · XML |
| 12.6–16.4 | Trust (dark) | Review modal lands on 13.11; Dry Run Passed toast at 13.64; phrase types in; Confirm push pressed at 15.29 | DATA YOU CAN TRUST. · v0.7 · Every audit fix. Shipped. |
| 16.4–18.3 | Languages (paper) | The extension name in eight languages scrolls as texture; pulse on 17.47 | NOW IN 9 LANGUAGES. |
| 18.3–21 | Outro (dark) | Logo lands on 18.56; letter cascade; holds to the end | WaveLink · Free. Open source. Local-first. · Chrome Web Store |

## Music cue guidance

Happy Beats / Business Moves vol.12 (≈110 BPM). Strong cues used: 8.74
(results), 10.93 (formats level), 13.11 (modal lands), 17.47 (language pulse),
18.56 (logo). Fade out 19.6–21.

## SFX

Soft click on Run (6.56) and Confirm (15.29); quiet keypresses under the typed
phrase; soft impacts on 8.74, 13.11, 18.56. Everything sits under the music.

## Grounding

UI copy is from the source (`TypedConfirmModal`, `DataPushScreen` toasts,
`_locales/*/messages.json`). Records are fictional and labelled. No live org.

## Voiceover (ElevenLabs, voice "Eric", eleven_multilingual_v2)

| Start | Line |
| --- | --- |
| 0.30 | Need your Salesforce data in a spreadsheet? |
| 3.35 | WaveLink runs right in your browser. Write SOQL, and preview your records. |
| 9.45 | Then export to CSV, Excel, JSON, or XML. |
| 12.95 | Now with dry runs, and typed production confirmations. |
| 16.55 | Available in nine languages. |
| 18.65 | WaveLink. Free on the Chrome Web Store. |

Music ducks to 42% under speech. Final mix normalised to about -15 LUFS with a limiter.

## Calm cut (main deliverable, 25 s)

Direction from James: slow down, more modern, in the spirit of Anthropic's launch films.
Warm paper background (#f4f1ea), Sitka serif headlines with teal italic accents,
Segoe UI Light supporting text, generous white space, soft blur-fade reveals,
a clean app window with a slow push-in, and fades through the background between scenes.

| Time | Scene | Voiceover start |
| --- | --- | --- |
| 0–3.6 | Salesforce data, / right in your browser. | 0.45 |
| 3.6–10 | Write SOQL. Preview your records. (window, typed SOQL, Run, rows) | 3.9 |
| 10–13.8 | Export to CSV, Excel, JSON, or XML. (four cards) | 10.35 |
| 13.8–18.8 | Data you can trust. (modal, dry run, typed phrase, Confirmed) | 14.25 |
| 18.8–21.8 | Nine languages. (nine tiles) | 19.15 |
| 21.8–25 | WaveLink · Free on the Chrome Web Store. | 22.3 |

Music: a calm D-major ambient bed (pad, felt-piano motif, sub, reverb) synthesised
in work/music/make_bed.py because the ElevenLabs music API needs a paid plan.

## Wavey (mascot)

A soft wave-drop in the logo gradient with the logo's wave across its belly
(composition/assets/js/mascot.js). Supporting role, small and gentle:

| Time | Moment |
| --- | --- |
| 1.0 | Pops in beside the hook and waves |
| 4.7 | Peeks over the app window; watches the cursor; cheers when rows land (7.6) |
| 11.15 | Sits by the format cards; nods when CSV is ticked |
| 14.6 | Watches the phrase being typed; cheers at Confirmed (17.0) |
| 19.45 | Speech bubble: Hello · Hola · こんにちは · 안녕하세요 · Bonjour |
| 23.0 | Waves goodbye under the lockup; winks (24.55) |
