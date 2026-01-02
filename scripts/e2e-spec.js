const fs = require('fs');
const path = require('path');

const engine = require('../public/packaging_engine');

const configPath = path.resolve(__dirname, '..', 'public', 'data', 'packaging.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function initBufferState() {
  return engine.loadBufferState(config, null, null).state;
}

function initLineRequests() {
  return engine.createLineRequests(config, null);
}

function updateLineRequest(lineRequests, lineId, trigger, updates) {
  return lineRequests.map((req) => {
    if (req.id !== lineId) return req;
    return { ...req, [trigger]: { ...req[trigger], ...updates } };
  });
}

function updateBufferCell(state, bufferId, cellId, updates) {
  const cells = state[bufferId] || [];
  state[bufferId] = cells.map((cell) => (cell.id === cellId ? { ...cell, ...updates } : cell));
}

function runS1() {
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();
  updateBufferCell(bufferState, 'MAG_A1_SUP_TMP', 'A1-L1-D1', { goodsType: 'BOX', stack: 2 });
  lineRequests = updateLineRequest(lineRequests, 'A1', 'supply', { active: true, goodsType: 'BOX' });

  const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
  assert(result, 'S1: expected dispatch');
  assert(result.action.streamId === 'S1', 'S1: streamId mismatch');
  assert(result.action.pickId === 'MAG_A1_SUP_TMP:A1-L1-D1', 'S1: pickId mismatch');
  assert(result.action.dropId === 'A1_IN', 'S1: dropId mismatch');
  const cell = result.nextBufferState.MAG_A1_SUP_TMP.find((c) => c.id === 'A1-L1-D1');
  assert(cell.stack === 1, 'S1: stack should decrement');
}

function runS2() {
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();
  updateBufferCell(bufferState, 'MAG_G2_SUP', 'G2-L1-D1', { goodsType: 'AUX', stack: 1 });
  lineRequests = updateLineRequest(lineRequests, 'A2', 'aux', { active: true });

  const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
  assert(result, 'S2: expected dispatch');
  assert(result.action.streamId === 'S2', 'S2: streamId mismatch');
  assert(result.action.pickId === 'MAG_G2_SUP:G2-L1-D1', 'S2: pickId mismatch');
  assert(result.action.dropId === 'G2', 'S2: dropId mismatch');
}

function runS3() {
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();
  lineRequests = updateLineRequest(lineRequests, 'A1', 'output', { active: true });

  const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
  assert(result, 'S3: expected dispatch');
  assert(result.action.streamId === 'S3', 'S3: streamId mismatch');
  assert(result.action.pickId === 'A1_OUT', 'S3: pickId mismatch');
  assert(result.action.dropId.startsWith('MAG_OUT_COLLECT_TMP:'), 'S3: dropId mismatch');
  const filled = result.nextBufferState.MAG_OUT_COLLECT_TMP.find((cell) => cell.stack === 1);
  assert(filled && filled.goodsType === 'PRODUCT', 'S3: buffer should be filled with PRODUCT');
}

function runS4() {
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();
  lineRequests = updateLineRequest(lineRequests, 'A2', 'waste', { active: true });

  const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
  assert(result, 'S4: expected dispatch');
  assert(result.action.streamId === 'S4', 'S4: streamId mismatch');
  assert(result.action.pickId === 'C2', 'S4: pickId mismatch');
  assert(result.action.dropId.startsWith('MAG_OUT_COLLECT_TMP:'), 'S4: dropId mismatch');
  const filled = result.nextBufferState.MAG_OUT_COLLECT_TMP.find((cell) => cell.stack === 1);
  assert(filled && filled.goodsType === 'WASTE', 'S4: buffer should be filled with WASTE');
}

function runS5() {
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();
  lineRequests = updateLineRequest(lineRequests, 'A1', 'return', { active: true, goodsType: 'BOX' });

  const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
  assert(result, 'S5: expected dispatch');
  assert(result.action.streamId === 'S5', 'S5: streamId mismatch');
  assert(result.action.pickId === 'A1_IN', 'S5: pickId mismatch');
  assert(result.action.dropId.startsWith('MAG_OUT_COLLECT_TMP:'), 'S5: dropId mismatch');
  const filled = result.nextBufferState.MAG_OUT_COLLECT_TMP.find((cell) => cell.stack === 1);
  assert(filled && filled.goodsType === 'BOX', 'S5: buffer should be filled with BOX');
}

function main() {
  runS1();
  runS2();
  runS3();
  runS4();
  runS5();
  console.log('E2E spec ok: S1-S5 dispatched correctly.');
}

main();
