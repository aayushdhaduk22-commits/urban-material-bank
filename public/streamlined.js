(()=>{"use strict";
const $=id=>document.getElementById(id);
function sectionDetails(section,label,parent){if(!section||!parent)return;const details=document.createElement("details");details.className="umb-optional";const summary=document.createElement("summary");summary.textContent=label;details.append(summary);section.parentNode.insertBefore(details,section);details.append(section);parent.append(details)}
document.addEventListener("DOMContentLoaded",()=>{
 const studio=$("procurementStudio"),market=$("marketplace"),trade=$("tradeDesk");if(!studio||!market)return;
 const grid=studio.querySelector(".studio-grid");const matcher=$("matcher");
 if(matcher&&grid){const details=document.createElement("details");details.className="umb-optional";details.id="requirementsManual";details.open=true;const title=document.createElement("summary");title.textContent="Manual project requirements & matching";details.append(title);grid.parentNode.insertBefore(details,grid);details.append(matcher)}
 const impact=document.querySelector(".impact-section"),recovery=document.querySelector(".recovery-section"),tetris=$("materialTetris");
 const lab=document.createElement("section");lab.id="optimizationLab";lab.className="umb-lab";lab.innerHTML='<div class="section-head"><div><div class="eyebrow">OPTIONAL TOOLS</div><h2>Optimization Lab</h2><p>Advanced material reuse experiments and planning utilities.</p></div></div>';const how=$("how");if(how)how.parentNode.insertBefore(lab,how);
 sectionDetails(tetris,"Material Tetris · Cutting-stock optimization",lab);
 sectionDetails(impact,"Estimated carbon impact",lab);
 sectionDetails(recovery,"Pre-demolition recovery estimate",lab);
 const delivery=$("deliverySupport"),optimizer=$("stCosts");
 if(delivery&&optimizer){const detail=document.createElement("details");detail.className="umb-optional umb-delivery-expand";const summary=document.createElement("summary");summary.textContent="Single-seller delivery cost breakdown (optional)";detail.append(summary);studio.append(detail);detail.append(delivery)}
 if($("stSearch")){$("stSearch").closest("label").style.display="none";const catalog=$("stCatalog");if(catalog)catalog.style.display="none";const intro=document.createElement("p");intro.className="studio-muted";intro.textContent="Browse the Marketplace and use Add to Cart on any material card. Your selected products appear below.";studio.querySelector(".studio-scroll")?.before(intro);}
 if(trade){const note=document.createElement("p");note.className="trade-note";note.textContent="Trade Desk and buyer inquiries are complementary: send an inquiry for inspection or contact details, or negotiate unit prices here.";trade.querySelector(".trade-card")?.prepend(note)}
 const cards=$("cards");if(cards){const decorate=()=>{cards.querySelectorAll("article.material[data-i]").forEach(card=>{if(card.querySelector(".umb-cart-quick"))return;const action=document.createElement("button");action.type="button";action.className="umb-cart-quick";action.textContent="＋ Add to Cart";action.setAttribute("aria-label","Add this marketplace material to cart");action.addEventListener("click",async event=>{event.stopPropagation();const id=card.dataset.materialId;if(id&&window.umbAddToCart?.(id,1)){action.textContent="✓ Added";setTimeout(()=>action.textContent="＋ Add to Cart",1500)}else action.textContent="Open listing to select";});card.querySelector(".mat-body")?.append(action)})};new MutationObserver(decorate).observe(cards,{childList:true});decorate()}
});
})();