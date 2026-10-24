import { db, storage, auth } from "hatchable";
import crypto from "node:crypto";
export const access = "public";
export const methods = ["GET","POST","PUT","DELETE"];

const allowedCategories = new Set(["Bricks","Blocks","Doors","Windows","Steel","Tiles"]);
const allowedQuality = new Set(["Excellent","Good","Fair"]);
const maxLen = { title:120, location:80, unit:30, condition_note:800, seller_name:100, seller_mobile:20 };
const validMapsUrl = value => { try { const u=new URL(String(value||"").trim()); return u.protocol==="https:" && ["google.com","www.google.com","maps.google.com","maps.app.goo.gl","goo.gl"].includes(u.hostname); } catch { return false; } };
const clean = (v, max=200) => String(v ?? "").trim().slice(0,max);

async function rateLimit(req){
  const raw = String(req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "anonymous").split(",")[0].trim();
  const fingerprint = crypto.createHash("sha256").update("umb-v1:"+raw).digest("hex");
  const now = new Date(), windowStart = new Date(now.getTime()-3600000);
  const {rows}=await db.query("SELECT fingerprint,window_start,request_count FROM listing_rate_limits WHERE fingerprint=$1",[fingerprint]);
  if(!rows.length){await db.query("INSERT INTO listing_rate_limits(fingerprint,window_start,request_count) VALUES($1,$2,1)",[fingerprint,now]);return true;}
  const r=rows[0];
  if(new Date(r.window_start) < windowStart){await db.query("UPDATE listing_rate_limits SET window_start=$1,request_count=1 WHERE fingerprint=$2",[now,fingerprint]);return true;}
  if(Number(r.request_count)>=10)return false;
  await db.query("UPDATE listing_rate_limits SET request_count=request_count+1 WHERE fingerprint=$1",[fingerprint]);
  return true;
}

