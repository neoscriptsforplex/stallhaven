# Stallhaven

A free browser game. You keep **Rune Craft**.

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

1. **Click the floor** to walk, including **behind the counter**. The camera follows you — scroll or `-` / `=` to zoom (zoom far out to see the **roof** and garden), arrow keys to change the angle. Customers still line up on the customer side of the counter.
2. Click the **anvil** (left, behind the counter). Craft under **Melee**, **Magic**, **Ranged**, or **Potions**. Click the compact **cooking range** for **Food**. Higher tiers stay locked until you craft enough of the previous item in that same line (20, then 30, then +10 each step). A progress bar fills while a piece is working.
3. Finished gear goes in the wooden **chest** (100 slots to start). Click the chest to see it. **Right-click** the chest to upgrade (+100 slots per level, 500g then ×3, max level 10 / 1000 slots). Click a table, wall shelf, or armour stand (it outlines in gold), then **Place on stall**. Food is small and sits on the wall shelves. Click furniture for **Move** / **Rotate 15°**.
4. Adventurers come through the **front door** and **line up at the counter**. The traveler at the front is who you trade with.
5. **Click the traveler at the front** to open trade: **Sell** if you have the item, **Offer** a different chest item at a reduced price (you choose which), **Refuse** to send them off, or **Buy their goods** for a scrap of material.
6. Restock materials with gold when the bins run low — they sit along the bottom of the screen. Basic materials also refill slowly on their own up to 250; higher-tier metals refill slower. Clicks make a short sound.
7. **Save** and **Load** in the top right write or read a JSON file on your computer. The expand-arrow button buys extra rooms (500g, then ×5): click a pad, then Confirm.
8. Optional: tap **Upload** beside Coins to add a `.glb` or `.gltf`. Tag it **Furniture** to replace the selected table, or **Ware** to change how a recipe looks. Models stay in this browser only.

You start with 40 gold. Bronze gear, a Staff, Blue D'hide, and Bread are unlocked.

The **?** button beside Expand opens Help (click-to-walk, anvil, range, chest, and the rest of How to play).

## Unlock lines

Each item line unlocks in order. Craft 20 of the first piece to open the next, then 30, then 40, 50, 60, 70.

Example: 20 Bronze Swords unlock Iron Sword; 30 Iron Swords unlock Steel Sword.

## Catalog

### Melee metals

Bronze (brown), Iron (grey), Steel (silver), Mithril (blue), Adamant (green), Runite (aqua), Dragon (red).

Weapons: Scimitar, Dagger, Sword, Mace, Spear, 2H Sword, Defender.

Armour: Full Helm, Med Helm, Platebody, Platelegs, Boots, Gloves, Chainbody, Plateskirt.

### Magic

Staff (plain) → Mystic Staff (orb) → Battle Staff (fancy orb) → Lunar Staff (moon) → Ancient Staff (church-window top).

Robes: Magic, Mystic, Battlemage, Lunar, Ancient. Each set has Hat, Robe Top, Robe Bottom, Boots, Gloves.

### Range

Same seven metals for Shortbow, Longbow, Crossbow, Knives, Thrown Axe.

Dragonhide armour in Blue, Green, Red, Black: Body, Chaps, Vambraces, Boots.

### Food

Bread → Pizza → Cake → Pie → Fish Pie, using flour, pineapple, egg, raspberry, and fish. Cook these on the **range**, not the anvil. Food displays on wall shelves.

### Potions

Coming later. The anvil tab is ready; recipes are not in yet.

## Shop upgrades

- **Chest:** 100 slots at level 1, +100 per level, max level 10 (1000). First upgrade 500g, then ×3.
- **Rooms:** five pads around the starting shop (three behind, one either side). First room 500g, then ×5.
- **Furniture:** move (snaps to the floor) and rotate in 15° steps. Wares sit on the piece and travel with it.

## For tinkerers

This is a static [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/) app. GitHub Pages serves the built files.

```bash
npm install
npm run dev
```

The Vite base path is `/stallhaven/`, matching the GitHub Pages project URL.
The repository name stays `stallhaven`.
