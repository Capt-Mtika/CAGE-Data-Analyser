/**
 * Offline, deterministic multi-index consensus screening.
 * This is an unsupervised statistical baseline, NOT a trained disease classifier.
 * It is intentionally bounded for 8 GB machines and uses every Nth pixel.
 */
export function screenMultiIndex(layers, maxSamples=120000) {
  const names=Object.keys(layers).filter(n=>!['DSM','DTM'].includes(n));
  if(names.length<2)return {mode:'statistical-baseline',supported:false,reason:'At least two aligned vegetation indices are needed.'};
  const n=layers[names[0]].data.length;
  if(names.some(name=>layers[name].data.length!==n))throw new Error('Multi-index analysis requires aligned raster dimensions.');
  const stride=Math.max(1,Math.ceil(n/maxSamples));
  const cuts={};
  for(const name of names){
    const values=[];const data=layers[name].data;
    for(let i=0;i<n;i+=stride)if(Number.isFinite(data[i]))values.push(data[i]);
    values.sort((a,b)=>a-b);
    if(!values.length)return {mode:'statistical-baseline',supported:false,reason:`${name} has no valid values.`};
    cuts[name]=values[Math.floor((values.length-1)*.2)];
  }
  let valid=0,consensus=0;
  for(let i=0;i<n;i+=stride){
    if(names.some(name=>!Number.isFinite(layers[name].data[i])))continue;
    valid++;
    let low=0;
    for(const name of names)if(layers[name].data[i]<=cuts[name])low++;
    if(low>=2)consensus++;
  }
  return {mode:'statistical-baseline',supported:true,indices:names,validSamples:valid,consensusSamples:consensus,consensusPercent:valid?100*consensus/valid:0,cutoffs:cuts,disclaimer:'Within-field lower-tail overlap, not a crop-stress probability or trained ML diagnosis.'};
}

/** Adapter contract for a future locally bundled ONNX/Core ML model.
 * No remote requests or hidden model downloads are performed.
 */
export class LocalModelAdapter {
  constructor({modelId='none',infer=null}={}){this.modelId=modelId;this.infer=infer;}
  async predict(tile,metadata){
    if(!this.infer)throw new Error('No validated offline model is installed. Statistical screening remains available.');
    return this.infer(tile,metadata);
  }
}
