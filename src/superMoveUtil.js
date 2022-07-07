const PokemonType = require('./PokemonType');
/** @typedef {typeof import('./PokemonType')} PokemonType */

const ZMoves = [
    "Breakneck Blitz",
    "Inferno Overdrive",
    "Hydro Vortex",
    "Gigavolt Havoc",
    "Bloom Doom",
    "Subzero Slammer",
    "All-Out Pummeling",
    "Acid Downpour",
    "Tectonic Rage",
    "Supersonic Skystrike",
    "Shattered Psyche",
    "Savage Spin-Out",
    "Continental Crush",
    "Never-Ending Nightmare",
    "Devastating Drake",
    "Black Hole Eclipse",
    "Corkscrew Crash",
    "Twinkle Tackle",
    "Catastropika",
    "10,000,000 Volt Thunderbolt",
    "Stoked Sparksurfer",
    "Extreme Evoboost",
    "Pulverizing Pancake",
    "Genesis Supernova",
    "Sinister Arrow Raid",
    "Malicious Moonsault",
    "Oceanic Operetta",
    "Splintered Stormshards",
    "Let's Snuggle Forever",
    "Clangorous Soulblaze",
    "Guardian of Alola",
    "Searing Sunraze Smash",
    "Menacing Moonraze Maelstrom",
    "Light That Burns the Sky",
    "Soul-Stealing 7-Star Strike"
];

const StatusZMoveIndex = {
    "Boosts Attack by 1 stage": ["Bulk Up", "Hone Claws", "Howl", "Laser Focus", "Leer", "Meditate", "Odor Sleuth", "Power Trick", "Rototiller", "Screech", "Sharpen", "Tail Whip", "Taunt", "Topsy-Turvy", "Will-O-Wisp", "Work Up"],
    "Boosts Attack by 2 stages": ["Mirror Move"],
    "Boosts Attack by 3 stages": ["Splash"],
    "Boosts Defense by 1 stage": ["Aqua Ring", "Baby-Doll Eyes", "Baneful Bunker", "Block", "Charm", "Defend Order", "Fairy Lock", "Feather Dance", "Flower Shield", "Grassy Terrain", "Growl", "Harden", "Mat Block", "Noble Roar", "Pain Split", "Play Nice", "Poison Gas", "Poison Powder", "Quick Guard", "Reflect", "Roar", "Spider Web", "Spikes", "Spiky Shield", "Stealth Rock", "Strength Sap", "Tearful Look", "Tickle", "Torment", "Toxic", "Toxic Spikes", "Venom Drench", "Wide Guard", "Withdraw"],
    "Boosts Special Attack by 1 stage": ["Confuse Ray", "Electrify", "Embargo", "Fake Tears", "Gear Up", "Gravity", "Growth", "Instruct", "Ion Deluge", "Metal Sound", "Mind Reader", "Miracle Eye", "Nightmare", "Psychic Terrain", "Reflect Type", "Simple Beam", "Soak", "Sweet Kiss", "Teeter Dance", "Telekinesis"],
    "Boosts Special Attack by 2 stages": ["Heal Block", "Psycho Shift"],
    "Boosts Special Defense by 1 stage": ["Charge", "Confide", "Cosmic Power", "Crafty Shield", "Eerie Impulse", "Entrainment", "Flatter", "Glare", "Ingrain", "Light Screen", "Magic Room", "Magnetic Flux", "Mean Look", "Misty Terrain", "Mud Sport", "Spotlight", "Stun Spore", "Thunder Wave", "Water Sport", "Whirlwind", "Wish", "Wonder Room"],
    "Boosts Special Defense by 2 stages": ["Aromatic Mist", "Captivate", "Imprison", "Magic Coat", "Powder"],
    "Boosts Speed by 1 stage": ["After You", "Aurora Veil", "Electric Terrain", "Encore", "Gastro Acid", "Grass Whistle", "Guard Split", "Guard Swap", "Hail", "Hypnosis", "Lock-On", "Lovely Kiss", "Power Split", "Power Swap", "Quash", "Rain Dance", "Role Play", "Safeguard", "Sandstorm", "Scary Face", "Sing", "Skill Swap", "Sleep Powder", "Speed Swap", "Sticky Web", "String Shot", "Sunny Day", "Supersonic", "Toxic Thread", "Worry Seed", "Yawn"],
    "Boosts Speed by 2 stages": ["Ally Switch", "Bestow", "Me First", "Recycle", "Snatch", "Switcheroo", "Trick"],
    "Boosts Accuracy by 1 stage": ["Copycat", "Defense Curl", "Defog", "Focus Energy", "Mimic", "Sweet Scent", "Trick Room"],
    "Boosts Evasion by 1 stage": ["Camouflage", "Detect", "Flash", "Kinesis", "Lucky Chant", "Magnet Rise", "Sand Attack", "Smokescreen"],
    "Boosts all stats by 1 stage": ["Celebrate", "Conversion", "Forest's Curse", "Geomancy", "Happy Hour", "Hold Hands", "Purify", "Sketch", "Trick-or-Treat"],
    "Increases Critical Hit Ratio by 2 stages": ["Acupressure", "Foresight", "Heart Swap", "Sleep Talk", "Tailwind"],
    "Resets all lowered stat modifications": ["Acid Armor", "Agility", "Amnesia", "Attract", "Autotomize", "Barrier", "Baton Pass", "Calm Mind", "Coil", "Cotton Guard", "Cotton Spore", "Dark Void", "Disable", "Double Team", "Dragon Dance", "Endure", "Floral Healing", "Follow Me", "Heal Order", "Heal Pulse", "Helping Hand", "Iron Defense", "King's Shield", "Leech Seed", "Milk Drink", "Minimize", "Moonlight", "Morning Sun", "Nasty Plot", "Perish Song", "Protect", "Quiver Dance", "Rage Powder", "Recover", "Rest", "Rock Polish", "Roost", "Shell Smash", "Shift Gear", "Shore Up", "Slack Off", "Soft-Boiled", "Spore", "Substitute", "Swagger", "Swallow", "Swords Dance", "Synthesis", "Tail Glow"],
    "Heals the Hit Points of this Pokémon": ["Aromatherapy", "Belly Drum", "Conversion 2", "Haze", "Heal Bell", "Mist", "Psych Up", "Refresh", "Spite", "Stockpile", "Teleport", "Transform"],
    "Heals the Hit Points of the Pokémon that switches in after this Pokémon": ["Memento", "Parting Shot"],
    "This Pokémon becomes the focus": ["Destiny Bond", "Grudge"],
    "This Z-Move will become a standard Z Move based on the type of the move in its effect": ["Metronome"]
};

