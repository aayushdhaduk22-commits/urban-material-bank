/* Material Tetris — browser-only 1D cutting-stock planner.
   Isolated from marketplace code. All dimensions are in hundredths of a centimetre
   internally to avoid floating point packing errors. */
(function () {
  "use strict";
  const root = document.getElementById("materialTetris");
  if (!root) return;
  const $ = (selector) => root.querySelector(selector);
  const presets = {
    shelving: {
      type: "Reclaimed timber / shelving",
      stock: [{name:"Long reclaimed board",length:120,qty:2},{name:"Short reclaimed board",length:100,qty:2}],
      cuts: [{name:"Shelf",length:80,qty:2},{name:"Side panel",length:60,qty:2},{name:"Brace",length:40,qty:2}],
      kerf:0.3
    },
    trim: {
      type: "Wooden trim / skirting",
      stock: [{name:"Renovation offcut",length:240,qty:2},{name:"Short strip",length:110,qty:2}],
      cuts: [{name:"Long trim",length:150,qty:2},{name:"Corner trim",length:70,qty:3},{name:"Small return",length:30,qty:2}],
      kerf:0.3
    },
    metal: {
      type: "Metal channels / profiles",
      stock: [{name:"Recovered profile",length:300,qty:2},{name:"Short profile",length:180,qty:1}],
      cuts: [{name:"Frame rail",length:130,qty:3},{name:"Crossbar",length:85,qty:2},{name:"Bracket",length:35,qty:3}],
      kerf:0.2
    }
  };
  let latest = null;
  const state = {type:"",stock:[],cuts:[],kerf:0.3};
  const escape = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const numberText = n => (Math.round(n)/100).toLocaleString("en-IN",{maximumFractionDigits:2});
  const unitText = n => numberText(n)+" cm";
  function cloneData(obj){return JSON.parse(JSON.stringify(obj));}
  function drawInputs(kind) {
    const rows = $("#mt-"+kind+"-rows");
    rows.innerHTML = state[kind].map((r,i) =>
      '<div class="tetris-edit-row" data-index="'+i+'">'+
        '<input aria-label="'+(kind==="stock"?"Stock batch":"Requested piece")+' name" data-field="name" type="text" maxlength="42" value="'+escape(r.name)+'" required>'+
        '<input aria-label="Length in centimetres" data-field="length" type="number" min="0.01" max="10000" step="0.01" value="'+escape(r.length)+'" required>'+
        '<input aria-label="Quantity" data-field="qty" class="tetris-qty" type="number" min="1" max="40" step="1" value="'+escape(r.qty)+'" required>'+
        '<button class="tetris-remove" type="button" data-remove="'+kind+'" data-index="'+i+'" aria-label="Remove row '+(i+1)+'" title="Remove row">×</button>'+
      '</div>'
    ).join("");
  }
  function markPreset(name) {
    root.querySelectorAll("[data-mt-preset]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mtPreset===name)));
  }
  function applyPreset(name) {
    const d=presets[name];
    state.type=d.type;state.stock=cloneData(d.stock);state.cuts=cloneData(d.cuts);state.kerf=d.kerf;
    $("#mt-type").value=d.type;
    $("#mt-kerf").value=String(d.kerf);
    drawInputs("stock");drawInputs("cuts");
    markPreset(name);
    run();
  }
  function readInputs(kind) {
    return Array.from(root.querySelectorAll("#mt-"+kind+"-rows .tetris-edit-row")).map((el,i)=>{
      const name=el.querySelector('[data-field="name"]').value.trim();
      const rawLength=Number(el.querySelector('[data-field="length"]').value);
      const qty=Number(el.querySelector('[data-field="qty"]').value);
      if (!name) throw new Error("Give every "+(kind==="stock"?"stock":"requested")+" row a name.");
      if (!Number.isFinite(rawLength)||rawLength<0.01||rawLength>10000||Math.round(rawLength*100)<=0) throw new Error("Row "+(i+1)+": enter a length between 0.01 and 10,000 cm.");
      if (!Number.isInteger(qty)||qty<1||qty>40) throw new Error("Row "+(i+1)+": quantity must be a whole number between 1 and 40.");
      return {name:name.slice(0,42),length:Math.round(rawLength*100),qty};
    });
  }
  function pack(stockBatches,cutGroups,kerf) {
    const boards=[];
    stockBatches.forEach((b,group)=>{for(let i=0;i<b.qty;i++)boards.push({key:group+"-"+i,source:b.name,length:b.length,remaining:b.length,cuts:[],kerfLoss:0,active:false});});
    const requests=[];
    cutGroups.forEach((c,group)=>{for(let i=0;i<c.qty;i++)requests.push({name:c.name,length:c.length,group,ordinal:i+1});});
    requests.sort((a,b)=>b.length-a.length||a.group-b.group);
    const missed=[];
    for(const request of requests){
      const canFit=board=>board.remaining===request.length || board.remaining>=request.length+kerf;
      const options=boards.filter(canFit);
      if(!options.length){missed.push(request);continue;}
      // Prefer packing a used board; otherwise open the shortest compatible board.
      options.sort((a,b)=>Number(b.active)-Number(a.active)||(a.remaining-b.remaining)||(a.length-b.length));
      const board=options[0];
      const sawLoss=board.remaining===request.length?0:kerf;
      board.remaining-=request.length+sawLoss;
      board.kerfLoss+=sawLoss;
      board.active=true;
      board.cuts.push({name:request.name,length:request.length,kerf:sawLoss});
    }
    const used=boards.filter(b=>b.active);
    const fitted=requests.length-missed.length;
    const useful=used.reduce((s,b)=>s+b.cuts.reduce((t,c)=>t+c.length,0),0);
    const consumed=used.reduce((s,b)=>s+b.length,0);
    const offcuts=used.reduce((s,b)=>s+b.remaining,0);
    const sawLoss=used.reduce((s,b)=>s+b.kerfLoss,0);
    return {boards:used,missed,requested:requests.length,fitted,useful,consumed,offcuts,sawLoss,unopened:boards.length-used.length,utilization:consumed?100*useful/consumed:0,coverage:requests.length?100*fitted/requests.length:0};
  }
  function metric(label,value,sub){return '<div class="tetris-metric"><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong><small>'+escape(sub)+'</small></div>';}
  function render(result) {
    const output=$("#mt-output");
    const status=result.fitted===result.requested?"All requested pieces allocated":result.fitted?"Partial cutting plan":"No requested pieces fit";
    const bars=result.boards.map((b,i)=>{
      const parts=[];
      b.cuts.forEach(c=>{
        const size=100*c.length/b.length;
        parts.push('<div class="tetris-segment" title="'+escape(c.name+": "+unitText(c.length))+'" style="width:'+size.toFixed(6)+'%">'+(size>8?escape(numberText(c.length)):"")+'</div>');
        if(c.kerf)parts.push('<div class="tetris-kerf-mark" title="Saw kerf '+escape(unitText(c.kerf))+'" style="width:'+(100*c.kerf/b.length).toFixed(6)+'%"></div>');
      });
      if(b.remaining>0)parts.push('<div class="tetris-leftover" style="width:'+(100*b.remaining/b.length).toFixed(6)+'%" title="Remaining '+escape(unitText(b.remaining))+'">'+(b.remaining/b.length>.10?escape(numberText(b.remaining)):"")+'</div>');
      return '<div class="tetris-board"><div class="tetris-board-label"><b>Stock '+(i+1)+' · '+escape(b.source)+'</b><span>'+escape(unitText(b.length))+' total</span></div>'+
        '<div class="tetris-board-track" role="img" aria-label="'+escape("Stock "+(i+1)+", "+b.cuts.map(c=>c.name+" "+unitText(c.length)).join(", ")+", remaining "+unitText(b.remaining))+'">'+parts.join("")+'</div>'+
        '<div class="tetris-board-note"><span>'+b.cuts.length+' cut'+(b.cuts.length===1?"":"s")+' · '+escape(unitText(b.kerfLoss))+' saw allowance</span><span>'+escape(unitText(b.remaining))+' usable offcut</span></div></div>';
    }).join("");
    const missing=result.missed.length?'<div class="tetris-missing"><b>Not enough compatible stock for '+result.missed.length+' piece'+(result.missed.length===1?"":"s")+'</b>'+escape(result.missed.slice(0,9).map(c=>c.name+" ("+unitText(c.length)+")").join(" · ")+(result.missed.length>9?" · and more":""))+'</div>':"";
    output.innerHTML='<div class="tetris-live"><div><b>'+escape(status)+'</b><small>'+escape($("#mt-type").value)+' · custom/demo input, not marketplace inventory</small></div><span class="tetris-heuristic">Best-fit heuristic</span></div>'+
      '<div class="tetris-metrics">'+metric("Pieces covered",Math.round(result.coverage)+"%",result.fitted+" / "+result.requested+" requested")+
      metric("Material utilization",Math.round(result.utilization)+"%",unitText(result.useful)+" recovered length")+
      metric("Reusable offcuts",unitText(result.offcuts),result.boards.length+" stock piece(s) used")+'</div>'+
      '<div class="tetris-bars-head"><b>Visual cutting plan</b><span>'+result.boards.length+' of '+(result.boards.length+result.unopened)+' stock pieces opened</span></div>'+
      (bars||'<div class="tetris-empty">No cuts fit the available stock. Adjust the stock sizes or required pieces and try again.</div>')+
      missing+
      '<div class="tetris-actions"><button type="button" id="mt-download" '+(!result.fitted?"disabled":"")+' aria-label="Download cutting plan CSV">↓ Download cut list (.csv)</button><button type="button" id="mt-copy">Copy plan summary</button></div>'+
      '<p class="tetris-disclaimer">Prototype 1D cutting-stock planner. Uses a best-fit heuristic, not a guaranteed optimal solution. Assumes all stock shares a compatible material, cross-section and condition. Includes entered saw-blade allowance; excludes clamps, defects, end trimming and safety checks. A qualified fabricator must approve real cuts.</p>';
    $("#mt-download").addEventListener("click",download);
    $("#mt-copy").addEventListener("click",copySummary);
  }
  function run() {
    const error=$("#mt-error");error.textContent="";
    try{
      const stock=readInputs("stock"),cuts=readInputs("cuts");
      if(!stock.length||!cuts.length)throw new Error("Add at least one stock length and one required cut.");
      const totalStock=stock.reduce((s,x)=>s+x.qty,0),totalCuts=cuts.reduce((s,x)=>s+x.qty,0);
      if(totalStock>160||totalCuts>160)throw new Error("For a responsive demo, keep each total at 160 pieces or less.");
      const kerfRaw=Number($("#mt-kerf").value);
      if(!Number.isFinite(kerfRaw)||kerfRaw<0||kerfRaw>5)throw new Error("Saw allowance must be between 0 and 5 cm.");
      const kerf=Math.round(kerfRaw*100);
      state.type=$("#mt-type").value;state.kerf=kerfRaw;
      const result=pack(stock,cuts,kerf);
      latest={result,stock,cuts,kerf};
      render(result);
      return result;
    }catch(err){
      error.textContent=err.message;
      error.setAttribute("role","alert");
      latest=null;
      return null;
    }
  }
  function quoteCSV(v){
    const text=String(v);
    const safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;
    return '"'+safe.replace(/"/g,'""')+'"';
  }
  function download(){
    if(!latest)return;
    const {result,kerf}=latest;
    const rows=[["Material Tetris cutting plan"],["Material family",$("#mt-type").value],["Saw allowance (cm)",numberText(kerf)],["Coverage",Math.round(result.coverage)+"%"],["Utilization",Math.round(result.utilization)+"%"],["Unopened stock pieces",result.unopened],[],["Stock #","Source","Original length (cm)","Cut #","Piece","Cut length (cm)","Saw loss (cm)","Remaining on stock (cm)"]];
    result.boards.forEach((b,i)=>b.cuts.forEach((c,j)=>rows.push([i+1,b.source,numberText(b.length),j+1,c.name,numberText(c.length),numberText(c.kerf),j===b.cuts.length-1?numberText(b.remaining):""])));
    rows.push([],["Unmatched requests","Piece","Length (cm)"]);
    result.missed.forEach(c=>rows.push(["",c.name,numberText(c.length)]));
    const csv="\ufeff"+rows.map(row=>row.map(quoteCSV).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="urban-material-bank-cut-plan.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copySummary(){
    if(!latest)return;
    const r=latest.result;
    const txt="Material Tetris — "+$("#mt-type").value+"\n"+r.fitted+"/"+r.requested+" pieces covered ("+Math.round(r.coverage)+"%)\n"+r.boards.length+" stock pieces used; "+unitText(r.useful)+" recovered; "+unitText(r.offcuts)+" remaining as offcuts; "+unitText(r.sawLoss)+" saw allowance.\nIllustrative best-fit cutting plan; confirm real-world measurements.";
    try{await navigator.clipboard.writeText(txt);$("#mt-copy").textContent="✓ Copied";setTimeout(()=>{const b=$("#mt-copy");if(b)b.textContent="Copy plan summary";},1800)}catch(e){$("#mt-error").textContent="Clipboard unavailable. Use Download cut list instead.";}
  }
  root.addEventListener("click",e=>{
    const preset=e.target.closest("[data-mt-preset]");
    if(preset){applyPreset(preset.dataset.mtPreset);return;}
    const add=e.target.closest("[data-mt-add]");
    if(add){const kind=add.dataset.mtAdd;if(state[kind].length>=8){$("#mt-error").textContent="Up to eight stock or cut types in this demo.";return;}state[kind].push({name:kind==="stock"?"Recovered offcut":"Required piece",length:kind==="stock"?100:40,qty:1});drawInputs(kind);markPreset("");return;}
    const remove=e.target.closest("[data-remove]");
    if(remove){const kind=remove.dataset.remove;state[kind].splice(Number(remove.dataset.index),1);drawInputs(kind);markPreset("");return;}
  });
  root.addEventListener("input",e=>{
    const line=e.target.closest(".tetris-edit-row");
    if(line){const kind=line.closest(".tetris-stock-rows")?"stock":"cuts";const index=Number(line.dataset.index);state[kind][index][e.target.dataset.field]=e.target.value;markPreset("");}
    if(e.target.matches("#mt-type,#mt-kerf"))markPreset("");
    $("#mt-error").textContent="";
  });
  $("#mt-run").addEventListener("click",run);
  // Pure function is exposed only for reproducible browser-based demo/tests.
  window.MaterialTetrisCore={pack};
  applyPreset("shelving");
})();