/* WordLoom generation worker */

/* Flat-array grid helpers (mirrored in main thread for rendering) */
const GRID_ORIGIN = 128;
const GRID_STRIDE = 256;
function gridIdx(x,y){ return (y+GRID_ORIGIN)*GRID_STRIDE+(x+GRID_ORIGIN); }

function buildGrid(placements){
  const g = new Uint8Array(GRID_STRIDE*GRID_STRIDE);
  for (const {word,x,y,dir} of placements){
    for (let i=0;i<word.length;i++){
      const cx = dir==='H' ? x+i : x;
      const cy = dir==='V' ? y+i : y;
      g[gridIdx(cx,cy)] = word.charCodeAt(i);
    }
  }
  return g;
}

function bboxFromPlacements(placements){
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  for (const {word,x,y,dir} of placements){
    if (dir==='H'){
      minx=Math.min(minx,x); maxx=Math.max(maxx,x+word.length-1);
      miny=Math.min(miny,y); maxy=Math.max(maxy,y);
    } else {
      minx=Math.min(minx,x); maxx=Math.max(maxx,x);
      miny=Math.min(miny,y); maxy=Math.max(maxy,y+word.length-1);
    }
  }
  return {minx,miny,maxx,maxy,w:maxx-minx+1,h:maxy-miny+1};
}

