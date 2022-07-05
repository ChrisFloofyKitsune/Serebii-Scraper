class Stage {
    /** @type {string} */
    Name;
    /** @type {number} */
    DexNum;
    /** @type {string} */
    Form;
}

class EvolutionChain {
    static Stage = Stage;

    /** @type {Stage} */
    Stage1;
    /** @type {string} */
    Stage2Method;
    /** @type {Stage} */
    Stage2;
    /** @type {string} */
    Stage3Method;
    /** @type {Stage?} */
    Stage3;
}

module.exports = {
    default: EvolutionChain,
    EvolutionChain
}