# Embers to Orbit — Design Document

Last updated Oct 13, 2026 · Christopher Abel

## Vision and pillars

A long, single-player strategy campaign that takes a handful of survivors on an Earth-like world all the way to a spacefaring nation. The player saves and returns over many sessions. Multiplayer modes come later.

- **Deep and complex.** Strategy, resource management, and combat all carry real weight, and new systems unlock as the nation grows.
- **Many playstyles, none forced.** Players are never asked to pick a path or win condition. What they do shapes what they become good at.
- **Screen-reader first.** Fully playable with VoiceOver on iPhone and with a screen reader on a computer. Accessibility is a design rule, not a later patch.
- **Complexity without tedium.** Advisors and standing orders handle repetitive work so the player spends time on real decisions.
- **Turn-based.** No real-time pressure. Every decision can be read, considered, and made at the player's pace.

## Where the game stands

Phase 1, the Survival era, is playable on GitHub Pages and on iPhone with VoiceOver, and the first part of the Settlement era is built on top of it. A campaign starts with twelve named survivors in the forest valley and plays season by season. What exists today:

- **Survivors** with ages, six skills that grow with practice, health, and morale; births, childhood, aging, and old age; mentoring.
- **Seasonal work:** hunt, forage, farm, gather wood, build, scout, tend the hurt, study, or rest, with one button (or a standing order) to put everyone on their best work.
- **Food, shelter, and winter:** eating, spoilage, limited storage, feasts, lean times, fires, exposure, and six buildings worked through a build queue.
- **A local map** of 14 places with work sites, wear and recovery, and scouting outward.
- **Knowledge:** seven discoveries through a study queue, including farming with fields.
- **Events:** 17 instant and choice events, three kinds of lean times, plus fever and wolves as ongoing conditions.
- **Three neighboring peoples** with relations, first contact, envoys, trade, tribute, and peace.
- **Tactical battles** for raids and for an attack on the Skarn hold.
- **Five advisors** who give ranked advice, forecasts, and odds, and carry out standing orders.
- **Traditions** (ten) **and reputation** that grow from what the camp actually does.
- **The Chronicle** of the campaign, a turn report each season, autosave, and save export and import.
- **Becoming a village** (the start of the Settlement era): a council that assigns everyone's work, guided by the player's priorities; groups by work; guards, huts, and settlers.
- **Stone, goods, and a research tree** in five branches, with 19 discoveries in all, one choice that closes off another, and six new village buildings.

The rest of this document mixes what is built with what is planned. Sections marked "built" describe the game as it plays now; the rest is design for later phases. [BACKLOG.md](BACKLOG.md) lists the next tasks.

## Accessibility principles

Every screen must be usable by swiping through it with VoiceOver, with no visual-only information.

- **Standard controls only.** Buttons, lists, headings, and form fields, so VoiceOver's built-in gestures work. No custom swipes or drag-and-drop.
- **Places as connected nodes, not grids.** Regions are described by owner, contents, and neighbors, e.g. "Ironwood: yours, 4 soldiers, borders Riverford and Ashen Pass."
- **Lead with what changed.** Announcements are short and put the result first. Full detail lives in a log one tap away.
- **Drill-down hierarchy.** World, then region, then settlement (later: galaxy, star system, planet). The player only hears the level they are on.
- **Headings as landmarks.** Each screen uses headings so the player can jump between sections with the rotor or heading keys.
- **Keyboard shortcuts on desktop.** Common actions (end turn, open report, open advisors) get shortcuts that don't clash with screen reader keys.
- **Optional audio cues.** Sounds for turn start, combat hits, and alerts can supplement speech but never carry information alone.

**Built so far**

- Nine screens reached from a navigation list: Report, People, Map, Build, Knowledge, Neighbors, Advisors, Chronicle, and Menu, plus an End season button. Each screen has one h1, which takes focus when the screen opens.
- Decisions that stop the game (choice events, raids, battle deployment, each battle round) get their own screen with the advisors' views and one button per choice.
- Short confirmations are spoken through a live region; after a screen redraws, focus returns to the control the player was using.
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

## Turns and eras

Each turn is one season: spring, summer, autumn, winter. Seasons drive planting, harvests, campaigning weather, and winter survival.

