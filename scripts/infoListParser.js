const fs = require("fs");
const path = require("path");
const cliProgress = require("cli-progress");
const {PokeParser} = require("../src/PokeParser.js");
const {AbilityNameFix} = require("../src/util");
/** @type {Record<number, { Gen: number, Path: string, Forms: string[]}[]>} */
const pokemonGenIndex = require("../data/pokemonGenIndex.json");
const extraPokemonInfo = require("../data/extraPokeFormInfo.json");
const evolutionChains = require("../data/evolutionChains.json");
const formChanges = require("../data/formChanges.json");
const fizzyDexCustom = require("../data/fizzyDexCustom.json");

////////////////////////
// DECLARATIONS
////////////////////////

const inputPath = path.resolve(__dirname, "../rawHTML/");
const outputPath = path.resolve(__dirname, "../output/pokemonList.json");

//Detect if the current form (or Pokemon in general) has a unique moveset and mark it as such.
//I don't want to talk about these regexes...
const moveSetFormRegex = new RegExp([
    /Alolan$/,
    /Galarian$/,
    /Hisuian$/,
    /Paldean$/,
    /Low Key$/,
    /Amped$/,
    /Midday$/,
    /Midnight$/,
    /Dusk$/,
    /Confined$/,
    /Unbound$/,
    /^Single Strike Style$/,
    /^Rapid Strike Style$/,
    /Red Flower/,
    /Eternal Flower/,
    /Vanilla Cream$/,
    /Natural$/,
    /Land Forme$/,
    /Sky Forme$/,
    /White$/,
    /Black$/,
    /Spring$/,
    /A$/,
    /Meadow$/,
    /West Sea$/,
    /Average Size$/,
    /Baile Style$/,
    /Disguised$/,
    /Rider$/,
    /^Solo/,
    /White-Striped$/,
    /Paldean Combat Breed$/,
    /Paldean Blaze Breed$/,
    /Paldean Aqua Breed$/,
    /Blood ?[Mm]oon/,
].map(r => r.source).join('|'));

const pokemonNameRegex = new RegExp([
    /Giratina$/,
    /Deoxys$/,
    /Wormadam$/,
    /Indeedee$/,
    /Meowstic$/,
    /Oinkologne$/,
].map(r => r.source).join('|'));

//Layout
/*
{
    "Name": "Bulbasaur",
    "DexNum": 1,
    "Forms": [{
        "FormName": "Normal",
        "PrimaryType": "Grass",
        "SecondaryType": "Poison",
        "Ability1": "Overgrow",
        "HiddenAbility": "Chlorophyll",
        "MoveSet": "Normal",
    }],
    "DefaultFormName": "Normal",
    "EvolutionChains": [{
        "Stage1DexNum": 1,
        "Stage1Form": "Normal",
        "Stage2Method": "Level 16",
        "Stage2DexNum": 2,
        "Stage2Form": "Normal",
        "Stage3Method": "Level 32",
        "Stage3DexNum": 3,
        "Stage3Form": "Normal"
    }],
    "GenderRatioM": 88.14,
    "GenderRaitoF": 11.86
}
*/

