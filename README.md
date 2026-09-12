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
2. Click the **anvil** (left, behind the counter). Craft under **Melee**, **Magic**, or **Ranged**, then **Weapons** or **Armour**. **Ranged** also has **Ammo**. **Magic** also has **Runes**. Weapons and armour use **metal bars**, not raw ore. A **furnace** already sits beside the anvil — click it to smelt ores into bars (Bronze starts unlocked; Iron and up unlock after enough smelts of the previous bar). Click a **spinning wheel** to turn **Flax** into **Bow String** (required for every bow and crossbow). Click the compact **cooking range** for **Food**. Click a placed **cauldron** for **Potions**. Higher tiers stay locked until you craft enough of the previous item in that same line. A progress bar fills while a piece is working. Restock materials from inside the craft window.
3. Finished gear goes in the wooden **chest** (100 slots to start). Click the chest to see it. **Right-click** the chest for **Upgrade**, **Move**, or **Rotate**. **Right-click a table or wall shelf** and choose **Display item…** to place a chest ware. On a **shelf**, pick the item, then **Top Left**, **Top Right**, **Bottom Left**, or **Bottom Right**. If that slot is full, the old ware returns to the chest. Food and potions are small shelf items.
4. Adventurers come through the **front door** and **line up at the counter**. The traveler at the front is who you trade with.
5. **Click the traveler at the front** to open trade: **Sell** if you have the item, **Offer** a different chest item at a reduced price (click the item, then Confirm), **Craft** what they asked for on the anvil, range, furnace, spinning wheel, or cauldron, **Refuse** to send them off, or **Buy their goods** for a scrap of material.
6. Basic materials refill slowly on their own up to 250; higher-tier ores refill slower. Restock with gold from a craft window. **Metal bars** and **Bow String** do not refill or restock — smelt bars at the furnace, and spin bow string from flax at the wheel. Clicks make a short sound.
7. **Save** and **Load** in the top right write or read a JSON file on your computer. The fullscreen button fills the window. **Upgrade** unlocks extra rooms (10,000g, then ×3, up to 5: click a pad, then Confirm), extra **tables** and **mannequins** (500g, then ×3 per type; starting pieces do not count), a **spinning wheel** for 500 gp, and a **cauldron** for 10,000 gp. The starting shop already has a furnace beside the anvil. Side rooms clear the trees on that side of the shop. The music-note button (right of Load) plays uploaded MP3, WAV, or OGG tracks as a playlist.
8. Optional: tap **Upload** beside Coins to add a `.glb` or `.gltf`. Tag it **Furniture** (selected table), **Ware** (a recipe look), **Player** (your character mesh), or **Customer** (shared NPC body; types keep colours and labels). Models stay in this browser. A custom player mesh still walks; hair/colour customizer may not apply to it.

You start with 40 gold. Bronze gear, a Staff, Blue D'hide, and Bread are unlocked.

The **?** button opens Help (click-to-walk, anvil, range, chest, and the rest of How to play).

## Unlock lines

Each item line unlocks in order. Craft 20 of the first piece to open the next, then 30, then 40, 50, 60, 70.

Example: 20 Bronze Swords unlock Iron Sword; 30 Iron Swords unlock Steel Sword.

The furnace uses the same ladder for bars: Bronze Bar from the start; 20 Bronze Bars unlock Iron Bar; 30 Iron Bars unlock Steel Bar; then +10 each step.

Potions unlock after a cauldron is placed, then 5 crafts of the previous vial.

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

Bows and crossbows also need **Bow String** (spun from Flax) plus logs.

**Ammo** (Ranged sub-tab): metal **Arrows** (Bronze through Dragon; Runite Arrows match Runite Bar). One craft makes **20** arrows for 1 matching bar + 1 Logs. **Cannonballs** are a single Steel Bar recipe (not a metal ladder) that also makes 20, sellable to rangers and mercenaries.

Dragonhide armour in Blue, Green, Red, Black: Body, Chaps, Vambraces, Boots.

### Runes

Anvil **Magic → Runes**. Grey discs with coloured marks, crafted from **Essence**. Unlock Air → Earth → Water → Fire on the same 20 / 30 / +10 ladder. Air starts unlocked. Hedge mages and other travelers may ask for them.

### Food

Kitchen: Bread → Pizza → Cake → Pie → Fish Pie (flour, pineapple, egg, raspberry, fish).

Feast (after enough Bread): Salmon → Lobster → Chocolate Cake → Monkfish → Curry → Shark → Summer Pie → Anglerfish. Salmon sells for less than Cake; the rest climb past it. Uses fish, flour, egg, chocolate, herbs, pineapple, and raspberry.

Cook these on the **range**, not the anvil. Food displays on wall shelves.

### Potions

Brew on a placed **cauldron** from **Herbs** and **Water**: Strength (yellow), Prayer (aqua), Attack (turquoise), Anti Poison (lime), Ranging (light blue), Antifire (purple), Energy (pink), Magic (peach). Sell prices start at **1,000g** for Strength and climb with rarity (Prayer 1,500g … Magic 16,000g). Vials sit on wall shelves.

## Shop upgrades

- **Chest:** 100 slots at level 1, +100 per level, max level 10 (1000). First upgrade 500g, then ×3. Right-click the chest to upgrade, move, or rotate.
- **Rooms:** from **Upgrade**. Five pads around the starting shop (three behind, one either side). First room 10,000g, then ×3, up to 5 extra spaces. Side expansions clear the exterior trees on that side so they do not clip through the new room.
- **Upgrade / Spinning Wheel:** 500 gp. Place with the floor snap grid, then Confirm. Click it to spin Flax into Bow String. The wheel mesh turns while a craft is running.
- **Furnace:** already placed beside the anvil in a new shop (free, not an Upgrade buy). Click it to smelt ores into bars. Right-click to move or rotate. Old saves that never placed one get a furnace next to their anvil; a furnace you already bought stays where it is.
- **Upgrade / Cauldron:** 10,000 gp. Place with the floor snap grid, then Confirm. Click the cauldron to brew potions. Right-click to move or rotate.
- **Upgrade / Table and Mannequin:** first extra of each type is 500g, then ×3 (1500, 4500, …). Starting shop tables and mannequins do not count. Place on the floor snap grid, then Confirm. Right-click to move, rotate, or (tables) Display item….
- **Furniture:** Move and Rotate only from a **right-click** context menu (not craft windows). The counter ignores left-click. Wares sit on the piece and travel with it.

## For tinkerers

This is a static [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/) app. GitHub Pages serves the built files.

```bash
npm install
npm run dev
```

The Vite base path is `/stallhaven/`, matching the GitHub Pages project URL.
The repository name stays `stallhaven`.
