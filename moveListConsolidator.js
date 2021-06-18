const fs = require("fs");
const path = require("path");
const cliProgress = require("cli-progress");
const pokemonList = require("./output/pokemonList.json");
const fizzyDexCustom = require("./fizzyDexCustom.json");

const { PokemonNameFix } = require("./util");

////////////////////////////////////////////
// DECLARATIONS
////////////////////////////////////////////

const inputPath = './genMoveLists';

const pokemonMoveListOutput = './output/pokemonMoveList.json';
const machineMoveListOutput = './output/machineMoveList.json';
const tutorMoveListOutput = './output/tutorMoveList.json';

const NonTransferableMoves = [
    "Zippy Zap",
    "Splishy Splash",
    "Floaty Fall",
    "Pika Papow",
    "Bouncy Bubble",
    "Buzzy Buzz",
    "Sizzly Slide",
    "Glitzy Glow",
    "Baddy Bad",
    "Sappy Seed",
    "Freezy Frost",
    "Sparkly Swirl",
    "Veevee Volley"
]

const IllegalTutorMoves = [
    "Zippy Zap",
    "Splishy Splash",
    "Floaty Fall",
    "Pika Papow",
    "Bouncy Bubble",
    "Buzzy Buzz",
    "Sizzly Slide",
    "Glitzy Glow",
    "Baddy Bad",
    "Sappy Seed",
    "Freezy Frost",
    "Sparkly Swirl",
    "Veevee Volley",
    "Relic Song",
    "Secret Sword",
    "Dragon Ascent"
]

function CheckAndFixNames(entryData, pokemonData) {
    if (entryData.Name != pokemonData.Name)
        throw "NAME MISMATCH " + entryData.Name + " " + pokemonData.Name;

    if (entryData.DefaultForm != pokemonData.DefaultFormName) {

        let oldName = entryData.DefaultForm;
        let newName = pokemonData.DefaultFormName;
        console.log(`WARNING: Default Form Mismatch in ${filePath} for ${entryData.Name} (${oldName}) and (${newName}). Fixing!`);

        entryData.DefaultForm = newName;
        entryData.Forms[0] = newName;

        entryData.LevelUpMoveLists.filter(l => l.Form == oldName).forEach(l => {
            l.Form = newName;
        });

        [...entryData.EggMoves, ...entryData.TutorMoves, ...entryData.MachineMoves].filter(m => m.Forms.includes(oldName)).forEach(m => {
            m.Forms[m.Forms.indexOf(oldName)] = newName;
        });
    }

    let movesToCheck = [...entryData.LevelUpMoveLists.flatMap(l => l.LevelUpMoves.map(m => { return { Name: m.Name, Forms: [l.Form] } })), ...entryData.EggMoves, ...entryData.TutorMoves, ...entryData.MachineMoves];

    let entryFormsToCheck = [...new Set([
        ...entryData.Forms,
        ...movesToCheck.flatMap(m => m.Forms)
    ])];
    let pokemonDataFormsToCheck = pokemonData.Forms.map(f => f.FormName);

    for (let formToCheck of entryFormsToCheck) {
        if (!pokemonDataFormsToCheck.includes(formToCheck))
            console.log(`Form Error in ${filePath} for ${entryData.Name}. Did not find form ${formToCheck} in the pokemon's data.`);
    }

    let pokemonDataMoveSetsToCheck = pokemonData.Forms.filter(f => f.MoveSet).map(f => f.MoveSet);

    for (let move of movesToCheck) {
        if (!move.Forms.some(f => pokemonDataMoveSetsToCheck.includes(f)))
            console.log(`Move Form Error in ${filePath} for ${entryData.Name}. Did not find any of thes forms ${move.Forms.join(", ")} for move ${move.Name} with forms in the pokemon's unique MoveSet list.`);
    }
}

