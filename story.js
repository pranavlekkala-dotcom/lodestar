// PROJECT LODESTAR — ship story script. Every spoken line in the game lives here so writers can edit
// without touching code. The ship is REAL (not a simulation): the player passed the training (made by
// teammates), was selected, and has just arrived aboard the Lodestar in Earth orbit.
// Chapter 1 is playable; later chapters are outlined for the team.

export const CAST = {
  mc:   { name: "MISSION CONTROL", role: "Flight, Earth",   color: "#ffb45e" },   // by radio; delay grows with distance
  ship: { name: "LODESTAR",        role: "Ship computer",   color: "#c9d6db" },   // short status calls only
  exp:  { name: "EXPEDITION 1",    role: "Distress signal", color: "#ff8a6a" },   // chapter 2+: fragments of the stranded crew's signal
  pda:  { name: "PDA",             role: "Suit computer",   color: "#9fd8e8" },
};

// ---------------------------------------------------------------- Chapter 1: Arrival
// Same beats as the game's first-hour flow: arrive, look, drift, hatch, scan, PDA, engine check, leak repair.
export const CH1 = {
  boot: [
    ["ship", "Docking complete. Cabin pressure one hundred and one kilopascals. Welcome aboard."],
    ["mc",   "Lodestar, this is Mission Control. If you can hear us, you made it up in one piece. Good."],
    ["mc",   "For this trip, you're the crew, and we're the voice in your ear. Take a minute. Look around. This ship is home for the next eight months."],
  ],
  look: [
    ["mc",   "No up or down up there, only where you point your head. Push gently and let yourself glide."],
    ["mc",   "Your hands do the work. W, A, S and D to grab the nearest surface and pull. Look where you want to go."],
    ["mc",   "C kicks you off a wall, right mouse to brake. Float through the forward hatch when you're ready."],
  ],
  hatch: [
    ["mc",   "Nice and smooth. Every one of those hatches can seal a module off if it loses pressure. Learn where they are."],
  ],
  // scanIntro / scan1 / scan2 / engineScan are only used while scanning is switched on (SCANNING in index.html);
  // with scanning off, the game goes hatch -> scan2 (PDA line) -> pda -> engine + engineLook -> leak.
  scanIntro: [
    ["mc",   "Before we light the engines, you need to know this ship. Anything with a faint glow, aim at it and hold click to scan it."],
  ],
  scan1: [
    ["mc",   "Got it on our screens down here. Every scan goes into your databank. Up there, knowing what something is can keep you alive."],
    ["mc",   "Scan one more. Take your time."],
  ],
  scan2: [
    ["mc",   "Open your PDA with Tab. Everything you've learned lives there. M brings up the ship map."],
  ],
  pda: [
    ["mc",   "Last check before departure: the engine bay, all the way aft. Use the map and find your way there."],
  ],
  engine: [
    ["mc",   "That's the heart of the Lodestar. Four engines, burning kerosene and liquid oxygen."],
  ],
  engineScan: [
    ["mc",   "Flight rules: nobody leaves orbit until the crew has eyes on every part of that cluster. Scan the four main components."],
  ],
  engineLook: [
    ["mc",   "Flight rules: nobody leaves orbit until the crew has eyes on every part of that cluster. Take a good look around."],
  ],
  examStart: [
    ["ship", "Caution. Oxygen feed pressure decreasing."],
    ["mc",   "We see it too. Feed pressure's falling. Find the leak before it gets worse."],
  ],
  found: [
    ["mc",   "There. Frost on the main oxygen line. A seal let go."],
    ["mc",   "Don't rush it. Close the valve first, then work the bolts. Press E when you're ready."],
  ],
  fixed: [
    ["mc",   "Pressure's holding. That was clean work."],
    ["mc",   "Mission Control copies all systems nominal. Lodestar, you are go for departure."],
    ["ship", "Departure checklist complete. Trans-Vesper burn in ten minutes."],
  ],
};

