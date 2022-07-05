const { EvolutionChain } = require('../src/EvolutionChain');
const { FormChange } = require('../src/FormChange');
const oldInfo = require('../data/oldPokemonInfo.json');

const { writeFile } = require('fs/promises');
const path = require('path');

const outEvoChains = path.resolve(__dirname, '../data/evolutionChains.json');
const outFormChanges = path.resolve(__dirname, '../data/formChanges.json');

/** @typedef {import('../src/EvolutionChain').FormListEntry} FormListEntry*/

async function main() {
    /** @type {EvolutionChain[]} */
    const evoChains = [];
    /** @type {FormChange[]} */
    const formChanges = [];
    
    for (const oldEntry of oldInfo) {
        for (const oldEvoChain of oldEntry.EvolutionChains ?? []) {
            const newChain = new EvolutionChain();

            newChain.Stage1 = new EvolutionChain.Stage();
            Object.assign(newChain.Stage1, {
                Name: getNameFromOldInfo(oldEvoChain.Stage1DexNum),
                DexNum: oldEvoChain.Stage1DexNum,
                Form: oldEvoChain.Stage1Form
            });

            newChain.Stage2Method = oldEvoChain.Stage2Method;

            newChain.Stage2 = new EvolutionChain.Stage();
            Object.assign(newChain.Stage2, {
                Name: getNameFromOldInfo(oldEvoChain.Stage2DexNum),
                DexNum: oldEvoChain.Stage2DexNum,
                Form: oldEvoChain.Stage2Form
            });

            if (oldEvoChain.Stage3DexNum !== undefined) {
                newChain.Stage3Method = oldEvoChain.Stage3Method;
                
                newChain.Stage3 = new EvolutionChain.Stage();
                Object.assign(newChain.Stage3, {
                    Name: getNameFromOldInfo(oldEvoChain.Stage3DexNum),
                    DexNum: oldEvoChain.Stage3DexNum,
                    Form: oldEvoChain.Stage3Form
                });
            }

            addIfUnique(evoChains, newChain);
        }

        for (const oldFormChange of oldEntry.FormChanges ?? []) {
            const newFormChange = new FormChange();
            
            newFormChange.Name = oldEntry.Name;
            newFormChange.DexNum = oldEntry.DexNum;
            copyProps(oldFormChange, newFormChange,
              'StartForm', 'ChangeMethod', 'EndForm'  
            );

            formChanges.push(newFormChange);
        }
    }

    await writeFile(outEvoChains, JSON.stringify(evoChains, null, 4));
    await writeFile(outFormChanges, JSON.stringify(formChanges, null, 4));

}

function copyProps(from, to, ...propList) {
    let value;
    for (const prop of propList) {
        if ((value = from[prop]) !== undefined) {
            to[prop] = value;
        }
    }
}

/**
 * @param {object[]} array
 * @param {object} item
 */
function addIfUnique(array, item) {
    const itemJson = JSON.stringify(item);
    if (array.every(obj => JSON.stringify(obj) !== itemJson)) {
        array.push(item);
    }
}

/**
 * @param {number} dexNum 
 * @returns {string | undefined}
 */
function getNameFromOldInfo(dexNum) {
    return oldInfo[dexNum - 1]?.Name ?? undefined;
}

(async () => {await main()})();