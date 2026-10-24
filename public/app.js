const $=s=>document.querySelector(s);
function applyTheme(theme){
 const light=theme==="light";
 document.documentElement.dataset.theme=light?"light":"dark";
 const btn=$("#themeToggle");
 if(btn){btn.innerHTML=light?'☾ <span>Dark mode</span>':'☼ <span>Light mode</span>';btn.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");btn.title=light?"Switch to dark mode":"Switch to light mode";}
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",light?"#f5f4ef":"#111714");
}
const savedTheme=(()=>{try{return localStorage.getItem("umb-theme")}catch(e){return null}})();
applyTheme(savedTheme==="light"?"light":"dark");
document.addEventListener("DOMContentLoaded",()=>{const b=$("#themeToggle");if(b)b.addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="light"?"dark":"light";applyTheme(next);try{localStorage.setItem("umb-theme",next)}catch(e){}});});
let materials=[];
const icons={brick:"▦",block:"◈",door:"▯",window:"⊞",steel:"╱",tile:"◇"};
const referencePhotos={Bricks:"/material-bricks.jpg",Blocks:"/material-aac.jpg",Doors:"/material-door.jpg",Windows:"/material-window.jpg",Steel:"/material-steel.jpg",Tiles:"/material-tiles.jpg"};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const photoFor=m=>m.image_url||referencePhotos[m.category]||"";
const carbonFactor=m=>window.umbCarbon.factor(m)?.value||0;
function passportCarbon(m){const factor=window.umbCarbon.factor(m),q=Number(m.quantity);if(!factor||!Number.isFinite(q)||q<=0)return "Estimate unavailable";const kg=q*factor.value;return kg<1000?kg.toLocaleString("en-IN",{maximumFractionDigits:2})+" kg":(kg/1000).toLocaleString("en-IN",{maximumFractionDigits:3})+" t";}
const categoryCoords={Whitefield:[13.0035,77.7585],"HSR Layout":[12.9116,77.6389],Indiranagar:[12.9784,77.6408],Koramangala:[12.9352,77.6245],Peenya:[13.0285,77.5197],"JP Nagar":[12.9063,77.5857]};

async function loadMaterials(){
 try{
  const p=new URLSearchParams();
  ["q","category","location","quality"].forEach(k=>{const v=$("#"+k)?.value;if(v)p.set(k,v)});
  const max=$("#maxPrice").value;if(Number(max)<10000)p.set("maxPrice",max);
  const r=await fetch("/api/materials?"+p.toString(),{headers:{"X-UMB-Client":"web-v1"}});
  if(!r.ok)throw new Error("Marketplace unavailable");
  materials=await r.json();render();initMaterialMap();
 }catch(e){$("#count").textContent="Marketplace temporarily unavailable";$("#cards").innerHTML='<div class="empty">Could not load inventory. Please refresh and try again.</div>';}
}

function listingDistance(m){const km=Number(m.distance_km);return Number.isFinite(km)&&km>0?km.toLocaleString("en-IN",{maximumFractionDigits:1})+" km · listed estimate":"Distance not calculated";}
function render(){
 $("#count").textContent=materials.length+" materials available";
 $("#cards").innerHTML=materials.length?materials.map((m,i)=>{
  const photo=photoFor(m);
  return '<article class="material" data-material-id="'+esc(m.id)+'" data-i="'+i+'"><div class="mat-image '+esc(m.image_theme)+'" style="'+(photo?'background-image:url(\''+esc(photo)+'\');background-size:cover;background-position:center;':'')+'"><span class="photo-icon">'+(photo?'':" "+(icons[m.image_theme]||"◈"))+'</span>'+(m.verified?'<span class="verified">✓ VERIFIED</span>':'')+'<span class="badge">'+esc(m.quality).toUpperCase()+'</span>'+(m.image_url?'':'<span class="photo-note">REFERENCE PHOTO</span>')+'</div><div class="mat-body"><h3>'+esc(m.title)+'</h3><div class="loc">⌖ '+esc(m.location)+' · '+listingDistance(m)+'</div><div class="mat-meta"><div><b>₹'+Number(m.price).toLocaleString("en-IN")+'</b><small> '+esc(m.unit)+'</small></div><div><b>'+Number(m.quantity).toLocaleString("en-IN")+'</b><small> available</small></div></div></div></article>';
 }).join(""):'<div class="empty">No materials match those filters.</div>';
 document.querySelectorAll(".material").forEach(el=>el.onclick=()=>showDetail(Number(el.dataset.i)));
}

