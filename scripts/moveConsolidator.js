const { readdir, readFile, writeFile } = require("fs/promises");
const path = require("path");
const SuperMoveUtil = require('../src/superMoveUtil');
const customMoves = require('../data/fizzyDexMoves.json');

const inputDir = path.resolve(__dirname, '../genMoveDexes');
const outputPath = path.resolve(__dirname, '../output/moveDex.json');

const moveSkeleton = {
    "Name": "ERROR",
    "Type": "Unknown",
    "Category": "ERROR",
    "BasePower": 0,
    "Accuracy": 100,
    "BattleEffect": "ERROR: NOTHING GOT LOADED",
    "SecondaryEffect": "No effect.",
    "EffectRate": "-- %",
    "SpeedPriority": "0",
    "CriticalHitRate": "4.17%",
    "Target": "Unspecified",
    "MakesPhysicalContact": "No"
}

function makeMoveEntry(moveObj) {
    const moveEntry = Object.assign({}, moveSkeleton);
    Object.assign(moveEntry, moveObj);

    if (moveEntry.Category === "Status") {
        moveEntry.CriticalHitRate = "None";
    }

    moveEntry.IsSuperMove = SuperMoveUtil.isSuperMove(moveEntry);
    if (moveEntry.IsSuperMove === "Yes") {
        moveEntry.Accuracy = 101;
    }

    let temp;
    if ((temp = SuperMoveUtil.maxMovePower(moveEntry)) !== null) {
        moveEntry.MaxMovePower = temp;
    }
    if ((temp = SuperMoveUtil.zMovePowerOrEffect(moveEntry)) !== null) {
        moveEntry.ZMovePowerOrEffect = temp;
    }

    const orderOfProps = [
        "Name",
        "Type",
        "Category",
        "BasePower",
        "Accuracy",
        "BattleEffect",
        "SecondaryEffect",
        "EffectRate",
        "SpeedPriority",
        "CriticalHitRate",
        "Target",
        "MakesPhysicalContact",
        "IsSuperMove",
        "MaxMovePower",
        "ZMovePowerOrEffect"
    ];

    const result = {};
    orderOfProps.forEach(p => {
        const val = moveEntry[p]
        if (val !== undefined) {
            result[p] = val;
        }
    })
    return result;
}


async function main() {
    const inputPaths = (await readdir(inputDir)).map(p => path.resolve(inputDir, p));
    const inputFiles = await Promise.all(
        inputPaths.map(async p => {
            return JSON.parse(await readFile(p, { encoding: 'utf8' }));
        })
    );

    inputFiles.push(customMoves);

    /** @type {(typeof moveSkeleton)[]} */
    const result = [];
    for (const moveList of inputFiles) {
        for (const moveEntry of moveList) {
            const existingIdx = result.findIndex(e => e.Name === moveEntry.Name);
            if (existingIdx !== -1) {
                Object.assign(result[existingIdx], moveEntry);
            } else {
                result.push(makeMoveEntry(moveEntry));
            }
        }
    }

    result.sort((a, b) => a.Name.localeCompare(b.Name));

    await writeFile(outputPath, JSON.stringify(result, null, 4));
}

(async () => { await main() })().catch(err => console.error(err));