class PokeInfoParser extends PokeParser {
    GetPokemonInfoData() {
        let [GenderRatioM, GenderRatioF] = this.GetGenderRatios();
        /** @type {{
         * Name: string,
         * DexNum: number,
         * Forms: ReturnType<PokeInfoParser["GetFormInfos"]>,
         * DefaultFormName: string,
         * GenderRatioM: number,
         * GenderRatioF: number,
         * EggGroups: string[],
         * EvolutionChains: any[],
         * FormChanges: any[],
         * }}*/
        let output = {
            Name: this.GetName(),
            DexNum: this.GetDexNum(),
            Forms: this.GetFormInfos(),
            DefaultFormName: this.GetDefaultForm(),
            GenderRatioM,
            GenderRatioF,
            EggGroups: this.GetEggGroups(),
        }

        let evoChains = evolutionChains.filter(ec => ec.Stage1.DexNum === output.DexNum || ec.Stage2.DexNum === output.DexNum || (ec.Stage3 && ec.Stage3.DexNum === output.DexNum));
        if (evoChains.length > 0) {
            evoChains = evoChains.map(ec => {
                const result = {
                    Stage1DexNum: ec.Stage1.DexNum,
                    Stage1Form: ec.Stage1.Form,
                    Stage2Method: ec.Stage2Method,
                    Stage2DexNum: ec.Stage2.DexNum,
                    Stage2Form: ec.Stage2.Form,
                };

                if (ec.Stage3Method) {
                    Object.assign(result, {
                        Stage3Method: ec.Stage3Method,
                        Stage3DexNum: ec.Stage3.DexNum,
                        Stage3Form: ec.Stage3.Form
                    })
                }

                return result;
            });

            output.EvolutionChains = evoChains;
        }

        let _formChanges = formChanges.filter(fc => fc.DexNum === output.DexNum);
        if (_formChanges.length > 0) {
            _formChanges = _formChanges.map(fc => {
                return {
                    StartForm: fc.StartForm,
                    ChangeMethod: fc.ChangeMethod,
                    EndForm: fc.EndForm
                }
            });
            output.FormChanges = _formChanges;
        }

        this.AttachExtraInfo(output);

        return output;
    }

    GetGenderRatios() {
        // console.log(this.$);
        let $genderRatio = this.$("table.dextable").eq(1).find("tr").eq(1).children("td").eq(3);
        //console.log($genderRatio.text());

        if ($genderRatio.text().includes("Genderless")) {
            return [0, 0];
        }

        $genderRatio = $genderRatio.find("td");

        return [parseFloat($genderRatio.eq(1).text()), parseFloat($genderRatio.eq(3).text())];
    }

    GetFormInfos() {
        let forms = this.GetForms();

        let $types = this.$("table.dextable").eq(1).find("tr").eq(1).children("td").eq(4);
        let $abilities = this.$("table.dextable").eq(2).find("tr").eq(1).find("td");

        return forms.map(form => {
            /** @type {{
             * FormName: string,
             * PrimaryType: string,
             * SecondaryType?: string,
             * Ability1: string,
             * Ability2?: string,
             * HiddenAbility?: string,
             * MoveSet?: string,
            }} */
            let output = {};

            output.FormName = form;

            let [primaryType, secondaryType] = this.GetTypesForForm($types, form);
            if (primaryType === undefined) {
                console.log(`\n\n${this.GetName()} - ${form} failed to have it's type parsed for form ${form}, defaulting to checking for "Normal"`);
                [primaryType, secondaryType] = this.GetTypesForForm($types, "Normal");
                if (primaryType) {
                    console.log("Fallback successful");
                }
            }

            output.PrimaryType = primaryType;
            if (secondaryType != null) {
                output.SecondaryType = secondaryType;
            }


            let [ability1, ability2, hiddenAbility] = this.GetAbilitiesForForm($abilities, form);
            if (!ability1) {
                console.log(`\n\n${this.GetName()} - ${form} failed to have it's Abilities parsed for form ${form}, defaulting to checking for "Normal"`);
                [ability1, ability2, hiddenAbility] = this.GetAbilitiesForForm($abilities, this.GetDefaultForm());
                if (ability1) {
                    console.log("Fallback successful");
                }
            }

            output.Ability1 = ability1;
            if (ability2 != null) {
                output.Ability2 = ability2;
            }
            if (hiddenAbility != null) {
                output.HiddenAbility = hiddenAbility;
            }

            if (
                form === this.GetDefaultForm() ||
                form.match(moveSetFormRegex) ||
                this.GetName().match(pokemonNameRegex) ||
                (this.generation >= 9 && (
                    this.GetName() === "Basculegion" ||
                    this.GetName() === "Gastrodon"
                ))
            ) {
                output.MoveSet = form;
            }

            return output;
        });
    }

