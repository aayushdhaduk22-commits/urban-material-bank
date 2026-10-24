(()=>{"use strict";
const byId=id=>document.getElementById(id);
let role="buyer",generation=0;
const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const guides={buyer:[["Find your materials","Browse the marketplace, filter by category and open a listing to check its Material Passport."],["Plan the real cost","Add materials to your cart. Compare material prices, delivery estimates and the cost of buying new."],["Contact, inspect and agree","Send an inquiry or a price offer. Arrange inspection and delivery with the seller before paying."]],seller:[["Prepare your listing","Sign in, complete your existing profile, then add real photos, quantities, dimensions, price and pickup details."],["Respond to buyers","Open Buyer inquiries for shared contact details. Use Seller offers to accept, decline or counter a price."],["Keep stock up to date","Edit your listings as availability changes. Mark a listing sold once the material has been sold."]]};
const action=(label,code)=>'<button type="button" data-work-action="'+code+'">'+label+'</button>';
function go(id){const el=byId(id);if(!el)return;el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});el.setAttribute("tabindex","-1");el.focus({preventScroll:true})}
async function json(url){const r=await fetch(url,{credentials:"include",headers:{"X-UMB-Client":"web-v1"}});const j=await r.json();if(!r.ok)throw Error(j.error||"Could not load your activity.");return j}
async function activity(){
 const version=++generation,el=byId("workActivity");el.innerHTML='<p role="status">Loading your '+role+' activity…</p>';
 const user=await getAccount();if(version!==generation)return;
 if(!user){el.innerHTML='<h3>Your activity starts here</h3><p>Browse without an account. Sign in to save your profile, send inquiries and offers, or publish materials.</p><a class="work-signin" href="/login">Sign in / create account →</a>';return}
 currentUser=user;
 try{if(role==="seller"){const [mine,inbox,offers]=await Promise.all([json("/api/materials?mine=1"),json("/api/inquiries"),json("/api/offers")]);if(version!==generation)return;const counts=[["Active listings",mine.filter(m=>m.listing_status==="active").length],["Sold listings",mine.filter(m=>m.listing_status==="sold").length],["Buyer inquiries",(inbox.requests||[]).length],["Open offers",(offers.offers||[]).filter(o=>o.role==="seller"&&["pending","countered"].includes(o.status)).length]];el.innerHTML=metrics(counts)+'<p>'+ (mine.length?"Keep your quantities current and respond to interested buyers.":"No listings yet. Publish your first material to start receiving buyer inquiries.")+'</p>'+action("Manage my listings","listings")+action("Open buyer inquiries","inquiries");
 }else{const offers=await json("/api/offers");if(version!==generation)return;const mine=(offers.offers||[]).filter(o=>o.role==="buyer");el.innerHTML=metrics([["My price offers",mine.length],["Awaiting agreement",mine.filter(o=>["pending","countered"].includes(o.status)).length],["Agreed offers",mine.filter(o=>o.status==="accepted").length]])+'<p>'+(mine.length?"Review your price discussions in Buyer offers. An accepted offer does not reserve stock or complete payment.":"No price offers yet. Open a listing to inspect its passport, then contact the seller or make an offer.")+'</p>'+action("Browse materials","browse")+action("View buyer offers","offers");}
 }catch(e){if(version!==generation)return;el.innerHTML='<p role="alert">'+escape(e.message)+'</p>'+action("Try again","refresh")}
}
function metrics(rows){return '<dl class="work-metrics">'+rows.map(([label,n])=>'<div><dt>'+label+'</dt><dd>'+n+'</dd></div>').join("")+'</dl>'}
function select(next,scroll=false){role=next;try{localStorage.setItem("umb-workspace",role)}catch{}
 document.querySelectorAll("[data-work-role]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.workRole===role)));
 byId("workspaceTitle").textContent=role==="buyer"?"Buyer dashboard":"Seller dashboard";
 byId("workspaceIntro").textContent=role==="buyer"?"Find reusable materials, plan your costs and speak with sellers.":"Publish reusable materials, manage your stock and respond to buyers.";
 byId("workspaceSteps").innerHTML=guides[role].map(([title,copy],i)=>'<li><span>0'+(i+1)+'</span><div><h3>'+title+'</h3><p>'+copy+'</p></div></li>').join("");
 byId("workspaceActions").innerHTML=role==="buyer"?action("Browse marketplace →","browse")+action("My cart & project planner","cart")+action("Buyer offers","offers")+action("My profile","profile"):action("List a material →","sell")+action("Manage my listings","listings")+action("Buyer inquiries","inquiries")+action("Seller offers","offers")+action("My profile","profile");
 window.umbTradeRole=role;window.dispatchEvent(new Event("umb-workspace-changed"));activity();if(scroll)go("workspace");
}
document.addEventListener("DOMContentLoaded",()=>{
 const section=document.createElement("section");section.id="workspace";section.className="work-shell";section.setAttribute("aria-labelledby","workspaceTitle");
 section.innerHTML='<div class="work-heading"><div><div class="eyebrow">START HERE · BUY OR SELL</div><h2 id="workspaceTitle">Buyer dashboard</h2><p id="workspaceIntro"></p></div><div class="work-switch" role="group" aria-label="Choose your workspace"><button type="button" data-work-role="buyer" aria-pressed="true">I want to buy</button><button type="button" data-work-role="seller" aria-pressed="false">I want to sell</button></div></div><p class="work-shared">One account, both roles. Switch anytime. Your profile and the marketplace stay the same.</p><div id="workspaceActions" class="work-actions"></div><div class="work-columns"><div><h3>Your first three steps</h3><ol id="workspaceSteps"></ol><details class="work-help"><summary>New here? What happens after I contact someone?</summary><p>Buyers and sellers agree on condition, quantity, final price, inspection and pickup directly. The cart estimates costs; it does not place an order. Trade Desk records price discussions; it does not process payments or book transport.</p></details></div><div class="work-activity"><div class="work-activity-head"><h3>Your activity</h3><button type="button" data-work-action="refresh" aria-label="Refresh dashboard activity">Refresh</button></div><div id="workActivity" aria-live="polite"></div></div></div>';
 document.querySelector(".hero").after(section);
 // Role switching is available within the dashboard.
 const top=byId("sellTop");if(top)top.textContent="List material";
 byId("buyerRequestsBtn").textContent="Seller · Buyer inquiries";byId("myListingsBtn").textContent="Seller · My listings";
 const heroSell=byId("sellHero");heroSell.onclick=()=>select("seller",true);
 const heroBuy=document.querySelector(".hero-actions .primary");if(heroBuy)heroBuy.onclick=()=>select("buyer",true);
 document.addEventListener("click",async e=>{const switcher=e.target.closest("[data-work-role]");if(switcher){select(switcher.dataset.workRole,true);return}
 const button=e.target.closest("[data-work-action]");if(!button)return;
 const a=button.dataset.workAction;
 if(a==="refresh"){activity();return}if(a==="browse"){go("marketplace");return}if(a==="cart"){go("procurementStudio");return}
 if(a==="offers"){go("tradeDesk");byId("tradeRefresh").click();return}if(a==="sell"){openSell();return}
 currentUser=await getAccount();if(!currentUser){location.href="/login";return}
 if(a==="profile")openMyProfile();if(a==="listings")openMyListings();if(a==="inquiries")openBuyerRequests();
 });
 let saved;try{saved=localStorage.getItem("umb-workspace")}catch{}select(saved==="seller"?"seller":"buyer");
 window.addEventListener("umb-offers-changed",activity);
});
})();