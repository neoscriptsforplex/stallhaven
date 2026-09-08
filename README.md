# Stallhaven

A free browser game. You keep **Rune Craft**, a roadside shop.

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

1. **Click the floor** to walk, including **behind the counter**. The camera follows you — scroll or `-` / `=` to zoom, arrow keys to change the angle. Customers still line up on the customer side of the counter.
2. Click the **anvil** (left, behind the counter). Craft under **Melee**, **Magic**, **Ranged**, **Food**, or **Potions**. Higher tiers stay locked until you craft enough of the previous item in that same line (20, then 30, then +10 each step). A progress bar fills while a piece is working.
3. Finished gear goes in the wooden **chest**. Click the chest to see it. Click a table, wall shelf, or armour stand (it outlines in gold), then **Place on stall**. Food is small and sits on the wall shelves.
4. Adventurers come through the **front door** and **line up at the counter**. The traveler at the front is who you trade with.
5. **Click the traveler at the front** to open trade: **Sell** if you have the item, **Refuse** to send them off, or **Buy their goods** for a scrap of material.
6. Restock materials with gold when the bins run low — they sit along the bottom of the screen. Clicks make a short sound.
7. **Save** and **Load** in the top right write or read a JSON file on your computer (gold, materials, chest, unlock progress, craft counts, placed displays).
8. Optional: drop a `.glb` or `.gltf` file onto the upload box. Tag it **Furniture** to replace the selected table, or **Ware** to change how a recipe looks. Models stay in this browser only.

You start with 40 gold. Bronze gear, a Staff, Blue d'hide, and Bread are unlocked.

## Unlock lines

Each item line unlocks in order. Craft 20 of the first piece to open the next, then 30, then 40, 50, 60, 70.

Example: 20 Bronze Swords unlock Iron Sword; 30 Iron Swords unlock Steel Sword.

## Catalog

### Melee metals

Bronze (brown), Iron (grey), Steel (silver), Mithril (blue), Adamant (green), Runite (aqua), Dragon (red).

Weapons: Scimitar, Dagger, Sword, Mace, Spear, 2h Sword, Defender.

Armour: Full Helm, Med Helm, Platebody, Platelegs, Boots, Gloves, Chainbody, Plateskirt.

### Magic

Staff (plain) → Mystic Staff (orb) → Battle Staff (fancy orb) → Lunar Staff (moon) → Ancient Staff (church-window top).

Robes: Magic, Mystic, Battlemage, Lunar, Ancient. Each set has hat, robe top, robe bottom, boots, gloves.

### Range

Same seven metals for Shortbow, Longbow, Crossbow, Knives, Thrownaxe.

Dragonhide armour in Blue, Green, Red, Black: body, chaps, vambraces, boots.

### Food

Bread → Pizza → Cake → Pie → Fish pie, using flour, pineapple, egg, raspberry, and fish. Food displays on wall shelves.

### Potions

Coming later. The anvil tab is ready; recipes are not in yet.

## For tinkerers

This is a static [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/) app. GitHub Pages serves the built files.

```bash
npm install
npm run dev
```

The Vite base path is `/stallhaven/`, matching the GitHub Pages project URL.
The repository name stays `stallhaven`.
