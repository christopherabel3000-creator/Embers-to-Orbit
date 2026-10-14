# Embers to Orbit — Balance Notes

What the simulator says about the game's balance. [DESIGN.md](DESIGN.md) says how the game works; this file records how it plays out across hundreds of automatic campaigns, so balance changes can be compared with what came before. Add a dated note here after each balance change.

## Running the checks

- `npm run simulate` plays 200 five-year campaigns with each of three strategies. `node tools/simulate.mjs [games] [years] [strategies]` changes the count, the length, and the strategies (comma-separated).
- Strategies: **sensible** assigns people by hand each season, feasts when the stores are nearly full, and fights a raid when the odds are at least even. **orders** leaves everything to standing orders. **idle** does nothing, as a floor. **village** uses standing orders, becomes a village as soon as it can, claims bordering land, founds a second settlement when ready, fights a raid when the odds are at least even, and sallies against a siege when the war chief gives it three chances in five, or even odds when a crop is sown (besiegers burn it). It spends goods the way a player would, keeping 40 in hand: sell-swords when the Skarn could field as many warriors as it has fighters, a caravan when food runs low, a master each year, and gifts to the hill clans when 150 goods would still be left. It uses no other diplomacy unless asked.
- `DIFFICULTY=easy` (or normal, hard, insane) sets the difficulty; runs use Normal, the default for a new game, unless told otherwise. Notes before October 14, 2026 were measured on what is now Easy.
- Settings for the village strategy, as environment variables: `NOSPEND=1` keeps it from spending goods; `FOODSTORES=4` (or 6, 8, 12, full) sets the food stores; `CLANGIFT=1` sends gifts to the hill clans whenever it can; `PEACE=1` seeks a lasting peace with the Skarn, and `PEACE=honor` also honors it when warned; `LAWS="food=byWork,service=militia"` tries a set of laws.
- `npm run battles` fights hundreds of battles to check combat odds.
- Each run counts fights won and not won (raids, sallies, ambushes, and attacks on Skarn hold) and ambushes scattered from. Before October 14, 2026, the count missed sallies and raids the simulated player answered itself, so older notes undercount lost fights.

## By difficulty (October 14, 2026)

Five-year camps run on standing orders, 200 of each:

| Difficulty | Wiped out | People at year 5 | Food | People lost | Fights not won |
| --- | --- | --- | --- | --- | --- |
| Easy | 0 | 22.5 | 173 | 0.3 | 0% |
| Normal | 0 | 22.2 | 168 | 0.6 | 0% |
| Hard | 0 | 21.3 | 167 | 1.0 | 4% |
| Insane | 0 | 20.1 | 146 | 2.1 | 8% |

A camp played by hand (the sensible strategy) is wiped out 1, 1, 2, and 3 times in 200 from Easy to Insane.

Twenty-year villages, 200 of each, with the simulated village answering raids itself (fight at even odds or better, otherwise hide or scatter):

| Difficulty | Wiped out | People at year 20 | Food | Seasons of hunger | Killed in raids and battles | Fights lost, camp years | Fights lost, village years | Hid or scattered, village years | Sieges | Reach the Nation era |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 0 | 61 | 653 | 0.1 | 2.1 | 0% | 9% | 1.0 | 2.1 | 194 |
| Normal | 2 | 58 | 642 | 1.0 | 2.8 | 0% | 8% | 2.2 | 2.7 | 162 |
| Hard | 5 | 50 | 551 | 1.8 | 4.4 | 4% | 11% | 2.9 | 3.2 | 136 |
| Insane | 17 | 43 | 408 | 3.0 | 6.3 | 11% | 15% | 8.2 | 3.1 | 78 |

- **The steps grow in the village years.** A Skarn nation with more warriors crosses its thresholds more often: it besieges instead of waiting (sieges last 3.4 seasons in all on Easy, 5.2 on Normal, 6.7 on Insane) and gathers great hosts (0.8, 1.3, 1.5, 2.9 a campaign). Hunger comes mostly from sieges and from hiding.
- **Normal** costs little in the camp years (0.6 people lost in five years instead of 0.3) but brings about ten times the hunger of Easy in a village, and 2 villages in 200 are wiped out, around year 12.
- **Insane** villages hide from most fights (8 a campaign), and 17 in 200 are wiped out, around year 12; fewer than half reach the Nation era in 20 years.
- The Skarn's own numbers at year 20 change less than the multiplier suggests, because they lose far more warriors and people in battle on harder levels: about 42 warriors among 108 people on Easy, 41 among 68 on Hard, and 64 among 78 on Insane.