function AddLevelUpMove(pokemonEntry, move, form, level) {
    let levelNum = parseInt(level, 10);
    if (isNaN(levelNum)) {
        levelNum = (level == "Evolve" ? 0 : 1);
        if (level == "N/A") {
            console.log("WARNING: Fixed " + level + " to " + levelNum + " for " + pokemonEntry.Name + " for move " + move);
        }
    }
    
    let list = pokemonEntry.LevelUpMoveLists.find(l => l.Form == form);

    if (!list) {
        list = { Form: form, LevelUpMoves: [] };
        pokemonEntry.LevelUpMoveLists.push(list);
    }

    let existingMove = list.LevelUpMoves.find(m => m.Name == move);
    if (existingMove) {
        if (levelNum < existingMove.Level) {
            existingMove.Note = "Was lowered from " + existingMove.Level;
            existingMove.Level = levelNum;
        }
    }
    else {
        list.LevelUpMoves.push({
            Name: move,
            Level: levelNum
        });
    }
}

function AddMove(moveList, move, forms) {
    let moveEntry = moveList.find(m => m.Name == move);
    if (moveEntry) {
        moveEntry.Forms.push(...forms.filter(f => !moveEntry.Forms.includes(f)));
    }
    else {
        moveList.push({
            Name: move,
            Forms: forms
        })
    }
}

function ProcessPreEvolutionMoves(pokemon, form, evolvedPokemon, evolvedForm) {
    var moveSet = pokemonList[pokemon.DexNum - 1].Forms.filter(f => f.MoveSet).map(f => f.MoveSet);
    var evolvedMoveSet = pokemonList[evolvedPokemon.DexNum - 1].Forms.filter(f => f.MoveSet).map(f => f.MoveSet);

    if (!moveSet.includes(form))
        form = pokemon.DefaultForm;

    if (!evolvedMoveSet.includes(evolvedForm))
        evolvedForm = evolvedPokemon.DefaultForm;

    //console.log(`Adding Moves from ${pokemon.Name} (${form}) to ${evolvedPokemon.Name} (${evolvedForm})`);

    var levelUpMoveList = pokemon.LevelUpMoveLists.find(l => l.Form == form);
    var evolvedLevelUpMoveList = evolvedPokemon.LevelUpMoveLists.find(l => l.Form == evolvedForm);

    evolvedLevelUpMoveList.LevelUpMoves.push(...levelUpMoveList.LevelUpMoves.filter(m => !NonTransferableMoves.includes(m.Name) && !evolvedLevelUpMoveList.LevelUpMoves.some(m2 => m2.Name == m.Name)));

    var AddPreEvolvedMoves = (moveList, evolvedMoveList) => {
        moveList.filter(m => !NonTransferableMoves.includes(m.Name) && m.Forms.includes(form) && !evolvedMoveList.some(m2 => m.Name == m2.Name && m2.Forms.includes(evolvedForm)))
            .forEach(m => AddMove(evolvedMoveList, m.Name, [evolvedForm]));
    }

    AddPreEvolvedMoves(pokemon.EggMoves, evolvedPokemon.EggMoves);
    AddPreEvolvedMoves(pokemon.TutorMoves, evolvedPokemon.TutorMoves);
    AddPreEvolvedMoves(pokemon.MachineMoves, evolvedPokemon.MachineMoves);

}

//////////////////////
// FUNCTIONAL CODE
//////////////////////

var filePaths = fs.readdirSync(inputPath).map(file => path.join(inputPath, file))
    .filter(filePath => fs.lstatSync(filePath).isFile()).sort();

console.log(filePaths);

var pokemonMoveList = [];

for (var pokemon of pokemonList) {
    pokemonMoveList.push({
        Name: pokemon.Name,
        DexNum: pokemon.DexNum,
        DefaultForm: pokemon.DefaultFormName,
        AltForms: pokemon.Forms.filter(f => f.MoveSet).map(f => f.MoveSet).filter(f => f != pokemon.DefaultFormName),
        LevelUpMoveLists: [],
        EggMoves: [],
        TutorMoves: [],
        MachineMoves: []
    })
}

