# Lost Sounds — Hall of Vanishing Sound

A small, fictional museum for sounds that no longer exist. Every specimen is rebuilt live in the browser with the Web Audio API: filtered noise, tuned partials, slow envelopes and scheduled events. There are no audio files anywhere.

The room reads as a physical exhibit: lacquered black walls, gold foil, accession numbers, a vitrine under glass and a waveform that moves with the live signal.

## Features

- Six playable specimens — rain, a distant bell, a train crossing, room tone, ice cracking and a lighthouse foghorn — each synthesised from scratch.
- A large now-playing plaque with provenance, medium, condition and a curator's note.
- Canvas oscilloscope drawing the live analyser signal, with an idle resting trace.
- Play and stop, running time, a progress bar and a room volume control.
- Specimens end on their own after their listed duration, with a gentle fade.
- "Keep" favourites filtered from the catalogue and saved in `localStorage`, alongside volume.
- A kept-specimen filter with an empty state.
- Keyboard support, visible focus states, `aria-pressed` controls, `aria-current` catalogue entries and a polite live region announcing playback.
- Clear notice that browsers require a user gesture before audio can begin.
- Responsive down to 390px and a reduced-motion mode.

## Running it

There is no build step, no package manager and no dependencies. Open `index.html` in a modern browser, or serve the folder with any static file server. Google Fonts is the only network request; all artwork is CSS, inline SVG and canvas.

## Files

- `index.html` — the museum hall and controls
- `styles.css` — lacquer, gold foil, vitrine and responsive layout
- `app.js` — exhibit data, Web Audio synthesis and interface behaviour
- `README.md` — this document

## Live demo

https://ayo-2010.github.io/lost-sounds/
