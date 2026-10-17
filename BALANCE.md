# Embers to Orbit — Balance Notes

What the simulator says about the game's balance. [DESIGN.md](DESIGN.md) says how the game works; this file records how it plays out across hundreds of automatic campaigns, so balance changes can be compared with what came before. Add a dated note here after each balance change.

## Running the checks

- `npm run simulate` plays 200 five-year campaigns with each of three strategies. `node tools/simulate.mjs [games] [years] [strategies]` changes the count, the length, and the strategies (comma-separated).
- Strategies: **sensible** assigns people by hand each season, feasts when the stores are nearly full, and fights a raid when the odds are at least even. **orders** leaves everything to standing orders. **idle** does nothing, as a floor. **village** uses standing orders, becomes a village as soon as it can, claims bordering land, founds settlements when ready (up to 6, one every two years at most, from the capital only while it keeps 55 people: the first with heavy demands, the rest normal, salt and iron first, then the richest land, each taking the role its land suits and the most learned governor it can), sends an expedition of 5 for 3 seasons whenever none is out (to the nearest region with places left, led by its best scout), sends an envoy each season to each great nation it has met (an embassy, treaties, a trade route, or a marriage when it can, otherwise a sale of goods beyond 80, salt beyond 40, or iron beyond 60), sends aid to any settlement whose loyalty falls below 55, builds roads once it knows how, fights a raid when the odds are at least even, and sallies against a siege when the war chief gives it three chances in five, or even odds when a crop is sown (besiegers burn it). It spends goods the way a player would, keeping 40 in hand: sell-swords when the Skarn could field as many warriors as it has fighters, a caravan when food runs low, a master each year, and gifts to the hill clans when 150 goods would still be left. It studies Shipbuilding, Astronomy, Harbors, and Navigation early in the Nation era, founds a port at the Grey headland once it knows Harbors (or makes the settlement already there one), buys learning from the Keshari with coin beyond 150, has its steward invite settlers each season once it knows Coinage (keeping 100 coin) and send people out to the settlements while the capital has more than 120, and sends the voyage across the sea as soon as it can. It keeps no army in peace. In the Nation era, when the Skarn have given it a reason for war and it could raise enough soldiers to outmatch them by a fifth, it raises one army all at once (spearmen, archers, and siege engines once it can build them), declares war, and besieges Skarn hold; its commander fights every battle, storms when the odds are three in four or better, and makes peace on the best terms the Skarn will take (or on even terms, or bought, if the war goes badly or lasts three years), then disbands. At most one war every eight years. It uses no other diplomacy unless asked.
- `DIFFICULTY=easy` (or normal, hard, insane) sets the difficulty; runs use Normal, the default for a new game, unless told otherwise. Notes before October 14, 2026 were measured on what is now Easy.
- Settings for the village strategy, as environment variables: `MAXTOWNS=1` caps how many settlements it founds (6 by default); `NOAID=1` never sends aid to its settlements; `NOEXPLORE=1` sends no expeditions; `NOGREAT=1` sends no envoys to the great nations; `TAXES=light` (or heavy) sets the tax law once it can; `NOSPEND=1` keeps it from spending goods; `FOODSTORES=4` (or 6, 8, 12, full) sets the food stores; `CLANGIFT=1` sends gifts to the hill clans whenever it can; `PEACE=1` seeks a lasting peace with the Skarn, and `PEACE=honor` also honors it when warned; `LAWS="food=byWork,service=militia"` tries a set of laws; `NOARMY=1` raises no armies; `ARMY=home` instead keeps a home army of four companies in the valley whenever the Skarn threaten, fighting only with good odds; `WARON=orhai` (or ostrani) makes its war on that great nation once met, marching to their homeland to besiege it, when it can raise 40 soldiers (`WARMIN=` changes that). `NOINVITE=1` never invites settlers for coin, and `INVITERESERVE=250` keeps another reserve (100 by default). `NOSPREAD=1` never sends people out of the capital, and `SPREAD=150` keeps the capital at another size (120 by default). `NOVOYAGE=1` never sends the voyage, and `VOYAGECAP=120` tries another size of capital for it. `WIPED=1` prints the seed and year of each game wiped out, `PROGRESS=1` how long each game took, and `DEBUGWAR=1` each army the strategy raises for war.
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

### The Age of Discovery, phase 1: the sea (October 17, 2026)