// ---------------------------------------------------------------- Opening (team storyline, Nov 14)
// You have just docked. The station is dark on reserve power; restore the mission bus at the power panel.
export const OPENING = {
  dock: [
    ["ship", "Docking complete. Hard seal confirmed."],
    ["ship", "Essential systems are running on reserve power. Main lighting is offline."],
    ["ship", "Restore the mission bus at the power distribution panel in the Systems Corridor."],
  ],
  panel: [
    ["ship", "Power distribution panel. Battery reserve available: seven point five kilowatts."],
  ],
  overload: [
    ["ship", "Overload. Demand exceeds the available supply. Disconnect a non-essential load."],
  ],
  pass: [
    ["ship", "Load within limits. Close the main breaker to restore the mission bus."],
  ],
  restored: [
    ["ship", "Mission bus restored. Bringing up lighting, zone by zone."],
    ["ship", "All mission systems nominal. Report to the cockpit for your mission briefing."],
  ],
  brief: [
    ["ship", "Mission briefing loaded."],
  ],
};

// Maintenance repairs (team handoff V2, VOICELINES.csv; ship voice). Repair 1 = the power cabinet at the dark start.
export const MAINT = {
  power: {
    onset:    [["ship", "Caution. Auxiliary bus overload. Main lighting offline. Emergency circuit active."]],
    inspect:  [["ship", "Generation is available. Connected demand exceeds this bus's limit. Check the loads."]],
    retrip:   [["ship", "Breaker tripped again. Reduce the load before resetting."]],
    isolate:  [["ship", "Service contactor open. Local circuit isolated."]],
    verified: [["ship", "Bus voltage stable. Essential systems supplied. Departure checks may continue."]],
  },
  scrubber: {
    onset:    [["ship", "Life-support caution. Carbon dioxide is rising. Scrubber cycling is not responding."]],
    inspect:  [["ship", "Cabin airflow is normal. The bed-switch command has not been acknowledged."]],
    service:  [["ship", "Standby removal active. Primary controller isolated for service."]],
    retained: [["ship", "Controller retained. Release both captive latches first."]],
    verified: [["ship", "Bed cycling restored. Carbon-dioxide readings are trending down."]],
  },
  cooling: {
    onset:    [["ship", "Thermal caution. Avionics temperature rising. Equipment fan is not turning."]],
    inspect:  [["ship", "Supply voltage is present. Measured fan speed is zero. Inspect the rotor and guard."]],
    live:     [["ship", "Isolate fan power before opening the guard."]],
    clear:    [["ship", "Rotor clear. Secure the guard before restoring power."]],
    verified: [["ship", "Fan speed recovered. Equipment temperature is falling. Arrival receiver available."]],
  },
  rx: {
    incoming: [["ship", "Incoming transmission detected. Emergency band."]],
    frag1a:   [["exp",  "Anyone..."]],
    frag1b:   [["exp",  "...alive..."]],
    weak:     [["ship", "Signal strength is low. The internal receiver link is also reporting errors."]],
    objective:[["ship", "Inspect the communications rack in the Data Corridor. We may be losing data inside the ship."]],
    keyed:    [["ship", "Connector key misaligned. Rotate to the socket mark before seating."]],
    restored: [["ship", "Internal interface restored. Requesting fresh copies of the damaged frames."]],
    fresh:    [["ship", "Fresh fragment received. Playing recovered audio."]],
    survivor: [["exp",  "This is Expedition One. I'm alive. I'm on the surface."], ["exp", "I don't know if this is reaching anyone. If you can hear me... please respond."]],
    logged:   [["ship", "Distress fragment logged. Expedition One may have a survivor."]],
    relay:    [["ship", "The external signal is still weak. Relay support is required to recover location and ascent data."]],
    handoff:  [["ship", "Ship systems ready. Begin communications CubeSat development and orbital planning."]],
  },
  voyage: {
    depart:   [["mc", "Lodestar, Mission Control. Burn complete. You're on your way to Vesper. Keep that ship healthy."]],
    cruise:   [["mc", "Day sixty-three. Radio delay is now three minutes each way. Routine checks, Lodestar."]],
    arrival:  [["mc", "Day two hundred forty-one. Vesper ahead. Run your arrival checks before orbit insertion."]],
  },
};
export const RX_DROP = "[signal lost]";   // subtitle only: the gap in the survivor's first fragment