    GetTypesForForm($types, form) {

        const ExtractTypeNames = ($imgs) => {
            let result = $imgs.map((i, e) => {
                let typeName = e.attribs.src.match(/type\/(.+?).gif/)[1];
                typeName = typeName[0].toLocaleUpperCase() + typeName.slice(1);
                return typeName;
            }).get();
            return result;
        }

        //SPECIAL CASES
        // console.log(form);
        if (this.GetName() == "Darmanitan" && form == "Galarian Zen Mode") {
            return ["Ice", "Fire"];
        }

        if (this.GetName() == "Arceus" || this.GetName() == "Silvally") {
            return [form, null];
        }

        if (this.GetName() === "Tauros" && form === "Paldean Combat Breed") {
            return ["Fighting", null];
        }
        if (this.GetName() === "Tauros" && form === "Paldean Blaze Breed") {
            return ["Fighting", "Fire"];
        }
        if (this.GetName() === "Tauros" && form === "Paldean Aqua Breed") {
            return ["Fighting", "Water"];
        }

        if ($types.find("table").length == 0) {
            return ExtractTypeNames($types.find("img"));
        }


        form = form.replace(/ ?Gigantamax ?/, "");

        if (this.GetName().match(/Rotom|Calyrex/) && form == this.GetDefaultForm()) {
            form = this.GetName();
        }

        if (form == "")
            form = this.GetDefaultForm();

        return ExtractTypeNames($types.find(`tr:contains("${form}") img`));
    }

    GetAbilitiesForForm($abilities, form) {

        const specialCases = [
            {Name: "Darmanitan", FormIncludes: "Zen Mode", Result: ["Zen Mode", null, null]},
            {Name: "Zygarde", FormIncludes: "Complete Forme", Result: ["Power Construct"]},
            {Name: "Meowstic", FormIncludes: "Female", Result: ["Keen Eye", "Infiltrator", "Competitive"]},
            {Name: "Meowstic", FormIncludes: "Male", Result: ["Keen Eye", "Infiltrator", "Prankster"]},
            {Name: "Basculin", FormIncludes: "Red", Result: ["Reckless", "Adaptability", "Mold Breaker"]},
            {Name: "Basculin", FormIncludes: "Blue", Result: ["Rock Head", "Adaptability", "Mold Breaker"]},
            {Name: "Basculin", FormIncludes: "White", Result: ["Rattled", "Adaptability", "Mold Breaker"]},
            {Name: "Rockruff", FormIncludes: "Own Tempo", Result: ["Own Tempo", null, null]},
            {Name: "Greninja", FormIncludes: "Battle Bond", Result: ["Battle Bond", null, null]},
            {Name: "Gengar", FormIncludes: "Normal", Result: ["Cursed Body", "Levitate", null]},
            {Name: "Gengar", FormIncludes: "Gigantamax", Result: ["Cursed Body", "Levitate", null]},
            {Name: "Oinkologne", FormIncludes: "Male", Result: ["Lingering Aroma", "Gluttony", "Thick Fat"]},
            {Name: "Oinkologne", FormIncludes: "Female", Result: ["Aroma Veil", "Gluttony", "Thick Fat"]},
            {Name: "Squawkabilly", FormIncludes: "Green ", Result: ["Intimidate", "Hustle", "Guts"]},
            {Name: "Squawkabilly", FormIncludes: "Blue ", Result: ["Intimidate", "Hustle", "Guts"]},
            {Name: "Squawkabilly", FormIncludes: "Yellow ", Result: ["Intimidate", "Hustle", "Sheer Force"]},
            {Name: "Squawkabilly", FormIncludes: "White ", Result: ["Intimidate", "Hustle", "Sheer Force"]},
        ];

        let specialCase = specialCases.find(sc => sc.Name == this.GetName() && form.includes(sc.FormIncludes))
        if (specialCase) {
            return specialCase.Result;
        }

        if (form.includes("Alola"))
            form = "Alola";

        if (form.includes("Galarian"))
            form = "Galarian";

        let textLines = $abilities.find("b").map((i, e) => this.$(e).text()).get();
        // console.log(textLines);

        let index = textLines.findIndex(textLine => textLine.includes(form) && textLine.includes("Abilit"));
        if (form === this.GetDefaultForm() && textLines[0].includes('Regular Form')) {
            index++;
        }

        let ability1 = AbilityNameFix(textLines[++index]);
        let ability2 = null;
        let hiddenAbility = null;

        index++;
        while (index < textLines.length && (textLines[index].match(/Hidden|Other/) || !textLines[index].includes("Abilit"))) {
            if (textLines[index].includes("Other Ability")) {
                index++;
            }

            if (textLines[index].includes("Hidden Ability")) {
                hiddenAbility = AbilityNameFix(textLines[++index]);
            } else {
                ability2 = AbilityNameFix(textLines[index]);
            }

            index++;
        }

        return [ability1, ability2, hiddenAbility];
    }