let matcherInventory=[];
async function matchMaterials(){
 const needs={Bricks:Number($("#needBricks").value)||0,Blocks:Number($("#needBlocks").value)||0,Doors:Number($("#needDoors").value)||0,Windows:Number($("#needWindows").value)||0,Steel:Number($("#needSteel").value)||0,Tiles:Number($("#needTiles").value)||0};
 const project=($("#projectType").value||"your project").trim();
 const locality=$("#projectLocality")?.value||"";
 const budget=Math.max(0,Number($("#projectBudget")?.value)||0);
 const el=$("#matchResults");
 if(!Object.values(needs).some(n=>n>0)){el.innerHTML='<div class="match-empty"><span>＋</span><b>Add at least one material requirement.</b><small>Enter the quantity you need for your project, then run the matcher again.</small></div>';updateImpact([]);return}
 el.innerHTML='<div class="match-empty"><span>✦</span><b>Matching your project…</b><small>Checking active listings, quantities, locality, condition and price.</small></div>';
 let inventory=[];
 try{const response=await fetch("/api/materials",{headers:{"X-UMB-Client":"web-v1"},cache:"no-store"});if(response.ok){const data=await response.json();if(Array.isArray(data))inventory=data;}}catch(e){}
 if(!inventory.length)inventory=materials.filter(m=>!m.listing_status||m.listing_status==="active");
 matcherInventory=inventory;
 const qualityScore={Excellent:10,Good:7,Fair:4};
 const matches=[];
 for(const [category,need] of Object.entries(needs)){
  if(need<=0)continue;
  const candidates=inventory.filter(m=>m.category===category&&Number(m.quantity)>0&&(!m.listing_status||m.listing_status==="active"));
  const prices=candidates.map(m=>Number(m.price)||0).filter(v=>v>0);
  const minPrice=prices.length?Math.min(...prices):0,maxPrice=prices.length?Math.max(...prices):0;
  const ranked=candidates.map(m=>{
   const distance=Number(m.distance_km)>0?Number(m.distance_km):Infinity,price=Number(m.price)||0;
   const localScore=locality?(String(m.location||"").toLowerCase()===locality.toLowerCase()?32:0):0;
   const priceScore=budget&&maxPrice>minPrice&&price>0?10*(maxPrice-price)/(maxPrice-minPrice):0;
   return {...m,_score:localScore+(m.verified?15:0)+(qualityScore[m.quality]||0)+Math.max(0,12-Math.min(12,distance/2))+priceScore};
  }).sort((a,b)=>b._score-a._score||Number(a.price)-Number(b.price)||(Number(a.distance_km)>0?Number(a.distance_km):Infinity)-(Number(b.distance_km)>0?Number(b.distance_km):Infinity));
  let remaining=need;const sources=[];
  for(const m of ranked){if(remaining<=0)break;const take=Math.min(remaining,Number(m.quantity)||0);if(take<=0)continue;sources.push({m,quantity:take,cost:take*(Number(m.price)||0)});remaining-=take;}
  const filled=need-remaining;
  matches.push({category,need,filled,remaining,coverage:Math.round(filled/need*100),sources,cost:sources.reduce((s,x)=>s+x.cost,0)});
 }
 const totalCost=matches.reduce((s,x)=>s+x.cost,0),matchedRows=matches.flatMap(x=>x.sources.map(s=>({...s.m,quantity:s.quantity}))),filledCount=matches.filter(x=>x.filled>0).length;
 if(!filledCount){el.innerHTML='<div class="match-empty"><span>⌁</span><b>No suitable active listings found yet.</b><small>Try removing the locality preference, adjusting quantities, or checking again later. Listings may change.</small></div>';updateImpact([]);return;}
 const categoryHtml=matches.map(group=>{
  const status=group.remaining===0?"Full requirement matched":group.filled>0?"Partial supply found":"No current supply";
  const sourcesHtml=group.sources.length?group.sources.map(s=>'<button class="match-item" data-match-id="'+esc(s.m.id)+'"><div class="match-icon">'+(icons[s.m.image_theme]||"◈")+'</div><div><b>'+esc(s.m.title)+'</b><small>'+esc(s.m.location)+' · '+listingDistance(s.m)+' · '+Number(s.quantity).toLocaleString("en-IN")+' '+esc(String(s.m.unit||"units").replace("/",""))+' allocated'+(s.m.verified?' · verified listing':' · unverified listing')+'</small></div><strong>₹'+Math.round(s.cost).toLocaleString("en-IN")+'</strong></button>').join(""):'<div class="matcher-no-supply">No active '+esc(group.category.toLowerCase())+' listings found.</div>';
  return '<div class="matcher-category"><div class="matcher-category-head"><div><b>'+esc(group.category)+'</b><small>'+Number(group.filled).toLocaleString("en-IN")+' of '+Number(group.need).toLocaleString("en-IN")+' needed · '+group.coverage+'% covered</small></div><span class="'+(group.remaining===0?'match-complete':group.filled?'match-partial':'match-missing')+'">'+status+'</span></div><div class="matcher-progress"><span style="width:'+group.coverage+'%"></span></div>'+sourcesHtml+(group.remaining>0&&group.filled>0?'<small class="matcher-shortfall">'+Number(group.remaining).toLocaleString("en-IN")+' more required to complete this category.</small>':'')+'</div>';
 }).join("");
 const budgetHtml=budget?'<div class="matcher-budget '+(totalCost>budget?'over':'within')+'"><span>Estimated selected materials</span><b>₹'+Math.round(totalCost).toLocaleString("en-IN")+' / ₹'+Math.round(budget).toLocaleString("en-IN")+' budget</b><small>'+(totalCost>budget?'This match exceeds your budget by ₹'+Math.round(totalCost-budget).toLocaleString("en-IN")+'. Try a larger budget or lower-cost listings.':'Within your entered budget before transport, taxes and inspection costs.')+'</small></div>':'<div class="matcher-budget"><span>Estimated material subtotal</span><b>₹'+Math.round(totalCost).toLocaleString("en-IN")+'</b><small>Allocated quantities × listed unit prices; excludes transport and other charges.</small></div>';
 el.innerHTML='<div class="match-heading"><div><b>Project match: '+esc(project)+'</b><small class="matcher-summary">'+filledCount+' of '+matches.length+' requested categories have supply · ranked by locality preference, verification, quality, listed distance and price</small></div><span>'+Math.round(matches.reduce((s,x)=>s+x.coverage,0)/matches.length)+'% avg. coverage</span></div>'+budgetHtml+categoryHtml+'<div class="matcher-disclaimer">Recommendations use currently available listing data. Distances are listing estimates, and all materials should be inspected for suitability before purchase.</div>';
 el.querySelectorAll("[data-match-id]").forEach(btn=>btn.addEventListener("click",()=>showMaterialById(btn.dataset.matchId)));
 updateImpact(matchedRows);
}
function updateImpact(list){ /* Main impact meter follows the cart; matching does not accumulate savings. */ }
function showMaterialById(id){
 const i=materials.findIndex(m=>String(m.id)===String(id));
 if(i>=0){showDetail(i);return;}
 const m=matcherInventory.find(x=>String(x.id)===String(id));
 if(!m)return;
 const previous=materials;materials=[m];showDetail(0);materials=previous;
}
let materialMap=null;
function initMaterialMap(){
 if(!window.L||!$("#materialMap"))return;
 if(materialMap){materialMap.remove();materialMap=null}
 const map=L.map("materialMap").setView([12.9716,77.5946],11);
 materialMap=map;
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(map);
 const markerStyles={Bricks:{icon:"🧱",className:"marker-bricks"},Blocks:{icon:"▦",className:"marker-blocks"},Doors:{icon:"🚪",className:"marker-doors"},Windows:{icon:"🪟",className:"marker-windows"},Steel:{icon:"🔩",className:"marker-steel"},Tiles:{icon:"◇",className:"marker-tiles"}};
 materials.forEach(m=>{const c=categoryCoords[m.location];if(!c)return;const s=markerStyles[m.category]||{icon:"◈",className:"marker-default"};const icon=L.divIcon({className:"umb-map-marker-wrap",html:'<div class="umb-map-marker '+s.className+'"><span>'+s.icon+"</span></div>",iconSize:[38,46],iconAnchor:[19,43],popupAnchor:[0,-38]});L.marker(c,{icon}).addTo(map).bindPopup('<b>'+esc(s.icon)+" "+esc(m.title)+'</b><br>'+esc(m.location)+' · ₹'+Number(m.price).toLocaleString("en-IN")+' '+esc(m.unit));});
}
function estimateRecovery(){
 const rows=[["Bricks",Number($("#demoBricks").value)||0,0.65],["Doors",Number($("#demoDoors").value)||0,4000],["Steel",Number($("#demoSteel").value)||0,54],["Windows",Number($("#demoWindows").value)||0,1500]];
 const total=rows.reduce((s,r)=>s+r[1]*r[2],0);
 $("#recoveryResult").innerHTML='<span>₹'+Math.round(total).toLocaleString("en-IN")+'</span><b>Potential material value recovered</b><small>Prototype estimate based on assumed resale values. Actual value depends on condition, dimensions, demand and inspection.</small>';
}
async function updateListingStatus(id,action){
 if(!currentUser){alert("Please sign in to manage your listing.");return false}
 try{
  const r=await fetch("/api/materials?id="+encodeURIComponent(id),{method:"PUT",headers:{"Content-Type":"application/json","X-UMB-Client":"web-v1"},credentials:"include",body:JSON.stringify({action})});
  const out=await r.json().catch(()=>({})); if(!r.ok)throw new Error(out.error||"Could not update listing.");
  return true;
 }catch(e){alert(e.message||"Could not update listing.");return false}
}
async function markSold(id){
 if(!confirm("Mark this material as sold? It will disappear from the public marketplace but remain in My Listings."))return;
 if(await updateListingStatus(id,"sold")){await loadMaterials();

/* UrbanMate chatbot initialization is registered at the end of this file. */await openMyListings();}
}
async function reactivateListing(id){
 if(await updateListingStatus(id,"active")){await loadMaterials();await openMyListings();}
}
async function discardListing(id){
 if(!currentUser){alert("Please sign in to manage your listing.");return}
 if(!confirm("Discard this listing? It will be removed from the marketplace and cannot be recovered."))return;
 try{
  const r=await fetch("/api/materials?id="+encodeURIComponent(id),{method:"DELETE",headers:{"X-UMB-Client":"web-v1"},credentials:"include"});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(out.error||"Could not discard listing");
  $("#modal").classList.add("hidden");
  await loadMaterials();
  alert("Listing discarded successfully.");
 }catch(e){alert(e.message||"Could not discard listing.")}
}
function showDetail(i){
 const m=materials[i]; if(!m)return;
 window.umbCurrentPassportId=String(m.id);
 const photo=photoFor(m);
 const passport='<div class="passport"><div class="passport-title"><span>📋 MATERIAL PASSPORT</span><b>'+(m.verified?'✓ VERIFIED SELLER':'ACCOUNT VERIFIED')+'</b></div><div class="passport-grid"><div><small>Quantity</small><b>'+Number(m.quantity).toLocaleString("en-IN")+' '+esc(m.unit).replace(/^\//,"")+'</b></div><div><small>Condition</small><b>'+esc(m.quality)+'</b></div><div><small>Age</small><b>'+(m.age_years!=null?esc(m.age_years)+' years':'Not provided')+'</b></div><div><small>Previous use</small><b>'+esc(m.previous_use||"Not provided")+'</b></div><div><small>Dimensions</small><b>'+esc(m.dimensions||"Not provided")+'</b></div><div><small>Inspection</small><b>'+esc(m.inspection_status||"Not inspected")+'</b></div></div><!-- CO2 estimate is available in the cart impact section. --></div>';
 $("#modalContent").innerHTML=(photo?'<img class="detail-photo" src="'+esc(photo)+'" alt="'+esc(m.title)+'">':'')+'<div class="eyebrow">'+esc(m.category).toUpperCase()+' · '+esc(m.quality).toUpperCase()+'</div>'+(m.image_url?'':'<div class="photo-disclaimer">Reference material photo · Actual stock condition must be confirmed during inspection.</div>')+'<h2>'+esc(m.title)+'</h2><p>'+esc(m.condition_note)+'</p><div class="detail-price">₹'+Number(m.price).toLocaleString("en-IN")+' <small style="font:400 12px DM Sans;color:#758079">'+esc(m.unit)+'</small></div><div class="detail-row"><span>Available quantity</span><b>'+Number(m.quantity).toLocaleString("en-IN")+' units</b></div><div class="detail-row"><span>Pickup location</span><b>'+esc(m.location)+' · '+listingDistance(m)+'</b></div>'+(m.google_maps_url?'<div class="detail-row"><span>Google Maps</span><b><a href="'+esc(m.google_maps_url)+'" target="_blank" rel="noopener noreferrer">Open pickup location ↗</a></b></div>':'')+'<div class="detail-row"><span>Seller</span><b>'+esc(m.seller_name)+'</b></div>'+passport+'<div class="inspection-note"><b>🔎 Live inspection available</b><small>Buyers can request a live/on-site inspection with the seller before purchase to check quality, quantity and visible condition.</small></div><div class="contact"><b>Interested in this material?</b><small>Connect with the seller to inspect stock, negotiate quantity and arrange pickup.</small>'+(currentUser&&m.owner_user_id&&m.owner_user_id===currentUser.id?'<div class="owner-actions"><button class="secondary full" onclick="openEditListing(\''+esc(m.id)+'\')">✎ Edit listing</button>'+(m.listing_status==="sold"?'<button class="secondary full" onclick="reactivateListing(\''+esc(m.id)+'\')">↻ Mark as active</button>':'<button class="secondary full" onclick="markSold(\''+esc(m.id)+'\')">✓ Mark as sold</button>')+'<button class="discard-btn" onclick="discardListing(\''+esc(m.id)+'\')">🗑 Discard listing</button></div>':'')+'<div class="buyer-contact" id="buyerContactForm"><label>Your email<input value="'+(currentUser?esc(currentUser.email):"")+'" readonly></label><label>Your mobile number<input id="buyerMobile" type="tel" inputmode="tel" maxlength="20" placeholder="+91 98765 43210" required></label><label>Message to seller (optional)<textarea id="buyerMessage" maxlength="500" rows="2" placeholder="Tell the seller what quantity you need or ask about inspection…"></textarea></label><small>Your buyer profile and contact details are shared with this listing seller only after you send this request.</small><button id="contactBtn" class="primary full">Send buyer request →</button></div></div>';
 $("#modal").classList.remove("hidden");
 const contactBtn=$("#contactBtn");
 contactBtn.onclick=async()=>{
  if(!currentUser){
   $("#modalContent").innerHTML='<div class="eyebrow">BUYER VERIFICATION</div><h2>Sign in to contact a seller</h2><p>Buyers must sign in before requesting seller contact. This keeps inquiries accountable and gives sellers a verified email behind every request.</p><div class="inspection-note"><b>🔐 Email + mobile required</b><small>After signing in, we will ask for your mobile number before recording the request.</small></div><button class="primary full" onclick="window.location.href=\'/login\'">Sign in / verify account →</button><button class="textbtn full" onclick="closeModal()">Not now</button>';
   return;
  }
  const mobile=String($("#buyerMobile")?.value||"").trim();
  if(!/^[+0-9 ()-]{8,20}$/.test(mobile)){alert("Please enter a valid mobile number.");return}
  contactBtn.disabled=true;contactBtn.textContent="Checking profile…";
  try{
   const pr=await fetch("/api/account/profile",{credentials:"include"});const po=await pr.json();
   if(!pr.ok)throw new Error(po.error||"Could not check your profile.");
   if(!po.profile){contactBtn.disabled=false;contactBtn.textContent="Send buyer request →";alert("Complete your buyer profile first. The seller only sees it after you send an inquiry.");await openMyProfile();return}
   const rr=await fetch("/api/inquiries",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","X-UMB-Client":"web-v1"},body:JSON.stringify({material_id:m.id,buyer_mobile:mobile,message:String($("#buyerMessage")?.value||"").trim()})});
   const result=await rr.json();if(!rr.ok)throw new Error(result.error||"Could not send request.");
   contactBtn.textContent="Request sent ✓";alert("Buyer request sent. The seller can now view your shared profile and contact details.");
  }catch(err){alert(err.message||"Could not send request.");contactBtn.disabled=false;contactBtn.textContent="Send buyer request →"}
 };
}

async function openMyListings(){
 if(!currentUser){window.location.href="/login";return}
 try{
  const r=await fetch("/api/materials?mine=1",{headers:{"X-UMB-Client":"web-v1"},credentials:"include"});const mine=await r.json();if(!r.ok)throw new Error(mine.error||"Could not load your listings.");
  const active=mine.filter(m=>m.listing_status==="active"),sold=mine.filter(m=>m.listing_status==="sold"),discarded=mine.filter(m=>m.listing_status==="discarded");
  $("#modalContent").innerHTML='<div class="eyebrow">SELLER DASHBOARD</div><h2>My Listings</h2><p>Manage the materials published from your verified Urban Material Bank account.</p><div class="listing-stats"><div><b>'+active.length+'</b><small>Active</small></div><div><b>'+sold.length+'</b><small>Sold</small></div><div><b>'+discarded.length+'</b><small>Discarded</small></div></div><div class="my-listings">'+(mine.length?mine.map(m=>'<div class="my-listing '+esc(m.listing_status)+'"><div class="my-listing-main"><div class="my-thumb" style="background-image:url(\''+esc(photoFor(m))+'\')"></div><div><b>'+esc(m.title)+'</b><small>'+esc(m.category)+' · '+esc(m.location)+' · ₹'+Number(m.price).toLocaleString("en-IN")+' '+esc(m.unit)+'</small><span class="status-pill '+esc(m.listing_status)+'">'+esc(m.listing_status).toUpperCase()+'</span></div></div><div class="my-listing-actions">'+(m.listing_status==="active"?'<button class="secondary" onclick="markSold(\''+esc(m.id)+'\')">✓ Sold</button>':'')+(m.listing_status==="sold"?'<button class="secondary" onclick="reactivateListing(\''+esc(m.id)+'\')">↻ Reactivate</button>':'')+'<button class="secondary" onclick="openEditListing(\''+esc(m.id)+'\')">✎ Edit</button>'+(m.listing_status!=="discarded"?'<button class="discard-btn compact" onclick="discardListing(\''+esc(m.id)+'\')">Discard</button>':'')+'</div></div>').join(""):'<div class="empty">You have not published any materials yet.<br><button class="primary" onclick="closeModal();openSell()" style="margin-top:14px">List your first material →</button></div>')+'</div>';
  $("#modal").classList.remove("hidden");
 }catch(e){alert(e.message||"Could not load your listings.")}
}
function openEditListing(id){
 const m=materials.find(x=>String(x.id)===String(id));
 if(!m){fetch("/api/materials?mine=1",{headers:{"X-UMB-Client":"web-v1"},credentials:"include"}).then(r=>r.json()).then(rows=>{materials=rows;openEditListing(id)});return}
 $("#modalContent").innerHTML='<div class="eyebrow">MANAGE INVENTORY</div><h2>Edit listing</h2><p>Update your listing details. Your Urban Material Bank account remains the owner.</p><form id="editForm"><div class="form-grid"><label>Material name<input name="title" maxlength="120" required value="'+esc(m.title)+'"></label><label>Category<select name="category">'+["Bricks","Blocks","Doors","Windows","Steel","Tiles"].map(x=>'<option '+(x===m.category?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label>Location / area<input name="location" maxlength="80" required value="'+esc(m.location)+'"></label><label class="wide">Google Maps location link<input name="google_maps_url" type="url" maxlength="500" required value="'+esc(m.google_maps_url||"")+'" placeholder="https://maps.app.goo.gl/..."><small>Open Google Maps, select the material pickup point, tap Share, then copy the link.</small></label><label>Price<input name="price" type="number" min=".01" max="10000000" step=".01" required value="'+Number(m.price)+'"></label><label>Unit<input name="unit" maxlength="30" required value="'+esc(m.unit)+'"></label><label>Quantity<input name="quantity" type="number" min="1" max="100000000" required value="'+Number(m.quantity)+'"></label><label>Quality<select name="quality">'+["Excellent","Good","Fair"].map(x=>'<option '+(x===m.quality?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label>Age (years)<input name="age_years" type="number" min="0" max="200" value="'+(m.age_years??"")+'"></label><label>Previous use<input name="previous_use" maxlength="120" value="'+esc(m.previous_use||"")+'"></label><label>Dimensions<input name="dimensions" maxlength="120" value="'+esc(m.dimensions||"")+'"></label><label>Seller name<input name="seller_name" maxlength="100" required value="'+esc(m.seller_name)+'"></label><label>Mobile number<input name="seller_mobile" type="tel" inputmode="tel" maxlength="20" required value="'+esc(m.seller_mobile||"")+'"></label><label class="wide">Condition / notes<textarea name="condition_note" maxlength="800" rows="3" required>'+esc(m.condition_note)+'</textarea></label></div><button class="primary full">Save changes →</button></form>';
 $("#modal").classList.remove("hidden");$("#editForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const r=await fetch("/api/materials?id="+encodeURIComponent(id),{method:"PUT",headers:{"Content-Type":"application/json","X-UMB-Client":"web-v1"},credentials:"include",body:JSON.stringify(data)});const out=await r.json().catch(()=>({}));if(!r.ok){alert(out.error||"Could not save changes.");return}await loadMaterials();openMyListings()};
}
function closeModal(){$("#modal").classList.add("hidden")}
function scrollToMarket(){$("#marketplace").scrollIntoView({behavior:"smooth"})}
function toggleFilters(){$("#filters").classList.toggle("open")}
function clearFilters(){["q","category","location","quality"].forEach(k=>$("#"+k).value="");$("#maxPrice").value=10000;$("#priceOut").textContent="Any";loadMaterials()}
$("#maxPrice").addEventListener("input",e=>$("#priceOut").textContent=e.target.value>=10000?"Any":"₹"+Number(e.target.value).toLocaleString("en-IN"));
["q","category","location","quality"].forEach(k=>$("#"+k).addEventListener(k==="q"?"input":"change",()=>{if(k!=="q"||$("#q").value.length>1)loadMaterials()}));

let currentUser=null;
async function getAccount(){
 try{
  const r=await fetch("/api/materials?checkAuth=1",{headers:{"X-UMB-Client":"web-v1"}});
  if(!r.ok)return null;
  const out=await r.json();
  return out.authenticated?{id:out.id,email:out.email}:null;
 }catch(e){return null}
}
async function refreshAccountUI(){
 const area=$("#accountArea"),btn=$("#accountBtn"),status=$("#accountStatus");
 if(!area||!btn||!status)return;
 currentUser=await getAccount();
 if(currentUser){
  btn.innerHTML='<span class="account-dot">✓</span> '+esc(currentUser.email);
  btn.classList.add("signed-in");
  status.innerHTML='<span class="verified-account">✓ ACCOUNT VERIFIED</span><b>'+esc(currentUser.email)+'</b><small>Your Urban Material Bank account is verified. You can publish listings.</small>';
  $("#myListingsBtn")?.classList.remove("hidden");
  $("#myProfileBtn")?.classList.remove("hidden");
  $("#buyerRequestsBtn")?.classList.remove("hidden");
 }else{
  $("#myListingsBtn")?.classList.add("hidden");
  $("#myProfileBtn")?.classList.add("hidden");
  $("#buyerRequestsBtn")?.classList.add("hidden");
  btn.textContent="Sign in";
  btn.classList.remove("signed-in");
  status.innerHTML='<b>Not signed in</b><small>Verify your account to list materials.</small>';
 }
}
async function checkAccount(){return Boolean(await getAccount())}

async function openMyProfile(){
 if(!currentUser){window.location.href="/login";return}
 try{
  const r=await fetch("/api/account/profile",{credentials:"include",headers:{"X-UMB-Client":"web-v1"}});
  const out=await r.json();if(!r.ok)throw new Error(out.error||"Could not load profile.");
  const p=out.profile||{};
  $( "#modalContent" ).innerHTML='<div class="eyebrow">YOUR URBAN MATERIAL BANK ID</div><h2>Buyer & seller profile</h2><p>This profile builds trust when you buy or sell recovered materials. Your exact home address is not collected.</p><div class="profile-photo-row"><div class="profile-avatar-preview">'+(p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="Profile photo">':'<span>'+(esc((p.full_name||currentUser.email||"U").slice(0,1).toUpperCase()))+'</span>')+'</div><label class="profile-photo-label">Profile photo<input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WEBP. Visible to a seller after you send an inquiry.</small></label></div><form id="profileForm"><div class="form-grid"><label>Full name<input name="full_name" maxlength="100" required value="'+esc(p.full_name||"")+'" placeholder="Your name"></label><label>Unique username / ID<input name="username" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required value="'+esc(p.username||"")+'" placeholder="e.g. aayush_24"><small>3–24 letters, numbers or underscores.</small></label><label>Age<input name="age" type="number" min="1" max="120" required value="'+esc(p.age??"")+'" placeholder="Age in years"></label><label>Work / occupation<input name="occupation" maxlength="100" required value="'+esc(p.occupation||"")+'" placeholder="Student, contractor, architect…"></label><label>City<input name="city" maxlength="80" required value="'+esc(p.city||"")+'" placeholder="e.g. Bengaluru"></label><label>Area / locality<input name="locality" maxlength="100" required value="'+esc(p.locality||"")+'" placeholder="e.g. Indiranagar"></label><label>Contact mobile<input name="phone" type="tel" inputmode="tel" maxlength="20" required value="'+esc(p.phone||"")+'" placeholder="+91 98765 43210"></label><label>Email address<input value="'+esc(currentUser.email||out.email||"")+'" readonly></label><label class="wide">About you (optional)<textarea name="bio" maxlength="280" rows="2" placeholder="What do you build, buy or supply?">'+esc(p.bio||"")+'</textarea></label></div><div class="inspection-note"><b>Privacy by design</b><small>Your name, username, age, work, city/locality, profile photo and contact details are shared with a seller only after you send an inquiry about their listing. Your exact home address is never requested.</small></div><button class="primary full" id="saveProfileBtn">Save profile securely →</button><div id="profileFeedback" class="profile-feedback" aria-live="polite"></div></form>';
  $("#modal").classList.remove("hidden");
  // Email OTP profile gate removed; restored to v20 behavior.
  // Email OTP profile verification removed; restored to v20 behavior.
  $("#profilePhoto").onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){alert("Choose a photo under 8 MB.");e.target.value="";return}const data=await compressProfilePhoto(file);$("#profilePhoto").dataset.data=data;const box=document.querySelector(".profile-avatar-preview");box.innerHTML='<img src="'+data+'" alt="Profile photo preview">';};
  $("#profileForm").onsubmit=async e=>{
   e.preventDefault();const btn=$("#saveProfileBtn"),feedback=$("#profileFeedback");btn.disabled=true;btn.textContent="Saving profile…";
   try{const data=Object.fromEntries(new FormData(e.target));const avatar=$("#profilePhoto").dataset.data;if(avatar)data.avatar_data=avatar;
    const save=await fetch("/api/account/profile",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json","X-UMB-Client":"web-v1"},body:JSON.stringify(data)});
    const result=await save.json();if(!save.ok)throw new Error(result.error||"Could not save profile.");
    feedback.textContent="Profile saved. Your unique ID is @"+result.profile.username;feedback.classList.add("success");await refreshAccountUI();
   }catch(err){feedback.textContent=err.message;feedback.classList.remove("success")}finally{btn.disabled=false;btn.textContent="Save profile securely →"}
  };
 }catch(e){alert(e.message||"Could not load your profile.")}
}
function compressProfilePhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=700,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}

async function openBuyerRequests(){
 if(!currentUser){window.location.href="/login";return}
 try{
  const r=await fetch("/api/inquiries",{credentials:"include",headers:{"X-UMB-Client":"web-v1"}});const out=await r.json();if(!r.ok)throw new Error(out.error||"Could not load buyer requests.");
  const rows=out.requests||[];
  $("#modalContent").innerHTML='<div class="eyebrow">SELLER INBOX</div><h2>Buyer requests</h2><p>When a buyer requests one of your materials, their shared profile and contact details appear here.</p><div class="buyer-request-list">'+(rows.length?rows.map(x=>'<article class="buyer-request-card"><div class="buyer-profile-head">'+(x.avatar_url?'<img src="'+esc(x.avatar_url)+'" alt="Buyer photo">':'<div class="buyer-avatar-fallback">'+esc((x.full_name||"B").slice(0,1).toUpperCase())+'</div>')+'<div><b>'+esc(x.full_name)+'</b><span>@'+esc(x.username)+' · '+esc(x.occupation)+'</span><small>'+esc(x.age)+' years · '+esc(x.locality)+', '+esc(x.city)+'</small></div></div><div class="detail-row"><span>Interested in</span><b>'+esc(x.material_title)+'</b></div><div class="detail-row"><span>Contact email</span><b>'+esc(x.buyer_email)+'</b></div><div class="detail-row"><span>Contact mobile</span><b>'+esc(x.buyer_mobile||x.profile_phone)+'</b></div>'+(x.bio?'<p class="buyer-bio">'+esc(x.bio)+'</p>':'')+(x.message?'<p class="buyer-bio"><b>Message:</b> '+esc(x.message)+'</p>':'')+'<small class="request-time">Request received '+new Date(x.created_at).toLocaleString()+'</small></article>').join(""):'<div class="empty">No buyer requests yet. Requests will appear here when buyers contact you about your own listings.</div>')+'</div>';
  $("#modal").classList.remove("hidden");
 }catch(e){alert(e.message||"Could not load buyer requests.")}
}
async function signOut(){
 try{
  const r=await fetch("/api/auth/sign-out",{method:"POST",credentials:"include"});
  if(!r.ok)throw new Error("Sign out failed");
  currentUser=null;
  $("#accountMenu")?.classList.add("hidden");
  await refreshAccountUI();
 }catch(e){alert("Could not sign out. Please try again.")}
}

async function openSell(){
 try{
  const authenticated=await checkAccount();
  if(!authenticated){
   $("#modalContent").innerHTML='<div class="eyebrow">SELLER VERIFICATION</div><h2>Verify your account first</h2><p>To keep Urban Material Bank trustworthy, sellers must verify their email account before publishing a listing. This helps us reduce fake listings and gives buyers a real person behind every seller.</p><div class="inspection-note"><b>🔐 Account verification</b><small>We use Hatchable’s passwordless email-code sign-in. No password is required.</small></div><button class="primary full" id="verifyAccountBtn">Verify account →</button><button class="textbtn full" id="cancelVerifyBtn">Not now</button>';
   $("#modal").classList.remove("hidden");
   $("#verifyAccountBtn").onclick=()=>{window.location.href="/login";};
   $("#cancelVerifyBtn").onclick=closeModal;
   return;
  }
  renderSellForm();
 }catch(e){alert("Could not verify your account. Please try again.")}
}

function renderSellForm(){
 $("#modalContent").innerHTML='<div class="eyebrow">GIVE MATERIAL A SECOND LIFE</div><h2>List surplus material</h2><p>Add enough detail for a buyer to compare your material with nearby inventory. Your account is verified. New listings remain unverified until reviewed.</p><div class="inspection-note"><b>🔎 Live inspection can be arranged</b><small>Tell buyers they can request a live/on-site inspection to check quality, quantity and visible condition before purchase.</small></div><form id="sellForm"><div class="form-grid"><label>Material name<input name="title" maxlength="120" required placeholder="e.g. Red clay bricks"></label><label>Category<select name="category"><option>Bricks</option><option>Blocks</option><option>Doors</option><option>Windows</option><option>Steel</option><option>Tiles</option></select></label><label>Location / area<input name="location" maxlength="80" required placeholder="e.g. Whitefield"></label><label class="wide">Google Maps location link<input name="google_maps_url" type="url" maxlength="500" required placeholder="https://maps.app.goo.gl/..."><small>Open Google Maps, select the material pickup point, tap Share, then copy the link.</small></label><label>Price per piece (₹)<input name="price" type="number" min="0.01" max="10000000" step="0.01" required placeholder="Enter price for one piece"><input name="unit" type="hidden" value="/piece"></label><label>Quantity (pieces)<input name="quantity" type="number" min="1" max="100000000" required placeholder="1000"></label><label>Quality<select name="quality"><option>Excellent</option><option>Good</option><option>Fair</option></select></label><label>Age (years)<input name="age_years" type="number" min="0" max="200" placeholder="e.g. 8"></label><label>Previous use<input name="previous_use" maxlength="120" placeholder="e.g. Residential building"></label><label>Dimensions<input name="dimensions" maxlength="120" placeholder="e.g. 230 × 110 × 75 mm"></label><label>Seller name<input name="seller_name" maxlength="100" required placeholder="Company / owner"></label><label>Mobile number<input name="seller_mobile" type="tel" inputmode="tel" maxlength="20" required placeholder="+91 98765 43210"></label><label class="wide material-photo-field">Material photo<div class="photo-upload"><input id="materialPhoto" type="file" accept="image/jpeg,image/png,image/webp" required><span>📷 Add a clear photo of the actual material</span><img id="photoPreview" class="upload-preview hidden" alt="Photo preview"></div></label><label class="wide">Condition / notes<textarea name="condition_note" maxlength="800" rows="3" required placeholder="Tell buyers where it came from and any visible wear. Mention if live inspection is available..."></textarea></label><label class="trap">Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="primary full" id="publishBtn">Publish listing securely →</button></form>';
 $("#modal").classList.remove("hidden");$("#sellForm").onsubmit=submitListing;$("#materialPhoto").onchange=previewPhoto;
}

function previewPhoto(e){const file=e.target.files[0];if(!file)return;const img=$("#photoPreview");img.src=URL.createObjectURL(file);img.classList.remove("hidden")}

async function submitListing(e){
 e.preventDefault();const btn=$("#publishBtn");btn.disabled=true;btn.textContent="Validating listing…";
 try{
  const data=Object.fromEntries(new FormData(e.target)),file=$("#materialPhoto").files[0];
  if(!/^[+0-9 ()-]{8,20}$/.test(String(data.seller_mobile||"").trim()))throw new Error("Please enter a valid mobile number.");
  if(file){if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024)throw new Error("Use a JPG, PNG or WEBP photo under 8 MB.");data.image_data=await compressImage(file)}
  const r=await fetch("/api/materials",{method:"POST",headers:{"Content-Type":"application/json","X-UMB-Client":"web-v1"},body:JSON.stringify(data)});
  const out=await r.json().catch(()=>({}));
  if(r.status===401){closeModal();await openSell();return;}
  if(!r.ok)throw new Error(out.error||"Could not publish listing.");
  closeModal();await loadMaterials();
 }catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent="Publish listing securely →"}
}

function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.82))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}

