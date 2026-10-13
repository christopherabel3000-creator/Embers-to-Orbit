# Embers to Orbit — Design Document

Last updated Oct 13, 2026 · Christopher Abel

## Vision and pillars

A long, single-player strategy campaign that takes a handful of survivors on an Earth-like world all the way to a spacefaring nation. The player saves and returns over many sessions. Multiplayer modes come later.

- **Deep and complex.** Strategy, resource management, and combat all carry real weight, and new systems unlock as the nation grows.
- **Many playstyles, none forced.** Players are never asked to pick a path or win condition. What they do shapes what they become good at.
- **Screen-reader first.** Fully playable with VoiceOver on iPhone and with a screen reader on a computer. Accessibility is a design rule, not a later patch.
- **Complexity without tedium.** Advisors and standing orders handle repetitive work so the player spends time on real decisions.
- **Turn-based.** No real-time pressure. Every decision can be read, considered, and made at the player's pace.

## Accessibility principles

Every screen must be usable by swiping through it with VoiceOver, with no visual-only information.

- **Standard controls only.** Buttons, lists, headings, and form fields, so VoiceOver's built-in gestures work. No custom swipes or drag-and-drop.
- **Places as connected nodes, not grids.** Regions are described by owner, contents, and neighbors, e.g. "Ironwood: yours, 4 soldiers, borders Riverford and Ashen Pass."
- **Lead with what changed.** Announcements are short and put the result first. Full detail lives in a log one tap away.
- **Drill-down hierarchy.** World, then region, then settlement (later: galaxy, star system, planet). The player only hears the level they are on.
- **Headings as landmarks.** Each screen uses headings so the player can jump between sections with the rotor or heading keys.
- **Keyboard shortcuts on desktop.** Common actions (end turn, open report, open advisors) get shortcuts that don't clash with screen reader keys.
- **Optional audio cues.** Sounds for turn start, combat hits, and alerts can supplement speech but never carry information alone.

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

Neighbor examples are placeholders until the 7 nations are designed.

### The local map

Each starting region has a hand-crafted local map of connected places. The forest valley has 11: the camp, riverbank, and oak woods are known at the start; the north meadow, deer trails, storm deadfall, berry thicket, herb hillside, abandoned camp, beaver ponds, and a raider trail are found by scouting.

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

Era advancement is driven by research and growth, not a fixed timer.

## Population and resources

People start as individuals and become groups as the settlement grows, so management scales with the nation.

- **Survival era:** each survivor has a name, skills (hunting, building, healing, leadership), health, and morale. Losing one person matters.
- **Ages and the cycle of life.** Everyone has an age and grows a year older each spring. Children under 5 cannot work. From 5 to 11 they can forage, farm, study, or rest at half strength; from 12 to 15 they can do any work at three quarters strength, including defending the camp; at 16 they are adults. Young children eat 1 food instead of 2 and take half a place in the shelters. From 55, strength fades (85 percent, then 70 percent from 65), and from 60 each year brings a growing chance of dying peacefully. Advisors are succeeded by the most skilled adult.
- **Births.** Each season, a camp with at least two adults aged 18 to 40 may have a baby. The chance grows with the number of young adults, rises when food is plentiful, and falls when food is short, the shelters are full, or spirits are low. The steward says what is holding families back.
- **Learning.** People under 16 learn half again as fast, and anyone working beside a more skilled mentor (skill 4 or more) at the same task learns faster.
- **Skills grow with practice.** Every season at a task earns experience in that task's skill (half as much while badly hurt or sick). Going from level L to L+1 takes 3 + 2L seasons, so early levels come quickly and reaching 5 takes years. Defending against a raid counts as two seasons of hunting practice. The People screen shows each person's progress toward their next level.
- **Settlement era onward:** population is tracked in groups by profession (farmers, builders, soldiers, scholars), with overall happiness and loyalty.
- **Early resources:** food, water, wood, stone, and later metal. Food must be stored to survive winter.
- **Later resources** unlock by era: gold and trade goods, iron, then fuel, electricity, and rare minerals; in the space age, off-world materials.

The exact resource list per era is still to be designed.

## Advisors and automation

Advisors always follow orders, but they actively give recommendations and warn the player when a strategy looks risky.

- **Origins.** The first advisors are the original survivors (the skilled hunter becomes war advisor, the herbalist becomes scholar). Successors take over as they age or die.
- **Domains.** Steward (food and stores), war, diplomacy, research, trade, and later intelligence and space.
- **Forecasts.** Advisors project consequences, e.g. "At current consumption, the granaries run empty in three seasons, one season before harvest."
- **Severity levels.** Notes, warnings, and urgent alerts.
- **Standing orders.** The player delegates repetitive work, e.g. "keep two winters of food in storage" or "train soldiers whenever the barracks is idle."
- **Best work button.** On the People screen, one button puts everyone on the work they are most skilled at, as far as it makes sense this season: no foraging in winter, only as many farmers as the fields need, builders only when a project is underway (enough to finish in about two seasons), one or two healers only when someone is hurt or sick, at most two scouts while there is anything left to find, and studiers only when a discovery is chosen. The badly hurt and the sick rest. Ties go to food first.
- **Turn report.** Each season opens with a report: urgent alerts first, then completed projects, then opportunities, then what advisors did under standing orders and anything they couldn't handle.
- **Auto-resolve.** The war advisor can resolve minor battles such as small raids.
- **Standing orders in Phase 1** (on the Advisors screen): badly hurt people rest until healed and then return to work; keep someone tending the hurt; keep enough food to last 1 to 4 seasons; foragers hunt in winter and return to foraging in spring; newcomers start at their best task; and a raid policy (ask me, fight if likely to win, or decide for me). The steward can also put everyone on their best work at the start of each season (the same as the People screen button); while that order is on, it takes the place of the rest, healer, winter, and newcomer orders, and the food reserve order still runs after it as a safety net. Two more orders save tedium: the steward can keep the fields staffed (sending people to plant, tend, and harvest, then back to their other work), and the healer can put a lean-to near the front of the build queue whenever the shelters are nearly full. Orders run at the start of each season and are listed in the report. A player's own reassignment always overrides an order.

