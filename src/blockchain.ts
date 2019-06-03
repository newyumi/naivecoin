import * as CryptoJS from 'crypto-js';
import {broadcastLatest} from './p2p';

// Block 의 class 를 설정한다. 
class Block {

    // 블록 구조의 필수적인 요소들에 대한 구현이다. 
    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: string;

    constructor(index: number, hash: string, previousHash: string, timestamp: number, data: string) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
    }
}
// genesisBlock 하드코딩 되어있다. 
const genesisBlock: Block = new Block(
    // 위의 블록구조 처럼 index, hash, previousHash, timestamp, data 순으로 정보가 기입되어있음을 알 수 있다. 
    0, '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7', '', 1465154705, 'my genesis block!!'
);
// 제네시스 블록을 가장 먼저 받아온다. 블록체인 저장을 시작하는 과정이다. 
let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;
// 마지막 블록의 정보를 가지고 오는 과정이다. 현 체인의 길이에서 - 1 을 한 index 를 가지고 있는 블록의 정보를 가지고 온다. 
const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// 블록을 생성하는 과정이다. 
const generateNextBlock = (blockData: string) => {
    const previousBlock: Block = getLatestBlock();              // 새로운 블록을 만들 때 그 전 블록으로 현 체인의 마지막 블록을 설정한다. 
    const nextIndex: number = previousBlock.index + 1;          // index 를 설정하는 과정이다.
    const nextTimestamp: number = new Date().getTime() / 1000;  // timestamp 를 설정하는 과정이다.  
    
    // calculateHash 으로 해시값을 계산한다. 
    const nextHash: string = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
    // class 의 Block 에 맞게 index, hash, previousHash, timestmap. data 순으로 정보를 기입하고 hash 는 위의 nextHash 값을 가지고 온다. 
    const newBlock: Block = new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, blockData);
    addBlock(newBlock);
    broadcastLatest();      // import 한 {broadcastLatest}이 사용되었다.
    return newBlock;
};

const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data);
// class Block 의 요소들로 hash 값을 계산하는 과정이다. 
const calculateHash = (index: number, previousHash: string, timestamp: number, data: string): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
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
    // 블록의 index에 이전 블록의 index 보다 1이 커야 한다. 그렇지 않으면, false 를 반환한다. 
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } 
    //  블록의 previousHash 와 이전 블록의 hash 가 일치해야 한다.  그렇지 않으면, false 를 반환한다.
    else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } 
    // 블록의 hash 값 자체가 유효해야 한다. 그렇지 않으면, false 를 반환한다.
    else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    }
    // 3가지 조건이 모두 성립하면 true 를 반환한다. 
    return true;
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
    // isValidnewBlock 을 통하여 전체 체인을 검증한다. 
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
    // code 1_4 에서 정의된 getBlockchain과 code 1_7 에서 정의된 isValidChain 을 사용한다. 
    // 새로운 chain 이 유효한 chain 이고 그 chain 이 기존의 것보다 더 길면 교체된다. 
    if (isValidChain(newBlocks) && newBlocks.length > getBlockchain().length) {
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