The game unfolds in eras. Each era layers new systems on top of the old ones, so the player learns gradually.

1. **Survival.** About a dozen named survivors. Food, shelter, warmth, and threats like raiders, wildlife, and winter.
2. **Settlement.** Population becomes groups by profession. Buildings, first trade, first contact with rival nations.
3. **Nation.** Multiple cities, armies, diplomacy, laws, industry. Governors can manage cities.
4. **Modern.** Advanced industry, mechanized warfare, intelligence agencies, rocketry research.
5. **Space.** Satellites, orbital mining, colonization, fleets (see Space age).

Era advancement is driven by research and growth, not a fixed timer, and the player chooses when to take each step. The Settlement era begins when the player chooses to become a village, any time after the camp has 16 people, a storehouse, a palisade, and farming. It ends, and the Nation era begins, when the village founds a second settlement.

## The Settlement era (parts 1 and 2 built)

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
| Stone wall | 20 wood, 80 stone | 30 | Needs the palisade. Defenders who hold take 35 percent of the harm instead of 45, and strike harder |

**Still to build:** part 3, the valley peoples growing into rival nations (population, strength, territory, treaties, remembered promises); part 4, founding a second settlement, which ends the era.

## Population and resources

People start as individuals and become groups as the settlement grows, so management scales with the nation.

- **Survival era (built):** each survivor has a name, an age, a short story, six skills from 0 to 5 (hunting, foraging, building, healing, scouting, learning), health, and morale. Losing one person matters. Twelve founders start the game; eight wanderers may be found by scouts or arrive asking to join, and friendly neighbors may send young people of their own.
- **Ages and the cycle of life.** Everyone has an age and grows a year older each spring. Children under 5 cannot work. From 5 to 11 they can forage, farm, study, or rest at half strength; from 12 to 15 they can do any work at three quarters strength, including defending the camp; at 16 they are adults. Young children eat 1 food instead of 2 and take half a place in the shelters. From 55, strength fades (85 percent, then 70 percent from 65), and from 60 each year brings a growing chance of dying peacefully. Advisors are succeeded by the most skilled adult.
- **Births.** Each season, a camp with at least two adults aged 18 to 40 may have a baby. The chance grows with the number of young adults, rises when food is plentiful, and falls when food is short, the shelters are full, or spirits are low. The steward says what is holding families back.
- **Learning.** People under 16 learn half again as fast, and anyone working beside a more skilled mentor (skill 4 or more) at the same task learns faster.
- **Skills grow with practice.** Every season at a task earns experience in that task's skill (half as much while badly hurt or sick). Going from level L to L+1 takes 3 + 2L seasons, so early levels come quickly and reaching 5 takes years. Defending against a raid counts as two seasons of hunting practice. The People screen shows each person's progress toward their next level.
- **Settlement era onward:** population is tracked in groups by profession (farmers, builders, soldiers, scholars), with overall happiness and loyalty.
- **Food (built).** Each adult eats 2 food a season and each child under 12 eats 1. Stored food spoils 12 percent a season, 4 percent with a storehouse; smoking cuts that by a third and pottery halves it again.
- **Storage (built).** The stores hold 100 food in baskets and pits, plus 150 for each storehouse (up to 3), and half again with pottery. Half of any food beyond that room rots each season. Big reserves are a choice the player builds for, not something that piles up for free.
- **Feasts (built).** Once a year the player can hold a feast from the Report screen for 3 food a person. It lifts everyone's spirits by 15, and people in high spirits (70 or more) work 10 percent better. Families grow closer, so a birth that season is half again as likely. Inviting a neighboring people costs 15 food more and wins 8 goodwill (counted as a gift). High spirits fade faster the higher they are, so a feast lasts about half a year, and plenty of food alone only keeps spirits steady. The steward can hold a harvest feast at the start of each winter if at least 3 seasons of food would be left.
- **Lean times (built).** They come on their own, apart from other events, so a reserve always matters: a hard winter (a 25 percent chance each winter after the first; fires burn half again as much wood and hunting yields 30 percent less), drought (20 percent each summer after the first; foraging and the harvest yield 40 percent less for summer and autumn), and herds moving away (5 percent each season; game drops sharply everywhere and slowly returns). The steward warns while one lasts, and forecasts account for it.
- **Shelter and warmth (built).** The starting tent and each lean-to shelter 4 people. In autumn and winter the camp burns wood for its fires; anyone without shelter, or left cold when the wood runs out, loses health. The fires take their wood before any building starts, so a build queue can never leave people cold; builders wait for wood instead.
- **Early resources:** food and wood are built; water, stone, and later metal are planned. Food must be stored to survive winter.
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
- **Turn report.** Each season opens with a report: urgent alerts first, then completed projects, then opportunities, then what advisors did under standing orders and anything they couldn't handle.
- **Auto-resolve.** The war advisor can resolve minor battles such as small raids.
- **Standing orders in Phase 1** (on the Advisors screen): badly hurt people rest until healed and then return to work; keep someone tending the hurt; keep enough food to last 1 to 4 seasons; foragers hunt in winter and return to foraging in spring; newcomers start at their best task; and a raid policy (ask me, fight if likely to win, or decide for me). The steward can also put everyone on their best work at the start of each season (the same as the People screen button); while that order is on, it takes the place of the rest, healer, winter, and newcomer orders, and the food reserve order still runs after it as a safety net. Two more orders save tedium: the steward can keep the fields staffed (sending people to plant, tend, and harvest, then back to their other work), and the healer can put a lean-to near the front of the build queue whenever the shelters are nearly full. Orders run at the start of each season and are listed in the report. A player's own reassignment always overrides an order.

