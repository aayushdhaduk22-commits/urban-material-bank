import { db, storage, auth } from "hatchable";

export const access = "public";
export const methods = ["GET", "POST"];

const clean = (v, max=500) => String(v ?? "").trim().slice(0, max);
const validPhone = v => /^[+0-9 ()-]{8,20}$/.test(v);

export default async function(req, res) {
  const user = await auth.getUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to continue.", login_required: true });

  if (req.method === "GET") {
    const { rows } = await db.query(
      "SELECT br.id, br.status, br.message, br.buyer_mobile, br.created_at, m.id AS material_id, m.title AS material_title, m.category, m.location AS material_location, m.price, m.unit, m.listing_status, p.user_id AS buyer_user_id, p.username, p.full_name, p.age, p.occupation, p.city, p.locality, p.phone AS profile_phone, p.email AS buyer_email, p.bio, p.avatar_key FROM buyer_requests br JOIN materials m ON m.id=br.material_id JOIN user_profiles p ON p.user_id=br.buyer_user_id WHERE br.seller_user_id=$1 ORDER BY br.created_at DESC LIMIT 100",
      [user.id]
    );
    const requests = await Promise.all(rows.map(async r => ({
      ...r,
      avatar_url: r.avatar_key ? await storage.url(r.avatar_key) : null
    })));
    return res.json({ requests });
  }

  const b = req.body || {};
  const materialId = clean(b.material_id, 80);
  const buyerMobile = clean(b.buyer_mobile, 20);
  const message = clean(b.message, 500);
  if (!materialId || !validPhone(buyerMobile)) return res.status(400).json({ error: "A material and valid mobile number are required." });

  const { rows: profiles } = await db.query(
    "SELECT user_id, username, full_name, age, occupation, city, locality, phone FROM user_profiles WHERE user_id=$1",
    [user.id]
  );
  if (!profiles.length) return res.status(400).json({ error: "Complete your profile before contacting a seller.", profile_required: true });

  const { rows: materials } = await db.query(
    "SELECT id, owner_user_id, listing_status FROM materials WHERE id=$1 LIMIT 1",
    [materialId]
  );
  const material = materials[0];
  if (!material || material.listing_status !== "active") return res.status(404).json({ error: "This material is no longer available." });
  if (material.owner_user_id === user.id) return res.status(400).json({ error: "You cannot contact yourself about your own listing." });
  if (!material.owner_user_id) return res.status(400).json({ error: "This demo listing has no linked seller account, so a request cannot be routed yet." });

  const { rows } = await db.query(
    "INSERT INTO buyer_requests (material_id,seller_user_id,buyer_user_id,buyer_mobile,message,status,created_at) VALUES ($1,$2,$3,$4,$5,'new',now()) ON CONFLICT (material_id,buyer_user_id) DO UPDATE SET buyer_mobile=EXCLUDED.buyer_mobile,message=EXCLUDED.message,status='new',created_at=now() RETURNING id,created_at,status",
    [materialId, material.owner_user_id, user.id, buyerMobile, message]
  );
  return res.status(201).json({ ok: true, request: rows[0], message: "Request sent. The seller can now view your shared buyer profile and contact details." });
}