The village strategy now plays the sea once its voyage lands: it builds ships at its port up to four (when it has 100 wood), keeps one fleet that carries food (beyond 400 in store) and settlers (while the capital has more than 100) to the foothold until it holds 24 people and 120 food, then charts every waters and coast it has heard of, and sends the foothold's scouts to the nearest region not yet explored. It greets the far shore's peoples with gifts when it has the goods. `NOSEA=1` does none of this.

| | Campaigns landed | Ships at the end (built, lost) | Places found, of 22 | Regions explored, of 6 | Far peoples met, of 3 | Foothold | Whole nation | Goods | Food |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 45 years, 200 campaigns | 163 of 194 | 1.6 (0.7, 0.1) | 15.9 | 5.0 | 2.5 | 15 people, never lost | 422 | 780 | 1,400 |
| 55 years, 100 campaigns | 92 of 98 | 2.0 (1.2, 0.2) | 19.4 | 6.0 | 3.0 | 16 people, never lost | 1,033 | 3,900 | 1,900 |

- **Discovery is quick.** Within about 15 years of the landing the simulated nation has explored the whole far shore and charted three of the four waters (the western isles are charted only when all three of their places are found). That leaves the rest of the era for colonies, which is where phase 2 puts its weight.
- **The sea costs little yet.** Two ships cost about 2 coin a season, and the foothold takes about 15 people. By year 55 the nation passes 1,000 people, with settlements of about 140, and goods and food pile up more than ever. Colonies and their trade should be the answer.
- **Year 45 barely moves:** the whole nation is about 422 instead of 438 (some settlers sail to the foothold, and chance shifts), and the voyage comes in 164 campaigns of 194, about year 39.1, as before.

### Great nations: war comes to you (October 16, 2026)

Forty-five-year campaigns with the village strategy: one that keeps up its diplomacy (as above, meeting any ultimatum with the first terms it can), and one that ignores the great nations (`NOGREAT=1`: no envoys, no trade, every ultimatum refused). It makes peace in a war they declared after a year, on the best terms they will take. 200 of each on Normal, 60 on Easy and Hard:

| | Ultimatums | Wars declared on you | Great hosts at the capital | Campaigns with a host at the capital | Voyage sent by the end | Wiped out |
| --- | --- | --- | --- | --- | --- | --- |
| Diplomat, Normal | 0.26 | 0 | 0 | 0 of 194 | 164 of 194, about year 39.1 | 2 of 200 |
| Ignores them, Normal | 1.73 | 1.72 | 0.54 | 45 of 194 (23 percent) | 109 of 194, about year 41.8 | 2 of 200 |
| Ignores them, Easy | 0.46 | 0.44 | 0 | 0 of 58 | | 0 of 60 |
| Ignores them, Hard | 2.04 | 2.04 | 1.09 | 22 of 58 (38 percent) | | 3 of 60 |

- **Neglect had no cost at first.** Relations drift back toward each nation's view of you, which never fell near the lines for an ultimatum: in the first runs, a nation that ignored them all met no ultimatum. Settlements in their lands, years without word, and contempt for weakness now pull a neglected nation's standing down to about -50.
- **Contempt needed an answer.** At first it weighed on any nation the warlike peoples could outnumber, embassy or not, and the diplomat's peace pacts with the Orhai fell from 173 campaigns in 194 to 3 in 58. An embassy now answers it: 170 of 194 keep that peace.
- **Hosts.** At 3 chances in 20 a season, a great host reached the capital in about half of the neglectful campaigns; at 1 in 25, 23 percent, under the target of a quarter.
- **Easy.** With its line 10 lower, Easy brought nearly as many wars as Normal (1.54); 20 lower, almost none (0.03); 15 lower, about a quarter as many (0.44), and no host at the capital.
- **Field odds** (`npm run battles`): an army meets a great host in the valley without the walls' cover. Five companies against five Orhai companies (worth 2.4) win about 72 percent; four against four Dravan (2.2) about 58 percent; one company more wins about 93 percent. Before the palisade, which the host never reaches while an army stands in its way, it would have been nearly certain.
- **The diplomat pays a little for its settlements in others' lands.** Dravan and Haldi peace pacts are harder to reach, and their raids come about 5.7 times a campaign instead of 3.6. The voyage comes in 164 campaigns of 194 instead of 173. Five campaigns gave up a settlement (and with it their port) to an ultimatum when coin ran short, since the simulated nation takes the first terms it can meet.

### Great nations: envoys and taking sides (October 16, 2026)