export default async function(req,res){
  if(req.method==="GET"){
    if(req.query?.checkAuth==="1"){
      const user=await auth.getUser(req);
      return res.json({authenticated:Boolean(user), id:user?.id||null, email:user?.email||null});
    }
    const mine=req.query?.mine==="1";
    if(mine){
      const user=await auth.getUser(req);
      if(!user)return res.status(401).json({error:"Sign in required.",login_required:true});
      const {rows}=await db.query("SELECT * FROM materials WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 100",[user.id]);
      const out=await Promise.all(rows.map(async r=>({...r,image_url:r.image_key?await storage.url(r.image_key):null})));
      return res.json(out);
    }
    const q=clean(req.query?.q,80), category=clean(req.query?.category,30), location=clean(req.query?.location,80), quality=clean(req.query?.quality,30);
    const maxPrice=req.query?.maxPrice ? Number(req.query.maxPrice) : null;
    let sql="SELECT * FROM materials WHERE listing_status='active'"; const params=[];
    if(q){params.push("%"+q+"%");sql+=" AND (title ILIKE $"+params.length+" OR category ILIKE $"+params.length+" OR location ILIKE $"+params.length+")";}
    if(allowedCategories.has(category)){params.push(category);sql+=" AND category=$"+params.length;}
    if(location){params.push("%"+location+"%");sql+=" AND location ILIKE $"+params.length;}
    if(allowedQuality.has(quality)){params.push(quality);sql+=" AND quality=$"+params.length;}
    if(maxPrice!==null&&Number.isFinite(maxPrice)&&maxPrice>=0&&maxPrice<=1000000){params.push(maxPrice);sql+=" AND price <= $"+params.length;}
    sql+=" ORDER BY verified DESC, distance_km ASC, created_at DESC LIMIT 100";
    const {rows}=await db.query(sql,params);
    const out=await Promise.all(rows.map(async r=>({...r,image_url:r.image_key?await storage.url(r.image_key):null})));
    return res.json(out);
  }
  const verifiedUser=await auth.getUser(req);
  if(!verifiedUser) return res.status(401).json({error:"Please verify your account before managing listings.",login_required:true});
  if(req.method==="PUT"){
    if(req.headers?.["x-umb-client"]!=="web-v1") return res.status(403).json({error:"Request validation failed."});
    const id=String(req.query?.id||req.body?.id||"").trim();
    if(!id)return res.status(400).json({error:"Listing id is required."});
    const b=req.body||{};
    const action=clean(b.action,20);
    if(action==="sold"||action==="active"||action==="discarded"){
      const {rows}=await db.query("UPDATE materials SET listing_status=$1 WHERE id=$2 AND owner_user_id=$3 RETURNING *",[action,id,verifiedUser.id]);
      if(!rows.length)return res.status(404).json({error:"Listing not found or you are not its owner."});
      return res.json({...rows[0],ok:true});
    }
    const title=clean(b.title,120),location=clean(b.location,80),unit=clean(b.unit,30),sellerName=clean(b.seller_name,100),sellerMobile=clean(b.seller_mobile,20),note=clean(b.condition_note,800),googleMapsUrl=clean(b.google_maps_url,500);
    if(!title||!location||!unit||!sellerName||!sellerMobile||!note||!googleMapsUrl)return res.status(400).json({error:"Please complete all required listing fields, including the Google Maps location link."});
    if(!validMapsUrl(googleMapsUrl))return res.status(400).json({error:"Please enter a valid Google Maps link (maps.google.com, google.com/maps, or maps.app.goo.gl)."});
    if(!/^[+0-9 ()-]{8,20}$/.test(sellerMobile))return res.status(400).json({error:"Please enter a valid mobile number."});
    if(!allowedCategories.has(clean(b.category))||!allowedQuality.has(clean(b.quality)))return res.status(400).json({error:"Invalid category or quality."});
    const price=Number(b.price),quantity=Number(b.quantity);
    if(!Number.isFinite(price)||price<=0||price>10000000||!Number.isFinite(quantity)||quantity<=0||quantity>100000000||!Number.isInteger(quantity))return res.status(400).json({error:"Invalid price or quantity."});
    const ageYears=Number.isInteger(Number(b.age_years))&&Number(b.age_years)>=0&&Number(b.age_years)<=200?Number(b.age_years):null;
    const previousUse=clean(b.previous_use,120)||null,dimensions=clean(b.dimensions,120)||null;
    const {rows}=await db.query("UPDATE materials SET title=$1,category=$2,location=$3,price=$4,unit=$5,quantity=$6,quality=$7,condition_note=$8,seller_name=$9,seller_mobile=$10,age_years=$11,previous_use=$12,dimensions=$13,google_maps_url=$14 WHERE id=$15 AND owner_user_id=$16 RETURNING *",[title,b.category,location,price,unit,quantity,b.quality,note,sellerName,sellerMobile,ageYears,previousUse,dimensions,googleMapsUrl,id,verifiedUser.id]);
    if(!rows.length)return res.status(404).json({error:"Listing not found or you are not its owner."});
    const row=rows[0];row.image_url=row.image_key?await storage.url(row.image_key):null;return res.json(row);
  }
  if(req.method==="DELETE"){
    const id=String(req.query?.id||req.body?.id||"").trim();
    if(!id)return res.status(400).json({error:"Listing id is required."});
    const {rowCount}=await db.query("DELETE FROM materials WHERE id=$1 AND owner_user_id=$2 RETURNING id",[id,verifiedUser.id]);
    if(!rowCount)return res.status(404).json({error:"Listing not found or you are not its owner."});
    return res.json({ok:true,deleted_id:id});
  }
  if(req.headers?.["x-umb-client"]!=="web-v1") return res.status(403).json({error:"Request validation failed."});
  if(!await rateLimit(req)) return res.status(429).json({error:"Too many listing attempts. Please try again later."});
  const b={...(req.body||{}),unit:"/piece"};
  if(clean(b.website,50)) return res.status(400).json({error:"Invalid submission."});
  if(!allowedCategories.has(clean(b.category))) return res.status(400).json({error:"Invalid material category."});
  if(!allowedQuality.has(clean(b.quality))) return res.status(400).json({error:"Invalid quality."});
  for(const k of ["title","location","unit","condition_note","seller_name"]){const raw=String(b[k]??"").trim();if(!raw||raw.length>maxLen[k])return res.status(400).json({error:"Invalid "+k});}
  const googleMapsUrl=clean(b.google_maps_url,500);
  if(!validMapsUrl(googleMapsUrl))return res.status(400).json({error:"Please enter a valid Google Maps link (maps.google.com, google.com/maps, or maps.app.goo.gl)."});
  const price=Number(b.price), quantity=Number(b.quantity);
  if(!Number.isFinite(price)||price<=0||price>10000000)return res.status(400).json({error:"Invalid price."});
  if(!Number.isFinite(quantity)||quantity<=0||quantity>100000000||!Number.isInteger(quantity))return res.status(400).json({error:"Invalid quantity."});
  const sellerMobile=clean(b.seller_mobile,20);
  if(!/^[+0-9 ()-]{8,20}$/.test(sellerMobile))return res.status(400).json({error:"Please enter a valid mobile number."});
  let imageKey=null;
  if(b.image_data){
    const parts=String(b.image_data).split(",");
    const mime=parts[0]?.slice(5)?.split(";")[0], base64=parts[1];
    if(!["image/jpeg","image/png","image/webp"].includes(mime)||!base64||!/^[A-Za-z0-9+/=]+$/.test(base64))return res.status(415).json({error:"Please upload a JPG, PNG or WEBP image."});
    const raw=atob(base64), bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    if(bytes.length>4*1024*1024)return res.status(413).json({error:"Photo must be under 4 MB."});
    const ext=mime==="image/jpeg"?"jpg":mime.split("/")[1];
    imageKey="material-images/"+crypto.randomUUID()+"."+ext;
    await storage.put(imageKey,bytes,mime);
  }
  const theme={Bricks:"brick",Blocks:"block",Doors:"door",Windows:"window",Steel:"steel",Tiles:"tile"}[b.category];
  const ageYears=Number.isInteger(Number(b.age_years))&&Number(b.age_years)>=0&&Number(b.age_years)<=200?Number(b.age_years):null;
  const previousUse=clean(b.previous_use,120)||null;
  const dimensions=clean(b.dimensions,120)||null;
  const inspectionStatus="Not inspected";
  const carbonFactors={Bricks:0.6,Blocks:4,Doors:20,Windows:18,Steel:1.8,Tiles:0.5};
  const carbonFactor=carbonFactors[b.category]||0;
  const {rows}=await db.query("INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_mobile,seller_type,verified,image_theme,image_key,age_years,previous_use,dimensions,carbon_factor_kg,inspection_status,google_maps_url,owner_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *",[clean(b.title,120),b.category,clean(b.location,80),0,price,clean(b.unit,30),quantity,b.quality,clean(b.condition_note,800),clean(b.seller_name,100),sellerMobile,clean(b.seller_type,40)||"Individual",theme,imageKey,ageYears,previousUse,dimensions,carbonFactor,inspectionStatus,googleMapsUrl,verifiedUser.id]);
  const row=rows[0];
  if(!row)return res.status(500).json({error:"The listing response was unavailable. Check My Listings before submitting again."});
  row.image_url=imageKey?await storage.url(imageKey):null;
  return res.status(201).json(row);
}