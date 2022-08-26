const { default: Axios } = require("axios");
const { Mutex } = require("async-mutex");

const CURRENT_GENERATION = 8;

const moveNameChanges = [
    { Old: "AncientPower", New: "Ancient Power" },
    { Old: "BubbleBeam", New: "Bubble Beam" },
    { Old: "DoubleSlap", New: "Double Slap" },
    { Old: "DragonBreath", New: "Dragon Breath" },
    { Old: "DynamicPunch", New: "Dynamic Punch" },
    { Old: "ExtremeSpeed", New: "Extreme Speed" },
    { Old: "Faint Attack", New: "Feint Attack" },
    { Old: "FeatherDance", New: "Feather Dance" },
    { Old: "GrassWhistle", New: "Grass Whistle" },
    { Old: "Hi Jump Kick", New: "High Jump Kick" },
    { Old: "PoisonPowder", New: "Poison Powder" },
    { Old: "Sand-Attack", New: "Sand Attack" },
    { Old: "Selfdestruct", New: "Self-Destruct" },
    { Old: "SmellingSalt", New: "Smelling Salts" },
    { Old: "SmokeScreen", New: "Smokescreen" },
    { Old: "Softboiled", New: "Soft-Boiled" },
    { Old: "SolarBeam", New: "Solar Beam" },
    { Old: "SonicBoom", New: "Sonic Boom" },
    { Old: "ThunderPunch", New: "Thunder Punch" },
    { Old: "ThunderShock", New: "Thunder Shock" },
    { Old: "ViceGrip", New: "Vise Grip" },
    { Old: "Vice Grip", New: "Vise Grip" },
    { Old: "Conversion2", New: "Conversion 2" },
    { Old: "Will-o-Wisp", New: "Will-O-Wisp" },
    { Old: "Double-edge", New: "Double-Edge" },
    { Old: "Mud-slap", New: "Mud-Slap" },
    { Old: "X-scissor", New: "X-Scissor" },
    { Old: "Wake-up Slap", New: "Wake-Up Slap" },
    { Old: "Lock-on", New: "Lock-On" },
    { Old: "Roar Of Time", New: "Roar of Time" },
    { Old: "Baby-doll Eyes", New: "Baby-Doll Eyes" },
];

const abilityNameChanges = [
    { Old: "Compoundeyes", New: "Compound Eyes" },
    { Old: "Lightningrod", New: "Lightning Rod"}
]

function MoveNameFix(moveName) {
    moveName = moveName.trim();

    moveName = moveName.replace("Crystal Only", "");
    moveName = moveName.replace(" - HGSS Only", "");
    moveName = moveName.replace("(ΩRαS) Only", "");
    moveName = moveName.replace("USUM Only", "");
    moveName = moveName.replace("SWSH Only", "");
    moveName = moveName.replace("BDSP Only", "");

    if (moveName.includes("Only"))
        console.log(`Need to fix: ${moveName}`);

    moveName = moveName.replace(/E$/, "");

    let nameChange = moveNameChanges.find(nc => nc.Old.toUpperCase() == moveName.toUpperCase());

    if (nameChange)
        moveName = nameChange.New;

    return moveName;
}

function AbilityNameFix(abilityName) {
    abilityName = abilityName.trim();

    let nameChange = abilityNameChanges.find(nc => nc.Old.toUpperCase() == abilityName.toUpperCase());

    if (nameChange)
        abilityName = nameChange.New;

    return abilityName;
}

function PokemonNameFix(name) {
    if (name == "Nidoran (F)")
        return "Nidoran♀";

    if (name == "Nidoran (M)")
        return "Nidoran♂";

    if (name == "Ho-oh")
        return "Ho-Oh";

    if (name == "Flab�b�")
        return "Flabébé";

    return name;
}

const serebiiGetLock = new Mutex();
//const serebiiGetLock = new Semaphore(2);
async function throttledPageGet(path) {
    
    var release = await serebiiGetLock.acquire();
    var result;
     
    try {
        result = await Axios.get(path);
        release();
    } catch(err) {
        release();
        throw err;
    }

    return result;
}

module.exports = {
    CURRENT_GENERATION,
    MoveNameFix,
    AbilityNameFix,
    PokemonNameFix,
    throttledPageGet
};


