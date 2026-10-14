# Embers to Orbit — Balance Notes

What the simulator says about the game's balance. [DESIGN.md](DESIGN.md) says how the game works; this file records how it plays out across hundreds of automatic campaigns, so balance changes can be compared with what came before. Add a dated note here after each balance change.

## Running the checks

- `npm run simulate` plays 200 five-year campaigns with each of three strategies. `node tools/simulate.mjs [games] [years] [strategies]` changes the count, the length, and the strategies (comma-separated).
- Strategies: **sensible** assigns people by hand each season, feasts when the stores are nearly full, and fights a raid when the odds are at least even. **orders** leaves everything to standing orders. **idle** does nothing, as a floor. **village** uses standing orders, becomes a village as soon as it can, claims bordering land, founds a second settlement when ready, fights a raid when the odds are at least even, and sallies against a siege when the war chief gives it three chances in five, or even odds when a crop is sown (besiegers burn it). It spends goods the way a player would, keeping 40 in hand: sell-swords when the Skarn could field as many warriors as it has fighters, a caravan when food runs low, a master each year, and gifts to the hill clans when 150 goods would still be left. It uses no other diplomacy unless asked.
- Settings for the village strategy, as environment variables: `NOSPEND=1` keeps it from spending goods; `FOODSTORES=4` (or 6, 8, 12, full) sets the food stores; `CLANGIFT=1` sends gifts to the hill clans whenever it can; `PEACE=1` seeks a lasting peace with the Skarn, and `PEACE=honor` also honors it when warned; `LAWS="food=byWork,service=militia"` tries a set of laws.
- `npm run battles` fights hundreds of battles to check combat odds.

## Where things stand (October 14, 2026)

Five-year campaigns, 200 of each:

| Strategy | Wiped out | People at year 5 | Food | Rotted | Lost |
| --- | --- | --- | --- | --- | --- |
| Sensible | 0 | 19.7 | 175 | 129 | 0.5 |
| Standing orders | 0 | 22.4 | 177 | 23 | 0.2 |
| Idle | 131 | 0.6 | 1 | 0 | 18.0 |

Twenty-year village campaigns, 200 of them (`node tools/simulate.mjs 200 20 village`):

- **Growth:** about 66 people at year 20; the camp becomes a village in about year 5.6, and 178 of 200 reach the Nation era, in about year 16. None are wiped out.
- **Stores:** about 695 food in store (149 rotted over the campaign), 21 stone, and about 440 goods, after hiring about 7 masters and 6 bands of sell-swords.
- **The Skarn:** about 46 warriors among 117 people at year 20, with about 21 hill clansmen. About 2.3 sieges (4 seasons under siege in all), 0.8 great hosts, and 11 skirmishes per campaign. Besiegers burn about 7 sown plots and drive off 1 herd per decade.
- **Losses:** about 2 people killed in battle by year 20; the villages lose no fights. About 0.24 seasons of hunger per campaign.
- **Spirits:** workers average 70, with 48 percent in high spirits over the campaign (55 percent in years 11 to 20); about 16 feasts in 20 years.
- **Still too easy:** villages almost never lose a fight, and goods pile up even when spent. BACKLOG.md lists ideas.

## Notes by system

Newest first within each system. Numbers are averages over 200 simulated campaigns unless stated.

### The late game, second pass (October 14, 2026)

Twenty-year villages, measured in three steps. High spirits are for years 11 to 20.

| Step | People at year 20 | Food | Goods | High spirits, years 11–20 |
| --- | --- | --- | --- | --- |
| Before | 55 | 563 | 809 | 92% |
| The simulated village spends its goods | 69 | 785 | 581 | 93% |
| Feasts become a custom | 64 | 700 | 452 | 55% |
| Besiegers ravage the land | 66 | 695 | 442 | 55% |

