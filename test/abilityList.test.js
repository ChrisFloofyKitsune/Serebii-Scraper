const { beforeAll, test, expect } = require('@jest/globals');

const pokemonList = require('../output/pokemonList.json');
const abilityDex = require('../output/abilityDex.json');

const abilityNameSet = new Set(abilityDex.map(ability => ability.Name));

test("Has at least Ability1", () => {
    for(const pokemon of pokemonList) {
        for (const form of pokemon.Forms) {
            if (!form.Ability1) {
                throw new Error (`${pokemon.Name} (${form.FormName}) is missing Ability1!`);
            }
        }
    }
});

test("All abilities are in the Ability Dex", () => {
    const errors = ["-- Missing AbilityDex Entries --"];

    for(const pokemon of pokemonList) {
        for (const form of pokemon.Forms) {
            if (!abilityNameSet.has(form.Ability1)) {
                errors.push(`${pokemon.Name}\t\t(${form.FormName})'s\t\tAbility1\t"${form.Ability1}"`)
            }
            if (!!form.Ability2 && !abilityNameSet.has(form.Ability2)) {
                errors.push(`${pokemon.Name}\t(${form.FormName})'s\tAbility2\t"${form.Ability2}"`)
            }
            if (!!form.HiddenAbility && !abilityNameSet.has(form.HiddenAbility)) {
                errors.push(`${pokemon.Name}\t(${form.FormName})'s\tHidden\t"${form.HiddenAbility}"`)
            }
        }
    }

    if (errors.length !== 1) {
        throw new Error(errors.join("\n"));
    }
})