## Where things stand (October 14, 2026, Easy)

Five-year campaigns, 200 of each:

| Strategy | Wiped out | People at year 5 | Food | Rotted | Lost |
| --- | --- | --- | --- | --- | --- |
| Sensible | 1 | 18.7 | 163 | 133 | 0.8 |
| Standing orders | 0 | 22.5 | 173 | 25 | 0.3 |
| Idle | 119 | 0.8 | 1 | 0 | 17.6 |

In the camp years almost no fight is lost (about 1 percent): raids on a palisaded camp are easy wins.

Twenty-year village campaigns, 200 of them (`node tools/simulate.mjs 200 20 village`):

- **Growth:** about 62 people at year 20; the camp becomes a village in about year 5.6, and 186 of 200 reach the Nation era, in about year 16. None are wiped out.
- **Stores:** about 695 food in store (155 rotted over the campaign), 23 stone, and about 450 goods, after hiring about 7 masters and 6 bands of sell-swords.
- **The Skarn:** about 45 warriors among 111 people at year 20, with about 20 hill clansmen. About 1.9 sieges (3.2 seasons under siege in all), 0.7 great hosts, 8.5 skirmishes, and 3.3 ambushes per campaign.
- **Battles:** about 10 fights a campaign, 0.6 of them not won; once the camp is a village, about one fight in eleven is lost, mostly ambushes and sallies. The workers scatter from about 1 ambush in 3. About 3 people are killed in battle by year 20.
- **Spirits:** workers average 70, with 48 percent in high spirits over the campaign; about 16 feasts in 20 years. Hunger is rare (0.04 seasons a campaign).
- **Still open:** goods pile up even when spent, and the camp years' raids are almost never lost. BACKLOG.md lists ideas.

## Notes by system

Newest first within each system. Numbers are averages over 200 simulated campaigns unless stated.

### Battles that can be lost (October 14, 2026)

With the corrected count, twenty-year villages lost about 0.3 fights a campaign before this pass, 4 percent of the fights they chose. The war chief's odds are honest (fights he rates 50 to 70 percent are lost about 40 percent of the time, 90 percent or better almost never), and a careful player only fights at even odds or better, so losses come from fights whose odds are in doubt. Nearly all fights were not: the camp years' raids, outlaws, and hill clans are won at about 99 percent.

Weather, shield walls, and braced spears alone left that unchanged. Ambushes made the difference, once their bands were sized to the workers they fall on:

| Ambush band | Fights a campaign after the village | Lost | Ambushes scattered from |
| --- | --- | --- | --- |
| Three tenths of the Skarn warriors; 4 in 10 skirmishes are ambushes | 6.1 | 6% | 0.7 |
| The same, 6 in 10 skirmishes | 6.7 | 5% | 0.9 |
| 0.8 to 1.3 times the workers' worth; 5 in 10 skirmishes | 7.1 | 4% | 0.2 |
| ...with braced spears weakened, and both sides adapting | 6.6 | 5% | 0.3 |
| 1.2 to 2 times | 6.3 | 7% | 0.3 |
| 1.5 to 2.5 times, at most half the Skarn | 6.3 | 8% | 0.8 |
| 1.8 to 3 times (kept) | 6.1 | 9% | 1.0 |

At first braced spears crushed raiders, who charge three times in four, and the war chief braced every time; braced spears now strike chargers 1.3 times as hard instead of 1.6, and both sides adapt from round to round. In the kept version, about a third of ambushes are scattered from, and about one in six of those fought is lost; sallies are lost about one time in ten. Over the whole campaign, about 3 people are killed in battle (2 before), and the village ends with 62 people (66 before). The camp years are unchanged: almost no fight is lost.

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