    GetEggGroups() {
        let output = [];

        let $eggGroups = this.$("table.dextable").eq(4).find("tr").eq(1).find("td.fooinfo");

        if ($eggGroups.text().includes("cannot breed")) {
            return ["Unbreedable"];
        }

        $eggGroups.find("a").each((i, e) => {
            output.push(this.$(e).text());
        });

        if (output.length == 0) {
            console.error(`Could not find egg groups for ${this.name}.`);
        }

        return output;
    }

    AttachExtraInfo(output) {
        for (let form of output.Forms) {
            let searchKey = `${form.FormName}${this.GetName()}`
            //console.log(searchKey);
            for (let field in extraPokemonInfo) {
                let data = extraPokemonInfo[field];
                if (data[searchKey]) {
                    form[field] = data[searchKey];
                    //console.log(`${searchKey}[${field}]: ${form[field]}`);
                }
            }
        }
    }
}

const MEGA_FORMS = [
    "Mega", "Ultra", "Primal"
];

class MegaInfoParser extends PokeInfoParser {

    IsMegaForm(form) {
        return MEGA_FORMS.some(mf => form.includes(mf));
    }

    PageHasMegaForm() {
        return this.GetForms().some(this.IsMegaForm);
    }

    GetPokemonMegaInfoData() {

        if (!this.PageHasMegaForm()) {
            return null;
        }

        let output = {
            DexNum: this.GetDexNum(),
            Forms: this.GetFormInfos(),
        }

        this.AttachExtraInfo(output);

        return output;
    }

    GetFormInfos() {
        let forms = this.GetForms();

        return forms.filter(this.IsMegaForm).map(form => {

            let searchIndex = form;
            if (searchIndex.includes("Mega")) {
                searchIndex = `Mega Evolution${form.slice(4)}`;
            }
            if (searchIndex.includes("Ultra")) {
                searchIndex = "Ultra Burst";
            }

            let $megaHeader = this.$(`table.dextable`).has(`td.fooevo:contains("${searchIndex}")`).eq(0);
            let $types = $megaHeader.next().find("tr").eq(1).children("td").eq(4);
            let $abilities = $megaHeader.next().next().find("tr").eq(1).find("td");

            let output = {};

            output["FormName"] = form;

            let [primaryType, secondaryType] = this.GetTypesForForm($types, form);
            if (primaryType === undefined) {
                console.error(`\n\n${this.GetName()} - ${form} failed to have it's type parsed!!`);
            }

            output["PrimaryType"] = primaryType;
            if (secondaryType != null) {
                output["SecondaryType"] = secondaryType;
            }

            let [ability1] = this.GetAbilitiesForForm($abilities, form);
            if (primaryType === undefined) {
                console.error(`\n\n${this.GetName()} - ${form} failed to have it's Abilities parsed!!`);
            }

            //Mega Forms only ever have had one ability.
            output["Ability1"] = ability1;

            return output;
        });
    }
}

function PatchPokemonFormEntry(baseEntry, patchEntry) {
    patchEntry.Forms.forEach(patchForm => {
        let baseForm = baseEntry.Forms.find(f => f.FormName === patchForm.FormName);
        if (!baseForm) {
            baseForm = {};
            baseEntry.Forms.push(baseForm);
        } else {
            for (const prop in baseForm) {
                delete baseForm[prop];
            }
        }

        Object.assign(baseForm, patchForm);
    });
}

function PatchPokemonForms(infos, patchInfos) {
    patchInfos.forEach(patchEntry => {
        let baseEntry = infos.find(info => info.DexNum == patchEntry.DexNum);

        if (!baseEntry) {
            //console.error("Unable to find base form info for #" + patchInfo.DexNum);
            return;
        }

        PatchPokemonFormEntry(baseEntry, patchEntry);
    });
}