for (var filePath of filePaths) {
    console.log(`Parsing file ${filePath}`);
    var fileData = JSON.parse(fs.readFileSync(filePath));

    for (var entryData of fileData) {
        var pokemonData = pokemonList[entryData.DexNum - 1];
        var pokemonMoveListEntry = pokemonMoveList[entryData.DexNum - 1];

        //console.log(pokemonMoveListEntry);

        entryData.Name = PokemonNameFix(entryData.Name);

        CheckAndFixNames(entryData, pokemonData);

        var moveSets = pokemonData.Forms.filter(f => f.MoveSet).map(f => f.MoveSet);

        const filterForms = _forms => {
            return _forms.filter(_f => moveSets.includes(_f))
        };

        const getFormOrDefault = formName => {
            return !moveSets.some(ms => ms == formName) ? entryData.DefaultForm : formName;
        }

        entryData.LevelUpMoveLists.forEach(l => {
            let form = getFormOrDefault(l.Form);
            l.LevelUpMoves.forEach(m => {
                AddLevelUpMove(pokemonMoveListEntry, m.Name, form, m.Level);
            });
        });

        entryData.EggMoves.forEach(m => AddMove(pokemonMoveListEntry.EggMoves, m.Name, filterForms(m.Forms)));
        entryData.TutorMoves.forEach(m => AddMove(pokemonMoveListEntry.TutorMoves, m.Name, filterForms(m.Forms)));
        entryData.MachineMoves.forEach(m => AddMove(pokemonMoveListEntry.MachineMoves, m.Name, filterForms(m.Forms)));
    }
};

//PATCH IN CUSTOM FB MOVE LISTS

fizzyDexCustom.forEach(customEntry => {
    if (customEntry.DexNum.match(/\D/)) {
        //New pokemon
        //TODO: Make this work
    } else {
        //Addition to existing pokemon
        let dexNum = parseInt(customEntry.DexNum);
        let form = customEntry.Form;

        let baseEntry = pokemonMoveList.find(e => e.DexNum == dexNum);
        if (!baseEntry) {
            console.error("Could not find base entry to patch for:...");
            console.error(customEntry);
            return;
        }

        console.log(`Patching in moves for new form to "${baseEntry.Name}": "${form}"`);

        //Level up moves.
        customEntry.LevelUpMoves.forEach(m => {
            AddLevelUpMove(baseEntry, m.Name, form, m.Level);
        })

        //Other moves.
        customEntry.EggMoves.forEach(m => AddMove(baseEntry.EggMoves, m, [form]));
        customEntry.TutorMoves.forEach(m => AddMove(baseEntry.TutorMoves, m, [form]));
        customEntry.MachineMoves.forEach(m => AddMove(baseEntry.MachineMoves, m, [form]));
    }
});

//ADD MOVES FROM EVOLUTION CHAIN

var evolutionChains = [];
pokemonList.filter(p => p.EvolutionChains).flatMap(p => p.EvolutionChains).forEach(ec1 => {
    //Don't add an evolution chain if it's already in our master list as the chains are, in fact, duplicated across every pokemon in that chain.
    if (!evolutionChains.some(ec2 => {
        //console.log(ec1);
        let alreadyExists = ec1.Stage1DexNum == ec2.Stage1DexNum && ec1.Stage1Form == ec2.Stage1Form &&
            ec1.Stage2DexNum == ec2.Stage2DexNum && ec1.Stage2Form == ec2.Stage2Form;

        if (alreadyExists && (ec1.Stage3DexNum !== undefined || ec2.Stage3DexNum !== undefined))
            alreadyExists = ec1.Stage3DexNum == ec2.Stage3DexNum && ec1.Stage3Form == ec2.Stage3Form;

        return alreadyExists;
    })) {
        evolutionChains.push(ec1);
    }
});