## Buildings (built)

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

Reaching the Settlement era (for now, a milestone) needs 16 people, a storehouse, a palisade, and farming. The full research tree is a Phase 2 task.

## Neighbors (built, Survival era)

Three hand-crafted peoples live around the forest valley. Each has a home on the local map, a temperament, and relations with you from -100 (hostile) to 100 (close friends), which drift slowly back toward their nature and your reputation (see Traditions and reputation). These are local peoples, not the 7 rival nations, which arrive in later eras.

| People | Home | Nature | Starting relations | What they offer |
| --- | --- | --- | --- | --- |
| Velari | Velari fields, beyond the North meadow | Peaceful hill farmers, slow to trust | 10 | Food for wood; at 40 or more, they will teach farming |
| Tellani | Teln landing, downriver beyond the beaver ponds | River traders | 5 | The best trade rates, both ways |
| Skarn | Skarn hold, at the end of the raider trail | Raiders who respect strength | -30 | Nothing but peace: tribute of 20 food buys a year's truce; at 10 or more, a lasting peace |

- **Meeting them.** Scouts who find a people's home make first contact, a choice event (gift, greet, or withdraw) that sets the tone. The Velari come to you if your scouts never find them. The river traders are the Tellani, who introduce themselves after a trade. The raiders are the Skarn, revealed after the first fight.
- **Diplomacy.** The Neighbors screen allows one envoy to each people per season: gifts of food or wood, trades whose rates improve with friendship, and special deals. A new advisor, the speaker, watches over relations.
- **The Skarn and raids.** Once known, the Skarn's mood sets how often raids come: hostile 1.5 times as often, friendly much less. Tribute or peace stops them; only small bands of outlaws remain. Defeating their raids angers them. Their riders may demand tribute; refusing or defying them brings raiders soon.
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

**Built so far (Survival era)**

