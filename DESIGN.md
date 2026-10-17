# Embers to Orbit — Design Document

Last updated Oct 16, 2026 · Christopher Abel

## Vision and pillars

A long, single-player strategy campaign that takes a handful of survivors on an Earth-like world all the way to a spacefaring nation. The player saves and returns over many sessions. Multiplayer modes come later.

- **Deep and complex.** Strategy, resource management, and combat all carry real weight, and new systems unlock as the nation grows.
- **Many playstyles, none forced.** Players are never asked to pick a path or win condition. What they do shapes what they become good at.
- **Screen-reader first.** Fully playable with VoiceOver on iPhone and with a screen reader on a computer. Accessibility is a design rule, not a later patch.
- **Complexity without tedium.** Advisors and standing orders handle repetitive work so the player spends time on real decisions.
- **Turn-based.** No real-time pressure. Every decision can be read, considered, and made at the player's pace.

## Where the game stands

Phase 1, the Survival era, and Phase 2, the Settlement era, are playable on GitHub Pages and on iPhone with VoiceOver, and so is the Nation era, built in five phases. A campaign starts with twelve named survivors in the forest valley and plays season by season. What exists today:

- **Survivors** with ages, six skills that grow with practice, health, and morale; births, childhood, aging, and old age; mentoring.
- **Seasonal work:** hunt, forage, farm, gather wood, build, scout, tend the hurt, study, or rest, with one button (or a standing order) to put everyone on their best work.
- **Food, shelter, and winter:** eating, spoilage, limited storage, feasts, lean times, fires, exposure, and six buildings worked through a build queue.
- **A local map** of 14 places with work sites, wear and recovery, and scouting outward.
- **Knowledge:** seven discoveries through a study queue, including farming with fields.
- **Events:** 17 instant and choice events, three kinds of lean times, plus fever and wolves as ongoing conditions.
- **Three neighboring peoples** with relations, first contact, envoys, trade, tribute, and peace.
- **Tactical battles** for raids, sieges, and an attack on the Skarn hold, with archers on both sides and walls that can be breached.
- **Five advisors** who give ranked advice, forecasts, and odds, and carry out standing orders.
- **Traditions** (ten) **and reputation** that grow from what the camp actually does.
- **The Chronicle** of the campaign, a turn report each season, autosave, and save export and import.
- **Becoming a village** (the start of the Settlement era): a council that assigns everyone's work, guided by the player's priorities; groups by work; guards, huts, and settlers.
- **Stone, goods, and a research tree** in five branches, with 19 discoveries in all, one choice that closes off another, and six new village buildings.
- **The valley peoples as nations:** population, warriors, and land that grow each spring; territory and claims on the map; treaties; trust and remembered promises; Skarn war bands, skirmishers, and great hosts drawn from their real strength.
- **Nations that act on their own:** relations between the nations, their own quarrels and clashes, and five kinds of decisions they bring to you.
- **Uses for goods:** comforts, arms for guards, hired masters and sell-swords, a shrine, caravans, and tribute or ransom paid in goods.
- **Village events:** eleven events of the village's own, mostly choices, including heroes the Chronicle remembers.
- **Laws:** four laws a village can make once it knows Oral law, each with two options that trade one benefit for a cost and shift how the neighbors see you.
- **Four difficulty levels**, chosen at the start and changeable at any time from the Menu screen.
- **A second settlement** under a governor, whose founding begins the Nation era.
- **The nation at home** (the Nation era, phase 1): more settlements, each with a role, demands, and priorities set by the player and a named governor who runs it; loyalty, aid, and defiance; settlements counted by groups, and a capital that counts its people once it passes 100; the Nation and Settlement screens; roads; and a Learning branch of four discoveries.
- **The wider world** (the Nation era, phase 2): seven regions around the valley with 25 places, expeditions with choices on the road, small peoples, wonders, and ruins; iron and salt; settlements beyond the valley; and five more discoveries, including River boats and Mapmaking.
- **The first great nations** (the Nation era, phase 3): the Ostrani and the Orhai, met in their homelands at the edge of the map; envoys, trade for coin, embassies, treaties, marriages, and trade routes; Orhai raids and demands; coin, governors' wages, and taxes; laws on inheritance and worship; the Velari and Tellani joining the nation, and the Skarn as vassals; and nine more discoveries.
- **Armies** (the Nation era, phase 4): companies of six kinds raised from the capital and the settlements under named commanders; marches, supply, and standing orders on the regional map; field battles on the ground of each region; wars declared with or without a reason, raids, sieges the player lays, storming with siege engines, and peace on terms; enemy hosts against your settlements; horses; and ten more discoveries.
- **Toward the sea** (the Nation era, phase 5): the other five great nations (the Keshari, the Dravan, the Ashani, the Haldi, and the Venn) in five new homelands; raids by the Dravan and the Haldi; ships, ports, and a harbor; thirteen more discoveries, including a crown or an assembly; and the voyage across the open sea that ends the era.
- **Settlers for coin** (the Nation era): with Coinage, coin pays the passage of settlers to the capital, a party a season, and the steward can do it under a standing order.

The rest of this document mixes what is built with what is planned. Sections marked "built" describe the game as it plays now; the rest is design for later phases. [BACKLOG.md](BACKLOG.md) lists the next tasks, and [BALANCE.md](BALANCE.md) records how each system plays out in simulated campaigns.

## Accessibility principles

Every screen must be usable by swiping through it with VoiceOver, with no visual-only information.

- **Standard controls only.** Buttons, lists, headings, and form fields, so VoiceOver's built-in gestures work. No custom swipes or drag-and-drop.
- **Places as connected nodes, not grids.** Regions are described by owner, contents, and neighbors, e.g. "Ironwood: yours, 4 soldiers, borders Riverford and Ashen Pass."
- **Lead with what changed.** Announcements are short and put the result first. Full detail lives in a log one tap away.
- **Drill-down hierarchy.** World, then region, then settlement (later: galaxy, star system, planet). The player only hears the level they are on.
- **Headings as landmarks.** Each screen uses headings so the player can jump between sections with the rotor or heading keys.
- **Screen reader keys on desktop.** Screens are built from headings and buttons, so a screen reader's own keys (H for the next heading, B for the next button) move through them quickly. Game-specific keyboard shortcuts are set aside for now (decided with Christopher, October 2026).
- **Optional audio cues.** Sounds for turn start, combat hits, and alerts can supplement speech but never carry information alone.

**Built so far**

- Nine screens reached from a navigation list: Report, People, Map, Build, Knowledge, Neighbors, Advisors, Chronicle, and Menu, plus an End season button; in the Nation era two more, Nation (from which each settlement's own screen opens) and World (from which each region's screen opens). Each screen has one h1, which takes focus when the screen opens.
- Decisions that stop the game (choice events, raids, battle deployment, each battle round) get their own screen with the advisors' views and one button per choice.
- Short confirmations are spoken through a live region; after a screen redraws, focus returns to the control the player was using.
- **A quieter season report** (October 2026). The news comes first: Urgent, Your decision, and What happened. Then the season's routine work sits under its own heading, "The season's work," in a few short lines: what work brought in, what upkeep used (fires, comforts, arms, spoilage), farm and building progress, what other settlements sent home, and skills grown, grouped by skill (a village names only those who reach 4 or 5 and counts the rest). The heading lets the player skip past it. The Chronicle keeps the news, not the routine.
- The People screen has a compact view (one line per person) and splits adults from young people, so a large camp stays quick to swipe through.
- Only native controls: buttons, selects, checkboxes, radio buttons, headings, and lists. Nothing is carried by color alone.
- Every screen is checked automatically with axe in light and dark mode, and play-tested with VoiceOver on iPhone.

## World and peoples

The home planet is a hand-crafted, Earth-like world with its own original peoples, cultures, and history.

- **Hand-crafted map.** One designed world with fixed geography, so each region and nation can have real character.
- **Standard game: 7 rival nations** (6 to 8), each with a distinct culture, values, homeland, and AI temperament. Some lean warlike, some mercantile, some scholarly or expansionist.
- **Challenge mode: up to 16 to 20 nations.** Not for a first playthrough. The full roster gets designed over time; the first 7 are designed in depth now.
- **Nations react to you.** They remember your history with them and with others (see Playstyles).

## Starting regions

The player chooses a starting region, which acts as the difficulty setting and drives replayability. Each start changes resources, threats, neighbors, and long-term strengths.

| Region | Difficulty | Early life | Neighbors (example) | Long-term payoff |
| --- | --- | --- | --- | --- |
| Forest / river valley | Easy | Plenty of food and timber, mild seasons | Peaceful farming people | Fast, steady growth |
| Coast | Moderate | Fishing, early sailing, sea raiders | Seafaring traders | Trade and naval power |
| Mountains | Moderate | Poor farming, natural defenses | Isolated clans | Rich ore, strong fortresses |
| Desert | Hard | Water is the constant struggle | Rival nomad clans | Valuable trade goods, later solar power |
| Arctic | Hardest | Brutal winters, scarce food | Few, hardy peoples | Later oil and rare minerals |

Neighbor examples are placeholders until the 7 nations are designed. Only the forest valley is built so far; the other four regions come in Phase 2.

### The local map (built)

Each starting region has a hand-crafted local map of connected places. The forest valley has 14: the camp, riverbank, and oak woods are known at the start; the north meadow, deer trails, storm deadfall, berry thicket, herb hillside, abandoned camp, beaver ponds, and raider trail are found by scouting, and beyond them lie the homes of three peoples: the Velari fields, Teln landing, and Skarn hold (see Neighbors).

- **Work sites.** Everyone doing the same task works at one chosen place. Places add a bonus to hunting, foraging, or wood gathering. Far places (distance 3) work 10 percent slower, and distant hunting is a little more dangerous.
- **Wear and recovery.** Hunting and foraging use up a place's game and wild food; places recover each season (slowly in winter). Worn places yield as little as 60 percent, which pushes players to rotate sites.
- **Scouting.** Scouts explore the unexplored paths leading from a chosen place, so exploration spreads outward. Some places have special effects: herbs improve healing, the raider trail means raids are always spotted, and the abandoned camp gives one-time supplies.
- The map screen describes each place by its condition, its paths, and who works there.

## Difficulty (built)

Decided with Christopher, October 14, 2026. Difficulty sets how many enemies come against the player's people, in every era. It is part of the saved game, chosen on the New game screen, and can be changed at any time from the Menu screen; a change takes effect at once.

| Level | Enemies, compared with Easy |
| --- | --- |
| Easy | As the game was first balanced |
| Normal (the default for a new game) | A quarter more |
| Hard | Half again as many |
| Insane | Twice as many |

- **Raids on the camp and outlaw bands** are that much larger when they set out.
- **The Skarn nation** keeps that many more warriors under arms (45 percent of its people on Easy, up to 90 percent on Insane), and that many more hill clansmen join it, up to that much more than the usual 40. Its war bands, great hosts, sieges, and ambushes, and the defenders of Skarn hold, grow in step, so the numbers on the Neighbors screen are always the warriors who can come. Ambush bands are also that much larger for the workers they fall on. The Velari and Tellani are unchanged.
- **Changing difficulty** grows or shrinks the Skarn's warriors and the hill clansmen with them at once, by the ratio between the new level and the old.
- Games saved before difficulty existed play on as Easy.

How each level plays in simulated campaigns is in BALANCE.md.

## Turns and eras

Each turn is one season: spring, summer, autumn, winter. Seasons drive planting, harvests, campaigning weather, and winter survival.

The game unfolds in eras. Each era layers new systems on top of the old ones, so the player learns gradually.

1. **Survival.** About a dozen named survivors. Food, shelter, warmth, and threats like raiders, wildlife, and winter.
2. **Settlement.** Population becomes groups by profession. Buildings, first trade, first contact with rival nations.
3. **Nation.** Several settlements under governors, the wider world and its seven great nations, armies on campaign, iron, horses, coin, and salt (see The Nation era).
4. **Age of Discovery.** Voyages and the lands beyond the sea, printing, gunpowder, early science, and colonies. It could end with the first steam engine.
5. **Modern.** Advanced industry, mechanized warfare, intelligence agencies, rocketry research.
6. **Space.** Satellites, orbital mining, colonization, fleets (see Space age).

The Age of Discovery was added in October 2026, between the Nation and Modern eras: going from iron and coin to engines in one era would pile too many new systems into it to learn by ear.

Era advancement is driven by research and growth, not a fixed timer, and the player chooses when to take each step. The Settlement era begins when the player chooses to become a village, any time after the camp has 16 people, a storehouse, a palisade, and farming. It ends, and the Nation era begins, when the village founds a second settlement. The Nation era ends, and the Age of Discovery begins, when the player sends the first ship across the open sea.

## The Settlement era (built)

Decisions made with Christopher, October 2026:

- **The step is the player's choice.** Once the camp reaches the milestone, the Report screen offers to become a village, with a screen that explains what changes. The player can take that step whenever they like, or never. It cannot be undone.
- **The council runs the groups.** In a village, the advisors become the council and set everyone's work at the start of every season. The player no longer assigns people one by one, and focuses on broader aims: council priorities, the build and study queues, trade and diplomacy, feasts, and the food reserve.
- **A second settlement ends the era.** Founding an outpost or a second town marks the start of the Nation era.
- **The valley peoples grow into the first rival nations.** The Velari, Tellani, and Skarn grow alongside the player rather than new nations arriving.
- **People are still simulated one by one under the hood**, so events, battles, births, and skills keep working, but the game presents and manages them as groups. If populations grow into the thousands in later eras, the engine can switch to true group counts.

**Built so far (part 1: becoming a village)**