// Mission brief: voiced slides on the cockpit brief screen (Mission Control reads each slide)
export const BRIEF = [
  { title: "Your mission", art: "planet", lines: [["mc", "Welcome aboard, Lodestar. Your mission: fly to Vesper and bring back helium-3, a clean fuel for fusion power on Earth."], ["mc", "It hides in titanium-rich ground. We will find it by surveying from orbit."]] },
  { title: "Expedition 1", art: "crew", lines: [["mc", "Four crew made this trip before you. They reached Vesper orbit, and then their signal stopped."], ["mc", "Their records are on the crew laptops. Read them as you go."]] },
  { title: "The route", art: "route", lines: [["mc", "The transfer takes about eight months. The radio delay grows the farther out you get."], ["mc", "You will keep the ship alive the whole way: air, water, power and heat."]] },
  { title: "Your role", art: "you", lines: [["mc", "You are the only crew aboard. We are with you by radio, but out there you decide."], ["mc", "First job: set the course to Vesper on the navigation screen."]] },
];

// Departure scene (plays over the exterior shot of the Lodestar after chapter 1)
export const DEPARTURE = [
  ["ship", "Main engines ignition. Burn nominal."],
  ["mc",   "Lodestar, Mission Control. Burn looks good from here. You're on your way."],
  ["mc",   "Eight months to Vesper. Four people made this same trip before you: Expedition 1. We lost their signal in orbit around Vesper, and we still don't know why."],
  ["mc",   "Your job is the helium-3. And keeping that ship alive all the way there. It won't keep itself alive."],
  ["mc",   "Lodestar, Mission Control. Good luck. We'll be listening."],
];

// ---------------------------------------------------------------- Later chapters (outline for the team)
// Rule for the whole trip: the player is always DOING something. Travel = keeping the ship alive while
// problems stack up. The distress signal is NOT handed to the player: it is pieced together from fragments
// that only show up because the player keeps the comms, power and antenna systems working.
export const OUTLINE = {
  ch2: "THE LONG FLIGHT — daily ship maintenance with real consequences: change CO2 scrubber cartridges, balance power between systems, filter and recycle water, keep the radiators cool, eat, sleep, exercise (bone and muscle loss). Mission Control's replies get slower as you travel because radio takes time (seconds, then minutes). Barriers along the way: a micrometeoroid hit that needs a patch, a solar storm (shelter in the most shielded module), a failing pump, a power shortage that forces choices about what to turn off.",
  ch2signal: "THE SIGNAL, piece by piece — while realigning the antenna or cleaning up comms noise, the comms station in the hub catches short, damaged fragments on an old Expedition 1 frequency. Each repair to comms/power makes the next fragment clearer. The player assembles them (PDA). By the end of the flight the full message is clear: someone from Expedition 1 is calling for help. The player does not yet know how many are alive (only one survived).",
  ch3: "CHOOSING THE ORBIT — arriving at Vesper, the player sets how far from the planet to orbit in the cockpit: low = cheap for the lander but drag, heating and radiation; high = safe but costs lander fuel and time. Trade-offs shown live.",
  ch4: "SURVEY — scan Vesper from the observation cupola and analyse samples in the lab to find titanium-rich ground, where the helium-3 is. Locate the signal's source on the surface.",
  ch5: "THE CHOICE — the lander can't lift everything: the helium-3 cargo or the survivor. An engineering solution exists (Reyes's mass list, fuel routing) for players who understood the systems. Three endings: fuel only, survivor only, both.",
};