$("#sellTop").onclick=openSell;$("#sellHero").onclick=openSell;$("#myProfileBtn").onclick=async e=>{e.stopPropagation();$("#accountMenu").classList.add("hidden");await openMyProfile()};$("#myListingsBtn").onclick=async e=>{e.stopPropagation();$("#accountMenu").classList.add("hidden");await openMyListings()};$("#buyerRequestsBtn").onclick=async e=>{e.stopPropagation();$("#accountMenu").classList.add("hidden");await openBuyerRequests()};
$("#accountBtn").onclick=async e=>{e.stopPropagation();currentUser=await getAccount();if(!currentUser){window.location.href="/login";return}$("#accountMenu").classList.toggle("hidden");await refreshAccountUI()};
$("#logoutBtn").onclick=signOut;
document.addEventListener("click",e=>{if(!e.target.closest("#accountArea"))$("#accountMenu")?.classList.add("hidden")});
refreshAccountUI();
$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
loadMaterials();
/* UrbanMate AI — staging chatbot */
const urbanMateHistory = [];
let urbanMateBusy = false;
function urbanMateAddMessage(role, text) {
  const wrap = $("#urbanmateMessages");
  if (!wrap) return;
  const node = document.createElement("div");
  node.className = "um-message " + (role === "user" ? "um-user" : "um-bot");
  const label = document.createElement("span");
  label.className = "um-message-label";
  label.textContent = role === "user" ? "YOU" : "URBANMATE";
  const p = document.createElement("p");
  p.textContent = text;
  node.append(label, p);
  wrap.appendChild(node);
  wrap.scrollTop = wrap.scrollHeight;
  return node;
}
function urbanMateToggle(open) {
  const panel = $("#urbanmatePanel"), launcher = $("#urbanmateLauncher");
  if (!panel || !launcher) return;
  const shouldOpen = typeof open === "boolean" ? open : panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !shouldOpen);
  launcher.classList.toggle("um-launcher-open", shouldOpen);
  launcher.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) setTimeout(() => $("#urbanmateInput")?.focus(), 80);
}
async function urbanMateSend(text) {
  const input = $("#urbanmateInput"), send = $("#urbanmateSend");
  const message = String(text || input?.value || "").trim();
  if (!message || urbanMateBusy) return;
  if (input) input.value = "";
  document.querySelectorAll(".um-suggestions").forEach(el => el.remove());
  urbanMateHistory.push({role:"user",content:message});
  urbanMateAddMessage("user", message);
  const pending = urbanMateAddMessage("assistant", "Checking current marketplace inventory…");
  pending?.classList.add("um-pending");
  urbanMateBusy = true;
  if (send) send.disabled = true;
  try {
    const response = await fetch("/api/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:urbanMateHistory.slice(-8)})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Couldn't reach UrbanMate.");
    pending?.remove();
    urbanMateHistory.push({role:"assistant",content:result.reply});
    urbanMateAddMessage("assistant", result.reply);
    while (urbanMateHistory.length > 8) urbanMateHistory.shift();
  } catch (error) {
    pending?.remove();
    urbanMateAddMessage("assistant", error.message || "UrbanMate is temporarily unavailable.");
  } finally {
    urbanMateBusy = false;
    if (send) send.disabled = false;
    input?.focus();
  }
}
document.addEventListener("DOMContentLoaded", () => {
  $("#urbanmateLauncher")?.addEventListener("click", () => urbanMateToggle());
  $("#urbanmateClose")?.addEventListener("click", () => urbanMateToggle(false));
  $("#urbanmateForm")?.addEventListener("submit", e => { e.preventDefault(); urbanMateSend(); });
  document.querySelectorAll("[data-um-prompt]").forEach(btn => btn.addEventListener("click", () => urbanMateSend(btn.dataset.umPrompt)));
});