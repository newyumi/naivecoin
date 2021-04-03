import * as CryptoJS from 'crypto-js';
import {broadcastLatest} from './p2p';
// 새롭게 import 되었다. 
import {hexToBinary} from './util';
// Block 의 class 를 설정한다. 

// 난이도와 채굴 구현 
// https://medium.com/caulink/javascript%EB%A1%9C-%EB%B8%94%EB%A1%9D%EC%B2%B4%EC%9D%B8-%EB%A7%8C%EB%93%A4%EA%B8%B0-2-5081895c4479 설명

class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: string;
    public difficulty: number;
    public nonce: number;
    constructor(index: number, hash: string, previousHash: string, timestamp: number, data: string, difficulty: number, nonce: number) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const genesisBlock: Block = new Block(
    // 위의 블록구조 처럼 index, hash, previousHash, timestamp, data, difficulty, nonce 순으로 정보가 기입되어있음을 알 수 있다. 
    0, '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', '', 1465154705, 'my genesis block!!', 0, 0
);

// 제네시스 블록을 가장 먼저 받아온다. 블록체인 저장을 시작하는 과정이다. 
let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;
// 마지막 블록의 정보를 가지고 오는 과정이다. 현 체인의 길이에서 - 1 을 한 index 를 가지고 있는 블록의 정보를 가지고 온다.
const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// 블록 생성 주기를 설정해준다. in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// 난이도 조정 주기를 설정해준다. in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);
// 블록을 생성하는 과정이다. 
const generateNextBlock = (blockData: string) => {
    const previousBlock: Block = getLatestBlock();              // 새로운 블록을 만들 때 그 전 블록으로 현 체인의 마지막 블록을 설정한다. 
    const difficulty: number = getDifficulty(getBlockchain());
    console.log('difficulty: ' + difficulty);
    const nextIndex: number = previousBlock.index + 1;          // index 를 설정하는 과정이다.
    const nextTimestamp: number = getCurrentTimestamp();        // #1 에서 약간 더 발전했다. 
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    addBlock(newBlock);
    broadcastLatest();      // import 한 {broadcastLatest}이 사용되었다.
    return newBlock;
};
// 블록을 생성하는 과정이다. 
const findBlock = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number): Block => {
    let nonce = 0;
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
// class Block 의 요소들로 hash 값을 계산하는 과정이다. 
const calculateHash = (index: number, previousHash: string, timestamp: number, data: string,
                       difficulty: number, nonce: number): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
// 새로운 블록을 더하는 과정이다.
const addBlock = (newBlock: Block) => {
    // 새롭게 추가될 블록이 유효한 것인지를 확인하는 과정이다. 
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
};
// 블록 구조의 유효성을 판단하는 과정이다. 
const isValidBlockStructure = (block: Block): boolean => {
    // class Block 에서 정의된 요소들의 각 항과 일치한지 검사한다. 
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};
// 새로운 블록의 유효성을 판단하는 과정이다. 
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid structure');
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
    }
    return true;
};

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

// 체인의 유효성을 판단하는 과정이다.
const isValidChain = (blockchainToValidate: Block[]): boolean => {
    // 체인의 첫 번째 블록이 genesisBlock 과 일치하는지 확인한다. 
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }
    // isValidNewBlock 을 통하여 전체 체인을 검증한다. 
    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }
    return true;
};

const addBlockToChain = (newBlock: Block) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true;
    }
    return false;
};

// 가장 긴 체인이 유효한 체인으로 교체되는 과정이다.
const replaceChain = (newBlocks: Block[]) => {
    // 새로운 chain 이 유효한 chain 이고 그 chain 이 기존의 것보다 더 길면 교체된다.
    if (isValidChain(newBlocks) &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        broadcastLatest();
    }
    // 위의 2가지 조건 중 1개라도 만족하지 못하면 교체되지 않는다.
    else {
        console.log('Received blockchain invalid');
    }
};

export {Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, replaceChain, addBlockToChain};
