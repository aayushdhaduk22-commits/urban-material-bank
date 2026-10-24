import { db, storage, auth } from "hatchable";
import crypto from "node:crypto";

export const access = "public";
export const methods = ["GET", "PUT"];

const clean = (v, max=120) => String(v ?? "").trim().slice(0, max);
const validPhone = v => /^[+0-9 ()-]{8,20}$/.test(v);

export default async function(req, res) {
  const user = req.user;

  if (req.method === "GET") {
    const { rows } = await db.query("SELECT user_id, email, username, full_name, age, occupation, city, locality, phone, bio, avatar_key, created_at, updated_at FROM user_profiles WHERE user_id=$1", [user.id]);
    if (!rows.length) return res.json({ profile: null, email: user.email });
    const p = rows[0];
    return res.json({ profile: { ...p, avatar_url: p.avatar_key ? await storage.url(p.avatar_key) : null }, email: user.email });
  }

  const b = req.body || {};
  // Profile editing restored to the v20 behavior.
  const username = clean(b.username, 24).replace(/^@/, "");
  const fullName = clean(b.full_name, 100);
  const age = Number(b.age);
  const occupation = clean(b.occupation, 100);
  const city = clean(b.city, 80);
  const locality = clean(b.locality, 100);
  const phone = clean(b.phone, 20);
  const bio = clean(b.bio, 280);
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Username must be 3–24 characters using letters, numbers or underscores." });
  if (!fullName || !Number.isInteger(age) || age < 1 || age > 120 || !occupation || !city || !locality || !validPhone(phone)) {
    return res.status(400).json({ error: "Complete every required field and enter a valid mobile number." });
  }

  let avatarKey = null;
  const { rows: existing } = await db.query("SELECT avatar_key FROM user_profiles WHERE user_id=$1", [user.id]);
  avatarKey = existing[0]?.avatar_key || null;
  if (b.avatar_data) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.avatar_data));
    if (!match) return res.status(415).json({ error: "Upload a JPG, PNG or WEBP profile photo." });
    const mime = match[1], base64 = match[2];
    const raw = atob(base64), bytes = new Uint8Array(raw.length);
    for (let i=0; i<raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (bytes.length > 2*1024*1024) return res.status(413).json({ error: "Profile photo must be under 2 MB after compression." });
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const newKey = "profile-photos/" + crypto.randomUUID() + "." + ext;
    await storage.put(newKey, bytes, mime);
    if (avatarKey) { try { await storage.del(avatarKey); } catch (_) {} }
    avatarKey = newKey;
  }

  try {
    const { rows } = await db.query(
      "INSERT INTO user_profiles (user_id,email,username,full_name,age,occupation,city,locality,phone,bio,avatar_key,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email,username=EXCLUDED.username,full_name=EXCLUDED.full_name,age=EXCLUDED.age,occupation=EXCLUDED.occupation,city=EXCLUDED.city,locality=EXCLUDED.locality,phone=EXCLUDED.phone,bio=EXCLUDED.bio,avatar_key=EXCLUDED.avatar_key,updated_at=now() RETURNING user_id,email,username,full_name,age,occupation,city,locality,phone,bio,avatar_key,created_at,updated_at",
      [user.id, user.email, username, fullName, age, occupation, city, locality, phone, bio, avatarKey]
    );
    const p = rows[0];
    // No profile-edit OTP token is used in v20 behavior.
    return res.json({ ok: true, profile: { ...p, avatar_url: p.avatar_key ? await storage.url(p.avatar_key) : null } });
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("unique")) return res.status(409).json({ error: "That username is already taken. Choose another one." });
    throw e;
  }
}