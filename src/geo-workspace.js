import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import {fromBlob} from 'geotiff';

const MAX_PIXELS = 18_000_000;
const NAMES = ['NDVI','NDRE','LCI','VARI','GNDVI','SAVI','DSM','DTM'];
let map, overlay;

export function geographicBounds(layer) {
  if (!layer?.bbox || !layer.crs) throw new Error('GeoTIFF has no usable geographic metadata');
  const code = Number(layer.crs);
  let src;
  if (code === 4326) src = 'EPSG:4326';
  else if (code === 3857) src = 'EPSG:3857';
  else if ((code >= 32601 && code <= 32660) || (code >= 32701 && code <= 32760)) {
    const zone = code % 100;
    src = `+proj=utm +zone=${zone} ${code >= 32700 ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
  } else throw new Error(`EPSG:${code} is not supported for automatic positioning. Reproject to EPSG:4326 or a WGS84 UTM zone.`);
  const [x0,y0,x1,y1] = layer.bbox;
  if (![x0,y0,x1,y1].every(Number.isFinite)) throw new Error('Invalid GeoTIFF bounding coordinates');
  const corners = [[x0,y0],[x0,y1],[x1,y0],[x1,y1]].map(p => proj4(src,'EPSG:4326',p));
  const lons = corners.map(p=>p[0]), lats = corners.map(p=>p[1]);
  if (lats.some(v=>Math.abs(v)>90) || lons.some(v=>Math.abs(v)>180)) throw new Error('Georeferencing falls outside valid latitude/longitude coordinates');
  return [[Math.min(...lats),Math.min(...lons)],[Math.max(...lats),Math.max(...lons)]];
}

function layerImage(layer) {
  const max = 640, width = Math.max(1,Math.round(Math.min(max,layer.width))), height = Math.max(1,Math.round(width*layer.height/layer.width));
  const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(width,height);
  if(layer.rgb){
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const s=(Math.min(layer.height-1,Math.floor(y*layer.height/height))*layer.width+Math.min(layer.width-1,Math.floor(x*layer.width/width)))*3;
      const o=(y*width+x)*4;
      for(let c=0;c<3;c++)pixels.data[o+c]=Math.max(0,Math.min(255,layer.rgb[s+c]));
      pixels.data[o+3]=230;
    }
    ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
  }
  let min=Infinity,maxValue=-Infinity;
  // Sample the displayed resolution; avoid copying millions of pixels into a sorting array.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=layer.data[Math.min(layer.height-1,Math.floor(y*layer.height/height))*layer.width+Math.min(layer.width-1,Math.floor(x*layer.width/width))];
    if(Number.isFinite(v)){min=Math.min(min,v);maxValue=Math.max(maxValue,v)}
  }
  const terrain=['DSM','DTM'].includes(layer.name);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=layer.data[Math.min(layer.height-1,Math.floor(y*layer.height/height))*layer.width+Math.min(layer.width-1,Math.floor(x*layer.width/width))];
    const o=(y*width+x)*4;
    if(!Number.isFinite(v))continue;
    const t=Math.max(0,Math.min(1,(v-min)/(maxValue-min||1)));
    const stops=terrain?[[48,96,126],[120,160,136],[234,204,146]]:[[192,63,62],[237,171,73],[232,223,124],[54,151,94]];
    const index=Math.min(stops.length-2,Math.floor(t*(stops.length-1))), f=t*(stops.length-1)-index;
    for(let c=0;c<3;c++)pixels.data[o+c]=Math.round(stops[index][c]*(1-f)+stops[index+1][c]*f);
    pixels.data[o+3]=215;
  }
  ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}

export function destroyGeoMap(){if(map){map.remove();map=null;overlay=null}}

export function mountGeoMap(state, setNotice) {
  const host=document.getElementById('osm-map');
  if(!host)return;
  if(!state.osmMode){host.hidden=true;return}
  host.hidden=false;
  if(!map){
    map=L.map(host,{zoomControl:false}).setView([-13.96,33.77],6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19
    }).addTo(map);
  }
  if(overlay){map.removeLayer(overlay);overlay=null}
  const layer=state.layers[state.selected];
  if(layer&&!layer.isDemo){
    try{
      const bounds=geographicBounds(layer);
      overlay=L.imageOverlay(layerImage(layer),bounds,{interactive:false}).addTo(map);
      map.fitBounds(bounds,{padding:[35,35],maxZoom:18});
      setNotice(`${state.selected} automatically positioned at EPSG:${layer.crs} coordinates.`, 'success');
    }catch(err){setNotice(`OpenStreetMap positioning: ${err.message}`,'error')}
  }else setNotice('Import a georeferenced GeoTIFF to locate it automatically on OpenStreetMap. The demo surface has no real-world coordinates.');
  setTimeout(()=>map?.invalidateSize(),0);
}

export function mapZoom(delta){if(map)delta>0?map.zoomIn():map.zoomOut()}
export function mapFit(state){if(map&&state.layers[state.selected]&&!state.isDemo){try{map.fitBounds(geographicBounds(state.layers[state.selected]),{padding:[35,35]})}catch{}}}

export async function addGeoTiffs(files,state,refresh,setNotice){
  const selected=Array.from(files).filter(f=>/\.tiff?$/i.test(f.name));
  if(!selected.length){setNotice('Choose .tif or .tiff files.','error');return}
  const incoming={};
  try{
    for(const file of selected){
      const name=file.name.replace(/\.tiff?$/i,'').toUpperCase().replace(/[^A-Z0-9_-]/g,'_');
      const tiff=await fromBlob(file), img=await tiff.getImage();
      const width=img.getWidth(),height=img.getHeight();
      if(width*height>MAX_PIXELS)throw new Error(`${file.name} exceeds the 18-million-pixel browser limit`);
      const bands=img.getSamplesPerPixel();
      if(bands!==1&&bands!==3&&bands!==4)throw new Error(`${file.name}: only single-band indices or RGB/RGBA GeoTIFFs are supported`);
      if(img.fileDirectory?.ModelTransformation)throw new Error(`${file.name} uses a transformed/rotated grid; orthorectify it before import`);
      const raster=bands===1?(await img.readRasters())[0]:null,nodata=img.getGDALNoData();
      const keys=img.getGeoKeys(),tie=img.getTiePoints()[0],res=img.getResolution();
      const crs=keys.ProjectedCSTypeGeoKey||keys.GeographicTypeGeoKey||null;
      const bbox=img.getBoundingBox();
      const rgb=bands>1?await img.readRasters({samples:[0,1,2],interleave:true}):null;
      if(bands===1&&!NAMES.includes(name))throw new Error(`${file.name}: numeric rasters must be named NDVI.tif, NDRE.tif, DSM.tif etc.`);
      const item={name,data:raster?Float32Array.from(raster,v=>v===nodata||!Number.isFinite(v)?NaN:v):null,rgb,width,height,crs,bbox,
        origin:tie?[tie.x,tie.y]:null,resolution:res?[res[0],res[1]]:null,source:file.name};
      geographicBounds(item); // Reject unknown projections instead of plotting in the wrong location.
      incoming[name]=item;
    }
    const existing=state.isDemo?{}:state.layers;
    const merged={...existing,...incoming};
    const names=Object.keys(merged);
    state.layers=merged;state.isDemo=false;state.valid=true;state.analysed=false;state.stats=null;
    state.primary=merged.NDVI?'NDVI':names.find(n=>merged[n].data&&!['DSM','DTM'].includes(n))||names.find(n=>merged[n].data)||'';
    state.selected=Object.keys(incoming)[0];state.name=state.name==='Illustrative field / demo data'?'Imported survey':state.name;
    state.osmMode=true;refresh();setNotice(`${selected.length} GeoTIFF file(s) added. Select layers or remove them individually.`, 'success');
  }catch(err){setNotice(`Import failed: ${err.message}`,'error')}
}