Forty-five-year campaigns on Normal with the village strategy, which now also takes the first answer to each envoy (accepting offers, sending aid, paying tribute or a claim when it can, refusing to stop trading), proposes an alliance pact once its other treaties are in place, and mediates wars among the great nations whenever it can. 200 campaigns:

| | Envoys to you | Your alliances at year 45 | Peace pact with the Orhai | Trade routes | Dravan and Haldi raids | Voyage sent by the end | Whole nation | Coin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before (phase 1 only) | none | none | 129 of 194 | 4.2 | 6.6 | 172 of 194, about year 38.9 | 446 | 137 |
| After | 17.3 | 2.9 | 173 of 194 | 6.0 | 3.6 | 173 of 194, about year 38.9 | 480 | 190 |

- **Pace.** With an envoy every 3 to 5 seasons there were about 14.5 a campaign; every 2 to 4 gives about 17, roughly one every 16 months once the great nations are met. Seasons in which no nation has a reason to send one account for the rest.
- **Easier for a diplomat.** Offers of treaties bring peace pacts and routes sooner, and tribute keeps the raiders home: Dravan and Haldi raids fall by about half. The danger that answers this comes in phase 3, when a nation you neglect can go to war with you.
- **Simulator fixes.** Its village strategy could try to found a settlement from a source with no one fit to govern; it now chooses only sources that have a governor.

### Great nations among themselves (October 16, 2026)

Forty-five-year campaigns on Normal with the village strategy (inviting settlers and keeping the capital near 120), after the great nations began to feel, fight, and ally among themselves. 200 campaigns:

| | Wars among them | Alliances made | Voyage sent by the end | Capital | Whole nation | Coin |
| --- | --- | --- | --- | --- | --- | --- |
| Before | none | none | 179 of 194, about year 38.5 | 120 | 469 | 140 |
| After | 5.7 (0.6 still going at year 45) | 1.0 | 172 of 194, about year 38.9 | 117 | 446 | 137 |

- **Pace.** The first try, a 1 in 3 chance each spring, gave about 7 wars in the 28 years of the Nation era, above the target of 4 to 6; 1 in 4 gives 5.7. Without a truce, a beaten people was attacked again by the same winner two years later; the 4-year truce stops that.
- **What it costs the player** is small: trade routes bring half while their people are at war, and less from a beaten people, so the simulated nation, which does not yet react to their wars, is a little smaller and sends the voyage a little later. Part of the change is chance: the great nations' wars draw on the same dice as everything else, so every campaign after the first war plays out differently.

### Moving out of the capital (October 16, 2026)

Forty-five-year campaigns on Normal with the village strategy, inviting settlers as above, now also keeping the capital at about 120 and sending the rest to the settlements. 200 of each:

| | Capital at year 45 | Whole nation | People per settlement | Voyage sent by the end | Coin | Moved out | Skarn warriors | Food rotted | Goods | Born |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inviting, never sending out (`NOSPREAD=1`) | 210 | 426 | 34 | 179 of 194, about year 38.5 | 280 | 0 | 143 | 2,830 | 2,010 | 106 |
| Inviting, keeping the capital at 120 (the default) | 120 | 469 | 55 | 179 of 194, about year 38.5 | 140 | 98 | 92 | 2,320 | 980 | 91 |

- **The voyage is unchanged**: a capital kept at 120 still reaches the 100 it needs. A player who keeps the capital lower will send it later.
- **The nation grows larger** (about 469 instead of 426): settlements grow by a share of their people each spring, so people moved into them keep growing there, while the capital's births slow (91 born in the capital instead of 106).
- **Calmer late game.** The Skarn weigh the capital's strength, so with a capital of 120 they reach about 92 warriors instead of 143. Fewer goods pile up (about 980 instead of 2,000), since a smaller capital crafts less, and less food rots. Deaths in battle (7.4), hunger (1.5 seasons), and spirits (67 percent in high spirits) do not move.
- **A fix found here.** The first run stopped on a missing-worker event whose worker had moved out before the decision was made. Anyone a waiting decision is about now stays in the capital.

### Settlers for coin (October 16, 2026)

Forty-five-year campaigns on Normal with the village strategy, which now has its steward invite settlers each season once it knows Coinage, keeping 100 coin. 200 of each:

| | Capital at year 45 | Whole nation | Voyage sent by the end | Ready but for the capital | Coin | Settlers invited | Skarn warriors | Food rotted | Goods |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Never inviting (`NOINVITE=1`) | 97 | 310 | 100 of 194, about year 42 | about year 34 | 3,200 | 0 | 74 | 570 | 1,120 |
| Inviting, 12 coin each (first try) | 234 | 451 | 179 of 194, about year 38 | about year 34 | 1,850 | 111 | 159 | 3,280 | 2,810 |
| Inviting, 10 coin and 1 more for every 10 people | 225 | 443 | 178 of 194, about year 38 | about year 34 | 950 | 102 | 152 | 3,090 | 2,540 |
| Inviting, 10 coin and 1 more for every 5 people (built) | 210 | 426 | 179 of 194, about year 38.5 | about year 34 | 280 | 88 | 143 | 2,830 | 2,010 |

- **What held the nation back.** An instrumented run (40 campaigns, never inviting) found the capital short of people, not of food (5 to 8 seasons in store, short in 2 to 3 percent of seasons), homes (20 to 30 places spare), or spirits (morale about 74). It grows about one person a year from year 20 to year 35, at about 50: about 2 births and 2 or 3 settlers a year, against 5 to 8 people a year who leave to found settlements. Coin was near zero until about year 28.
- **When the settlers come.** By five-year span (40 campaigns each), capital and coin with inviting against without: years 31 to 35, 58 and 78 against 50 and 249; years 36 to 40, 94 and 163 against 59 and 934; years 41 to 45, 159 and 234 against 79 and 2,187. The voyage has gone in 37 percent of campaigns by years 36 to 40 (7 percent without), and 82 percent by years 41 to 45 (28 percent).
- **The price.** At a flat price the party's size, not the treasury, was the limit, and a bigger capital made more goods to sell for more coin, so coin still piled up. With the price rising 1 coin for every 5 people in the capital, coin is the limit and nearly all of it is spent.
- **After the voyage** the Age of Discovery is not built yet, so the simulated nation goes on inviting: most of the growth past 100 comes after the voyage. The Skarn weigh the capital's strength and grow with it (about 143 warriors instead of 74), more food rots (about 2,800 instead of 570), and goods pile up (about 2,000). Deaths in battle (7.7 against 7.2), hunger (1.5 seasons), and spirits (67 percent in high spirits) barely move. The Age of Discovery should give these people somewhere to go.
- **Earlier eras are unchanged:** settlers can only be invited in the Nation era with Coinage. Five-year camps on standing orders end with 22.2 people, as before.

### The Nation era, phase 5: toward the sea (October 15, 2026)

Campaigns on Normal with the village strategy, which now studies Shipbuilding, Astronomy, Harbors, and Navigation early in the Nation era, founds a port at the Grey headland once it knows Harbors, buys learning from the Keshari with coin beyond 150, and sends the voyage as soon as it can. 200 of each:

| | Capital | Whole nation | Settlements | Ready but for the capital | Voyage sent by the end | Coin |
| --- | --- | --- | --- | --- | --- | --- |
| 35 years | 53 | 140 | 5.3 | 146 of 194, about year 32 | 2 | 550 |
| 45 years | 97 | 310 | 6.1 | 191 of 194, about year 34 | 100 of 194, about year 42 | 3,200 |
| 45 years, founding at most 4 (`MAXTOWNS=4`, then the port) | 121 | 298 | 4.7 | 189 of 194, about year 34 | 137 of 194, about year 40 | 3,500 |

- **The end of the era.** Everything but the capital is in place by about year 34: Navigation, a port with its harbor, four settlements, and three great nations met (all seven by year 45). The capital is the long step. Founding at most four settlements (`MAXTOWNS=4`, then the port; 100 campaigns), 29 of 98 nations send the voyage by year 45 when it asks for a capital of 150, as first planned; 56 when it asks for 120; and 70, in about year 40, when it asks for 100. The voyage now needs a capital of 100. A nation that keeps founding settlements to the last sends it later, or not by year 45, since its settlers leave the capital.
- **Late growth.** Wells and cisterns, Crop rotation, and Mills carry the late Nation era: between years 35 and 45 the whole nation doubles, from about 140 to about 300, and the settlements grow from about 16 people to about 34.
- **Coin piles up** more than ever: about 3,200 by year 45, from trade routes to four or five great nations and envoys selling the surplus to seven. The Keshari's learning (30 study points for about 9 to 12 coin, as relations stand, once a season) uses only a little of it. A standing army is the steady use a player can choose; the Age of Discovery should bring more.
- **New raiders.** The simulated nation settles where the Dravan and the Haldi raid: the iron hills for iron, and the coast for its port. From the middle of the Nation era their war bands and longships come about 11 times in a 45-year campaign; the settlements' guards drive off about a third, and each of the rest kills one to three settlers. A peace pact with them ends it. The Orhai's riders, by contrast, rarely find the simulated nation, which seldom settles the plains.
- **A fix.** A large capital could run out of names for its babies: once every name had been used, and used again as "the Second" through "the Fifth," naming the next child never finished, and the game stopped. Names now go on to "the Tenth," then plain numbers.
- **Earlier years** move a little: at year 35 the capital is about 53 instead of 60, and the whole nation about 140 instead of 150, since the simulated nation now founds a port as well, studies the sea first, and meets two more raiding peoples. The Settlement era is unchanged: with one settlement, no exploring, and no armies, twenty-year villages end with 55 people in the capital, 2 of 200 wiped out, and 178 reaching the Nation era. Five-year camps are unchanged too.