//Sorting rules:
// Super forms LAST
// BUT Gigantamax Forms go VERY LAST because generation order or something.
// OTHERWISE alphabetical order of super forms

function SuperFormComparer(a, b) {
    let aSort = a.IsSuperForm ? 1 : 0;
    let bSort = b.IsSuperForm ? 1 : 0;

    if (a.FormName.includes("Gigantamax"))
        aSort++;

    if (b.FormName.includes("Gigantamax"))
        bSort++;

    if (aSort > 0 && aSort === bSort) {
        return a.FormName.localeCompare(b.FormName);
    }

    return (aSort - bSort);
}

//////////////////
//MAIN CODE BEGINS
//////////////////

const parser = new PokeInfoParser();
let paths = Object.values(pokemonGenIndex).map(indexList => {

    indexList.sort((a, b) => b.Gen - a.Gen);
    /** @type {Record<string, { Gen: number, Path: string, Forms: string[]}>} */
    const matchedFormsMap = {};

    for (const index of indexList) {
        // note which forms are found in which gen
        for (const form of index.Forms) {
            const prev = matchedFormsMap[form];
            if ((!prev && (form !== "Normal" || Object.values(matchedFormsMap).length === 0)) || (form !== "Normal" && !prev.Forms.includes(form))) {
                matchedFormsMap[form] = index;
            }
        }
    }

    const result = Object.values(matchedFormsMap)
        .filter((value, index, array) => array.indexOf(value) === index);

    return result.map(r => inputPath + r.Path);
});

console.log("PARSING POKEMON PAGES");

let bar = new cliProgress.SingleBar({
    format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}`
}, cliProgress.Presets.shades_classic);

bar.start(paths.length, 0, {current: ""});

/** @type {Map<number, ReturnType<PokeInfoParser['GetPokemonInfoData']>>} */
let infoMap = new Map();

//DEBUG
//paths = paths.filter((p, i) => (i + 1) % 100 == 0);
//paths = paths.filter((p, i) => i == 36 || i == 37 || i == 554 || i == 645);
//paths = paths.filter((p, i) => i <= 50);

for (const pathList of paths) {

    for (const path of pathList) {
        if (!fs.existsSync(path))
            console.error(`Path: ${path} doesn't exist`);

        try {
            parser.LoadPage(path);
            const data = parser.GetPokemonInfoData();
            const existing = infoMap.get(data.DexNum);
            if (!existing) {
                infoMap.set(data.DexNum, data);
            } else {
                const missingForms = data.Forms.filter(f => !existing.Forms.some(ef => ef.FormName === f.FormName));
                existing.Forms.push(
                    ...missingForms
                );
                // console.log(`\nAdded missing form(s): [${missingForms.map(f => f.FormName).join(", ")}] to ${existing.Name}`)
            }
        } catch (e) {
            console.error(`\n\nError on parsing file ${path}`);
            throw e;
        }
    }
    bar.increment(1, {current: `${parser.GetName()} - ${parser.GetDexNum()}`});
}
bar.stop();

/** @type {ReturnType<PokeInfoParser['GetPokemonInfoData']>[]} */
let infoOutput = Array.from(infoMap.values());

//Parse Mega Forms

let megaFormsPatch = [];
const megaFormParser = new MegaInfoParser();
const megaPaths = Object.values(pokemonGenIndex)
    .map(indexList => indexList.find(entry => entry.Gen === 7)?.Path)
    .filter(path => !!path).map(p => inputPath + p);

//DEBUG
//paths = paths.filter((p, i) => i <= 50);

console.log("PARSING GENERATION 7 FOR MEGA FORMS");
bar = new cliProgress.SingleBar({
    format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}`
}, cliProgress.Presets.shades_classic);
bar.start(megaPaths.length, 0, {current: ""});

for (let path of megaPaths) {

    if (!fs.existsSync(path)) {
        console.error(`Path: ${path} doesn't exist`);
        continue;
    }

    try {
        megaFormParser.LoadPage(path);
        const data = megaFormParser.GetPokemonMegaInfoData();
        if (data !== null) {
            megaFormsPatch.push(data);
        }
    } catch (e) {
        console.error(`\n\nError on parsing file ${path}`);
        throw e;
    }

    bar.increment(1, {current: `${megaFormParser.GetName()} - ${megaFormParser.GetDexNum()}`});
}

