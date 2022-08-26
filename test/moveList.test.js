const { expect, test } = require('@jest/globals');

const pokemonMoveList = require('../output/pokemonMoveList.json');
const pokemonList = require('../output/pokemonList.json');
const moveDex = require('../output/moveDex.json');

const movesInMoveList = new Set();
const movesInMoveDex = new Set();

beforeAll(() => {
    for (const pokemon of pokemonMoveList.Pokemon) {
        for (const levelMoveList of pokemon.LevelUpMoveLists) {
            for (const move of levelMoveList.LevelUpMoves) {
                movesInMoveList.add(move.Name);
            }
        }

        for (let moveList of [pokemon.EggMoves, pokemon.TutorMoves, pokemon.MachineMoves]) {
            for (const move of moveList) {
                movesInMoveList.add(move.Name);
            }
        }
    }

    for (const pokemon of pokemonList) {
        for (const form of pokemon.Forms) {
            form.ExtraMove && movesInMoveList.add(form.ExtraMove);
            form.SignatureSuperMove && movesInMoveList.add(form.SignatureSuperMove);
        }
    }

    for (const move of moveDex) {
        movesInMoveDex.add(move.Name);
    }
});

test('move list sets should have moves', () => {
    expect(movesInMoveList.size).toBeGreaterThan(0);
    expect(movesInMoveDex.size).toBeGreaterThan(0);
});

test('move dex should have ALL moves in the move lists file and extra moves from the info file', () => {
    const missing = [];
    for (const move of movesInMoveList) {
        if (!movesInMoveDex.has(move)) {
            missing.push(move);
        }
    }
    if (missing.length > 0) {
        throw new Error(`Missing Moves in MoveDex.json!: [ ${missing.join(', ')} ]`);
    }
})