## Building and study queues

The player queues as many buildings as they like on the Build screen and can move them up or down or remove them. Builders' work flows through the queue in order: when a building is finished, leftover work goes straight into the next. For example, 25 work against four queued fields of 10 work each finishes two and leaves the third half built. Each building's wood is paid when work on it begins; if there is not enough wood, building pauses until there is. Removing a building refunds its wood in full if no work was done, or half once work has started.

Study works the same way: the player can queue discoveries, including ones not yet possible, which start as soon as they can. Leftover study points carry into the next discovery.

## Knowledge

Discovery starts in the Survival era. People set to the Study task earn study points (2 plus their learning skill each season); the player chooses a discovery or builds a queue of them on the Knowledge screen, and partial progress is kept if they switch. The scholar, a fourth advisor, watches over study.

| Discovery | Cost | Needs | Effect |
| --- | --- | --- | --- |
| Fire-hardened spears | 15 | | +1 food per hunter; defenders fight harder |
| Smoking and drying | 15 | | Food spoils a third less |
| Stone tools | 20 | | +1 work per builder, +1 wood per woodcutter |
| Warm clothing | 15 | | Cold and exposure do much less harm |
| Herbal medicine | 20 | Herb hillside found | Healing +20 percent; faster fever recovery |
| Pottery | 25 | Smoking and drying | Spoilage halved again; no more mice in the stores |
| Farming | 35 | Stone tools; North meadow found | Fields and the Farm task |

**Farming** follows the year. Each field holds 6 plots. In spring each farmer plants 2 plots; in summer each tends 3; in autumn each harvests 3. A tended plot yields 10 food and an untended one 6; grain nobody harvests yields half. There is no farm work in winter. Farming does not wear out the land, and the harvest arrives just before winter.

Reaching the Settlement era (for now, a milestone) needs 16 people, a storehouse, a palisade, and farming.

## Events

Events keep seasons from feeling the same. After each season there is a 40 percent chance of one event, and the same event cannot repeat within 6 seasons. Raids take priority.

- **Instant events** simply happen and appear in the report: storms (wreck a lean-to or soak the woodpile), bumper crops, fever outbreaks, mice in the food stores (a storehouse prevents this), winter cold snaps, and fireside stories that lift spirits.
- **Choice events** stop the game on their own screen, with advisors' views, and the player picks an option: a sick traveler asking to join, wolves moving into a hunting ground, a quarrel between two survivors, a missing worker, river traders, and a wild beehive. Outcomes appear under "Your decision" in the report.
- **Ongoing conditions.** Fever: the sick lose health, work at half strength, and spread it, faster in a crowded camp; tending the sick and a healer's hut speed recovery. Wolves: hunting at their place is more dangerous and yields less for about a year.
- Events tie into existing systems: places on the map, shelter, the storehouse, advisors, and standing orders (for example, keeping a healer on duty also covers the sick).

## Playstyles, traditions, and reputation

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
- **Saves.** Saved in the browser at first, with export and import of save files so a campaign can move between phone and computer. Cloud saves can come later.
- **Multiplayer later.** Likely async turn-based play through an online backend such as Firebase. Not built in the first phases, but the design must not block it.
- **Plain HTML, CSS, and JavaScript**, no build tools. Published through GitHub Pages so it can be played on iPhone from a link.
- **Store releases later.** Packaged with Capacitor for the App Store and Google Play, and with Electron or Tauri for Steam. To keep this possible: the game is fully offline (no outside servers or CDNs), uses relative paths, and saves only through one swappable save module.

## Build roadmap

The game is built in layers, and each phase should be playable and fun on its own before the next begins.

1. **Phase 1: Survival era.** One starting region (forest valley), named survivors, seasons, food and shelter, raids, the turn report, the first advisors, and saving. Tested with VoiceOver from day one. Each season the player assigns every survivor a task (hunt, forage, gather wood, build, scout, tend the hurt, study, rest, and later farm). Raids are simple in Phase 1: choose defenders and whether to fight or hide, and the result resolves automatically; zone-based battles arrive in Phase 2.
2. **Phase 2: Settlement era.** Population groups, buildings, research, all five starting regions, the first rival nations, trade, and zone-based combat.
3. **Phase 3: Nation era.** Multiple cities, governors, diplomacy, traditions and reputation, defenses and sieges, all 7 nations.
4. **Phase 4: Modern era.** Combined arms, air and sea layers, special operations, supply, espionage.
5. **Phase 5: Space age.** Satellites, mining, colonization, space combat.
6. **Later:** multiplayer modes, challenge mode with 16 to 20 nations, endgame.

## Open questions

- [x] Game title: Embers to Orbit
- [ ] How the game ends: victory conditions, or endless play
- [ ] Names, cultures, and homelands of the 7 core nations
- [ ] Exact resource list per era
- [ ] Shape of the research tree
- [ ] Audio: which sound cues, if any, in Phase 1
- [x] Phase 1 starting region: forest valley
- [ ] Multiplayer modes: head-to-head, co-op, async with friends