- **Zones:** left flank, center, right flank, plus a reserve. At your camp, the palisade (if built) covers every zone and the treeline covers the left flank. At Skarn hold, the Skarn hold walls on a rocky hill.
- **Deployment:** choose a formation (even line, strong center, strong left or right, a fifth in reserve, or match the enemy) and adjust each fighter's position, including keeping someone behind. Or let the war chief command, or hide.
- **Rounds (up to 4):** each group gets an order: hold (takes less harm; behind the palisade it also strikes hard), attack (hits harder, takes full harm), swing round to hit the enemy center (from a flank, hits hard but leaves that flank open), or fall back to the reserve. The reserve can join any zone. Orders resolve at the same time as the enemy's.
- **Empty zones:** raiders who meet no one in a zone reach the stores and carry off food and wood. When attacking Skarn hold, pushing through two zones they leave empty wins.
- **Breaking:** a group that loses more than 60 percent of its strength breaks and flees; the enemy gives up when it is down to 35 percent of its fighters, and after 4 rounds they pull back with what they took.
- **Wounds and deaths** fall on the people who fought. Every fighter gains two seasons of hunting practice.
- **The war chief** suggests orders each round and can finish the battle at any time; their estimate of the odds comes from quietly fighting the battle many times in their head.
- **Strength:** each raider fights with a strength of 6; defenders fight by their hunting skill and health, with bonuses from fire-hardened spears and the Warrior tradition. Raids grow by 2 raiders a year for five years, then by 1 every two years, leveling off at 16 more than the first raids. Full stores draw notice: beyond 200 food, raids come a little more often (up to 10 percent more) and bring 1 more raider for every 120 food (up to 5 more). Surprise (no warning from scouts or the watchtower) weakens the defenders and strengthens the raiders in the first round.
- **Attacking Skarn hold** (from the Neighbors screen, once your scouts have found it): 8 warriors plus 1 per year defend it. Victory brings their stores (30 food and 20 wood), two years of truce, and enough respect for a lasting peace. Defeat brings revenge raids.
- **Raid choices:** before a raid the player can deploy and fight, let the war chief command, or hide in the woods and lose some stores. A standing order can decide for them.

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
- **Testing and balance tools.** Engine tests run with `npm test`. `npm run simulate` plays hundreds of automatic campaigns with different strategies, and `npm run battles` fights hundreds of battles, to check balance after changes.
- **Multiplayer later.** Likely async turn-based play through an online backend such as Firebase. Not built in the first phases, but the design must not block it.
- **Plain HTML, CSS, and JavaScript**, no build tools. Published through GitHub Pages so it can be played on iPhone from a link.
- **Store releases later.** Packaged with Capacitor for the App Store and Google Play, and with Electron or Tauri for Steam. To keep this possible: the game is fully offline (no outside servers or CDNs), uses relative paths, and saves only through one swappable save module.

## Build roadmap

The game is built in layers, and each phase should be playable and fun on its own before the next begins.

1. **Phase 1: Survival era (playable).** One starting region (forest valley), named survivors, seasons, food and shelter, raids, the turn report, the first advisors, and saving, tested with VoiceOver from day one. Built beyond the original plan: the local map, standing orders, events, the first knowledge, farming, skills that grow, births and aging, build and study queues, three neighboring peoples, tactical battles, traditions and reputation, and limited storage with feasts and lean times. Still to do: families and relationships, more events, keyboard shortcuts, and audio cues (see BACKLOG.md).
2. **Phase 2: Settlement era (in progress).** Built: becoming a village by choice, the council with player priorities, groups by work, guards, huts, and settlers; stone, goods, and a research tree in five branches with new village buildings. Still to build: the valley peoples as rival nations with deeper trade and diplomacy, a second settlement to end the era, the other four starting regions, and unit types in battle.
3. **Phase 3: Nation era.** Multiple cities, governors, diplomacy, traditions and reputation at nation scale, defenses and sieges, all 7 nations.
4. **Phase 4: Modern era.** Combined arms, air and sea layers, special operations, supply, espionage.
5. **Phase 5: Space age.** Satellites, mining, colonization, space combat.
6. **Later:** multiplayer modes, challenge mode with 16 to 20 nations, endgame.

## Open questions

- [x] Game title: Embers to Orbit
- [ ] How the game ends: victory conditions, or endless play
- [ ] Names, cultures, and homelands of the 7 core nations
- [ ] Exact resource list per era
- [x] Shape of the research tree: five branches, with occasional choices that close off an alternative (built through the Settlement era)
- [ ] Audio: which sound cues, if any, in Phase 1
- [x] Phase 1 starting region: forest valley
- [x] Battle model: zones, simultaneous orders, morale (built in Phase 1)
- [x] Traditions earned from deeds, never chosen (built in Phase 1)
- [x] When and how named survivors become groups: at the player's choice, once the milestone is reached; the council manages groups, and notable people stay named
- [x] How the Settlement era begins and ends: the player chooses to become a village; a second settlement starts the Nation era
- [x] The first rival nations: the Velari, Tellani, and Skarn grow into them
- [ ] Late-game balance: what keeps a well-run camp challenged (bigger threats, uses for surplus, harder regions)
- [ ] Whether traditions can fade if neglected
- [ ] Multiplayer modes: head-to-head, co-op, async with friends