- **Goods.** A village that hires a master and sell-swords every year it can, and pays the clans when it has plenty, still ends with about 440 goods. Spending made it stronger, too: about 14 more people, and fewer sieges (2.1 instead of 3), since sell-swords harry besiegers and turn back raiders.
- **Feasts.** With a feast every winter, nine in ten workers stayed in high spirits in years 11 to 20. As a custom, it is about half; with no feasts at all, about one in five. Feasts still matter, but they no longer carry spirits on their own.
- **Sieges.** Besiegers burned about 7 sown plots and drove off 1 herd per decade; seasons of hunger rose to 0.24 per campaign, from 0.10 before besiegers ravaged, and 178 villages reached the Nation era, down from 188 before feasts and sieges changed. Sallying at even odds when a crop is sown changed almost nothing: siege odds are usually clearly good or clearly bad, and the villages still lost no fights. Making battles losable needs the battle ideas in BACKLOG.md.

### The season report (October 2026)

In twenty-year villages, a season's report fell from about 17 lines to about 11 by year 15 (at most 30 before, 23 after), with about 7 lines of news ahead of the routine work.

### Work on claimed land (October 2026)

Before the council moved work off land another people claims, the simulated villages angered a neighbor over its land in about 34 seasons of every 20-year campaign. Afterward, none; relations with the Tellani finish at about 10 instead of 3. The village strategy now keeps off other peoples' land the way the council does, which shifted the twenty-year results slightly: 55 people instead of 56, about 810 goods instead of 895, and 194 villages reaching the Nation era instead of 184.

### Keeping the peace (October 2026)

In twenty-year villages that send gifts until the Skarn accept peace, and never honor it, peace is lost about three times and remade, with about 2 people killed in battle (0.1 under the old peace, which never broke, and 3 for a village that never seeks peace) and 62 people at year 20 (67 under the old peace, 56 at war). A village that honors the peace whenever warned keeps it all 20 years, with almost no losses, but spends about half the goods it would otherwise have, and still meets about 4 hill clan raids.

### Food stores (October 2026)

In twenty-year villages, keeping 8 seasons of food (the default) cut food in store from about 1,100 to about 580 and food rotted from about 400 to about 150, and raised goods from about 190 to about 880, with no more hunger than before; the village ends a little smaller (56 people instead of 59), since plenty draws settlers and births. Keeping 4 seasons raised goods to about 1,300, but brought a little hunger and a village of about 50.

### The late Settlement era challenge (October 2026)

Before this pass, a large, rich village drew no more danger than a small one: simulated villages stored over 1,300 food by year 20, broke every siege with one sally, and lost about one person in battle in 20 years.

After it, in villages run on default priorities, with no diplomacy and no gifts to the clans, the Skarn keep pace with the village and stay dangerous: about 39 warriors among 107 people at year 20, with about 21 hill clansmen. They lay about three sieges in 15 village years, which hold for nearly two seasons each because a first sally is rarely a good bet, send one great host in most campaigns, and send skirmishers about every year and a half. About 3 people die in battle by year 20 (1 before), food in store is about 1,100 (1,400 before), no village is wiped out, and the Nation era still begins in about year 16. A village that sends gifts to the clans whenever it can faces about a sixth fewer sieges. The simulated villages still win every battle they choose to fight; the pressure comes through seasons lost to sieges, wounds, and the cost of staying strong. Spirits stay high (about 72 percent of workers in high spirits) mainly because harvest feasts cost little once stores are large.

### Uses for goods (October 2026)

See also The late game, second pass, above. When comforts and arms for the guards were added, villages that kept both had about 200 goods after 20 years, down from about 550, leaving room for hiring, caravans, and the shrine; a village that does all of these must keep more people crafting. The food stores setting, added later, sends spare hands to crafts, and goods now pile up again: about 810 after 20 years. A use for goods that grows with the village is still open.

### Laws (October 2026)

Most laws change little on their own, because their value depends on what the player is aiming for. The big one is strangers: open gates grow a village to about 70 people in 20 years, closed gates keep it near 38.

### The second settlement (October 2026)

In campaigns that become a village as soon as they can, the camp becomes a village in about year 5, and the second settlement comes in about year 15 or 16.

### Walls and cover (Settlement era)

From the battle checks: 12 defenders behind a palisade have about even odds against 21 raiders, and a stone wall makes that about five in six.

### The Survival era

A camp run on standing orders, with sensible building, does well in the forest valley: about 26 people after 20 years, and never wiped out. Food no longer piles up past the stores, but most late surplus rots. The harder starting regions are the main answer (see BACKLOG.md).