- **Council priorities:** building, learning, defense, and exploration, each low, normal, or high. The council first covers the essentials: tending the hurt (1 to 3 healers), the fields (enough farmers for the season's work, counting children at part strength), and firewood (woodcutters whenever the woodpile cannot cover three seasons of fires plus the next building). Then it fills the priorities, and puts everyone else on hunting, foraging, or wood by their skill. The food reserve order still runs afterward as a safety net. The player can have the council reassign everyone at once.

| Priority | Low | Normal | High |
| --- | --- | --- | --- |
| Building (while the queue has work) | Up to 2 builders | Enough to finish in about two seasons, up to 6 | Twice that, up to 10 |
| Learning (while a discovery is chosen) | 1 scholar | About 8 percent of workers | About 16 percent, at least 2 |
| Defense | No guards | About 8 percent of workers, at least 1 | About 16 percent, at least 2 |
| Exploration (while anything is left to find) | No scouts | 1 scout | 2 scouts |

- **Food stores** (decided with Christopher, October 2026). A council setting beside the priorities: keep about 4, 6, 8 (the default), or 12 seasons of food at the village's current needs, or as much as the stores hold; never more than the stores can hold. In spring the council sows only enough plots that the harvest brings the stores up to that amount, after the village eats through spring, summer, and autumn; anything already sown is still tended and harvested. While the stores hold that much, everyone who would otherwise hunt or forage goes to building instead (as long as the queue has work they can do: something under way, or the next building paid for in hand) until the queue could be finished that season, and then to crafts; before the village can craft, they cut wood. Below it, they go back to food. The steward says when the stores are full and spare hands are building and crafting.
- **The Village screen** replaces the People screen: council priorities, groups by work with their size and average skill, notable people (the council and anyone with a skill of 5), and a full list of everyone, which is read-only.
- **Guards** (a new task, using the hunting skill): they fight 25 percent harder, two or more on watch always spot raiders early, and each one makes raids 4 percent less likely (down to 60 percent of the usual chance).
- **Huts:** 30 wood and 14 work; they shelter 8. The healer's shelter order builds huts in a village.
- **Settlers:** each season a village with at least 2 seasons of food and room in its shelters has a 15 percent chance of drawing settlers (25 percent in high spirits, 10 percent more with Open hearth), sometimes two at once. Settlers are 16 to 34, with one strong skill.
- **Advice** in a village points to priorities instead of moving people by hand.

**Built so far (part 2: stone, crafts, and the research tree)**

- **Two new resources.** Stone is cut by quarriers (a new task, using the building skill): about 2 plus half their skill a season, plus 1 with stone tools, plus the site's bonus. Loose stones around camp give 1 less; the riverbank gives the base; the Grey cliffs, found by scouting beyond the storm deadfall, give 3 more (they are far, so 10 percent slower). Goods are made by crafters (a new task, also using the building skill): 1 plus 0.4 times their skill a season, plus 1 with kilns and 1 with a workshop.
- **The council handles the new work.** It sends quarriers whenever the build queue is waiting for stone, enough to keep 20 in hand (one more when building is a high priority), up to a quarter of the workers. A fifth priority, Crafts, sets how many people make goods (low: none; normal: about 6 percent; high: about 12 percent).
- **Goods are for trade, gifts, and grand buildings.** Once your people can weave, the Tellani trade 10 goods for about 30 food or 25 wood, and any people will receive a gift of 5 fine goods, worth twice an ordinary gift. A market brings every trading people to buy goods and makes every trade half again as good.
- **Buildings can cost stone and goods.** All of a building's cost is paid when work begins, and the steward says what the queue is short of.

**The research tree.** Every discovery belongs to one of five branches, and the Knowledge screen groups them under a heading for each. Village discoveries show in camp as "becomes possible once your camp is a village."

| Branch | Survival era | Settlement era (cost, needs) |
| --- | --- | --- |
| Food and farming | Smoking and drying; Farming | Animal husbandry (50, farming): pastures. Irrigation (60, farming and stonecutting): plots yield 2 more, and drought hurts the harvest half as much |
| Building and stone | Stone tools | Stonecutting (40, stone tools): the Quarry task. Masonry (60, stonecutting): granaries and the stone wall |
| Crafts and trade | Warm clothing; Pottery | Weaving (40, warm clothing): the Craft task, the workshop, trade with the Tellani. Kilns (50, weaving and pottery): crafters make 1 more goods. Markets (60, weaving): the market |
| War and defense | Fire-hardened spears | Bows (40, spears): hunters bring 1 more food, every fighter strikes harder. Shields and drill (50, bows): guards fight half again as hard instead of a quarter |
| Society and healing | Herbal medicine | Oral law (40): the meeting hall. Then a choice: Council of elders (50: every scholar adds 1 more study point, settlers come more often) or Chieftain (50: guards fight harder still, raids come 15 percent less often). Choosing one closes off the other for good |

| Building | Cost | Work | Effect |
| --- | --- | --- | --- |
| Pasture | 30 wood | 12 | 6 food every season, even winter; up to 3 |
| Granary | 20 wood, 40 stone | 20 | Room for 300 more food; up to 2 |
| Workshop | 30 wood, 15 stone | 16 | Every crafter makes 1 more goods |
| Market | 30 wood, 30 stone, 20 goods | 20 | Trades half again as good; every trading people buys goods |
| Meeting hall | 40 wood, 40 stone, 20 goods | 24 | Spirits settle at 62 instead of 55; quarrels much rarer |
| Shrine | 30 wood, 30 stone, 30 goods | 20 | Needs Oral law. Spirits settle 2 higher; fever less likely; deaths weigh half as much |
| Stone wall | 20 wood, 80 stone | 30 | Needs the palisade. Defenders who hold take 35 percent of the harm instead of 45, and strike harder |

**Built so far (part 3: the valley peoples as nations)**

When the camp becomes a village, the Velari, Tellani, and Skarn become nations. Each has a population, warriors, and stores, and owns its home on the map.

| Nation | People at the start | Growth each spring | Under arms | Lands they reach for, in order |
| --- | --- | --- | --- | --- |
| Velari | 30 plus 2 a year | 5 percent | 12 percent | Herb hillside, Abandoned camp, North meadow |
| Tellani | 24 plus 1 a year | 4 percent | 10 percent | Beaver ponds, Berry thicket, Riverbank |
| Skarn | 40 plus 3 a year | 8 percent | 45 percent | Raider trail, Deer trails, Oak woods |

- **Growth.** Every spring each nation grows by its rate, plus one person for every 60 in its stores (plunder and trade draw newcomers). Warriors move toward their share of the population by up to a third a year, so losses are made good within a few years. As the village grows past four fifths of the Skarn's size, hill clans join the Skarn, a quarter of the difference each year.
- **Territory.** Every place can be owned. The village starts with its camp; each nation with its home. A nation claims its next place each spring once it has 15 people for each place it holds beyond its home, skipping places the village holds. The village can claim a known, unowned place that borders its land, up to 2 places plus 1 for every 10 people. Claiming a place a nation wanted costs some of their goodwill and trust. Working a place another people owns (hunting, foraging, wood, or quarrying) costs 2 relation a season with them, unless there is an open lands pact; the speaker warns of it. **The council keeps work off their land** (October 2026): at the start of each season, a work site another people holds without an open lands pact (because they claimed it, or a pact ended) moves to the best place the village can work freely, and the speaker says where. A place the player picks on the Map screen is left alone, even on another people's land, and the work site choices say whose land a place is.
- **Treaties**, proposed on the Neighbors screen, one envoy a season: a **trade pact** (relations 20, trust 40: trades a quarter better, and their attitude settles 5 higher), **open lands** (relations 15, trust 30: each may work the other's land), and an **alliance** (relations 50, trust 60). Only the Velari and Tellani will make treaties; with the Skarn, there are still tribute, truce, and peace. Ending a treaty is allowed, but costs some goodwill and trust.
- **Trust and memory.** Each nation's trust runs from 0 to 100, starting at 50, and shifts the attitude its relations drift toward (by up to 10 either way). Every year a treaty is kept adds 2. Each nation remembers what you did, shown on the Neighbors screen: agreeing to treaties, coming to their aid, refusing it, breaking a truce.
- **Alliances work both ways.** When the Skarn raid the village, each ally sends about a third of its warriors, who turn back that many raiders. When the Skarn attack an ally, the ally calls for help (a choice): sending up to 4 fighters and 10 food protects them, weakens the Skarn, and earns trust; refusing breaks a promise (25 trust), and an ally whose trust falls below 40 ends the alliance. Without an ally to help, the Skarn raid the weaker of the other two peoples about one spring in three.
- **The Skarn as a real power.** Their war bands are half to four fifths of their warriors and any hill clansmen marching with them (see The late Settlement era challenge), plus any drawn by full stores, and every Skarn warrior killed is lost to them. They weigh what the village's fighters are worth, not just how many there are, and its walls: they storm when the band is worth 85 percent of the village's fighters, counting a palisade as half again and a stone wall as nearly twice as many; otherwise they lay siege or wait and grow, so a weakened Skarn raids less. Their attack on Skarn hold now faces seven tenths of their warriors. Attacking during a truce breaks a promise (30 trust).
- **Skirmishers.** Since the Skarn rarely storm a walled village, their skirmishers fall on people working away from camp: one or two are hurt, and work there brings in half for the season. The chance grows with Skarn warriors and falls with every guard on watch, and each guard has a chance (15 percent each, up to 75 percent, half that in fog) of driving them off and killing one or two. Once the Skarn have 20 warriors, half of the skirmishes they send are full ambushes instead (see Combat).
- **Sieges.** A Skarn band too weak to storm a walled village, but worth at least nine tenths of its fighters in the open, lays siege instead, as does a great host that cannot storm. While the siege lasts, no one can hunt, forage, farm, cut wood or stone, or scout; pastures give half; nothing comes home from other settlements; no settlers arrive; and the council keeps everyone at work inside, with a quarter of them on the walls. The besiegers also ravage the land (see The late Settlement era challenge). The besiegers have 3 to 5 seasons of supplies and lose a tenth of their number (at least 1) to hunger each season, plus more to allies' harassment; they leave when supplies run out or fewer than 4 remain. On the Report screen the player can wait, pay them 3 food per besieger to leave (which also buys a year's truce), or sally out: a battle in the open against besiegers dug in behind stakes and ditches (they take 55 percent of the harm while they hold). Beating them down, or pushing through two zones they leave empty, breaks the siege; otherwise the survivors fall back inside and the siege goes on.
- **Great hosts.** Once the Skarn and the clans with them are strong enough that nine tenths of them could storm the village or besiege it, they may gather a great host, announced a season ahead. It marches with nine tenths of their warriors and clansmen, unless peace is made first; allies turn some back. Hiding from a great host costs 40 percent of the food, 30 percent of the wood, and 30 percent of the goods, twice what hiding from a raid costs.

**Nations that act on their own (built)**

- **Relations between the nations** run from -100 to 100 like yours with them, and show on the Neighbors screen under "Between the peoples." They start with the Velari and Tellani friendly (30), the Velari and Skarn hostile (-40), and the Tellani and Skarn wary (-20), and each spring drift up to 3 back toward those. The Velari and Tellani gain 2 a year from trade while they are on good terms. Each Skarn raid on another people costs 10 between them, and the Skarn pick on whoever is weaker and more hated. If the Velari and Tellani fall to -40 or worse, they come to blows each spring and both lose warriors.
- **Decisions the nations bring:**

| Event | When | Choices |
| --- | --- | --- |
| A treaty offer | The Velari or Tellani would accept a treaty, with relations at least 10 above what it needs | Accept (the treaty is made) or decline (relations fall 3) |
| A land demand | The Velari or Tellani, at relations below 0, see the village holding a place they wanted | Give it up (relations rise 10, a little trust), refuse (relations and trust fall, remembered), or keep it and send 15 goods |
| Taking sides | The Velari and Tellani are on bad terms | Back one (they gain 10 and win the quarrel; the other falls 12, and both remember), stay out (both fall 2), or judge between them, with a meeting hall or a speaker of learning 3 (both rise 4, and the two peoples gain 25 toward each other) |
| A caravan escort | The Tellani are not hostile, the Skarn have 8 or more warriors, and the village has 3 fit fighters | Send the 3 best (20 goods, or 10 goods and some wounds if the Skarn attack; the Tellani remember) or decline |
| A Skarn bargain | The Skarn are not at peace and not deeply hostile | Stand aside while they raid the Velari (a year's truce; half the time the Velari learn of it, and trust falls 20), refuse, or warn the Velari (they rise 8, the raid fails, and the Skarn fall 12) |

**The late Settlement era challenge (built)**

A large, rich village drew no more danger than a small one, so a well-run village grew comfortable (BALANCE.md has the numbers, before and after). Four changes, decided October 2026, make size and wealth draw real pressure that the player answers with choices.

- **The Skarn learn war as a nation.** Each year after the camp becomes a village, Skarn warriors fight 6 percent better, striking harder and harder to bring down, up to twice as well as the old raiders (in about 17 years). Outlaws and hill clansmen fight like the old raiders. The Neighbors screen says how well armed the Skarn are.
- **Hill clans.** Warriors from the eastern hills come for plunder: 1 for every 3 people in the village beyond 30, plus 1 for every 80 food and goods in its stores beyond 300, up to 40. They arrive in spring as soon as the village draws them, and drift home slowly (a quarter of the difference a year) when there is less to take; fallen clansmen are replaced by the next spring. They march in Skarn war bands, sieges, and great hosts, and fall in battle in proportion to their numbers. While the Skarn keep a peace or a truce, the clans are not bound by it: with 5 or more, they raid on their own, with a chance each season of one in 80 for each clansman (up to 30 percent, less with guards on watch), in a band of half to four fifths of them; they fight like the old raiders, and those who fall are lost to the clans until the next spring. On the Neighbors screen the player can send the clan chiefs 2 goods per clansman (at least 10): half go home, and the rest keep away from the village for two years, neither marching with the Skarn nor raiding alone. The war chief counts them in his warnings.
- **A crowded village frays.** Spirits settle 1 lower for every 10 people beyond 30, up to 5 lower. The steward says so, and points to the meeting hall, the shrine, comforts, festivals, and laws.
- **Great hosts strip a village that hides** (see Great hosts above).

Two more, decided with Christopher on October 14, 2026, after simulated villages kept nine in ten workers in high spirits and waited out every siege for free:

- **Feasts become a custom.** In a village, each feast held within seven seasons of the last lifts spirits 3 less than the one before (15, then 12, 9, 6, down to 5; the Feasting days tradition adds 10 before the drop). Once two feasts in a row have made it a custom, a year without a feast lowers everyone's spirits by 6, and the next feast lifts them fully again. The Report screen says what the next feast would do, and the steward warns in the last season before the custom lapses. So a yearly feast no longer keeps spirits high by itself, and skipping a year is a real choice. A camp's feasts are unchanged.
- **Besiegers ravage the land.** Each season of a siege, before the season's farming, they burn a third of the sown plots (at least 1), or in autumn take the whole harvest standing in the fields; drive off the herds of one pasture (the pasture must be rebuilt); and hunt and strip every place the village holds, which loses 25 game and 25 wild food. Waiting out a siege now costs food, which makes a sally worth weighing.


**Uses for goods (built)**

Goods are a resource the village spends, not just trades:

- **Comforts** (a steward order, on by default in a new village): 1 goods for every 6 people each season, and spirits settle 4 higher. A village of 30 or more that can craft, but shares out no comforts, has spirits settle 3 lower.
- **Arms for the guards** (a war chief order): 1 goods per guard each season, and guards fight a fifth harder.
- **Hiring**, on the Village screen: a master of any skill (skill 4) for 25 goods, once a year; or 6 sell-swords for 20 goods, who for a year meet raiders on the road and harry besiegers alongside any allies.
- **A shrine** (30 wood, 30 stone, 30 goods, needs Oral law): spirits settle 2 higher, fever outbreaks are 40 percent less likely, and each death costs the village half the usual spirits.
- **Trade and peace:** a caravan of 30 goods to the Tellani (with a market or a trade pact) brings a little more than three trades' worth of food; the Skarn take 15 goods as tribute for a year's truce; besiegers leave for 1.5 goods each instead of 3 food.


**Village events (built)**

Once the camp is a village, events come a little more often (a 55 percent chance each season instead of 40), and eleven events of its own join the others. Most are choices on their own screen, with advisors' views.

| Event | When | Choices |
| --- | --- | --- |
| Rivalry | The two largest working groups each have 3 or more adults | Side with one (they gain 8 spirits, the other loses 12), split the difference (both lose 3), or let the council judge (free with a meeting hall, otherwise 5 goods; everyone gains 3) |
| A hero of the village | Someone has a skill of 4 or more | Their deed fits their best skill. Raise a cairn (10 stone, everyone gains 8), a feast in their name (2 food a person, everyone gains 10, counts as a feast), or quiet thanks (they gain 15). Either way they gain a level in that skill and are remembered on the Chronicle; their death is mourned by name |
| Fire in the village | At least 2 huts or lean-tos | Everyone fights it (2 or 3 are burned; usually every home is saved), pull down two homes to stop it, or save the stores and lose one home and a tenth of the food |
| Sickness in the herds | Pastures | Cull (lose one pasture), have a healer of skill 3 or more tend them (three in four recover), or leave it to fate (half the time, lose up to two pastures) |
| A traveling craftsman | Any time | Pay 15 goods or 30 food: up to 3 builders, crafters, quarriers, or woodcutters gain a building level, and current study gains 15 points |
| A council member disagrees | The war chief when the Skarn are strong and defense is not high; the scholar while studying and learning is not high; the steward with 3 or more buildings waiting and building not high | Agree (priority set to high), compromise (low to normal), or overrule (the advisor loses 15 spirits, everyone 2) |
| Festival day | Summer or autumn | Celebrate with 10 goods (everyone gains 10) or 2 food a person (everyone gains 8), or skip it (everyone loses 4) |
| A wedding between peoples | The Velari or Tellani at relations 20 or more | Welcome (a newcomer joins; relations and trust rise) or forbid (relations fall) |
| Herders on your land | A neighbor's land borders land you hold | Share (relations rise), drive them off (relations and trust fall), or ask 15 food (they pay if relations are not hostile) |
| Refugees at the gate | The Skarn have 10 or more warriors, and the gates are not closed | Take all 3 to 5, take two, or turn them away; trust with their people rises or falls to match |
| Old ruins | 8 or more places known (not a choice) | 20 points toward the current study, or 10 goods |

**Laws (built)**

Once a village knows Oral law, the Village screen has a Laws section. Each law has two options, or the village keeps to custom, which has no effect. A law can change once a year (every 4 seasons); without a meeting hall, every change lowers everyone's spirits by 5.

| Law | Option | Effect |
| --- | --- | --- |
| Sharing food | Equal shares | Spirits settle 5 higher |
| | By work | Everyone works 5 percent better; spirits settle 5 lower |
| Strangers | Open gates | Settlers 10 percent more likely each season and twice as likely to come in pairs; fever outbreaks half again as likely; the Velari approve (plus 5) |
| | Closed gates | No settlers; spirits settle 3 higher; fever outbreaks half as likely; Skarn skirmishes half as likely; the Velari and Tellani think you cold (minus 3 each) |
| Service | Militia | Every fighter strikes 15 percent harder; everyone works 3 percent less |
| | Guilds | Crafters make 1 more goods and builders do 1 more work; everyone but guards fights 10 percent weaker |
| Justice | Mercy | The Velari approve (plus 3); the Skarn see softness (minus 3) |
| | Harsh law | Quarrels come less than half as often; spirits settle 3 lower; the Skarn respect it (plus 5); the Velari disapprove (minus 3) |

The neighbors' reactions show on the Neighbors screen with their other reasons.

**Built so far (part 4: the second settlement)**

- **When.** A village of at least 40 people that holds a place beyond its camp, and has 80 food, 60 wood, and 30 stone, can found a second settlement. The Report screen says when it is ready, or what is missing.
- **The founding screen** asks where (any place the village holds), its name, how many settlers go (10 to 20, keeping at least 30 at home), who governs (one of the notable people), and its first policy. It cannot be undone. The council picks a fair mix of able adults aged 16 to 50 and stays at home itself; if a council member governs, a successor takes their post.
- **The settlement runs itself.** It sends home what its land is best for: stone from a quarry place, wood from a wood place, otherwise food. Under the supply policy that is 1 food, 0.8 wood, or 0.6 stone per settler each season (food is halved in winter), and it grows 3 percent each spring; under grow it sends 40 percent of that and grows 8 percent. Skarn skirmishers may fall on it, killing a settler or two, unless it is large enough to drive them off. Each settlement lets the village hold 2 more places, and its land counts for claiming what borders it.
- **The Nation era begins** the moment the settlement is founded. Everything from the Settlement era goes on, and the Chronicle names the era. The Nation era's own systems are below.

## The Nation era

Decided with Christopher on October 14, 2026, from the Nation era brief, where he accepted every recommendation. The era is built in five phases; each is playable on its own and checked in the simulator before the next begins.

### The decisions

1. **What the player controls in each settlement:** a role and priorities. Each settlement's governor builds and assigns work to match. The player rules the nation as a whole: its laws, armies, diplomacy, study, and where new settlements go.
2. **Governors** are named people with skills, answerable for their settlement's loyalty. A skilled governor gets more from a settlement. Loyalty falls under heavy demands and neglect (and, in later phases, heavy taxes and long wars); a disloyal settlement sends home less, and in time defies the player.
3. **People as groups.** Every new settlement counts its people by work. Only notable people keep names: governors, commanders, heroes, and masters. The capital switches over when it passes 100 people.
4. **Turns stay seasons.** Standing orders and a nation-wide report keep each season short.
5. **The world** at first: about eight hand-crafted regions around the forest valley. The sea and what lies past it wait for the Age of Discovery.
6. **Expeditions: send and wait.** The player chooses where, who, and how much food; the party reports back, with a choice or two on the way.
7. **The great nations are met by exploring.** Rumors of them come at the start of the era, and each is met when an expedition, caravan, or envoy reaches its land.
8. **The first two great nations:** a river and coast people of traders (the natural partner) and a riding people of the plains (the natural rival). The other five come in phase 5 (built: the Keshari, the Dravan, the Ashani, the Haldi, and the Venn).
9. **The valley peoples can join the nation.** After a long alliance, the Velari or Tellani can become a federated part of it; a beaten Skarn can become a vassal paying tribute.
10. **New resources:** iron, horses, coin, and salt.
11. **The knowledge tree:** all 36 discoveries and three either-or choices below, built in slices, each phase adding the discoveries its systems need.
12. **Armies** are units raised from the settlements and led by named commanders, which march on the regional map, live on what they carry, and fight on the zone battlefield.
13. **Six kinds of soldiers:** spearmen, shield infantry, archers, cavalry, skirmishers, and siege engines.
14. **The era ends with the first ocean voyage** (see The end of the era).
15. **The next era is the Age of Discovery.**

### The five phases

1. **The nation at home (built):** the Nation and Settlement screens, roles and priorities, governors and loyalty, people as groups, the Learning branch with Writing, and Roads.
2. **The wider world (built):** the regional map and its regions, expeditions, river boats, mapmaking, and iron and salt with Mining and Salting.
3. **The first great nations (built):** the two designed first, embassies and trade, coin, taxes, trade routes, and the valley peoples joining the nation.
4. **Armies (built):** companies and commanders, campaigns and supply, sieges the player lays, the six kinds of soldiers, wars and peace, and horses with cavalry.
5. **Toward the sea (built):** the rest of the tree, the remaining great nations, harbors and ships, Navigation, and the voyage that ends the era.

### Phase 1: the nation at home (built)

**Settlements.** Every settlement beyond the capital is run by its governor and counted by groups. Only its governor and its notable people (masters of a skill and heroes) have names.

- **Founding more.** Any time in the Nation era, the capital (with at least 40 people, keeping 30 at home) or a settlement of at least 30 (keeping 20) can send 10 or more settlers to found another on a place the nation holds, for 80 food, 60 wood, and 30 stone from the capital's stores. The governor comes from the capital's notable people or the sending settlement's. The founding form also sets the new settlement's role. Each settlement lets the nation hold 2 more places.
- **Roles.** The player sets each settlement's role, and can change it any season:

| Role | What it does | Its works (built by the governor, up to 3 levels) |
| --- | --- | --- |
| Farming town | Sends home food: 1.8 a season for each worker at the role, half that in winter | Fields and granaries |
| Timber town | Sends home wood: 1.45 for each worker at the role | Sawpits |
| Mining town | Sends home stone: 1.1 for each worker at the role | Quarry works |
| Market town (needs Weaving) | Sends home goods: 0.55 for each worker at the role | Market hall |
| Fortress | Sends home nothing. At least 4 in 10 of its workers are soldiers, who meet raiders on the road to the capital, and the Skarn skirmish your people less often | Barracks |

  Each level of works adds 15 percent to what the role brings in (for a fortress, to what its soldiers are worth). A port came in phase 5: see there.
- **The land.** A role suits some places better: a farming town does a tenth better for each point of the place's best hunting or foraging bonus, a timber town for each point of wood bonus, and a mining town for each point of quarry bonus. A timber or mining town where there is no wood or stone to work brings in half, and a farming town on land with no game or wild food four fifths. The founding form and the Settlement screen say which role the land suits best.
- **Demands** (light, normal, or heavy) set how much of what the settlement brings in is sent home: 40, 70, or all of it. What it keeps helps it grow, with its own children and newcomers drawn to it: each spring it grows by 12, 9, or 5 percent, half that while its loyalty is below 40, and only as far as its homes allow. Light demands raise loyalty by 10; heavy demands lower it by 10. Settlements from older saves keep their policy: grow became light demands, and supply became heavy.
- **Priorities,** as in the capital: Defense (low, normal, or high: 5, 10, or 20 percent of its workers stand guard) and Learning (low, normal, or high: none, 4, or 8 percent study, half again as many with Schools). Scholars everywhere add to the one shared study queue: about 3.5 points a season each, more with Writing.
- **Groups.** About 72 percent of a settlement's people are workers; the rest are children and elders. Of the workers, the governor puts the guards and scholars the priorities ask for on watch and at study, one or two healers once it has a dozen people, a tenth on building while there is something to build, and everyone else at the role. The Settlement screen lists the groups.
- **What it sends home** each season: the workers at the role, times the role's rate, the land, the governor's skill, its loyalty, and its works, times the share its demands ask for. Without a road, a settlement two or more places from the capital loses 15 percent on the way. Nothing comes home while the capital is under siege.
- **Buildings.** The governor builds, in order: homes when the settlement is nearly full (each shelters 8, and takes 14 work), a palisade once it has 15 people (20 work; a fortress builds it first), its works (16, 32, then 48 work, once it has 10, 20, then 30 people), a hall once it knows Oral law and has 25 people (24 work; loyalty 5 higher), and a stone wall once it knows Masonry and has 30 people (30 work). Each builder does 4 work a season (5 with Mathematics).
- **Skirmishes.** Skarn skirmishers fall on each settlement half as often as they come at the capital's workers (seven tenths of that with a road). It drives them off 10 percent of the time, plus 1 percent for each of its people and 10 for each guard (half again behind a palisade, twice behind a stone wall), up to 90 percent. Otherwise a settler is killed (one or two in a settlement of 20 or more), and its loyalty falls by 5 and stays 5 lower for a year: they feel unprotected.
- **Fortresses.** When raiders march on the capital, each fortress sends half its soldiers (more with barracks), who turn back that many raiders on the road and harry besiegers, as allies do. Each fortress also makes Skarn skirmishes on the capital's workers and on the settlements 15 percent less likely (down to 55 percent).

**Governors.** The governor is a named person, chosen when the settlement is founded.

- **Skill.** A governor makes the settlement bring in 85 percent, plus 6 percent for each point of the skill that matches its role (foraging for a farming town, building for timber, mining, and market towns, hunting for a fortress), plus 3 percent for each point of learning: from 85 percent for a novice to 130 percent for a master of both. Governors practice their skills every season, so they grow better at it.
- **Changing governors.** On the Settlement screen the player can make any notable person from the capital, or one of the settlement's own notable people, its governor. The old governor comes home to the capital. A settlement whose loyalty is 50 or more misses the old governor (loyalty falls by 5); one below 40 welcomes the change (loyalty rises by 10).
- **Age and succession.** Governors and notable people in the settlements age and die like everyone else. When a governor dies, the settlement's most skilled notable person takes over, or its people choose one of their own; the report says who.
- **Masters rise.** Each year, a settlement of 30 or more has a one in ten chance that someone there masters a skill and becomes a notable person, and a possible governor.

**Loyalty.** Each settlement has a loyalty from 0 to 100, starting at 70. Each season it moves a quarter of the way toward a target, which the Settlement screen explains line by line. With nothing to move it, a settlement settles at 55, just loyal, so a settlement left to itself needs some attention: a road, a hall, aid, or a wise governor.

| Reason | Change |
| --- | --- |
| Base | 55 |
| Demands | Light 10 more; heavy 10 less |
| The governor's learning | 2 for each point above 2 (from 4 less to 6 more) |
| A hall | 5 more |
| A road to the capital | 5 more |
| Far from the capital (3 or more places away) | 3 less |
| Neglect: no aid for more than two years | 3 less, and 3 more for each year after, up to 15 |
| A deadly Skarn skirmish within the last year | 5 less |

| Loyalty | Word | What it sends home |
| --- | --- | --- |
| 75 or more | Devoted | 10 percent more |
| 55 to 74 | Loyal | As it should |
| 40 to 54 | Restless | 15 percent less |
| 20 to 39 | Discontent | 40 percent less, and it grows half as fast |
| Below 20 | Defiant | It defies you (a choice) |

- **Aid.** Once a year for each settlement, the player can send it a season of food (2 for each person) or goods (1 for every 2 people). Its loyalty rises by 10, and the neglect starts over.
- **Defiance.** When a settlement's loyalty falls below 20, its governor defies the capital (a choice): send gifts to win them back (as much as aid; loyalty rises by 30), send a new governor (the best notable person in the capital who could go; loyalty rises by 20), or let them keep everything for a year (demands become light, it sends nothing for four seasons, and its loyalty climbs 3 more each season). Force comes with armies in phase 4.

**The capital.** In the Nation era the village is the capital, and everything from the Settlement era goes on there. When it first passes 100 people, it counts its people by group for good: the Village screen lists groups and notable people only, and the season report counts the ordinary people who are born, come of age, are hurt, die, or arrive, rather than naming each of them. Notable people are still named. (The engine still follows everyone one by one; a capital of a few hundred is cheap to simulate.)

**Screens.** A Nation screen lists the capital and every settlement on one line each (role, people, loyalty, governor, what it sends home), with a button to open each, and the founding of new settlements. A Settlement screen drills into one: its role, demands and priorities, governor, loyalty and the reasons for it, aid, groups, buildings, and notable people.

**The Learning branch and Roads.** Five discoveries, possible only in the Nation era:

| Discovery | Cost | Needs | Effect |
| --- | --- | --- | --- |
| Writing | 70 | Oral law | Records and letters: every scholar studies a quarter faster |
| Mathematics | 90 | Writing | Builders do 1 more work each, in the capital and the settlements |
| Astronomy | 110 | Mathematics | A calendar of the stars: every field plot yields 1 more food, and farming towns send a tenth more (later, stars to steer ships by) |
| Schools | 80 | Writing; a meeting hall | The young learn twice as fast instead of half again; the learning priority sets half again as many scholars, in the capital and the settlements |
| Roads (Building and stone) | 80 | Stonecutting | Unlocks roads |

A **road** (20 wood, 30 stone, 20 work) is built in the capital's build queue and joins the next settlement without one to the capital, in the order they were founded. A settlement with a road sends home everything it ships (no 15 percent lost on the way, for one two or more places away), is 5 more loyal, and is skirmished seven tenths as often. Later, armies march faster on roads.

### Phase 2: the wider world (built)

**Regions.** Eight hand-crafted regions, the forest valley at their center. The World screen (a navigation button in the Nation era) lists the regions your people know; a Region screen drills into one and lists the places found there. The valley's own places stay on the Map screen.

| Region | Where | Borders | Its character |
| --- | --- | --- | --- |
| The forest valley | Home | Lake country, iron hills, great plains, northern woods | Your home |
| The lake country | South, downriver | Valley, coast, great plains | Fish, reeds, and river routes; reached by river |
| The coast | South, beyond the lakes | Lake country, desert edge | Salt flats, the richest fishing, and the one harbor site; reached by river |
| The iron hills | East, beyond the Skarn | Valley, old ruins | Iron ore. The passes close in winter; the Skarn's skirmishers reach it |
| The great plains | West | Valley, lake country, desert edge | Grass, wild horses, and signs of riders |
| The northern woods | North | Valley, old ruins | The best timber and trapping, the hardest winters, and wolves |
| The desert edge | Southwest, beyond the plains | Great plains, coast | Salt pans, an oasis, and a caravan track to distant peoples |
| The old ruins | Northeast | Northern woods, iron hills | The broken towns of an older people, and what they left |

When the Nation era begins, travelers bring word of the four regions around the valley; a region becomes known by name once an expedition reaches one next to it. Each region holds three or four places (25 in all) of six kinds: places to settle (13), small peoples (the Reed folk of the lake country and the Cairn folk of the iron hills), wonders (Willow isle, the Frozen falls, the Stone circle), ruins (the wreck on the coast, the Broken city, the Sealed vault), dangers (Wolf country and a Burned riders' camp), and routes (the High pass and the Caravan track, for later phases).

**Expeditions** are sent and waited for, from the World screen: the player chooses where (a region heard of, next to one already explored, with places left to find), the leader (from the ten best scouts in the capital), how many go (3 to 8, keeping 20 at home), and how many seasons they explore (1 to 4). The rest of the party are the best scouts and hunters who can be spared; the council stays home unless one of them leads. At most two expeditions are out at once.

- **Travel.** Next to the valley, no time is lost on the way. Each region between adds a season each way, one less through a mapped region; with River boats, the lake country and the coast are reached at once.
- **Food.** The party carries food for the whole journey: 2 for each traveler each season, 1 with Salting while there is salt. If it runs out, everyone is hurt and they turn for home. Food left over comes home.
- **Finding places.** Each season of exploring, the party finds a place with a chance of 35 percent, plus 7 for each point of the leader's scouting and 4 for each traveler beyond three, plus 15 in a mapped region and 10 with the Far horizons tradition, up to 90 percent. A party that has found everything turns for home.
- **Dangers.** Each season away, someone may come to harm: 5 percent, 10 more in winter (20 in the northern woods), and 6 more for each danger found in the region; a fifth less for a party of 6 or more, a fifth less under a leader with scouting or hunting of 4 or more, half in a mapped region, and a fifth less with Far horizons. One time in three the one harmed is killed; otherwise they are hurt. In winter, snow closes the passes of the iron hills, and a party there shelters until spring.
- **Choices on the way.** A quarter of the seasons spent exploring bring a choice, which comes before other events: a river in flood (cross, and someone may be hurt, or go around and lose a season), smoke ahead (bring a season's food as gifts, and the strangers point the way to a place, though in a region with dangers they may be bandits; or avoid them), fever (turn for home, or press on with a 40 percent chance that the sick one dies), and, in the ruins, the iron hills, the coast, and the desert edge, something buried (dig, for 20 study points and a one-in-five chance of a collapse, or leave it).
- **Practice.** Every season on the road is scouting practice, half again as much for the leader.
- **Coming home.** The party rejoins the capital and the report says what they found and who was lost. With Mapmaking, they bring back a map of the region.

**What expeditions find.**

- **Places to settle** become sites for new settlements. Founding one claims it; places beyond the valley count as far from the capital (4 places away next to the valley, 5 beyond), so a settlement there loses 15 percent of what it sends home without a road, and its loyalty is 5 lower for being in another region.
- **Small peoples.** Meeting one is a choice: send 10 goods as gifts (they become friends and guide your people, so the region counts as mapped), invite any who wish to join (2 to 4 come home with the expedition), or greet them and go on.
- **Wonders** lift the spirits of everyone in the capital by 6, and count toward a new tradition, **Far horizons** (two wonders seen): expeditions find places 10 percent more often and come to a fifth less harm.
- **Ruins** give study points to the current discovery (30 at the wreck, 40 at the Broken city, 20 at the Stone circle). The Sealed vault reveals a discovery outright: the one being studied if it can be made, else the next in the queue, else the first ready, or 60 study points if none is.
- **Dangers** make the region more dangerous to travel.

**Iron and salt.** Two new resources, shown in the status line and the stores once there are any.

- **Salt** comes from a mining town at the coast's salt flats or the desert's salt pans: 1 salt for each worker at the role, where stone would be 1.1.
- **Iron** comes from a mining town at an ore place in the iron hills (the Red scar or the Old diggings), once your people know Mining: 0.5 iron for each worker at the role. Before Mining, those towns cut stone.
- **Iron tools** (Iron working): while there is iron in store, the capital's builders, quarriers, and woodcutters do 1 more each. The tools wear out: 1 iron each season for every 4 who use them.
- **Salting**: while there is salt in store, food spoils half as much, using 1 salt each season for every 100 food in store, and expeditions eat half as much on the road.

**The council keeps 40 stone in hand in the Nation era** (20 before), enough to found another settlement.

**Settlements beyond the valley.** Mining towns choose what they send by their land: salt where there is salt, iron from ore once Mining is known, otherwise stone. A farming town counts fishing as well as hunting and foraging. With River boats, settlements in the lake country and on the coast send home by boat and lose nothing on the way, road or not. The Skarn's skirmishers reach only the valley and the iron hills.

**The discoveries of phase 2:**

| Discovery | Branch | Cost | Needs | Effect |
| --- | --- | --- | --- | --- |
| River boats | Exploration | 70 | Weaving | Expeditions reach the lake country and the coast at once; settlements there lose nothing on the way home |
| Mapmaking | Exploration | 90 | Writing | Expeditions map the regions they come home from: a season closer, half the danger, and places 15 percent easier to find |
| Mining | Building and stone | 80 | Stonecutting; iron ore found | Mining towns at ore places send iron instead of stone |
| Iron working | Crafts and trade | 100 | Mining | Iron tools, while there is iron |
| Salting | Food and farming | 70 | Smoking and drying; salt in store | Salted food, while there is salt |

### Phase 3: the first great nations (built)

**The first two great nations.** Word of both reaches the capital when the Nation era begins. Each has a homeland region at the edge of the map, beyond the regions around the valley, which becomes known by name once an expedition reaches a region next to it.

| | The Ostrani | The Orhai |
| --- | --- | --- |
| Who they are | Merchant princes of the Ostran delta, who build their city on islands and send galleys along every coast | Riders of the far steppe, who live on horseback and follow their herds and their khans |
| Homeland | The Ostran delta, far south along the coast (beyond the coast and the desert edge) | The far steppe, far west (beyond the great plains and the desert edge) |
| Temperament | Mercantile: wary of war, which is bad for trade | Expansionist and proud: growing, and moving east toward your land |
| Values | Honest trade and kept treaties; they think little of a people who live by the sword | Strength and courage; they despise a people who pay to be left alone |
| Their nature (where relations settle) | 10, plus a third of your name as honest traders, less a sixth of your name as fierce fighters | -10, plus a third of your name as fierce fighters, less a sixth of your name for generosity |
| Want | Goods, salt, and iron | Grazing land, tribute, and respect |
| Offer | Coin; iron, salt, and food for coin | Peace, at a price (horses come with phase 4) |
| Signature | Their galleys: with a settlement of yours on the coast, every trade with them brings a tenth more | Their riders: they strike far and fast |

- **Meeting them.** An expedition that reaches a homeland meets its people at once; the Orhai also find you on their own, once the Nation era is four years old, by raiding a settlement on the plains or the desert edge. First contact is a choice: gifts of 10 goods (the Ostrani like it, plus 10; the Orhai think it soft, plus 2), greeting them as equals (plus 3 with the Ostrani, plus 8 with the Orhai), or keeping your distance (minus 5).
- **Relations and trust** work as with the valley peoples: relations drift 2 a season toward their nature, shifted by your reputation, an embassy (plus 10), a trade pact (plus 5), a peace pact (plus 5), a marriage (plus 10), a trade route (plus 5), a law welcoming all gods (plus 5), and their trust (a fifth of how far it is from 50). Trust grows 2 a year while a treaty holds. They remember what you did.

**Envoys.** From the Neighbors screen, under "Beyond the valley," one envoy a season to each great nation met:

- **Trade, in lots:** sell 20 goods (8 coin), or 20 fine goods with Fine crafts (13 coin, instead of ordinary goods); sell 10 salt (6 coin) or 10 iron (7 coin); buy 10 iron (10 coin), 10 salt (8 coin), or 40 food (6 coin). The Ostrani trade in all of these; the Orhai buy goods and iron and sell food, and only under a peace pact. What you get is better by half their relations in percent (a quarter more at relations of 50), a quarter more with a trade pact, a quarter more with Weights and measures, a tenth more from the Ostrani with a settlement on the coast, and, with Free markets, from a tenth less to half again as much, changing each season.
- **A gift** of 10 goods: plus 6 with the Ostrani, plus 3 with the Orhai.
- **Tribute to the Orhai:** 15 coin, a quarter more each year in a row (up to about twice that), keeps their riders away for a year.
- **An embassy** (needs Diplomacy; 20 goods and 10 coin): plus 5 at once and 10 to where relations settle, and treaties become possible.
- **Treaties** (need an embassy): a trade pact with either (relations 20, trust 40: trades a quarter better, and a trade route 2 more coin a season) and a peace pact with the Orhai (relations 10, trust 40: their riders leave your settlements alone, and they will trade).
- **A marriage between your ruling families** (needs an embassy and relations 40), once with each: relations plus 15 at once and 10 to where they settle, and trust plus 15.
- **A trade route** (needs Trade routes, relations 10, and with the Orhai a peace pact; 20 goods and 10 coin): 3 coin a season from the Ostrani, 2 from the Orhai, 2 more with a trade pact, and a quarter more with Weights and measures.

**The Orhai.** Their riders fall on your settlements within their reach (on the great plains, the desert edge, and the steppe) with a chance of 6 percent each season, half again as much while relations are below -20, half as much at 20 or more, and twice as much for a year after you refuse them tribute. A settlement drives them off as it would skirmishers, but seven tenths as well; otherwise they kill 1 to 3 settlers and drive off its herds, and its loyalty falls by 8. A peace pact or a year's tribute keeps them away. Every two years while relations are below 30 and there is no peace pact, their envoys **demand tribute** (a choice): pay it, refuse (relations minus 10, and more raids for a year), or, with a fortress on the plains or the desert edge or a name as fierce fighters of 15 or more, show them your strength and send them home with nothing (relations plus 8).

**An Ostrani merchant fleet** (a choice, while relations are 0 or more and you have 40 goods): a fleet going home offers 20 coin, improved like any trade, for 40 goods.

**Coin.** A new resource, shown in the status line and the stores. It comes from trade with the great nations, trade routes, taxes, and silver (a mining town at Silver beck in the iron hills sends 0.25 coin for each worker at its role once your people know Coinage). It pays:

- **Governors' wages** (with Coinage): 1 coin a season for each governor, paid from the treasury if there is coin; a settlement whose governor was paid last season is 5 more loyal. The report says when the treasury could not pay.
- **Hiring:** masters for 10 coin and sell-swords for 8, as well as for goods.
- **Tribute, embassies, and trade routes.**

**Laws for the whole nation.** Law codes unlocks two new laws, and Taxes a third; they work like the village's laws, changeable once a year:

| Law | Option | Effect |
| --- | --- | --- |
| Inheritance | Eldest inherits | Governors serve with a firmer hand: settlements bring in 5 percent more; spirits in the capital settle 2 lower |
| | Shared among all | Spirits in the capital settle 3 higher; the settlements are 3 more loyal |
| Worship | One faith | The settlements are 5 more loyal; spirits in the capital settle 2 higher |
| | All gods welcome | Settlers come 10 percent more often; the great nations think better of you (plus 5) |
| Taxes | Light taxes | The capital and every settlement pay 1 coin each season for every 20 people; the settlements are 5 less loyal; spirits in the capital settle 2 lower |
| | Heavy taxes | 1 coin for every 10 people; the settlements are 12 less loyal; spirits in the capital settle 5 lower |

**The valley peoples join your nation.**

- **The Velari or the Tellani** ask to join (a choice) once your people know Law codes, after six years of alliance, with relations of 60 and trust of 75. If welcomed, they become a settlement of yours at their home, with all their people, under their chief as governor: a farming town for the Velari, a market town for the Tellani (once your people can weave), with light demands, a palisade, a hall, and the first level of its works. Their land becomes yours. They joined as a free people: they will not bear heavy demands, and are 5 more loyal for it. They leave the valley's own round of growth, quarrels, raids, and events. Asked to wait, they ask again in two years.
- **The Skarn** sue to become your vassals (a choice) once they are beaten: in the Nation era, when their warriors number fewer than two fifths of your fighters. As vassals they keep the peace (the hill clans are not bound by it), pay tribute each spring (20 food and 10 goods), and a fifth of their warriors stand with you when raiders come. Each spring, if their warriors number more than four fifths of your fighters, they throw off your rule.

**The discoveries of phase 3:**

| Discovery | Branch | Cost | Needs | Effect |
| --- | --- | --- | --- | --- |
| Coinage | Crafts and trade | 90 | Mining, Markets | Coin from silver, governors' wages, hiring for coin |
| Weights and measures | Crafts and trade | 70 | Writing, Markets | Every trade, with the valley peoples and the great nations, and every trade route, a quarter better |
| Fine crafts | Crafts and trade | 80 | Kilns | Goods sell to the great nations as fine work |
| Trade routes | Crafts and trade | 100 | Roads, Coinage | Trade routes to the great nations |
| Guild charters | Crafts and trade | 60 | Markets; closes off Free markets | Every crafter makes 1 more goods |
| Free markets | Crafts and trade | 60 | Markets; closes off Guild charters | What the great nations pay changes each season, from 0.9 to 1.5 times |
| Law codes | Society and law | 80 | Writing, Oral law | The inheritance and worship laws |
| Taxes | Society and law | 90 | Coinage, Law codes | The tax law |
| Diplomacy | Society and law | 80 | Writing | Embassies, treaties, and marriages with the great nations |

### Phase 4: armies (built)

**Armies** are raised from the Armies screen (a navigation button in the Nation era), and each opens on its own Army screen, one army at a time. A nation can have up to 3 armies, each of up to 8 companies under one commander. A new army gathers in the valley with its commander and its first company.

**Companies** hold up to 10 soldiers, and at least 5.

- **From the capital:** the people it can best spare (healthy adults from 16 to 50, never the council, masters, or heroes, the least skilled first), keeping 30 at home. They leave the capital's work and come home, by name, when they are sent home.
- **From a settlement:** up to 3 in 10 of its people (half, with Levies), keeping 12 at home. They are counted, and rejoin their settlement when sent home; a settlement that has lost its people to the armies is less loyal (see War, below).
- **Where:** new companies join an army in the valley, or in the region of the settlement that raises them. Companies are sent home, and armies disbanded, the same way: in the valley, or where they were raised.

| Kind | Cost | Needs | In battle |
| --- | --- | --- | --- |
| Spearmen | 10 wood | | Strike 1. Brace spears: riders who charge them are struck 1.5 times as hard, and take half again as much harm |
| Shield infantry | 10 wood, 10 goods | Shields and drill | Strike 0.9; take 6 tenths of the harm from arrows. Shield wall: 3 tenths from arrows, but strike at half |
| Archers | 10 wood | Bows | Strike 0.4, shoot 1; take 1.3 times the harm when charged |
| Cavalry | 10 horses, 5 goods | Cavalry | Strike 1.3, and charge 1.4 times as hard (by the ground); swing round a flank to strike the center 1.3 times as hard; cut down a fifth of a company that breaks before them |
| Skirmishers | 5 goods | | Strike 0.6, shoot 0.5; take 7 tenths of the harm; fight better on rough ground; scout, so the enemy's numbers are seen even in fog |
| Siege engines | 30 wood, 20 stone | Siege engines | Strike 0.15, shoot 0.3; stay in the reserve, and each round each company knocks a tenth off the cover of the enemy's walls |

With Levies, a company costs half (horses excepted). With Iron weapons and 5 iron in store, each new company is armed with iron, for 5 iron.

**What a soldier is worth,** against an ordinary raider: (7, plus 1.5 each for Fire-hardened spears, Bows, and the Warrior tradition) divided by 6; times 1.5 with Shields and drill (1.25 without); times the training of the company's time: militia 1, levies 0.85, a standing army 1.25; and times 1.2 with iron arms. A drilled company with spears and bows is worth 2.5 a soldier. The Skarn are worth 1 at first and grow 0.06 a year as a nation, up to 2; the Orhai 1.8, growing 0.03 a year of the Nation era, up to 2.4; the Ostrani's hired soldiers 2.2.

- **A standing army** costs 2 coin a season for each of its companies. If the treasury cannot pay, 2 in 10 of each unpaid company's soldiers go home.

**Commanders** are healthy adults from the capital, from 18 to 60 (not the war chief, who commands at home). Each has one trait, fixed by who they are: **bold** (their soldiers strike 15 percent harder when they attack or charge, and take a tenth more harm), **careful** (15 percent less harm), or **beloved** (companies hold until 3 in 10 remain, instead of half). Their skill is half their hunting skill, plus one for every two battles, up to 5; each point makes the army strike 4 percent harder. A commander is killed in a lost battle one time in seven. They can be replaced from the Army screen.

**Food and supply.** An army carries food for everyone in it: each eats 2 a season, 1 with Salting while there is salt. It carries two seasons of full rations (so four with Salting), two more with Logistics, and one more with carts.

- **Within reach of your stores,** its packs are filled from the capital's stores each season: in the valley, the regions next to it, and any region with a settlement of yours, and with Logistics the regions next to those. Nothing reaches an army while the capital is besieged.
- **Beyond them,** it lives on what it carries, and forages a quarter of what it eats in summer and autumn (half while raiding). An army that runs out of food loses 1 in 10 of its soldiers each season, to hunger and desertion, and turns for home.
- **The wounded** rest with the army: half of them rejoin their companies each season.

**Marching** goes through regions your expeditions have explored, a region a season in summer and autumn, half a region in the spring mud, and none in winter. A step between two regions joined by roads (the valley, or a region with a settlement of yours that has a road) takes half as long. An army of only cavalry and skirmishers marches half again as fast. The Army screen says how long a march will take.

**Orders.**

| Order | Where | What it does |
| --- | --- | --- |
| Hold | Anywhere | Stand and defend the region. In the valley, the army meets raiders on the road to the capital, relieves allies the Skarn attack, and can attack besiegers. Elsewhere, Skarn skirmishers and Orhai riders keep off your settlements there, and enemy hosts must face the army |
| March | To an explored region | The army holds the region it reaches |
| Raid | The enemy's home region, at war | Burn and plunder (see War) |
| Besiege | The enemy's home region, at war | Surround their home (see War) |
| Hold the high pass | The iron hills, once the high pass is found | The hill clans cannot come through to march with the Skarn or raid on their own, and Skarn skirmishers cannot reach the iron hills |

**When a battle comes,** each army's stance decides: **ask me** (the player commands it, or lets the commander fight it; the default), **the commander fights**, or **fight only with good odds** (when the enemy attacks and the commander's odds are below even, the army falls back a region toward the valley before they can; riders cut down or wound 1 in 10 of it on the way).

**An army at home.** An army standing in the valley counts toward the capital's strength when the Skarn weigh an attack. When raiders come for the capital and an army holds the valley, it meets them on the road in a field battle; if it pulls back or is beaten, the raiders go on, less half the army's soldiers, who fight from the walls. While the capital is besieged, the army outside harries the besiegers (4 in 10 of its number fall each season) and can attack them: unless it fights only with good odds and they are worse than 6 in 10, it does each season. An army in the valley, or in a defiant settlement's region, can also bring that settlement to heel (its loyalty becomes 35, one of its people is killed, and every other settlement is 5 less loyal). The steward points out an army that has stood idle in the valley for two years with no war.

**Field battles** use the same zones as a raid (left flank, center, right flank, and a reserve) on the ground of the region where they are fought, up to 6 rounds. The Field battle screen gives the commander's honest odds, then the player deploys (formations: match the enemy, an even line, a strong center, cavalry on the flanks, or a line with a reserve; then each company's place) and orders each zone each round (hold, attack, shield wall, brace spears, swing round the flank, fall back), or lets the commander fight it, or pulls back.

| Ground | Cavalry | Arrows | Rough ground | Holding |
| --- | --- | --- | --- | --- |
| The forest valley | 0.85 | 0.9 | 1.15 | 1 |
| The lake country | 0.7 | 1 | 1.1 | 1.05 |
| The coast | 0.9 | 1 | 1 | 1 |
| The iron hills | 0.6 | 0.9 | 1.2 | 1.2 |
| The great plains | 1.25 | 1.1 | 0.9 | 1 |
| The northern woods | 0.6 | 0.7 | 1.3 | 1.05 |
| The desert edge | 1.1 | 1.05 | 0.95 | 1 |
| The old ruins | 0.7 | 0.9 | 1.15 | 1.15 |
| The far steppe | 1.3 | 1.1 | 0.9 | 1 |
| The Ostran delta | 0.5 | 1 | 1.1 | 1.1 |

- **A round:** the reserve joins the line where ordered; companies with no enemy before them turn to the enemy's strongest zone; siege engines batter walls; arrows fly (rain halves them, fog takes 3 tenths); then the lines meet, and cavalry swinging round a flank strike the enemy center. Each company that falls below half its soldiers breaks (3 in 10 under a beloved commander, a quarter behind walls); an army breaks when fewer than 4 in 10 of its soldiers are still fighting.
- **After six rounds,** walls still standing hold out; otherwise the attacker had to win the field, and the defender holds it unless the attacker is clearly the stronger (a fifth more).
- **Luck and numbers:** each side has its fortune for the battle (0.75 to 1.25) and each round its own (0.75 to 1.25). Better soldiers count, but less than numbers do: a soldier worth a quarter more strikes about a seventh harder. With equal soldiers and numbers, a battle is about even; a quarter better soldiers win about nine times in ten; three companies against four of equal soldiers win about one time in eight.
- **Losses:** of your soldiers lost, 4 in 10 are killed after a victory and half after a defeat; the rest are wounded. Of the enemy's, 6 in 10 are killed. A victory lifts spirits in the capital by 3, and a defeat lowers them by 3. Every battle is a step in the commander's skill.

**War** is declared from the Armies screen, on the Skarn (once met, unless they are your vassals), the Orhai, or the Ostrani (once met), and not within two years of making peace with them.

- **A reason:** their raids on your people (Skarn raids, hosts, sieges, and skirmishes; Orhai raids on your settlements) or an Orhai demand for tribute, within the last two years. Without one, or by breaking your word (a peace or truce with the Skarn, a peace pact with the Orhai), every other people thinks less of you (relations 10 lower) and your settlements are 5 less loyal for two years.
- **What it ends:** a peace with the Skarn (relations 15 lower); with the Orhai or the Ostrani, your embassy, treaties, trade route, trade, and envoys (relations 20 lower).
- **The war score** runs from -100 to 100: a battle won 12, a battle lost -12, a season of raiding 4, a season of siege 6, their home stormed 40, starved out 30, a settlement saved 5, sacked -10.
- **A long war** wears on your people: in its third year and after, the settlements are 2 less loyal for each year after the first (up to 8), and spirits in the capital settle 1 lower for each (up to 4). Each settlement is also 1 less loyal for every 5 of its people away in companies of militia or levies (up to 8); a standing army's soldiers are not missed.
- **The enemy at war.** The Skarn raid as they always have. The Orhai's hosts ride four seasons in ten, and the Ostrani's galleys three, against a settlement of yours within reach (for the Orhai the great plains, the desert edge, and the steppe; for the Ostrani the coast, the lake country, and the delta), with a third of their strength (at least 12). An army in that region fights them before the settlement (with its walls behind it); otherwise the settlement holds out with six tenths of its chance against skirmishers, three tenths more with a keep (up to 95 percent), or is sacked: 15 percent of its people (at least 2) are killed or carried off, and its loyalty falls by 15. With no settlement within reach, they attack an army there. The Orhai keep 50 riders under arms, 4 more each year of the Nation era (up to 100), times the difficulty; the Ostrani 30 soldiers, 2 more each year (up to 60), half again at war; each spring they make good a quarter of what they have lost.
- **Raiding** their home region brings in, each season, 2 food for each soldier (1 in winter and spring), and from the Skarn half a goods each, from the Ostrani a third of a coin each, and from the Orhai a horse for every 10. The army fills its packs first; the rest goes to the capital. Four times in ten they come out to stop it, with 6 tenths of their strength.
- **Sieges.** Their homes: Skarn hold (a palisade, which takes 6 tenths of the harm; all their warriors and the clansmen with them inside; hunger takes 8 percent a season; it yields after 6 seasons), the great camp of the Orhai (no walls; 45 percent of their riders; 6 percent; 6 seasons), and Ostra (stone walls, 4 tenths; 6 tenths of their soldiers; 4 percent, since ships still reach it; 10 seasons). It also yields when fewer than 45 percent of its first defenders, or fewer than 5, remain. An army worth less than half the garrison cannot hem them in: the siege does not begin, and they come out to fight it often. Each season they may come out to break the siege, more often the stronger they are against the army (from 1 to 7 times in 10). While a home is besieged, its people send no hosts, and the Skarn neither raid, skirmish, gather a host, nor raid the other valley peoples.
- **Storming** is a battle against the defenders behind their walls; siege engines batter them down, and the commander gives honest odds first. A home that falls, stormed or starved out, gives up its stores (Skarn hold 60 food and 30 goods; the great camp 20 horses and 20 coin; Ostra 80 coin and 40 goods), lifts spirits by 6, and its people will accept any terms. The Skarn lose a sixth of their people.

**Peace** is offered from the Armies screen, on terms the enemy will take now, by the war score:

| Terms | They agree at | What it brings |
| --- | --- | --- |
| Peace on even terms | Skarn -20, Orhai -10, Ostrani -40 or more | A peace with the Skarn (kept for a year at least), a peace pact with the Orhai |
| Peace, and they pay tribute | 30 | That peace, and each spring for five years: the Skarn 25 food and 10 goods, the Orhai 10 horses, the Ostrani 20 coin |
| Peace, and they give up land | 50 | That peace, and: the Skarn's lands beyond their hold become yours; the Orhai pull back to the steppe, so their riders no longer reach the plains or the desert edge; a free quay in Ostra, so every trade with the Ostrani brings a fifth more |
| They become your vassals (the Skarn) | 70 | As vassals (see phase 3) |
| Pay them for peace | Only when even terms are refused | The Skarn 40 food and 20 goods; the Orhai twice their tribute in coin; the Ostrani 40 coin |

Every term is open once their home has fallen. Peace raises relations by 10.

**Horses,** a new resource, shown in the status line and the stores. With Horse breeding, every 2 pastures in the capital raise a horse each season but winter (at least 1 with any pasture), and a farming town at the wild horse grounds sends home a horse for every 6 of its workers at the role (at least 1) each season but winter. The Orhai sell 10 horses for 15 coin under a peace pact, and pay them in tribute. They mount cavalry, and with 10 or more in store, carts pull your loads: settlements without a road lose half as much on the way home, and armies carry a season more food. With the plough (phase 5), 10 horses also help the farmers.

**The discoveries of phase 4:**

| Discovery | Branch | Cost | Needs | Effect |
| --- | --- | --- | --- | --- |
| Iron weapons | War and defense | 90 | Iron working | Companies armed with iron (5 iron each) are worth a fifth more; your fighters at home strike harder (1.5 more strength) |
| Horse breeding | Food and farming | 90 | Animal husbandry; the wild horse grounds found | Horses from the pastures and the horse grounds, and carts |
| Horse riding | Exploration | 70 | Horse breeding | Expeditions to a region beyond the next reach it a season sooner |
| Cavalry | War and defense | 100 | Horse riding | Companies of cavalry |
| Siege engines | War and defense | 110 | Mathematics | Companies with siege engines |
| Logistics | War and defense | 90 | Roads, Salting | Armies carry two seasons more food, and your stores reach one region further |
| Signal beacons | War and defense | 70 | Writing | Raiders heading for the capital are always seen coming; settlements drive off raiders 15 percent more often |
| Fortresses | Building and stone | 110 | Masonry, Shields and drill | A fortress settlement builds a stone keep after its stone wall (40 work): its soldiers do half again as much on the road to the capital, and it holds out against a host three tenths more often |
| Levies | War and defense | 60 | Shields and drill, Law codes; closes off a standing army | Settlements can send half their people, companies cost half, and new companies are worth 0.85 |
| A standing army | War and defense | 80 | Shields and drill, Coinage; closes off Levies | New companies are worth 1.25 and are not missed at home, for 2 coin a season each |

### Phase 5: toward the sea (built)

**The rest of the tree:**

| Discovery | Branch | Cost | Needs | Effect |
| --- | --- | --- | --- | --- |
| Crop rotation | Food and farming | 90 | Irrigation | Every plot yields 2 more food; a drought takes a tenth of the harvest instead of a fifth; farming towns send a tenth more |
| The plough | Food and farming | 100 | Iron working, Horse breeding | With 10 or more horses in store, each farmer plants, tends, and harvests half again as many plots, and farming towns send a fifth more |
| Mills | Food and farming | 90 | Masonry | Every harvest brings a fifth more; farming towns send a tenth more |
| Fishing boats | Food and farming | 70 | River boats | Foragers fish in winter (3 food, plus 0.6 for each point of foraging, before their work factor), so the council keeps them foraging; farming towns send a tenth more for each point of fishing at their place |
| Bridges | Building and stone | 90 | Roads, Mathematics | Armies march a third faster; settlements in other regions are 3 less loyal for the distance instead of 5 |
| Wells and cisterns | Building and stone | 80 | Masonry | Each home in a settlement shelters 10 instead of 8; settlements grow 2 percent faster each year, and hold out against a host a tenth more often |
| Shipbuilding | Exploration | 100 | River boats, Iron working | Expeditions reach the lake country, the coast, the Ostran delta, and the outer isles at once, and the isles can be reached at all |
| Harbors | Building and stone | 90 | Shipbuilding; a place for a harbor found | A settlement at the Grey headland can be a port |
| Navigation | Exploration | 140 | Shipbuilding, Astronomy | With a harbor, the voyage that ends the era |
| Temples | Society and law | 80 | Writing; a shrine | Spirits in the capital settle 2 higher; settlements are 3 more loyal; each feast lifts every settlement's loyalty by 5 |
| Medicine | Society and law | 90 | Herbal medicine, Writing | Healing a quarter more effective; the sick recover from fever more often (15 percent more each season); a third fewer of the soldiers who fall in battle are killed |
| A crown | Society and law | 90 (60 for a people led by a chieftain) | Law codes; closes off an assembly | Laws can change every two seasons; armies fight a tenth harder and tire of war half as much; settlements are 3 more loyal while most of the capital's workers are in high spirits, and 5 less while they are not |
| An assembly | Society and law | 90 (60 for a people led by a council of elders) | Law codes; closes off a crown | Settlements are 5 more loyal; laws change only every two years; the assembly will not declare a war without a reason, or one that breaks your word |

Fishing became a winter use of foraging rather than a new task, so the council, the People screen, and the standing orders needed no new work to learn; the winter foragers order leaves foragers at their nets once there are boats.

**The other five great nations,** each met by reaching its homeland at the edge of the map, as the first two are. Word of each comes when an expedition hears of its homeland, by reaching a region next to it.

| | Homeland (beyond) | Who they are | Temperament and values | What moves them | Trade | Signature |
| --- | --- | --- | --- | --- | --- | --- |
| The Keshari | The Kesh highlands (the old ruins, the white north) | Star-watchers of the highland towers, heirs of the people who built the old ruins | Scholarly: they prize learning, patience, and kept records, and think little of a people who burn what they do not understand | Nature 5; a sixth of your name as honest traders, less a sixth of your name as fierce fighters, and half a point for every discovery beyond 30 | Buy goods and fine goods; sell 30 points of study for 12 coin | With an embassy among them, every scholar of yours studies a tenth faster |
| The Dravan | The high crags (the iron hills, through passes closed in winter) | Iron-helmed mountain lords; their younger sons come down as the hill clans | Warlike: they honor courage and good iron, and keep their word to the strong | Nature -15; a third of your name as fierce fighters, less a tenth of your name for generosity | Only under a peace pact: buy food and goods; sell iron | Under a peace pact, the hill clans stay home, and neither march with the Skarn nor raid on their own |
| The Ashani | The southern sands (the desert edge, along the caravan track) | Caravan kings of white cities around the great wells | Devout: they honor the gods, hospitality, and an open hand | Nature 5; a sixth of your names for generosity and for welcoming strangers; 10 more for your temples | Buy goods, fine goods, iron, and horses (10 for 18 coin) | A trade route to them brings 4 coin a season, the richest of any |
| The Haldi | The outer isles (the coast and the delta, by ship only) | Sea rovers who fish, trade, and raid in longships | Seafaring: they respect bold sailors and strong arms | Nature -10; a quarter of your name as fierce fighters | Only under a peace pact: buy food and iron; sell 20 goods for 8 coin | With an embassy among them, Shipbuilding and Navigation cost a third less |
| The Venn | The white north (the northern woods, the Kesh highlands) | Deer herders of the white north, in hide tents | Wary: patient and quiet, they fear warlike peoples and warm slowly (their attitude moves 1 a season, not 2) | Nature 0; a fifth of your name for welcoming strangers, less a sixth of your name as fierce fighters | Buy food and iron; sell 20 goods for 8 coin | Under a trade pact, your armies march through winter at half pace |

- **Treaties:** a trade pact is possible with all seven; a peace pact with the Orhai, the Dravan, and the Haldi. Trade routes bring 2 coin a season (1 from the Venn, 3 from the Ostrani, 4 from the Ashani), 2 more with a trade pact.
- **Raids in peace.** As the Orhai's riders do, the Dravan's war bands fall on your settlements in the iron hills (and the crags), and the Haldi's longships on those on the coast, in the lake country, and in the delta: 5 percent a season, half again as often while relations are below -20, half as often at 20 or more, and never under a peace pact. They find you this way before you meet them, once the Nation era is six (the Dravan) or eight (the Haldi) years old. An army holding the region keeps them off.
- **The regions:** each homeland has its people's home and a wonder or ruins: Stonehelm and the ice crown in the high crags; the star towers and the sky wheel (30 study points) in the Kesh highlands; the winter camps, the northern lights, and the ice fields (a danger) in the white north; Ashar of the wells and the singing dunes in the southern sands; Skerry hold and the drowned temple (30 study points) in the outer isles. That makes 15 regions and 38 places.

**Ships and ports.**

- **Shipbuilding** lets expeditions sail along the coast (see the table above). The outer isles are reached only by ship: no army can march there, so a war with the Haldi is fought against their longships.
- **A port** (with Harbors) can be founded at the Grey headland, the one place on the coast where a harbor can stand, or a settlement there can take the role. It sends home 0.3 coin for each worker at the role (a tenth more for each point of fishing there), and its governor's skill is scouting. Its works are the harbor, built like any role's works once it has 10 people: the first level is the harbor the voyage needs.

**War with any of them.** Wars, hosts, raids, sieges, and peace work as in phase 4 for all seven great nations:

| | Soldiers (base, each year, most) | Worth | Home and walls | Garrison, hunger, yields | Hosts at war | Tribute | Land |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The Keshari | 20, 1, 40 | 2 | The star towers, stone (4 tenths) | 8 tenths, 5 percent, 8 seasons | 15 percent, the old ruins and the highlands | 15 coin | none |
| The Dravan | 40, 3, 80, by difficulty | 2.2 | Stonehelm (half) | all, 6 percent, 8 | 40 percent, the iron hills and the crags | 10 iron | they no longer raid the iron hills |
| The Ashani | 30, 2, 60 | 2 | Ashar of the wells (half) | 6 tenths, 5 percent, 8 | 25 percent, the desert edge and the sands | 25 coin | a well on the caravan track: their trade route brings twice as much |
| The Haldi | 30, 2, 60, by difficulty | 2 | Skerry hold (no walls; no army can reach it) | 6 tenths, 5 percent, 8 | 35 percent, the coast, the lake country, the delta, and the isles | 15 goods | they no longer raid your coasts |
| The Venn | 15, 1, 30 | 1.6 | The winter camps (no walls) | half, 4 percent, 8 | 15 percent, the northern woods and the white north | 10 goods | none |

They make peace on even terms at a war score of -40 or more (the Keshari and the Venn), -20 (the Ashani), or -10 (the Dravan and the Haldi). A peace with the Dravan or the Haldi brings a peace pact. Taking their home brings its stores: the star towers 40 coin and 30 goods; Stonehelm 40 iron and 20 goods; Ashar 60 coin and 10 horses; Skerry hold 40 goods and 20 iron; the winter camps 60 food and 30 goods.

**The voyage** that ends the era: see The end of the era, below.

### Settlers for coin (built)

Decided with Christopher on October 16, 2026. In the simulator, coin was near zero until about year 28, then piled up to about 3,200 by year 45, while the capital of 100 was the one thing the voyage still waited on, from about year 34 to year 42. The capital was not short of food, homes, or spirits; it was short of people: births are slow, settlers come at most once a season, and founding settlements takes people from it. So coin now buys people.

- **Inviting settlers.** In the Nation era, once your people know Coinage, coin pays the passage of settlers from beyond the valley to the capital. One party can come each season, of up to 5, as many as the homes and stores can take: a spare place in the homes, and 2 seasons of food for everyone, newcomers included. Not with the gates closed by law, and not through a siege. Settlers are adults from 16 to 34, each with one strong skill, like the settlers who come on their own. The Village screen has the control.
- **The price** is 10 coin a settler, or 8 with open gates, and 1 coin more for every 5 people in the capital: about 20 at 50 people and 30 at 100. A growing capital must reach farther for settlers. At a flat 12 coin, the treasury was never the limit, and a capital that grew bigger made more goods to sell for more coin; the rising price makes coin the limit and spends nearly all of it.
- **The steward's standing order** invites as many settlers as the capital can take each season, keeping a reserve the player chooses (none, 50, 100, 250, or 500 coin). Without the order, the steward points out a treasury of ten settlers' worth or more, and warns when the voyage waits only on the capital.
- **Still open.** After the voyage, a nation that keeps inviting grows its capital past 200 by year 45, and the Skarn grow with it. The Age of Discovery should give those people somewhere to go (colonies beyond the sea) and give coin its next large uses.

### The Nation era's knowledge tree

36 discoveries in seven branches, plus three either-or choices, taking the tree from 19 discoveries to about 55. Writing is the gate to most of them. Each costs about 60 to 160 study points; scholars in every settlement add to one shared study queue, and ruins can give study points or reveal a discovery. Each phase adds the ones its systems need; phase 1's are marked, and phases 2 to 4 list theirs in their own sections. All of it is built: phases 2 to 5 list their discoveries in their own sections.

- **Learning (new branch):** Writing (Oral law; phase 1), Mathematics (Writing; phase 1), Astronomy (Mathematics; phase 1), Schools (Writing, a meeting hall; phase 1).
- **Food and farming:** Crop rotation (Irrigation: plots yield 2 more, and drought hurts less), The plough (Iron working, horses: each farmer plants and tends half again as many plots), Mills (Masonry: every harvest a fifth more), Salting (salt in hand: stored food spoils far less; expeditions and armies carry food twice as long), Fishing boats (River boats: foragers fish through the winter), Horse breeding (Animal husbandry, the plains found: pastures raise horses).
- **Building and stone:** Mining (Stonecutting, ore found: mines for iron, and gold or silver where they lie), Roads (Stonecutting; phase 1), Bridges (Roads, Mathematics: crossings that shorten routes and open new ones), Wells and cisterns (Masonry: settlements grow larger and hold out longer under siege), Fortresses (Masonry, Shields and drill: a stone keep; a garrison holds far longer), Harbors (Shipbuilding, the coast found: a port settlement).
- **Crafts and trade:** Iron working (Mining: iron tools and iron arms), Coinage (Mining, Markets: coin, a treasury, and wages), Weights and measures (Writing, Markets: every trade a quarter better), Fine crafts (Kilns: glass, dyed cloth, and jewelry, which the great nations prize), Trade routes (Roads, Coinage: standing caravans that bring in coin every season), and a choice: Guild charters (crafters more productive at fixed prices) or Free markets (more trade and better prices, which rise and fall).
- **War and defense:** Iron weapons (Iron working: every soldier strikes harder and is harder to bring down), Cavalry (Horse breeding), Siege engines (Mathematics), Logistics (Roads, Salting: armies carry supply longer), Signal beacons (Writing: a raid on any settlement is seen coming), and a choice: Levies (many fighters from every settlement when war comes; weaker, and missed at their work) or a Standing army (fewer, stronger, always ready, paid in coin).
- **Society and law:** Law codes (Writing, Oral law: laws for the whole nation, including inheritance, worship, and taxes), Taxes (Coinage, Law codes: coin from every settlement, at a cost in loyalty), Temples (a shrine: spirits and loyalty rise; festivals bring settlements together), Medicine (Herbal medicine, Writing: wounds heal faster, fewer die of fever or in battle), Diplomacy (Writing: embassies, treaties, and marriages between ruling families), and a choice: a Crown (swift decisions and loyal armies, but loyalty rests on the ruler) or an Assembly (loyalty stays higher, but change comes slower). A Chieftain village leans toward the crown and a Council of elders toward the assembly, but either may choose.
- **Exploration (new branch):** River boats (Weaving), Horse riding (Horse breeding: riders scout twice as far), Mapmaking (Writing), Shipbuilding (River boats, Iron working: ships that sail along the coast), Navigation (Shipbuilding, Astronomy: crossing open water by the stars, the key to the era's end).

### The end of the era (built)

As with becoming a village, the step is the player's to take once the nation is ready, and it cannot be undone. The Report screen shows what is missing, once your people know Shipbuilding, and offers the step when the nation is ready; the report says so the first time it is.

- a capital of at least 100 people
- at least four other settlements
- Navigation known, and a port on the coast with its harbor built
- contact made with at least three great nations

Fitting out the ship takes 120 wood, 60 goods, 30 iron, and 150 food, and a crew of 12, the best scouts the capital can spare (never the council), who sail away with it. The voyage begins the Age of Discovery, which is still to be built: until it is, the game goes on as in the Nation era.

The capital was first set at 150 people. In the simulator, a nation that founds four or five settlements has everything else in place by about year 34, but its capital reaches 150 only rarely by year 45; at 100, it sends the voyage in about year 40, the aim (see BALANCE.md). Since October 16, 2026, a nation that spends its coin inviting settlers sends it in about year 38 or 39.

## Population and resources

People start as individuals and become groups as the settlement grows, so management scales with the nation.

- **Survival era (built):** each survivor has a name, an age, a short story, six skills from 0 to 5 (hunting, foraging, building, healing, scouting, learning), health, and morale. Losing one person matters. Twelve founders start the game; eight wanderers may be found by scouts or arrive asking to join, and friendly neighbors may send young people of their own.
- **Ages and the cycle of life.** Everyone has an age and grows a year older each spring. Children under 5 cannot work. From 5 to 11 they can forage, farm, study, or rest at half strength; from 12 to 15 they can do any work at three quarters strength, including defending the camp; at 16 they are adults. Young children eat 1 food instead of 2 and take half a place in the shelters. From 55, strength fades (85 percent, then 70 percent from 65), and from 60 each year brings a growing chance of dying peacefully. Advisors are succeeded by the most skilled adult.
- **Births.** Each season, a camp with at least two adults aged 18 to 40 may have a baby. The chance grows with the number of young adults, rises when food is plentiful, and falls when food is short, the shelters are full, or spirits are low. The steward says what is holding families back.
- **Learning.** People under 16 learn half again as fast, and anyone working beside a more skilled mentor (skill 4 or more) at the same task learns faster.
- **Skills grow with practice.** Every season at a task earns experience in that task's skill (half as much while badly hurt or sick). Going from level L to L+1 takes 3 + 2L seasons, so early levels come quickly and reaching 5 takes years. Defending against a raid counts as two seasons of hunting practice. The People screen shows each person's progress toward their next level.
- **Settlement era onward (built):** the Village screen presents people in groups by work, managed by the council, while each person is still simulated underneath (see The Settlement era). Overall loyalty, and true group counts for very large populations, come in later eras.
- **Food (built).** Each adult eats 2 food a season and each child under 12 eats 1. Stored food spoils 12 percent a season, 4 percent with a storehouse; smoking cuts that by a third and pottery halves it again.
- **Storage (built).** The stores hold 100 food in baskets and pits, plus 150 for each storehouse (up to 3), and half again with pottery. Half of any food beyond that room rots each season. Big reserves are a choice the player builds for, not something that piles up for free.
- **Feasts (built).** Once a year the player can hold a feast from the Report screen for 3 food a person. It lifts everyone's spirits by 15, and people in high spirits (70 or more) work 10 percent better. Families grow closer, so a birth that season is half again as likely. Inviting a neighboring people costs 15 food more and wins 8 goodwill (counted as a gift). High spirits fade faster the higher they are, so a feast lasts about half a year, and plenty of food alone only keeps spirits steady. The steward can hold a harvest feast at the start of each winter if at least 3 seasons of food would be left. In a village, a yearly feast becomes a custom that lifts spirits less each year in a row (see The late Settlement era challenge).
- **Lean times (built).** They come on their own, apart from other events, so a reserve always matters: a hard winter (a 25 percent chance each winter after the first; fires burn half again as much wood and hunting yields 30 percent less), drought (20 percent each summer after the first; foraging and the harvest yield 40 percent less for summer and autumn), and herds moving away (5 percent each season; game drops sharply everywhere and slowly returns). The steward warns while one lasts, and forecasts account for it.
- **Shelter and warmth (built).** The starting tent and each lean-to shelter 4 people. In autumn and winter the camp burns wood for its fires; anyone without shelter, or left cold when the wood runs out, loses health. The fires take their wood before any building starts, so a build queue can never leave people cold; builders wait for wood instead.
- **Early resources:** food and wood are built, and stone and goods arrive in the Settlement era; water and metal are planned. Food must be stored to survive winter.
- **Later resources** unlock by era: gold and trade goods, iron, then fuel, electricity, and rare minerals; in the space age, off-world materials.

The exact resource list per era is still to be designed.

## Advisors and automation

Advisors always follow orders, but they actively give recommendations and warn the player when a strategy looks risky.

- **Origins.** The first advisors are the original survivors (the skilled hunter becomes war advisor, the herbalist becomes scholar). Successors take over as they age or die.
- **Domains.** Built: steward (food and stores), war chief (defense), healer (health and shelter), scholar (study and discovery), and speaker (neighbors and diplomacy). Each is held by the camp's most skilled adult in the matching skill. Later: trade, intelligence, and space.
- **Forecasts.** Advisors project consequences, e.g. "At current consumption, the granaries run empty in three seasons, one season before harvest." Built: the steward's food forecast counts the coming harvest, the war chief gives the odds of winning a fight, and the steward explains what is holding back births.
- **Severity levels.** Notes, warnings, and urgent alerts.
- **Standing orders.** The player delegates repetitive work, e.g. "keep two winters of food in storage" or "train soldiers whenever the barracks is idle."
- **Best work button.** On the People screen, one button puts everyone on the work they are most skilled at, as far as it makes sense this season: no foraging in winter, only as many farmers as the fields need, builders only when a project is underway (enough to finish in about two seasons), one or two healers only when someone is hurt or sick, at most two scouts while there is anything left to find, and studiers only when a discovery is chosen. The badly hurt and the sick rest. Ties go to food first.
- **Turn report.** Each season opens with a report: urgent alerts first, then the season's news, then its routine work in a few short lines, then what advisors did under standing orders and anything they couldn't handle (see Accessibility principles).
- **Auto-resolve.** The war advisor can resolve minor battles such as small raids.
- **Standing orders in Phase 1** (on the Advisors screen): badly hurt people rest until healed and then return to work; keep someone tending the hurt; keep enough food to last 1 to 4 seasons; foragers hunt in winter and return to foraging in spring; newcomers start at their best task; and a raid policy (ask me, fight if likely to win, or decide for me). The steward can also put everyone on their best work at the start of each season (the same as the People screen button); while that order is on, it takes the place of the rest, healer, winter, and newcomer orders, and the food reserve order still runs after it as a safety net. Two more orders save tedium: the steward can keep the fields staffed (sending people to plant, tend, and harvest, then back to their other work), and the healer can put a lean-to near the front of the build queue whenever the shelters are nearly full. Orders run at the start of each season and are listed in the report. A player's own reassignment always overrides an order.

## Buildings (built)

The camp's buildings. Village buildings, which can also cost stone and goods, are listed under The Settlement era.

| Building | Wood | Work | Effect |
| --- | --- | --- | --- |
| Lean-to | 15 | 8 | Shelters 4 more people; can be built many times |
| Field | 15 | 10 | 6 plots of grain; needs Farming; can be built many times |
| Storehouse | 25 | 12 | Room for 150 more food, up to 3; the first cuts spoilage from 12 to 4 percent and stops mice |
| Healer's hut | 15 | 8 | Healing half again as effective; faster fever recovery |
| Watchtower | 20 | 10 | Raiders are always spotted early |
| Palisade | 40 | 20 | Covers every zone in battles at the camp |

## Building and study queues (built)

The player queues as many buildings as they like on the Build screen and can move them up or down or remove them. Builders' work flows through the queue in order: when a building is finished, leftover work goes straight into the next. For example, 25 work against four queued fields of 10 work each finishes two and leaves the third half built. Each building's wood is paid when work on it begins; if there is not enough wood, building pauses until there is. Removing a building refunds its wood in full if no work was done, or half once work has started.

Study works the same way: the player can queue discoveries, including ones not yet possible, which start as soon as they can. Leftover study points carry into the next discovery.

## Knowledge (built)

Discovery starts in the Survival era. People set to the Study task earn study points (2 plus their learning skill each season, plus 1 with the Love of learning tradition); the player chooses a discovery or builds a queue of them on the Knowledge screen, and partial progress is kept if they switch. The scholar, a fourth advisor, watches over study.

| Discovery | Cost | Needs | Effect |
| --- | --- | --- | --- |
| Fire-hardened spears | 15 | | +1 food per hunter; defenders fight harder |
| Smoking and drying | 15 | | Food spoils a third less |
| Stone tools | 20 | | +1 work per builder, +1 wood per woodcutter |
| Warm clothing | 15 | | Cold and exposure do much less harm |
| Herbal medicine | 20 | Herb hillside found | Healing +20 percent; faster fever recovery |
| Pottery | 25 | Smoking and drying | Spoilage halved again; no more mice in the stores |
| Farming | 35 | Stone tools; North meadow found | Fields and the Farm task |

**Farming** follows the year. Each field holds 6 plots. In spring each farmer plants 2 plots; in summer each tends 3; in autumn each harvests 3. A tended plot yields 10 food and an untended one 6 (1 more with the Rhythm of the seasons tradition); grain nobody harvests yields half. There is no farm work in winter. Farming does not wear out the land, and the harvest arrives just before winter.

These are the Survival-era discoveries; the Settlement era adds twelve more in five branches (see The research tree). Becoming a village needs 16 people, a storehouse, a palisade, and farming.

## Neighbors (built, Survival era)

Three hand-crafted peoples live around the forest valley. Each has a home on the local map, a temperament, and relations with you from -100 (hostile) to 100 (close friends), which drift slowly back toward their nature and your reputation (see Traditions and reputation). When the camp becomes a village, these three grow into the first rival nations (see The Settlement era); the 7 great nations beyond the valley arrive in later eras.

| People | Home | Nature | Starting relations | What they offer |
| --- | --- | --- | --- | --- |
| Velari | Velari fields, beyond the North meadow | Peaceful hill farmers, slow to trust | 10 | Food for wood; at 40 or more, they will teach farming |
| Tellani | Teln landing, downriver beyond the beaver ponds | River traders | 5 | The best trade rates, both ways |
| Skarn | Skarn hold, at the end of the raider trail | Raiders who respect strength | -30 | Nothing but peace: tribute of 20 food buys a year's truce; at 10 or more, a lasting peace |

- **Meeting them.** Scouts who find a people's home make first contact, a choice event (gift, greet, or withdraw) that sets the tone. The Velari come to you if your scouts never find them. The river traders are the Tellani, who introduce themselves after a trade. The raiders are the Skarn, revealed after the first fight.
- **Diplomacy.** The Neighbors screen allows one envoy to each people per season: gifts of food or wood, trades whose rates improve with friendship, and special deals. A new advisor, the speaker, watches over relations.
- **The Skarn and raids.** Once known, the Skarn's mood sets how often raids come: hostile 1.5 times as often, friendly much less. Tribute or peace stops them; only small bands of outlaws remain (and, once there is a village, the hill clans). Defeating their raids angers them. Their riders may demand tribute; refusing or defying them brings raiders soon.
- **Keeping the peace (built, October 2026).** A lasting peace used to switch off every Skarn threat for good, which made the Settlement era far too easy for a player who made peace early. Now it must be kept:
  - **The Skarn respect strength.** Each spring they weigh the village. Once they are a nation, they ask whether nine tenths of their warriors could storm it or besiege it (see The Skarn as a real power); before that, whether its fit fighters, counting a palisade as half again, number fewer than the war band they would send. A village that looks weak is warned, and if it still looks weak the next spring, the Skarn cast the peace aside. A season of grace follows, by custom, and then their raiders may come. Making peace again needs relations of 10, as before.
  - **Honoring the peace.** While at peace, the player can send gifts to the Skarn chiefs from the Neighbors screen: the most of 20 food, their warriors' number in food, or a fifth of the food in store (or half that in goods, or a fifth of the goods). The Skarn hold to the peace for a year, through the next spring, whatever they think of the village's strength. Paying year after year looks like weakness: each year in a row costs more (a fifth of the stores, then 35 percent, then half, up to four fifths), until the village is strong enough not to need it.
  - **Chiefs die.** The Skarn have a named chief, who rules 8 to 15 years. When a chief dies during a peace, the new chief is not bound by it and asks what it is worth (a choice): gifts (the most of 30 food, twice their warriors, or a quarter of the stores; or half that in goods, or a quarter of the goods), the village's best fighter against their champion (a champion fights at one and a half times a Skarn warrior's strength; the war chief gives the odds; a win keeps the peace for at least a year, a loss leaves the fighter badly hurt and ends it), or refusal, which ends it. Without a peace, a chief's death is only news.
  - **The hill clans are not bound by it** (see The late Settlement era challenge).
  - The Neighbors screen names the chief and says how the peace stands; the speaker warns when the Skarn call the village weak.
- **Neighbor events.** The Velari may ask for food after a blight; friendly Velari or Tellani may send a young person to join the camp; the Skarn may demand tribute.

## Traditions and reputation (built)

The camp keeps count of its deeds: battles won, seasons of hunting, harvests, strangers taken in or turned away, gifts and help given, trades, discoveries, buildings finished, feasts held, raids hidden from, and attacks launched. Nothing is chosen from a menu.

| Tradition | Grows from | Effect |
| --- | --- | --- |
| Warrior tradition | 3 battles won | Fighters are stronger in every battle |
| Hunting lore | 80 seasons of hunting (one per hunter per season) | +1 food per hunter |
| Rhythm of the seasons | 3 harvests | +1 food per field plot |
| Open hearth | 3 strangers taken in by choice | Wanderers come more often and settle in happier |
| Generous hands | 5 gifts or acts of help | Gifts win half again as much goodwill |
| Trading ways | 5 trades | +3 food or wood on every trade |
| Love of learning | 4 discoveries | +1 study point per studier |
| Master builders | 8 buildings finished | +1 work per builder |
| Feasting days | 4 feasts | Feasts lift spirits 10 more, and guests leave twice as pleased |
| Hidden ways | 3 raids hidden from | Hiding from raiders loses half as much |

**Reputation** has four parts, each 0 to 30: fierce fighters (battles won and attacks), generous friends (gifts), welcoming to strangers (taken in minus turned away), and honest traders (trades). Each people weighs them differently: the Velari like generosity and welcome and dislike fierceness; the Tellani like honest trading and some generosity; the Skarn respect fierceness and see generosity as softness. Relations drift toward each people's nature plus these shifts. The Chronicle screen shows traditions, those taking shape, and your reputation; the Neighbors screen shows how each people sees you.

## Events (built)

Events keep seasons from feeling the same. After each season there is a 40 percent chance of one event, and the same event cannot repeat within 6 seasons. Raids take priority.

- **Instant events** simply happen and appear in the report: storms (wreck a lean-to or soak the woodpile), bumper crops, fever outbreaks, mice in the food stores (a storehouse or pottery prevents this), winter cold snaps, fireside stories that lift spirits, and a visit from the Velari if your scouts have not found them.
- **Choice events** stop the game on their own screen, with advisors' views, and the player picks an option: a sick traveler asking to join, wolves moving into a hunting ground, a quarrel between two survivors, a missing worker, river traders, a wild beehive, first contact with a people, the Velari asking for food after a blight, a neighbor's young person asking to join, and a Skarn demand for tribute. Outcomes appear under "Your decision" in the report.
- **Ongoing conditions.** Fever: the sick lose health, work at half strength, and spread it, faster in a crowded camp; tending the sick and a healer's hut speed recovery. Wolves: hunting at their place is more dangerous and yields less for about a year.
- Events tie into existing systems: places on the map, shelter, the storehouse, advisors, and standing orders (for example, keeping a healer on duty also covers the sick).

## Playstyles, traditions, and reputation

The Survival-era version of traditions and reputation is built (see above); this section is the long-term design.

Players never choose a playstyle or win condition. Their actions make certain things easier, and a nation's identity emerges from its history.

- **Natural advantages.** A nation that builds warships and jets is simply better at war. A nation that invests in trade has more partners and wealth.
- **Traditions.** Earned automatically from repeated actions, never picked from a menu. Many victories might create a martial tradition (soldiers train faster). Generations of trade might create a merchant tradition (better deals). A nation can hold several at once.
- **Reputation.** Other nations judge you by your record. Aggression makes neighbors wary; honoring treaties makes alliances easier; broken promises are remembered.
- **Common approaches the systems should support:** military conquest, trade and economics, diplomacy and alliances, science and technology, espionage, or any mix.

## Diplomacy, trade, and espionage

The player can trade with, ally with, or fight any nation, and relationships shift over time.

- **Diplomacy:** treaties, alliances, non-aggression pacts, vassals, and later federations. Nations weigh your reputation and their own temperament.
- **Trade:** trade routes and resource deals. Some resources only exist in certain regions, which makes trade or conquest necessary.
- **Espionage:** scouts early; spies, saboteurs, and intelligence agencies later; satellites in the space age. Spies can gather intelligence, steal technology, sabotage, and destabilize rivals.

Detailed rules for each are still to be designed.

## Combat

Battles happen on a battlefield split into zones, and both sides make tactical decisions each round.

**Battlefield.** Zones: left flank, center, right flank, and reserve, plus terrain features such as a hill, river ford, or treeline. Each zone reads as a short summary, e.g. "Center: your 40 spearmen versus their 60 warriors. You hold the hill."

**How a battle plays out**

1. **Before battle:** deploy units to zones, choose a commander, and set a stance (aggressive, defensive, delaying). Scouting reveals what the enemy brought.
2. **Each round:** both sides secretly give each formation an order (hold, advance, flank, charge, volley, fall back). Orders resolve at the same time.
3. **Morale:** units break and flee long before they are destroyed. Retreating early to save an army is a valid choice.

**Built so far (Survival and Settlement eras)**

- **Zones:** left flank, center, right flank, plus a reserve. At your camp, the palisade (if built) covers every zone and the treeline covers the left flank. At Skarn hold, the Skarn hold walls on a rocky hill.
- **Deployment:** choose a formation (even line, strong center, strong left or right, a fifth in reserve, or match the enemy) and adjust each fighter's position, including keeping someone behind. Or let the war chief command, or hide.
- **Rounds (up to 4):** each group gets an order: hold (takes less harm; behind the palisade it also strikes hard), attack (hits harder, takes full harm), swing round to hit the enemy center (from a flank, hits hard but leaves that flank open), or fall back to the reserve. The reserve can join any zone. Orders resolve at the same time as the enemy's.
- **Empty zones:** raiders who meet no one in a zone reach the stores and carry off food and wood. When attacking Skarn hold, pushing through two zones they leave empty wins.
- **Breaking:** a group that loses more than 60 percent of its strength breaks and flees; the enemy gives up when it is down to 35 percent of its fighters, and after 4 rounds they pull back with what they took.
- **Cover (rebalanced in the Settlement era).** Holding behind a palisade takes 55 percent of the harm and strikes at full strength; behind a stone wall, 45 percent and a little harder.
- **Archers.** Once the Skarn are a nation, a quarter of every war band are archers. Arrows come over walls, so cover protects only half as well against them. Your own people with hunting 3 or more shoot as archers once you know Bows (guards stand in the line instead). Archers strike at full strength even while holding, but a group mostly of archers that warriors charge takes 30 percent more harm, on either side. The field shows archers in every zone.
- **Breaches.** Each round that warriors attack a zone behind a palisade or wall, they may break through: about 10 percent plus 4 percent for each warrior more than the defenders there, up to half; 60 percent if no one defends it; half that against a stone wall. A breached zone loses its cover for the rest of the battle.
- **Wounds and deaths** fall on the people who fought. Every fighter gains two seasons of hunting practice.
- **Weather** (decided with Christopher, October 14, 2026). Each season has its weather, drawn as it begins, and every battle that season is fought in it. Spring: clear, rain (35 percent), or fog (15 percent). Summer: clear, heat (30), or rain (15). Autumn: clear, fog (30), or rain (30). Winter: clear, snow (55), or fog (15). Rain halves what archers strike for and slows a charge (charging fighters strike 15 percent less hard). Fog: archers strike at 70 percent, the enemy's numbers stay hidden until the first round even when scouts warned of them, and raiders are harder to spot: the watchtower and the raider trail see nothing, only two guards on watch do, and scouts half as often. Snow: everyone strikes 10 percent less hard and every wound does 5 more harm. Heat: from the third round, everyone strikes 15 percent less hard. The battle screens and the siege section of the Report screen say what the weather does, and the war chief's odds count it.
- **Shield walls and braced spears** (decided October 14, 2026). Two orders beside hold and attack. A shield wall (needs Shields and drill) takes 30 percent of the harm from arrows and at most 60 percent from blows, but strikes at half strength. Braced spears (need Fire-hardened spears) strike charging fighters 1.3 times as hard and anyone else at half; they stand in front of any walls, so they take blows as in the open (70 percent) and get no shelter from arrows. Skarn bands use both once they are well armed (once their arms reach 1.3, about five years after the camp becomes a village): they lock shields against archer-heavy groups and brace against fighters strong enough to charge them, and they will not charge into spears they saw braced the round before. The war chief locks shields against zones that are half archers or more, and braces spears in the open against raiders who charged last round.
- **Ambushes** (decided October 14, 2026). Once the Skarn have 20 warriors, half of their skirmishes are ambushes: a band falls on the workers at a place away from camp, sized to beat them as the Skarn judge it (1.8 to 3 times what those workers are worth, at most half the Skarn's warriors). It is a battle in the open, with no walls or trees, and a surprise. Only those working there can fight; half the guards on watch, the strongest, come running and start in the reserve. The player can fight, let the war chief command, or scatter for home: four in ten of the workers are hurt on the way, and work at that place brings in half for the season. Losing the fight does the same; winning lifts everyone's spirits and costs Skarn warriors. Ambushers never reach the stores.
- **The war chief** suggests orders each round and can finish the battle at any time; their estimate of the odds comes from quietly fighting the battle many times in their head. A careful player who fights only at even odds or better loses about one battle in ten once the camp is a village, mostly in ambushes and sallies (see BALANCE.md).
- **Strength:** each raider fights with a strength of 6, and Skarn warriors grow stronger and harder to bring down each year they are a nation, up to 12 (see The late Settlement era challenge); defenders fight by their hunting skill and health, with bonuses from fire-hardened spears and the Warrior tradition. Raids grow by 2 raiders a year for five years, then by 1 every two years, leveling off at 16 more than the first raids. Full stores draw notice: beyond 200 food, raids come a little more often (up to 10 percent more) and bring 1 more raider for every 120 food (up to 5 more). Surprise (no warning from scouts or the watchtower) weakens the defenders and strengthens the raiders in the first round.
- **Attacking Skarn hold** (from the Neighbors screen, once your scouts have found it): 8 warriors plus 1 per year defend it. Victory brings their stores (30 food and 20 wood), two years of truce, and enough respect for a lasting peace. Defeat brings revenge raids.
- **Raid choices:** before a raid the player can deploy and fight, let the war chief command, or hide in the woods and lose some stores. A standing order can decide for them.

**Field battles between armies** (the Nation era) use the same zones, with six kinds of soldiers, the ground of each region, and morale that breaks a line long before it is destroyed: see Phase 4: armies, under The Nation era.

**Modern era additions**

- **Air and sea layers** sit above the ground zones. Air superiority gives ground forces a major edge.
- **Combined arms:** tanks dominate open ground but struggle in cities and forests against anti-tank infantry; helicopters hunt tanks; jets hunt helicopters; anti-air punishes all aircraft. No unit wins alone.
- **Special operations** act in the pre-battle phase: sabotage defenses, seize bridges, eliminate commanders, gather intelligence.
- **Supply:** modern armies need fuel and ammunition. Cutting supply lines stalls an enemy.
- **Naval:** blockades, shore bombardment, and amphibious landings.

The same zone model extends to space (high orbit, low orbit, surface), and simultaneous orders work naturally for future multiplayer.

## Cities and defenses

Defenses make cities meaningfully harder to capture, and they must keep pace with advancing weapons.

- **Fortifications by era:** walls and towers early; trenches, bunkers, coastal guns, anti-air batteries, and missile defense later. Older defenses lose value (walls fall quickly to artillery).
- **Layered city fights:** attackers fight through the outskirts, then the districts, then the center. Each layer costs them.
- **Police and garrisons:** a strong police presence slows urban fighting, catches enemy spies and saboteurs, and keeps order during a siege.
- **Loyalty:** loyal citizens form militias; unhappy citizens may open the gates. Conquered cities can rebel.
- **Sieges:** an attacker can surround a city and starve it out instead of storming it, at the cost of time and an exposed army.

## Space age (future phase)

Developing spaceships opens a new layer of play on top of everything that came before. Details will be designed once the earlier eras are built.

- Satellites for spying on other nations
- Mining other planets and asteroids
- Colonizing planets
- Space combat, using the same zone model (high orbit, low orbit, surface)
- The map hierarchy expands: galaxy, star system, planet, region, city

## Technical approach

The game is one web app that runs in Safari on iPhone and in any desktop browser, so there is a single codebase.

- **Game logic separate from display.** All rules and game state live in their own layer; the screens only read state and send player actions. This keeps the UI accessible and makes multiplayer possible without a rewrite.
- **Actions as data.** Every player decision (build, recruit, battle orders) is a recorded action applied to the state. This suits turn-based multiplayer, where players submit orders each season.
- **Saves.** Saved in the browser at the end of every season, with export and import of save files so a campaign can move between phone and computer. Saves carry a version number, and older saves are upgraded automatically when loaded. Cloud saves can come later.
- **Repeatable randomness.** All chance in the game comes from a seeded random number generator kept in the saved game, so the same choices from the same save give the same results. This makes testing, balance checks, and future multiplayer possible.
- **Testing and balance tools.** Engine tests run with `npm test`. `npm run simulate` plays hundreds of automatic campaigns with different strategies, and `npm run battles` fights hundreds of battles, to check balance after changes. The results are kept in [BALANCE.md](BALANCE.md).
- **Multiplayer later.** Likely async turn-based play through an online backend such as Firebase. Not built in the first phases, but the design must not block it.
- **Plain HTML, CSS, and JavaScript**, no build tools. Published through GitHub Pages so it can be played on iPhone from a link.
- **Store releases later.** Packaged with Capacitor for the App Store and Google Play, and with Electron or Tauri for Steam. To keep this possible: the game is fully offline (no outside servers or CDNs), uses relative paths, and saves only through one swappable save module.

## Build roadmap

The game is built in layers, and each phase should be playable and fun on its own before the next begins.

1. **Phase 1: Survival era (playable).** One starting region (forest valley), named survivors, seasons, food and shelter, raids, the turn report, the first advisors, and saving, tested with VoiceOver from day one. Built beyond the original plan: the local map, standing orders, events, the first knowledge, farming, skills that grow, births and aging, build and study queues, three neighboring peoples, tactical battles, traditions and reputation, and limited storage with feasts and lean times. Still to do: families and relationships, more events, and audio cues (see BACKLOG.md).
2. **Phase 2: Settlement era (playable).** Built: becoming a village by choice, the council with player priorities, groups by work, guards, huts, and settlers; stone, goods, and a research tree in five branches with new village buildings; the valley peoples as nations with territory, treaties, trust, and a Skarn that grows into a real power; and a second settlement, which begins the Nation era. Still open: late-game challenge, the other four starting regions, and unit types in battle (see BACKLOG.md).
3. **Phase 3: Nation era (playable).** Built in five phases of its own (see The Nation era): the nation at home, the wider world, the first great nations, armies, and toward the sea, ending with the voyage across the open sea.
4. **Phase 4: Age of Discovery (next).** Voyages, the lands beyond the sea, printing, gunpowder, early science, and colonies. It begins with the Nation era's voyage.
5. **Phase 5: Modern era.** Combined arms, air and sea layers, special operations, supply, espionage.
6. **Phase 6: Space age.** Satellites, mining, colonization, space combat.
7. **Later:** multiplayer modes, challenge mode with 16 to 20 nations, endgame.

## Open questions

- [x] Game title: Embers to Orbit
- [ ] How the game ends: victory conditions, or endless play
- [x] Names, cultures, and homelands of the 7 core nations: the Ostrani, the Orhai, the Keshari, the Dravan, the Ashani, the Haldi, and the Venn (see The Nation era). Built in October 2026 from the brief's recommendations; open to Christopher's changes
- [ ] Exact resource list per era. Answered for the Nation era: iron, horses, coin, and salt (all built)
- [x] What comes between the Nation and Modern eras: the Age of Discovery, which the Nation era's first ocean voyage begins
- [x] Shape of the research tree: five branches, with occasional choices that close off an alternative (built through the Settlement era)
- [ ] Audio: which sound cues, if any, in Phase 1
- [x] Phase 1 starting region: forest valley
- [x] Battle model: zones, simultaneous orders, morale (built in Phase 1)
- [x] Traditions earned from deeds, never chosen (built in Phase 1)
- [x] When and how named survivors become groups: at the player's choice, once the milestone is reached; the council manages groups, and notable people stay named
- [x] How the Settlement era begins and ends: the player chooses to become a village; a second settlement starts the Nation era
- [x] The first rival nations: the Velari, Tellani, and Skarn grow into them
- [ ] Late-game balance: what keeps a well-run camp challenged. Partly answered in the Settlement era: Skarn who learn war, hill clans drawn by size and stores, and crowding. Feasts became a custom and sieges cost food in October 2026. Still open: harder regions, battles that are almost never lost, and goods that pile up
- [ ] Whether traditions can fade if neglected
- [ ] Multiplayer modes: head-to-head, co-op, async with friends
