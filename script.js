// Simple Flow-like implementation using pointer events
const COLS = 7;
const ROWS = 11;
const boardEl = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const newBtn = document.getElementById('newBtn');
const statusEl = document.getElementById('status');

const COLORS = {
  A: 'color-A',
  B: 'color-B',
  C: 'color-C',
  D: 'color-D',
  E: 'color-E',
  F: 'color-F',
  G: 'color-G',
  H: 'color-H'
};

// Example level (inspired by provided image) - 0-based (r,c)
const sampleLevel = {
  rows: ROWS,
  cols: COLS,
  endpoints: [
    {color:'F', a:[0,6], b:[10,6]},
    {color:'D', a:[9,3], b:[10,3]},
    {color:'C', a:[8,1], b:[2,1]},
    {color:'H', a:[1,5], b:[1,4]},
    {color:'E', a:[2,4], b:[4,4]},
    {color:'G', a:[3,2], b:[5,3]},
    {color:'B', a:[5,1], b:[6,1]},
    {color:'A', a:[6,3], b:[8,3]}
  ]
};

let cells = []; // {el, r, c, color (string or null), fixed (bool)}
let paths = {}; // color -> array of [r,c]
let drawing = null; // {color, path: [[r,c]], activeCells Set}

function createGrid(level){
  boardEl.innerHTML = '';
  cells = [];
  paths = {};
  drawing = null;
  statusEl.textContent = '';

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--cols', level.cols);
  grid.style.setProperty('--rows', level.rows);

  // create empty grid
  for(let r=0;r<level.rows;r++){
    for(let c=0;c<level.cols;c++){
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('pointerdown', onPointerDown);
      cell.addEventListener('pointerenter', onPointerEnter);
      cell.addEventListener('pointerup', onPointerUp);
      // prevent context menu on long press
      cell.addEventListener('contextmenu', e=>e.preventDefault());
      const overlay = document.createElement('div'); overlay.className='overlay';
      cell.appendChild(overlay);
      grid.appendChild(cell);
      cells.push({el:cell, r, c, color:null, fixed:false});
    }
  }

  // place endpoints
  for(const ep of level.endpoints){
    const [ra,ca]=ep.a, [rb,cb]=ep.b;
    placeDot(ra,ca,ep.color,true);
    placeDot(rb,cb,ep.color,true);
    paths[ep.color] = []; // initial empty
  }

  boardEl.appendChild(grid);
}

function idx(r,c){ return r * COLS + c; }
function getCell(r,c){ return cells[idx(r,c)]; }

function placeDot(r,c,color,isEndpoint){
  const cell = getCell(r,c);
  cell.color = color;
  cell.fixed = true;
  cell.el.classList.remove('empty');
  // dot element
  const dot = document.createElement('div');
  dot.className = `dot endpoint ${COLORS[color]}`;
  dot.textContent = color;
  cell.el.appendChild(dot);
  // keep overlay for path drawing
}

function neighbors(r,c){
  const res=[];
  const steps=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dr,dc] of steps){
    const nr=r+dr, nc=c+dc;
    if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS) res.push([nr,nc]);
  }
  return res;
}

function cellsFilledCount(){
  return cells.filter(c=>!c.el.classList.contains('empty')).length;
}

function onPointerDown(e){
  e.preventDefault();
  const r = +this.dataset.r, c = +this.dataset.c;
  const cell = getCell(r,c);
  // if clicking on endpoint or a colored cell, start drawing with that color (if endpoint or its path cell)
  let startColor = null;
  if(cell.fixed && cell.color) { startColor = cell.color; }
  else if(cell.el.dataset.pathColor) { startColor = cell.el.dataset.pathColor; }
  if(!startColor) return;

  // if clicking a finalized path of same color, allow editing: remove existing path cells (but keep endpoints)
  clearPathForColor(startColor);

  startDrawing(startColor, r, c);
  // capture pointer to the board to get move/up outside cells
  this.setPointerCapture(e.pointerId);
}

function onPointerEnter(e){
  if(!drawing) return;
  const r = +this.dataset.r, c = +this.dataset.c;
  tryExtendPath(r,c);
}

function onPointerUp(e){
  if(!drawing) return endDrawing();
}

function startDrawing(color, r, c){
  drawing = {color, path:[], occupied:set()};
  function set(){ return new Set(); } // placeholder - we use Map-like Set of "r,c" strings
  drawing.occupied = new Set();
  addToPath(r,c);
}

