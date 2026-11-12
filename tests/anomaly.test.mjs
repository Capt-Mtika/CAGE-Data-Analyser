import test from 'node:test';
import assert from 'node:assert/strict';
import {screenMultiIndex,LocalModelAdapter} from '../src/anomaly.js';

test('consensus screening finds shared low zones',()=>{
  const layers={NDVI:{data:Float32Array.from([.1,.2,.7,.8,.9])},NDRE:{data:Float32Array.from([.05,.15,.4,.5,.6])}};
  const result=screenMultiIndex(layers);
  assert.equal(result.supported,true);
  assert.equal(result.consensusSamples,1);
  assert.equal(result.validSamples,5);
  assert.equal(result.consensusPercent,20);
});
test('one index cannot confirm multi-index agreement',()=>{
  assert.equal(screenMultiIndex({NDVI:{data:Float32Array.of(.2,.3)}}).supported,false);
});
test('model adapter fails clearly without an installed model',async()=>{
  await assert.rejects(new LocalModelAdapter().predict([],{}),/No validated offline model/);
});
