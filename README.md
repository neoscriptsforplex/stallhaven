# Stallhaven

A free browser game. You keep the **Store of Geilenor**, a roadside shop.

## Play

**https://neoscriptsforplex.github.io/stallhaven/**

No account, no download, no paywall.

If GitHub shows “Site not found”, play here while Pages is switched on:

**https://raw.githack.com/neoscriptsforplex/stallhaven/play/index.html**

To turn on the official GitHub Pages link (one time, free, no coding):

1. Open [Settings → Pages](https://github.com/neoscriptsforplex/stallhaven/settings/pages)
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (or Branch `gh-pages`, folder `/`)
3. Save, wait a minute, then open https://neoscriptsforplex.github.io/stallhaven/

## How to play

1. **Click the floor** to walk. The camera follows you — scroll or `-` / `=` to zoom, arrow keys to change the angle.
2. Click the **anvil** (left of the counter). In the anvil panel, craft under **Arms**, **Armour**, or **Provisions**. Recipes spend materials, sometimes gold, and a short wait. Close the panel when you are done.
3. Finished gear goes in the wooden **chest**. Click the chest to see it. Click a table, wall shelf, or armour stand (it outlines in gold), then **Place on stall**.
4. Adventurers come through the **front door** and **line up at the counter**. The traveler at the front is who you trade with. Mercenaries want melee gear, rangers want bows and hide, hedge mages want staves and veils.
5. **Click the traveler at the front** to open trade: **Sell** if you have the item, **Refuse** to send them off, or **Buy their goods** for a scrap of material. After sell, refuse, or buy they leave and the line advances.
6. Restock materials with gold when the bins run low.
7. Optional: drop a `.glb` or `.gltf` file onto the upload box. Tag it **Furniture** to replace the selected table, or **Ware** to change how a recipe looks. Models stay in this browser only.

You start with 40 gold and a little of each material, enough to craft a first Ironedge, Ashlong, or Emberrod.

## Recipes

Provisions from the old roadside stall still sell.

| Ware | Cost | Time | Sells | Likely buyers |
| --- | --- | --- | --- | --- |
| Trailbread | Grain | 8s | 12g | Pilgrim |
| Emberflask | Embercap | 12s | 22g | Hedge mage |
| Thornpike | Ironbark | 16s | 30g | Mercenary |
| Waycloak | Woolspool | 14s | 26g | Pilgrim, Hedge mage |

### Arms

| Ware | Class | Cost | Time | Sells |
| --- | --- | --- | --- | --- |
| Ironedge | Melee | Dulliron + 3g | 8s | 20g |
| Steelcleaver | Melee | Brightsteel + Dulliron + 6g | 12s | 38g |
| Starfang | Melee | Starvein + Brightsteel + 10g | 16s | 62g |
| Ashlong | Range | Bowheart + 3g | 8s | 20g |
| Heartstring | Range | Bowheart + Moonstring + 6g | 12s | 36g |
| Skysplit | Range | Bowheart + Moonstring + Gleamcrystal + 10g | 16s | 60g |
| Emberrod | Magic | Embercap + Ironbark + 3g | 8s | 22g |
| Gleamstave | Magic | Gleamcrystal + Ironbark + 6g | 12s | 40g |
| Veilstaff | Magic | Gleamcrystal + Veilsilk + 10g | 16s | 64g |

### Armour

Each class has a helm, body, and legs in two tiers (Iron / Steel, Hide / Scout, Veil / Gleam). Recipes use Platescrap, Hideleather, or Veilsilk plus the matching metal, string, or crystal. Place armour on a stand to wear the matching set on the mannequin.

## For tinkerers

This is a static [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/) app. GitHub Pages serves the built files.

```bash
npm install
npm run dev
```

The Vite base path is `/stallhaven/`, matching the GitHub Pages project URL.