### The Nation era, phase 4: armies (October 15, 2026)

Thirty-five-year campaigns on Normal, with the village strategy, 200 of each:

| | Capital | Whole nation | Settlements | Wiped out | Wars on the Skarn | Skarn starved out | Vassal, tribute, bought, even peace | Field battles won, lost | Soldiers killed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No armies (`NOARMY=1`) | 61 | 152 | 5.1 | 3 | 0 | 0 | none | none | 0 |
| Wars when the moment is right (the default) | 60 | 150 | 5.1 | 2 | 1.4 | 0.6 | 0.99, 0.12, 0.18, 0 | 0.3, 0.9 | 2.4 |
| A home army in the valley (`ARMY=home`) | 52 | 120 | 3.8 | 4 | 0 | 0 | none | 0.1, 0 | 0.1 |

- **When to fight.** The simulated nation can rarely spare enough soldiers to outmatch the Skarn at full strength: about 45 warriors worth 2 each, with 20 hill clansmen, against a capital of about 60 that keeps 30 at home and settlements of about 17 that can spare 5 each. So its wars come right after the Skarn have broken a host on its walls, when they are weak: about one and a half wars a campaign, nearly all won, and the Skarn become vassals about once a campaign (they throw off your rule once they recover, so 16 of 194 are still vassals at year 35). A war costs the nation almost nothing measurable: the whole nation is 150 instead of 152.
- **Armies in peace are expensive.** A home army of four companies standing in the valley deters the Skarn (counted in their reckoning of the capital's strength, they rarely attack, and grow to about 65 warriors) but takes about 40 people from work for years: the nation ends at 120 instead of 152, with fewer settlements and more hunger, and 4 of 200 campaigns are wiped out. The steward now points out an army left idle in the valley for two years with no war.
- **The great nations** are far harder. The Orhai at home (about 55 riders in the great camp by year 30, worth about 2 each, on the open steppe) beat every army of 30 to 40 soldiers the simulated nation sent against them, and it bought peace after about half of those wars (`WARON=orhai WARMIN=30`, 100 campaigns). Wars against them are best fought near home, against their hosts.
- **Field battles** (`npm run battles`): with equal soldiers and numbers about even (49 percent); a quarter better soldiers win about 9 in 10; three companies against four of equal soldiers about 1 in 8; four companies of infantry against four of Orhai riders on open grass about 3 in 5, and in the forest about 6 in 7; storming walls with siege engines costs about a third of the losses it would without. The pace of a battle now follows the average worth of its soldiers, and better soldiers count a little less than numbers, so that well-armed armies do not settle battles in a single round.
- **The Settlement era** is unchanged: with one settlement, no exploring, and no armies, twenty-year villages end with 55 people in the capital, 2 of 200 wiped out, and 178 reaching the Nation era.

### The Nation era, phase 3: the first great nations (October 14, 2026)

Thirty-five-year campaigns on Normal, with the village strategy:

| | Capital | Whole nation | Goods | Coin | Embassies | Trade routes | Orhai peace pacts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Envoys to the great nations | 61 | 153 | 282 | 622 | 1.9 | 1.4 | 99 of 194 |
| No envoys | 62 | 155 | 594 | 2 | 0 | 0 | 0 |
| Envoys, and light taxes | 60 | 152 | 269 | 683 | 1.9 | 1.3 | 78 of 194 |

- **Meeting them.** Expeditions reach both homelands in nearly every Nation-era campaign by year 35 (the Ostrani in 185 of 194, the Orhai in 188).
- **Goods.** Selling goods to the great nations halves what piles up by year 35 (about 280 instead of about 590). Coin now piles up instead, about 600 to 700: wages, hiring, tribute, embassies, and routes use only part of it. Paid soldiers (the standing army of phase 4) will be the large, steady use.
- **The Orhai.** The simulated nation rarely settles the plains or the desert edge (it prefers salt, iron, and the richest land elsewhere), so their riders seldom find a settlement to raid; a player who settles within their reach will meet them sooner and harder. A peace pact comes in about half of the campaigns, a little less with taxes (which leave less to spend on embassies).
- **Joining.** The Velari or the Tellani join the nation in about 56 of 194 campaigns by year 35, and the Skarn become vassals in 1 or 2, since the simulated village rarely breaks them.
- **The Settlement era** is unchanged: with one settlement and no exploring, twenty-year villages end with 55 people in the capital, 2 of 200 wiped out, and 178 reaching the Nation era.

### The Nation era, phase 2: the wider world (October 14, 2026)

Thirty-five-year campaigns on Normal, with the village strategy as it now plays (a more careful founder than in phase 1; see Running the checks):

| | Capital | Whole nation | Settlements | Beyond the valley | Places found | Iron, salt in store |
| --- | --- | --- | --- | --- | --- | --- |
| Sends expeditions | 65 | 162 | 5.4 | 2.7 | 24.7 of 25 | 166, 87 |
| Sends none | 70 | 169 | 5.5 | 0 | 0 | 0, 0 |

- **Exploring.** One expedition out at a time finds almost the whole world (6.9 of 7 regions) between the start of the Nation era (about year 17) and year 35, about 14 expeditions in all, with about one death on the road in every two campaigns. That is about the length the era is meant to take.
- **Settling.** With expeditions, about half the settlements stand beyond the valley, most of them mining towns for salt and iron. Without them, the valley holds about five or six; a nation that never explores is barely smaller by year 35, but it has no iron or salt.
- **Stone.** The simulated village could not found a third settlement until the council kept stone for it: it only quarried what the build queue needed, never the 30 a settlement takes. The council now keeps 40 stone in the Nation era.
- **Iron and salt** pile up modestly. Their later uses (iron arms in phase 4, salt in trade in phase 3) will draw them down.
- **The capital** ends smaller than in phase 1 (65 instead of about 105) because the simulated nation now founds more settlements; the whole nation is about the same size. The era's end asks for a capital of 150, which phase 5 will weigh against how many settlers a nation sends out.

### The Nation era, phase 1: the nation at home (October 14, 2026)

Measured on Normal with the village strategy. The Settlement era is unchanged: with one settlement (`MAXTOWNS=1`), twenty-year villages end with 56 people in the capital and 11 in the settlement (58 in the village before, which kept no record of the settlement), 2 of 200 wiped out, 0.7 seasons of hunger, 6 percent of fights not won, and 176 reaching the Nation era in about year 16.

Thirty-five-year campaigns, founding up to four settlements:

| | Capital | Whole nation | Settlements | People in each | Loyalty | Aid sent | Defiance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sends aid below 55 | 106 | 172 | 3.1 | 21 | 59 | 21 a campaign | none |
| Never sends aid | 104 | 166 | 3.1 | 20 | 46 | none | 6 in 200 campaigns |

- **Growth.** The valley has room for only three or four settlements, on the places a village can claim; the regions of phase 2 will add more. Settlements founded with 10 settlers reach about 20 in a decade. The capital passes 100 people, and starts counting its people by group, in about 112 of 194 Nation-era campaigns by year 35.
- **Skirmishes.** At first settlements lost about as many settlers to Skarn skirmishers as they grew, and stayed near 15 people. Skirmishers now come at each settlement half as often as at the capital's workers, and a settlement's size helps drive them off; together with faster growth (9 percent a year on normal demands, not 5.5), settlements grow.
- **Loyalty.** A settlement on normal demands settles at 55, just loyal; neglect, heavy demands, and skirmishes pull it down. A nation that never sends aid keeps its settlements restless (46), and about one campaign in thirty sees a settlement defy it. Taxes (phase 3) and long wars (phase 4) will add to the pressure.
- **Still open.** Goods pile up even faster over 35 years (about 1,500), since the Nation era has nothing yet that costs goods in bulk; coin and the great nations (phase 3) are the answer. The capital is about 105 at year 35, short of the 150 the end of the era is meant to need; phase 5 will tune that.

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