// ---------------------------------------------------------------- Crew laptops (E to read)
// Expedition 1's records, transmitted to Earth before they went silent and loaded onto the Lodestar's
// laptops so the next crew can learn from them, plus Mission Control's flight notes. They quietly set up
// Vesper, orbit choice and the lander mass problem the player faces in the finale.
// Expedition 1 (4 crew): CDR. A. MENSAH, T. REYES, DR. M. CASTELLANOS, J. PARK. Only one survives (not revealed here).
export const LOGS = [
  { who: "MISSION CONTROL", when: "Flight note", title: "Rule one",
    text: "Rule one for every crew we fly: nobody touches a valve until they can tell us what's on the other side of it. Scan first. Then think. Then act." },
  { who: "T. REYES · ENGINEER, EXP. 1", when: "Mission day 14", title: "Lander mass budget",
    text: "Ran the ascent numbers again. Lander lifts 2,400 kg off Vesper with a 6% margin. Four crew, cores and sample cases fit. Anything extra — a fifth person, a broken rover part — and something stays behind. Flagged it. Nobody wanted to talk about it." },
  { who: "DR. M. CASTELLANOS · GEOLOGY, EXP. 1", when: "Mission day 15", title: "Why Vesper",
    text: "Orbital spectra say Vesper's dark plains are rich in titanium. On the Moon, titanium-rich soil holds the most helium-3, because both get trapped in the same old, sun-baked dust. If that holds on Vesper, we're flying to the best fuel field anyone has ever found." },
  { who: "J. PARK · PILOT, EXP. 1", when: "Mission day 17", title: "Orbits are weird",
    text: "Lesson I keep relearning: to catch up with something ahead of you in orbit, you slow down. Lower orbit, shorter lap, you pass it, then you speed back up. Took me nine tries before I stopped fighting the instinct." },
  { who: "CDR. A. MENSAH · COMMANDER, EXP. 1", when: "Mission day 96", title: "Halfway",
    text: "Halfway to Vesper. Nothing out here breaks all at once; it wears down. A filter, a fan, a seal. The crews who make it are the ones who fix the small things before they become big things." },
  { who: "T. REYES · ENGINEER, EXP. 1", when: "Mission day 123", title: "Ways to save mass",
    text: "If we ever need room on that lander: strip the second seat frame (38 kg), dump the science rack (120 kg), vent the reserve ballast and burn the extra fuel on the way up. It's ugly. It works on paper. Writing it down so someone remembers." },
  { who: "J. PARK · PILOT, EXP. 1", when: "Mission day 190", title: "Vesper orbit",
    text: "We parked low to save lander fuel. Cheap on fuel, rough on everything else: drag, heat on every pass, and the radiation counter never stops clicking. Next crew, think hard about where you park." },
  { who: "MISSION CONTROL", when: "Flight note", title: "To the next crew",
    text: "If you're reading this, you're curious, and that's the best thing a crew member can be. You have the same training they had. Use it. Come home." },
];

// First visit to a room: a short "what this is on a real mission" card (owner, Nov 14). Passages are skipped.
export const ROOM_INFO = {
  airlock:     "Lets the crew go outside without losing the ship's air: the inner hatch seals, the air is pumped back into the cabin, then the outer hatch opens. The ISS's is called Quest.",
  eva:         "Spacesuits are checked, charged and put on here. Before a spacewalk the crew breathe pure oxygen for hours to flush nitrogen from their blood and avoid the bends.",
  forward:     "A junction joining the cockpit, the spacewalk area and the galley. Junction modules carry air, power and data between modules as well as people.",
  cockpit:     "Navigation, communications and engine control. On long trips most flying is automatic: the crew plans the burns and checks the computers' work.",
  recreation:  "Rest and exercise. Without gravity, muscles and bones weaken fast, so astronauts on the ISS exercise about two hours every day.",
  systems:     "This corridor keeps everyone alive: power, CO2 removal, water recycling and cooling. The ISS recycles about 98% of its water, sweat and urine included.",
  hub:         "The ship's crossroads. Six hatches lead off it, like the connecting nodes on the ISS, and its panels show the state of the whole ship.",
  data:        "Flight computers and radio racks. Spacecraft run several computers side by side so a single failure can't end the mission.",
  medical:     "Sleeping berths and the ship's clinic. Crews train as medics: help from Earth is minutes away by radio, and on deep-space trips much longer.",
  engine:      "The main engines and their plumbing. Big burns happen only a few times a mission: leaving Earth orbit and arriving at the target.",
  lab:         "Experiments that only work without gravity, from growing crystals to studying how flames and liquids behave when nothing has weight.",
  equipment:   "Spare parts and cargo. Far from home you can't order spares, so long missions carry parts for the failures most likely to happen.",
  culture:     "Cells, microbes and plants grow here to see how space changes them. Plants may one day feed crews on long missions.",
  analysis:    "Instruments that find out what samples are made of. Spectrometers and X-ray fluorescence identify the elements in rock and soil.",
  observation: "A big window on the planet below. On the ISS the Cupola is used to photograph Earth and to guide the station's robot arm.",
  labcupola:   "A small viewing dome over the lab, used to aim cameras and compare samples with what the crew can see outside.",
  wc:          "The toilet and washroom. Without gravity, air flow does gravity's job, and urine is cleaned and recycled into drinking water.",
};
