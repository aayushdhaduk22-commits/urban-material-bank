import {db,auth} from "hatchable";
export const access = "public";
export const methods = ["GET","POST"];
const goodId=x=>/^[a-f0-9-]{36}$/i.test(String(x||""));
export default async function(req,res){
 const user=await auth.getUser(req);if(!user)return res.status(401).json({error:"Please sign in to negotiate."});
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT o.id,o.material_id,o.quantity,o.offer_price,o.status,o.last_actor,o.updated_at,o.buyer_user_id,o.seller_user_id,m.title,m.price AS listing_price,m.unit,m.quantity AS available_quantity FROM material_offers o JOIN materials m ON m.id=o.material_id WHERE o.buyer_user_id=$1 OR o.seller_user_id=$1 ORDER BY o.updated_at DESC LIMIT 100",[user.id]);
  return res.json({offers:rows.map(x=>({...x,role:x.buyer_user_id===user.id?"buyer":"seller",buyer_user_id:undefined,seller_user_id:undefined}))});
 }
 const b=req.body||{},action=String(b.action||""),id=String(b.id||"");
 if(action==="create"){
  if(!goodId(b.material_id))return res.status(400).json({error:"Invalid material."});
  const quantity=Number(b.quantity),offer_price=Number(b.offer_price);
  const {rows:mat}=await db.query("SELECT id,owner_user_id,quantity,listing_status FROM materials WHERE id=$1",[b.material_id]);const m=mat[0];
  if(!m||m.listing_status!=="active"||!m.owner_user_id)return res.status(400).json({error:"Choose an active listing owned by a real seller."});
  if(m.owner_user_id===user.id)return res.status(400).json({error:"You cannot offer on your own listing."});
  if(!Number.isFinite(quantity)||quantity<=0||quantity>Number(m.quantity)||!Number.isFinite(offer_price)||offer_price<=0||offer_price>10000000)return res.status(400).json({error:"Enter a valid available quantity and unit price."});
  const {rows}=await db.query("INSERT INTO material_offers(material_id,buyer_user_id,seller_user_id,quantity,offer_price,last_actor) VALUES($1,$2,$3,$4,$5,'buyer') ON CONFLICT(material_id,buyer_user_id) DO UPDATE SET quantity=EXCLUDED.quantity,offer_price=EXCLUDED.offer_price,status='pending',last_actor='buyer',updated_at=now() RETURNING id,status",[m.id,user.id,m.owner_user_id,quantity,offer_price]);
  return res.json({offer:rows[0]});
 }
 if(!goodId(id))return res.status(400).json({error:"Offer ID required."});
 const {rows:r}=await db.query("SELECT o.*,m.quantity AS stock,m.listing_status FROM material_offers o JOIN materials m ON m.id=o.material_id WHERE o.id=$1 AND (o.buyer_user_id=$2 OR o.seller_user_id=$2)",[id,user.id]);const o=r[0];
 if(!o)return res.status(404).json({error:"Offer not found."});
 const seller=o.seller_user_id===user.id,buyer=o.buyer_user_id===user.id;
 if(o.status==="accepted"||o.status==="declined"||o.status==="withdrawn")return res.status(409).json({error:"This offer is closed."});
 if(action==="counter"){
  if(!seller||o.last_actor!=="buyer")return res.status(403).json({error:"Only the seller can counter the latest buyer proposal."});
  const price=Number(b.offer_price);if(!Number.isFinite(price)||price<=0||price>10000000)return res.status(400).json({error:"Invalid counteroffer unit price."});
  const {rows}=await db.query("UPDATE material_offers SET offer_price=$1,status='countered',last_actor='seller',updated_at=now() WHERE id=$2 AND last_actor='buyer' AND status IN ('pending','countered') RETURNING id,status",[price,id]);return res.json({offer:rows[0]});
 }
 if(action==="accept"){
  if(o.listing_status!=="active"||Number(o.quantity)>Number(o.stock))return res.status(409).json({error:"Stock no longer available."});
  if(seller&&o.last_actor!=="buyer"||buyer&&o.last_actor!=="seller")return res.status(403).json({error:"The other party must respond to this price."});
  const {rows}=await db.query("UPDATE material_offers SET status='accepted',updated_at=now() WHERE id=$1 AND status IN ('pending','countered') RETURNING id,status",[id]);return res.json({offer:rows[0],note:"Agreement recorded, not a payment, reservation or completed sale. Confirm fulfillment directly."});
 }
 if(action==="decline"&&seller||action==="withdraw"&&buyer){const {rows}=await db.query("UPDATE material_offers SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,status",[action==="withdraw"?"withdrawn":"declined",id]);return res.json({offer:rows[0]})}
 return res.status(400).json({error:"Action not allowed."});
}