/* RNG */
let randSeed = {value:0};
function rand(seedObj){
  if (!seedObj.value) { seedObj.value = Math.floor(Math.random() * 2147483648); }
  let t = seedObj.value += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(arr, rngFn = Math.random){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rngFn() * (i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

/* Placement core */
function placeWord(grid, letterIndex, word, rng){
  if (!letterIndex.size){
    return {word, x:0, y:0, dir:'H'};
  }
  const candidates=[];
  for (let wi=0; wi<word.length; wi++){
    const ch = word[wi];
    const hits = letterIndex.get(ch) || [];
    for (const [gx,gy] of hits){
      for (const dir of ['H','V']){
        const x = dir==='H' ? gx-wi : gx;
        const y = dir==='V' ? gy-wi : gy;
        if (dir==='H' ? grid[gridIdx(x-1,y)] || grid[gridIdx(x+word.length,y)]
                      : grid[gridIdx(x,y-1)] || grid[gridIdx(x,y+word.length)]) continue;
        let ok=true;
        for(let i=0;i<word.length;i++){
          const cx = dir==='H' ? x+i : x;
          const cy = dir==='V' ? y+i : y;
          const cell = grid[gridIdx(cx,cy)];
          if (cell){
            if (cell !== word.charCodeAt(i)){ok=false; break;}
          } else {
            if (dir==='H'){
              if (grid[gridIdx(cx,cy-1)]||grid[gridIdx(cx,cy+1)]){ok=false;break;}
            } else {
              if (grid[gridIdx(cx-1,cy)]||grid[gridIdx(cx+1,cy)]){ok=false;break;}
            }
          }
        }
        if (ok) candidates.push({word,x,y,dir});
      }
    }
  }
  if (candidates.length===0) return null;
  return candidates[Math.floor(rng()*candidates.length)];
}

function countHoles(grid, bb){
  let holes=0;
  for (let y=bb.miny;y<=bb.maxy;y++){
    for (let x=bb.minx;x<=bb.maxx;x++){
      if (grid[gridIdx(x,y)]) continue;
      if (grid[gridIdx(x+1,y)] && grid[gridIdx(x-1,y)] &&
          grid[gridIdx(x,y+1)] && grid[gridIdx(x,y-1)]) holes++;
    }
  }
  return holes;
}

function layoutScore(placements){
  if (!placements.length) return {score:1e9,meta:{bb:{w:0,h:0},letters:0,crossings:0,fillBBox:0}};
  const bb = bboxFromPlacements(placements);
  const grid = buildGrid(placements);
  let totalSlots=0, crossings=0;
  const visited = new Set();
  for (const {word,x,y,dir} of placements){
    totalSlots += word.length;
    for (let i=0;i<word.length;i++){
      const cx = dir==='H' ? x+i : x; const cy = dir==='V' ? y+i : y;
      const idx = gridIdx(cx,cy);
      if (visited.has(idx)) crossings++; else visited.add(idx);
    }
  }
  const usedCells = totalSlots - crossings;
  const letters = usedCells;
  const area = bb.w*bb.h;
  const fillBBox = usedCells/area;
  const ratio = Math.max(bb.w/bb.h, bb.h/bb.w);
  const aspectPenalty = Math.pow(ratio-1, 2);
  const holes = countHoles(grid, bb);
  const score =
    area*0.7 +
    aspectPenalty*400 +
    (1-fillBBox)*800 +
    holes*30 -
    crossings*8;
  return {score, meta:{bb,usedCells,letters,crossings,fillBBox,holes}};
}

/* Local improvement */
const _bgGrid = new Uint8Array(GRID_STRIDE*GRID_STRIDE);
const _bgTouched = [];
function buildBackgroundGrid(placements, skipIdx){
  for (const i of _bgTouched) _bgGrid[i]=0;
  _bgTouched.length=0;
  for (let i=0;i<placements.length;i++){
    if (i===skipIdx) continue;
    const {word,x,y,dir}=placements[i];
    for (let j=0;j<word.length;j++){
      const cx=dir==='H'?x+j:x; const cy=dir==='V'?y+j:y;
      const idx=gridIdx(cx,cy);
      if (!_bgGrid[idx]) _bgTouched.push(idx);
      _bgGrid[idx]=word.charCodeAt(j);
    }
  }
}
function checkWordAgainstGrid(word, x, y, dir){
  if (dir==='H' ? _bgGrid[gridIdx(x-1,y)]||_bgGrid[gridIdx(x+word.length,y)]
                : _bgGrid[gridIdx(x,y-1)]||_bgGrid[gridIdx(x,y+word.length)]) return false;
  for (let i=0;i<word.length;i++){
    const cx=dir==='H'?x+i:x; const cy=dir==='V'?y+i:y;
    const cell=_bgGrid[gridIdx(cx,cy)];
    if (cell){
      if (cell!==word.charCodeAt(i)) return false;
    } else {
      if (dir==='H'){
        if (_bgGrid[gridIdx(cx,cy-1)]||_bgGrid[gridIdx(cx,cy+1)]) return false;
      } else {
        if (_bgGrid[gridIdx(cx-1,cy)]||_bgGrid[gridIdx(cx+1,cy)]) return false;
      }
    }
  }
  return true;
}
function localImprove(placements){
  let best = placements.map(p=>({...p}));
  let {score:bestScore} = layoutScore(best);
  const rngFn = () => rand(randSeed);
  for (let iter=0; iter<200; iter++){
    const idx = Math.floor(Math.random()*best.length);
    buildBackgroundGrid(best, idx);
    const {word, x:ox, y:oy, dir:odir} = best[idx];
    const tries = [
      {dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
      {flip:true}
    ];
    shuffle(tries, rngFn);
    for (const t of tries){
      const x = ox+(t.dx||0);
      const y = oy+(t.dy||0);
      const dir = t.flip ? (odir==='H'?'V':'H') : odir;
      if (!checkWordAgainstGrid(word, x, y, dir)) continue;
      const variant = best.map((p,i)=>i===idx?{word,x,y,dir}:{...p});
      const {score} = layoutScore(variant);
      if (score < bestScore){
        bestScore = score;
        best = variant;
        break;
      }
    }
  }
  return best;
}

/* Driver */
function generateCrossword(words, restarts=200, seed=0){
  randSeed.value = seed|0;
  const rng = ()=>rand(randSeed);
  const baseOrder = [...words].sort((a,b)=>b.length-a.length);

  let best = null, bestScore = Infinity, bestMeta=null;

  outer: for (let r=0;r<restarts;r++){
    const order = [...baseOrder];
    for (let i=0;i<order.length;i++){
      const j = Math.max(0, Math.min(order.length-1, i + Math.floor((rng()-0.5)*3)));
      [order[i],order[j]]=[order[j],order[i]];
    }
    const placements=[];
    const grid = new Uint8Array(GRID_STRIDE*GRID_STRIDE);
    const letterIndex = new Map();
    for (let w of order){
      const p = placeWord(grid, letterIndex, w, rng);
      if (!p){ continue; }
      placements.push(p);
      for (let i=0; i<p.word.length; i++){
        const cx = p.dir==='H' ? p.x+i : p.x;
        const cy = p.dir==='V' ? p.y+i : p.y;
        const idx = gridIdx(cx,cy);
        if (!grid[idx]){
          grid[idx] = p.word.charCodeAt(i);
          const ch = p.word[i];
          if (!letterIndex.has(ch)) letterIndex.set(ch,[]);
          letterIndex.get(ch).push([cx,cy]);
        }
      }
    }
    if (placements.length===0) continue;

    let improved = localImprove(placements);
    const {score, meta} = layoutScore(improved);
    if (score < bestScore){ bestScore = score; best = improved; bestMeta = meta; }
    if (bestMeta && bestMeta.fillBBox>0.70 &&
        (Math.max(bestMeta.bb.w/bestMeta.bb.h, bestMeta.bb.h/bestMeta.bb.w) < 1.15)){
      break outer;
    }
  }
  return {placements:best||[], meta:bestMeta||{bb:{w:0,h:0},letters:0,crossings:0,fillBBox:0,usedCells:0}};
}

onmessage = function(e){
  const {words, restarts, seed} = e.data;
  postMessage(generateCrossword(words, restarts, seed));
};
