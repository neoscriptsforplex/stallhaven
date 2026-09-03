# Stallhaven

A free browser game. You keep a dusty roadside stall in the market town of **Stallhaven**.

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

1. Press a craft button. Each recipe spends one material and a short wait.
2. Finished wares appear on a table. Click a table if you want to choose the stall.
3. Travelers come in through the door. Pilgrims like Trailbread and Waycloak. Mercenaries look for a Thornpike. Hedge mages look for an Emberflask or a Waycloak.
4. A sale happens at the counter, then your gold goes up.
5. Restock materials with gold when the bins run low.
6. Optional: drop a `.glb` or `.gltf` file onto the upload box. Tag it **Furniture** to replace the selected table, or **Ware** to change how a recipe looks. Models stay in this browser only.

You start with 40 gold and a little Grain, Embercap, Ironbark, and Woolspool.

## Recipes

| Ware | Material | Time | Sells | Likely buyers |
| --- | --- | --- | --- | --- |
| Trailbread | Grain | 8s | 12g | Pilgrim |
| Emberflask | Embercap | 12s | 22g | Hedge mage |
| Thornpike | Ironbark | 16s | 30g | Mercenary |
| Waycloak | Woolspool | 14s | 26g | Pilgrim, Hedge mage |

## For tinkerers

This is a static [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/) app. GitHub Pages serves the built files.

```bash
npm install
npm run dev
```

The Vite base path is `/stallhaven/`, matching the GitHub Pages project URL.
