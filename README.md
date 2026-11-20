# Tanjung Emas

![make.fun](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/ibr6ixhim/tanjung-emas/rank.svg)
![reward](https://make.fun/badge/gta6-01/ibr6ixhim/tanjung-emas/reward.svg)

**Tanjung Emas** is an open-world crime game in the spirit of GTA 6, built for the
[make.fun](https://make.fun/bounty/gta6-01) bounty "Make GTA 6". It runs entirely
from static files in a desktop browser — no network requests, keyboard and mouse.

## The game

Raka returns to Tanjung Emas, a fictional tropical island city at sunset. Steal
cars, outrun the police, build a crew, and take over the city, one story mission
at a time.

- **A living city**: 6 named districts (Pantai Senja, Pelabuhan Tua, Kota Pusat,
  Marina, Kampung Neon, Bukit Kencana), each with its own standing and bonus.
- **On foot and by car**: steal any car with `F`, drive through traffic and
  pedestrians, or board a boat at the Marina and escape by sea.
- **Wanted 0–5 stars**: named police dispatch units with live distance and
  tactics (PURSUIT, RAMMING, ROADBLOCK, SPOTLIGHT), a helicopter with a
  spotlight, and water police on the bay.
- **8 story missions** with multi-stage objectives and NPC dialogue — including
  a storm mission at night in the rain, and a boat escape across the strait.
- **Crew with active perks**: Sinta (driver, longer nitro), Bimo (mechanic,
  garage discount), Nadia (hacker, removes a wanted star) — hotkeys Z/X/C.
- **Garage, radio, saves**: repair/respray/tune/armour/nitro at Bimo's garage,
  two WebAudio radio stations, 3 save slots with autosave after each mission.
- **HUD + minimap**: mission panel, money and wanted stars, circular minimap,
  speedometer, weapon slots, and a full pause map (M) with mission list,
  career stats and save slots.

## Play

```text
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Controls: WASD walk/drive • mouse drag camera • click shoot • F steal car /
board boat • E garage • M map • 1–6 weapons • R radio • Z/X/C crew perks •
Shift nitro / run.

## Tech

- three.js (vendored as `game/vendor/three.min.js`), low-poly third-person 3D.
- The game source is split by system: `world`, `vehicles`, `boats`, `traffic`,
  `police`, `missions`, `combat`, `hud`, `minimap`, `audio`, `save`, `weather`.
- `main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json` with the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).
