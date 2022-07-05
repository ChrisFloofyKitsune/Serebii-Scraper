const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const cliProgress = require("cli-progress");
const { PokeParser } = require("./PokeParser.js");
const { AbilityNameFix } = require("./util");

const pokemonGenIndex = require("./pokemonGenIndex.json");
const extraPokemonInfo = require("./extraPokeFormInfo.json");
const oldPokemonInfo = require("./oldPokemonList.json");

const fizzyDexCustom = require("./fizzyDexCustom.json");

////////////////////////
// DECLARATIONS
////////////////////////

const outputPath = "./output/pokemonList.json"

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
    GetPokemonData() {
        let [GenderRatioM, GenderRatioF] = this.GetGenderRatios();
        let output = {
            Name: this.GetName(),
            DexNum: this.GetDexNum(),
            Forms: this.GetFormInfos(),
            DefaultFormName: this.GetDefaultForm(),
            GenderRatioM,
            GenderRatioF,
            EggGroups: this.GetEggGroups()
        }

        //TODO, maybe make a more sensible list of these infos sometime.
        //How about when the next generation and/or new Pokemon roll around huh?
        let oldEvoChains = oldPokemonInfo[this.GetDexNum() - 1].EvolutionChains;
        if (oldEvoChains) {
            output["EvolutionChains"] = oldEvoChains;
        }

        let oldFormChanges = oldPokemonInfo[this.GetDexNum() - 1].FormChanges;
        if (oldFormChanges) {
            output["FormChanges"] = oldFormChanges;
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
            let output = {};

            output["FormName"] = form;

            let [primaryType, secondaryType] = this.GetTypesForForm($types, form);
            if (primaryType === undefined) {
                console.log(`\n\n${this.GetName()} - ${form} failed to have it's type parsed for form ${form}, defaulting to checking for "Normal"`);
                [primaryType, secondaryType] = this.GetTypesForForm($types, "Normal");
                if (primaryType) {
                    console.log("Fallback successful");
                }
            }

            output["PrimaryType"] = primaryType;
            if (secondaryType != null) {
                output["SecondaryType"] = secondaryType;
            }


            let [ability1, ability2, hiddenAbility] = this.GetAbilitiesForForm($abilities, form);
            if (!ability1) {
                console.log(`\n\n${this.GetName()} - ${form} failed to have it's Abilities parsed for form ${form}, defaulting to checking for "Normal"`);
                [ability1, ability2, hiddenAbility] = this.GetAbilitiesForForm($abilities, this.GetDefaultForm());
                if (ability1) {
                    console.log("Fallback successful");
                }
            }

            output["Ability1"] = ability1;
            if (ability2 != null) {
                output["Ability2"] = ability2;
            }
            if (hiddenAbility != null) {
                output["HiddenAbility"] = hiddenAbility;
            }

            //Detect if the current form (or Pokemon in general) has a unique moveset and mark it as such.
            //I don't want to talk about these regexes...
            let moveSetFormRegex = /Alolan$|Galarian$|Hisuian$|Low Key$|Amped$|Midday$|Midnight$|Dusk$|Confined$|Unbound$|^Single Strike Style$|^Rapid Strike Style$|Red Flower|Eternal Flower|Vanilla Cream$|Natural$|Land Forme$|Sky Forme$|White$|Black$|Spring$|A$|Meadow$|West Sea$|Average Size$|Baile Style$|Disguised$|Rider$|^Solo|White-Striped$/;
            let pokemonNameRegex = /Giratina$|Deoxys$|Wormadam$|Indeedee$|Meowstic$/;

            if (form == this.GetDefaultForm() || form.match(moveSetFormRegex) || this.GetName().match(pokemonNameRegex)) {
                output["MoveSet"] = form;
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
            { Name: "Darmanitan", FormIncludes: "Zen Mode", Result: ["Zen Mode", null, null] },
            { Name: "Zygarde", FormIncludes: "Complete Forme", Result: ["Power Construct"] },
            { Name: "Meowstic", FormIncludes: "Female", Result: ["Keen Eye", "Infiltrator", "Competitive"] },
            { Name: "Meowstic", FormIncludes: "Male", Result: ["Keen Eye", "Infiltrator", "Prankster"] },
            { Name: "Basculin", FormIncludes: "Red", Result: ["Reckless", "Adaptability", "Mold Breaker"] },
            { Name: "Basculin", FormIncludes: "Blue", Result: ["Rock Head", "Adaptability", "Mold Breaker"] },
            { Name: "Rockruff", FormIncludes: "Own Tempo", Result: ["Own Tempo", null, null] },
            { Name: "Greninja", FormIncludes: "Battle Bond", Result: ["Battle Bond", null, null] },
            { Name: "Gengar", FormIncludes: "Normal", Result: ["Cursed Body", "Levitate", null] },
            { Name: "Gengar", FormIncludes: "Gigantamax", Result: ["Cursed Body", "Levitate", null] },
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

    GetPokemonData() {

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
        let baseForm = baseEntry.Forms.find(f => f.FormName == patchForm.FormName);
        if (!baseForm) {
            baseForm = {};
            baseEntry.Forms.push(baseForm);
        } else {
            for (var prop in baseForm) {
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

    if (aSort > 0 && aSort == bSort) {
        return a.FormName.localeCompare(b.FormName);
    }

    return (aSort - bSort);
}

//////////////////
//MAIN CODE BEGINS
//////////////////

const parser = new PokeInfoParser();
let paths = Object.values(pokemonGenIndex).map(array => {
    //hacky patch to get the gen7 page instead for select pokemon
    let path = Object.values(array[array.length - 1])[0];
    if (path.match(/rattata|raticate|geodude|graveler|golem|grimer|muk/)) {
        path = array.find(v => Object.keys(v).includes("7"))["7"];
    }

    return path;
});
// console.log(paths);

console.log("PARSING LATEST GEN PAGES FOR ALL POKEMON");

let bar = new cliProgress.SingleBar({
    format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}`
}, cliProgress.Presets.shades_classic);

bar.start(paths.length, 0, { current: "" });

let infoOutput = [];

//DEBUG
//paths = paths.filter((p, i) => (i + 1) % 100 == 0);
//paths = paths.filter((p, i) => i == 36 || i == 37 || i == 554 || i == 645);
//paths = paths.filter((p, i) => i <= 50);

for (let path of paths) {

    if (!fs.existsSync(path))
        console.error(`Path: ${path} doesn't exist`);

    try {
        parser.LoadPage(path);
        infoOutput.push(parser.GetPokemonData());
    } catch (e) {
        console.error(`\n\nError on parsing file ${path}`);
        throw e;
    }
    bar.increment(1, { current: `${parser.GetName()} - ${parser.GetDexNum()}` });
}

bar.stop();

//Parse Mega Forms

let megaFormsPatch = [];
const megaFormParser = new MegaInfoParser();

paths = Object.values(pokemonGenIndex)
    .map(indexArray => indexArray.find(entry => entry["7"] !== undefined))
    .filter(entry => entry !== undefined)
    .map(entry => entry["7"]);

//DEBUG
//paths = paths.filter((p, i) => i <= 50);

console.log("PARSING GENERATION 7 FOR MEGA FORMS");
bar = new cliProgress.SingleBar({
    format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}`
}, cliProgress.Presets.shades_classic);
bar.start(paths.length, 0, { current: "" });

for (let path of paths) {

    if (!fs.existsSync(path)) {
        console.error(`Path: ${path} doesn't exist`);
        continue;
    }

    try {
        megaFormParser.LoadPage(path);
        let data = megaFormParser.GetPokemonData();
        if (data !== null) {
            megaFormsPatch.push(data);
        }
    } catch (e) {
        console.error(`\n\nError on parsing file ${path}`);
        throw e;
    }

    bar.increment(1, { current: `${megaFormParser.GetName()} - ${megaFormParser.GetDexNum()}` });
}

bar.stop();

PatchPokemonForms(infoOutput, megaFormsPatch);

//Verify against the existing list

console.log("CHECKING DATA AGAINST OLD VERSION OF POKEMON LIST");

let oldPokemonList = require("./oldPokemonList.json");
//console.log(oldPokemonList);
const { diff } = require("just-diff");

for (let entry of infoOutput) {

    //copy array.
    let forms = [...entry.Forms].sort((a, b) => a.FormName.localeCompare(b.FormName));

    let tempEntry = {
        ...entry,
        Forms: forms
    }

    let oldEntry = oldPokemonList[tempEntry.DexNum - 1];
    oldEntry.Forms.sort((a, b) => a.FormName.localeCompare(b.FormName))

    let diffs = diff(oldEntry, tempEntry);

    diffs = diffs.filter(d => !d.path[0].match(/Gender|EggGroups/));

    //console.log(diffs);
    if (diffs.length > 0) {
        console.log(`Diff in ${tempEntry.Name}`);
        console.log(diffs);
    }
}

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

        let baseEntry = infoOutput.find(e => e.DexNum == parseInt(customEntry.DexNum));
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

        PatchPokemonFormEntry(baseEntry, { DexNum: dexNum, Forms: [formPatch] });

        const ARRAY_PROPS_TO_COPY = [
            { Prop: "EvolutionChain", Target: "EvolutionChains" },
            { Prop: "FormChange", Target: "FormChanges" },
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

fs.writeFileSync(outputPath, JSON.stringify(infoOutput, null, 2));