bar.stop();

PatchPokemonForms(infoOutput, megaFormsPatch);

//Sort forms!
infoOutput.forEach(entry => entry.Forms.sort(SuperFormComparer));

//Patch in custom Fizzy Dex Pokemon and Forms, don't sort after this so they always appear last.
console.log("PATCHING IN CUSTOM FIZZY BUBBLES POKEMON AND FORMS");

fizzyDexCustom.forEach(customEntry => {
    //Detect if new mon or not. New mons are required (by me) to have non-numeral characters in their DexNums

    if (customEntry.DexNum.match(/\D/)) {
        //New pokemon.
        //TODO: MAKE THIS WORK.
        console.log("Adding new Fakemon (Note: NOT IMPLEMENTED YET)");
    } else {
        //Addition to existing pokemon.
        let dexNum = parseInt(customEntry.DexNum);

        let baseEntry = infoOutput.find(e => e.DexNum === parseInt(customEntry.DexNum));
        if (!baseEntry) {
            console.error("Could not find the base entry to patch for:...");
            console.error(customEntry);
            return;
        }

        console.log(`Patching in new form to "${baseEntry.Name}": "${customEntry.Form}"`);

        //Assemble the form patch!
        let formPatch = {
            "FormName": customEntry.Form
        };

        const FORM_PROPS_TO_COPY = ["Alias", "PrimaryType", "SecondaryType", "Ability1", "Ability2", "HiddenAbility", "ExtraMove", "HumpySpriteURL", "HumpyShinyURL", "ArtworkURL"];
        FORM_PROPS_TO_COPY.forEach(prop => {
            if (customEntry[prop] !== undefined) {
                formPatch[prop] = customEntry[prop];
            }
        });

        //These ALWAYS have their own move set, otherwise- what's the point?
        formPatch["MoveSet"] = customEntry.Form;

        // console.log(formPatch);

        PatchPokemonFormEntry(baseEntry, {DexNum: dexNum, Forms: [formPatch]});

        const ARRAY_PROPS_TO_COPY = [
            {Prop: "EvolutionChain", Target: "EvolutionChains"},
            {Prop: "FormChange", Target: "FormChanges"},
        ];

        ARRAY_PROPS_TO_COPY.forEach(item => {
            if (customEntry[item.Prop] !== undefined) {
                if (baseEntry[item.Target] === undefined) {
                    baseEntry[item.Target] = [];
                }

                baseEntry[item.Target].push(customEntry[item.Prop]);
            }
        });
    }
});

//Diff against the old/existing list

console.log("CHECKING DATA AGAINST LAST VERSION OF POKEMON LIST");

const oldPokemonList = require("../old/pokemonList.old.json") ?? require("../output/pokemonList.json");

if (oldPokemonList) {
    const {diff} = require("just-diff");

    for (let entry of infoOutput) {

        let oldEntry = oldPokemonList[entry.DexNum - 1];
        if (!oldEntry) {
            console.log(`Added new entry for: ${entry.Name}`);
            continue;
        }

        function sortForms(a, b) {
            const firsts = ["Normal", "Kalosian"];
            if (firsts.some(f => a === f)) {
                a = "_" + a;
            }
            if (firsts.some(f => b === f)) {
                b = "_" + b;
            }
        }

        //copy array.
        let forms = entry.Forms.slice().sort(sortForms);

        let tempEntry = {
            ...entry,
            Forms: forms
        }

        oldEntry.Forms.sort(sortForms)

        let diffs = diff(oldEntry, tempEntry);

        diffs = diffs.filter(d => !d.path[0].match(/Gender|EggGroups/));

        //console.log(diffs);
        if (diffs.length > 0) {
            console.log(`Diff in ${tempEntry.Name}`);
            console.log(diffs);
        }
    }
} else {
    console.log("NO EXISTING LIST FOUND.");
}

fs.writeFileSync(outputPath, JSON.stringify(infoOutput, null, 4));