evolutionChains.forEach(ec => {
    var pokemonStage1 = pokemonMoveList[ec.Stage1DexNum - 1];
    var formStage1 = ec.Stage1Form;

    var pokemonStage2 = pokemonMoveList[ec.Stage2DexNum - 1];
    var formStage2 = ec.Stage2Form;

    ProcessPreEvolutionMoves(pokemonStage1, formStage1, pokemonStage2, formStage2);

    if (ec.Stage3DexNum !== undefined) {
        var pokemonStage3 = pokemonMoveList[ec.Stage3DexNum - 1];
        var formStage3 = ec.Stage3Form;

        ProcessPreEvolutionMoves(pokemonStage2, formStage2, pokemonStage3, formStage3);
    }
});

//FINISHING UP
// Adding cross generation tutor/machine moves.
// Checking move names.

var machineMoveSet = new Set(pokemonMoveList.flatMap(p => p.MachineMoves.map(m => m.Name)));
var tutorMoveSet = new Set(pokemonMoveList.flatMap(p => p.TutorMoves.map(m => m.Name)).filter(m => !IllegalTutorMoves.includes(m)).sort());

pokemonMoveList.forEach(pokemon => {
    //console.log(`Finshing up on... ${pokemon.Name}`)
    let allLevelUpMoves = pokemon.LevelUpMoveLists.flatMap(l => l.LevelUpMoves.map(m => { return { Name: m.Name, Form: l.Form } }));
    let allEggMoves = pokemon.EggMoves.flatMap(m => m.Forms.map(f => { return { Name: m.Name, Form: f } }));
    //console.log(pokemon.TutorMoves);
    let allTutorMoves = pokemon.TutorMoves.flatMap(m => m.Forms.map(f => { return { Name: m.Name, Form: f } }));
    let allMachineMoves = pokemon.MachineMoves.flatMap(m => m.Forms.map(f => { return { Name: m.Name, Form: f } }));

    [...allLevelUpMoves, ...allEggMoves, ...allTutorMoves]
        .filter(m => machineMoveSet.has(m.Name)) //Is it a machine move?
        .filter(m => !allMachineMoves.some(m2 => m.Name == m2.Name && m.Form == m2.Form)) //Does it NOT already exist under the Form we're checking?
        .forEach(m => {

            if (!pokemon.OtherGenerationMachineMoves) {
                pokemon.OtherGenerationMachineMoves = [];
            }

            //console.log(`For ${pokemon.Name} (${m.Form}) adding TM Move "${m.Name}"`);
            AddMove(pokemon.OtherGenerationMachineMoves, m.Name, [m.Form]);
        });

    [...allLevelUpMoves, ...allEggMoves, ...allMachineMoves]
        .filter(m => tutorMoveSet.has(m.Name))
        .filter(m => !allTutorMoves.some(m2 => m.Name == m2.Name && m.Form == m2.Form))
        .forEach(m => {

            if (!pokemon.OtherGenerationTutorMoves) {
                pokemon.OtherGenerationTutorMoves = [];
            }

            //console.log(`For ${pokemon.Name} (${m.Form}) adding Tutor Move "${m.Name}"`);
            AddMove(pokemon.OtherGenerationTutorMoves, m.Name, [m.Form]);
        });

    [...allLevelUpMoves, ...allEggMoves, ...allTutorMoves, ...allMachineMoves].forEach(m => {
        if (m.Name.includes("undefined") || m.Name.includes("Featherdance") || m.Name.includes("Extremespeed")) {
            console.error("FINAL CHECKS: Issue with move name!!!");
            console.log(m.Name);
        }
    })

    pokemon.LevelUpMoveLists.forEach(l => l.LevelUpMoves.sort((a, b) => (a.Level != b.Level) ? a.Level - b.Level : a.Name.localeCompare(b.Name)));
    pokemon.EggMoves.sort((a, b) => a.Name.localeCompare(b.Name));
    pokemon.TutorMoves.sort((a, b) => a.Name.localeCompare(b.Name));
    pokemon.MachineMoves.sort((a, b) => a.Name.localeCompare(b.Name));
})

console.log("Pokemon Entry Count:" + pokemonMoveList.length);

fs.writeFileSync(pokemonMoveListOutput, JSON.stringify({ Pokemon: pokemonMoveList }, null, 2));