/**
 * @param {{
 *      Name: string
 *      Category: 'Physical' | 'Special' | 'Status'
 *      BasePower: number
 *      ZMovePowerOrEffect: string | undefined
 * }} move
 * @returns {string | null} 
 */
function zMovePowerOrEffect(move) {
    if (isSuperMove(move) === "Yes") {
        return null
    }

    if (move.ZMovePowerOrEffect) {
        return move.ZMovePowerOrEffect
    }

    if (move.Category === 'Status') {
        const matchingKey = Object.keys(StatusZMoveIndex).find(k => StatusZMoveIndex[k].includes(move.Name))
        return matchingKey !== undefined ? matchingKey : 'No extra effect'
    }

    const powerScale = [
        { Base: 0, Power: 0 },
        { Base: 55, Power: 100 },
        { Base: 65, Power: 120 },
        { Base: 75, Power: 140 },
        { Base: 85, Power: 160 },
        { Base: 95, Power: 175 },
        { Base: 100, Power: 180 },
        { Base: 110, Power: 185 },
        { Base: 125, Power: 190 },
        { Base: 130, Power: 195 },
        { Base: Infinity, Power: 200 },
    ];

    const zPowerEntry = powerScale.slice(1).find((entry, index) => {
        const prevBase = powerScale[index].Base
        const thisBase = entry.Base;
        return prevBase < move.BasePower && move.BasePower <= thisBase;
    });

    return zPowerEntry?.Power.toString() ?? null;
}



/**
 * @param {{
 *      Name: string
 *      Type: PokemonType
 *      Category: 'Physical' | 'Special' | 'Status'
 *      BasePower: number
 *      MaxMovePower: string | undefined
 * }} move
 * @returns {number | null} 
 */
function maxMovePower(move) {
    if (move.MaxMovePower !== undefined) {
        return move.MaxMovePower;
    }

    if (isSuperMove(move) === "Yes" || move.Category === 'Status') {
        return null;
    }

    /** @type {{Base: number, Power: number}[]} */
    const powerScale = (move.Type === PokemonType.Fighting || move.Type === PokemonType.Poison) ?
    [
        { Base: 0, Power: 0 },
        { Base: 40, Power: 70},
        { Base: 50, Power: 75},
        { Base: 60, Power: 80},
        { Base: 70, Power: 85},
        { Base: 100, Power: 90},
        { Base: 140, Power: 95},
        { Base: Infinity, Power: 100}
    ]:
    [
        { Base: 0, Power: 0 },
        { Base: 40, Power: 90},
        { Base: 50, Power: 100},
        { Base: 60, Power: 110},
        { Base: 70, Power: 120},
        { Base: 100, Power: 130},
        { Base: 140, Power: 140},
        { Base: Infinity, Power: 150}
    ];

    const maxPowerEntry = powerScale.slice(1).find((entry, index) => {
        const prevBase = powerScale[index].Base
        const thisBase = entry.Base;
        return prevBase < move.BasePower && move.BasePower <= thisBase;
    });

    return maxPowerEntry?.Power ?? null;
}

/**
 * @param {{
 *      Name: string
 *      IsSuperMove: "Yes" | "No" | undefined
 * }} move
 * @returns {"Yes" | "No"}
 */
function isSuperMove(move) {
    if (move.IsSuperMove !== undefined) {
        return move.IsSuperMove;
    }

    const name = move.Name;
    return (name.match(/^G-Max |^Max /) || ZMoves.includes(name)) ? "Yes" : "No";
}

module.exports = {
    zMovePowerOrEffect,
    maxMovePower,
    isSuperMove,
}