function coordKey(r,c){ return `${r},${c}`; }

function addToPath(r,c){
  const key = coordKey(r,c);
  if(drawing.occupied.has(key)) {
    // backtracking: if the cell is the previous one - pop
    const pIndex = drawing.path.findIndex(([rr,cc])=>coordKey(rr,cc)===key);
    if(pIndex >= 0 && pIndex === drawing.path.length-2){
      // pop last
      const [lr,lc] = drawing.path.pop();
      drawing.occupied.delete(coordKey(lr,lc));
      paintCell(lr,lc,null,false);
      return;
    }
    return;
  }

  // can't step on another color's fixed path/endpoint
  const cell = getCell(r,c);
  if(cell.fixed && cell.color && cell.color !== drawing.color) return;

  // allow stepping anywhere adjacent only
  if(drawing.path.length>0){
    const [pr,pc] = drawing.path[drawing.path.length-1];
    const man = Math.abs(pr-r)+Math.abs(pc-c);
    if(man !== 1) return;
  }

  drawing.path.push([r,c]);
  drawing.occupied.add(key);
  paintCell(r,c,drawing.color,false);
}

function tryExtendPath(r,c){
  addToPath(r,c);
}

function paintCell(r,c,color,lock){
  const cell = getCell(r,c);
  const overlay = cell.el.querySelector('.overlay');
  overlay.innerHTML = '';
  if(color){
    cell.el.classList.remove('empty');
    cell.el.dataset.pathColor = color;
    const pathDiv = document.createElement('div');
    pathDiv.className = `path ${COLORS[color]}`;
    overlay.appendChild(pathDiv);
  } else {
    // clear only if it's not endpoint
    if(!cell.fixed){
      cell.el.classList.add('empty');
      delete cell.el.dataset.pathColor;
    }
  }
  if(lock){
    cell.fixed = true;
    cell.color = color;
  } else {
    if(!cell.fixed) cell.color = color || null;
  }
}

function endDrawing(){
  if(!drawing) return;
  const color = drawing.color;
  // If last cell is an endpoint of same color -> finalize path
  const last = drawing.path[drawing.path.length-1];
  let finalized = false;
  if(last){
    const [lr,lc]=last;
    const cell = getCell(lr,lc);
    if(cell.fixed && cell.color === color){
      // connected to endpoint: finalize whole path (set fixed)
      for(const [r,c] of drawing.path){
        const cc = getCell(r,c);
        cc.fixed = true;
        cc.color = color;
        paintCell(r,c,color,true);
      }
      paths[color] = drawing.path.slice();
      finalized = true;
    }
  }
  if(!finalized){
    // revert this temporary path (restore nothing)
    for(const [r,c] of drawing.path){
      const cc = getCell(r,c);
      // if the cell was not originally fixed/endpoints, clear it
      if(!cc.fixed || cc.el.dataset.pathColor === color){
        // but don't clear other colors
        if(!cc.el.querySelector('.dot')) paintCell(r,c,null,false);
      }
    }
  }

  drawing = null;
  checkWin();
}

function clearPathForColor(color){
  // remove non-endpoint cells that belong to this color
  for(const cell of cells){
    const pc = cell.el.dataset.pathColor;
    if(pc === color && !cell.el.querySelector('.dot')){
      paintCell(cell.r,cell.c,null,false);
      cell.fixed = false;
      cell.color = null;
    }
  }
  paths[color] = [];
}

function checkWin(){
  // win when all cells are non-empty and all endpoints connected (simple check)
  const total = ROWS * COLS;
  const filled = cells.filter(c=>!c.el.classList.contains('empty')).length;
  const allConnected = Object.values(paths).every(p=>p && p.length>0);
  if(filled === total && allConnected){
    statusEl.textContent = 'You win! 🎉';
  } else {
    statusEl.textContent = '';
  }
}

resetBtn.addEventListener('click', ()=>createGrid(sampleLevel));
newBtn.addEventListener('click', ()=>{
  // For now only sample level - could add multiple
  createGrid(sampleLevel);
});

// helper: initialize
createGrid(sampleLevel);

// prevent pointer leaving the window while drawing
window.addEventListener('pointerup', ()=>{ if(drawing) endDrawing(); });
