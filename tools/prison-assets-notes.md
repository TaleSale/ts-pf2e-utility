# Prison assets
12 assets, each generated separately with built-in ImageGen; base and Dark Fantasy variants.
Prompt set: empty floor cage; suspended human cage; tabletop and suspended fairy cages; closed upright iron maiden seen from zenith; restraint table; ceiling chain; wall chains with open cuffs; ankle stocks; restraint chair; instrument side table; brazier with pokers.
Shared prompt constraints: orthographic 90-degree overhead view, centered complete silhouette, soft upper-left light, no text, no watermark, no external shadows. Dark variants preserve reference composition and use blackened iron, muted rust, dark oak and tarnished bronze. Transparent alpha or flat magenta extraction; isolated debris removed, aspect preserved by finalize_asset.py.
Final paths and source generation IDs are listed in prison-assets-manifest.json. Base: images/scene-assets. Dark: images/presets/bastion-blasphemy/scene-assets.
All entries are new, so existing tiles need no migration. Scene preset resolver selects only the active texture. Hard refresh Foundry after installation.

## Revision v2
Built-in ImageGen redrew iron maiden as intact upright shell, crown-dominant overhead view, slightly ajar door and visible spike tips. Ceiling chain uses an end-on compact overlapping-link projection; wall manacles use strongly foreshortened hanging geometry; stocks show upright beam from zenith. Each has a separate Dark Fantasy material variant preserving composition.
Files: prison-{iron-maiden,ceiling-chain,wall-manacles,stocks}-topdown-v2.webp in both existing image trees. Manifest records exact generation sources and dimensions.
Legacy v1 paths resolve to v2 in both presets. Flagged placed tiles and saved sets receive one-time geometry updates preserving center, rotation, elevation and scale relative to the old default size. Ceiling chain default footprint is now 0.25 cells. Existing unflagged tiles receive path updates only. Hard refresh required; live Foundry placement was not inspected.
