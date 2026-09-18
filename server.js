const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "GOPASS2026!";
const ADMIN_PATH = "/" + (process.env.ADMIN_PATH || "gopass-hq-9f3k7x").replace(/^\/+/, "");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) console.warn("WARNING: DATABASE_URL is not set. Add a Railway PostgreSQL service and connect DATABASE_URL.");
const pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL ? { rejectUnauthorized: false } : undefined, max: 10 });

const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000, LOGIN_MAX_ATTEMPTS = 6, LOGIN_LOCK_MS = 15 * 60 * 1000;

function rate(ip){ const now=Date.now(), e=loginAttempts.get(ip); if(!e)return {blocked:false}; if(e.lockedUntil>now)return {blocked:true}; if(now-e.firstAttemptAt>LOGIN_WINDOW_MS){loginAttempts.delete(ip);return {blocked:false}} return {blocked:false}; }
function fail(ip){const now=Date.now();let e=loginAttempts.get(ip)||{count:0,firstAttemptAt:now};if(now-e.firstAttemptAt>LOGIN_WINDOW_MS)e={count:0,firstAttemptAt:now};e.count++;if(e.count>=LOGIN_MAX_ATTEMPTS)e.lockedUntil=now+LOGIN_LOCK_MS;loginAttempts.set(ip,e)}
function cookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf("=");return [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))]}))}
function session(req){const token=cookies(req).gopass_admin,s=sessions.get(token);if(!token||!s)return null;if(Date.now()-s.createdAt>SESSION_TTL_MS){sessions.delete(token);return null}return {token,...s}}
function requireAdmin(req,res,next){const s=session(req);if(!s)return res.status(401).json({ok:false,message:"ต้องเข้าสู่ระบบแอดมินก่อน"});req.admin=s;next()}
function makeId(prefix="GP"){return prefix+Date.now().toString(36)+crypto.randomBytes(4).toString("hex")}
function clean(v,max=500){return String(v??"").trim().slice(0,max)}

app.disable("x-powered-by"); app.set("trust proxy",true); app.use(express.json({limit:"1mb"})); app.use(express.urlencoded({extended:true}));
app.get("/admin.html",(_,res)=>res.status(404).send("Not found")); app.get("/admin",(_,res)=>res.status(404).send("Not found")); app.get("/data/demo.json",(_,res)=>res.status(404).send("Not found"));
app.get(ADMIN_PATH,(_,res)=>res.sendFile(path.join(__dirname,"admin.html")));
app.use(express.static(__dirname,{index:"index.html"}));

async function initDb(){
 if(!DATABASE_URL) return;
 await pool.query(`CREATE TABLE IF NOT EXISTS events(
   id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
   date TEXT NOT NULL DEFAULT '', time TEXT NOT NULL DEFAULT '', venue TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'คอนเสิร์ต',
   status TEXT NOT NULL DEFAULT 'กำลังเปิดขาย', hero TEXT NOT NULL DEFAULT 'assets/event-banner.png', artists JSONB NOT NULL DEFAULT '[]'::jsonb,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS tickets(
   id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, name TEXT NOT NULL,
   detail TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL DEFAULT 0 CHECK(price>=0), remaining INTEGER NOT NULL DEFAULT 0 CHECK(remaining>=0),
   sold INTEGER NOT NULL DEFAULT 0 CHECK(sold>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS orders(
   id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id) ON DELETE SET NULL, event_name TEXT NOT NULL DEFAULT '', ticket_id TEXT,
   ticket_type TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL CHECK(qty>0), amount INTEGER NOT NULL DEFAULT 0,
   buyer TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', discord TEXT NOT NULL DEFAULT '', pay_method TEXT NOT NULL DEFAULT 'card',
   status TEXT NOT NULL DEFAULT 'PAID', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ticket_no TEXT NOT NULL UNIQUE
 );`);
 const c=await pool.query('SELECT COUNT(*)::int AS n FROM events');
 if(c.rows[0].n===0){
   const file=path.join(__dirname,'data','demo.json');
   if(fs.existsSync(file)){const seed=JSON.parse(fs.readFileSync(file,'utf8')); await seedData(seed)}
 }
}
async function seedData(data){
 for(const e of (data.events||[])){
  await pool.query(`INSERT INTO events(id,name,short,description,date,time,venue,category,status,hero,artists) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,[e.id,e.name,e.short||e.name,e.description||'',e.date||'',e.time||'',e.venue||'',e.category||'คอนเสิร์ต',e.status||'กำลังเปิดขาย',e.hero||e.banner||'assets/event-banner.png',JSON.stringify(e.artists||[]) ]);
  for(const t of (e.tickets||[])) await pool.query(`INSERT INTO tickets(id,event_id,name,detail,price,remaining,sold) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,[`${e.id}:${t.id}`,e.id,t.name,t.detail||'',Math.max(0,Number(t.price)||0),Math.max(0,Number(t.remaining)||0),Math.max(0,Number(t.sold)||0)]);
 }
 for(const o of (data.orders||[])) await pool.query(`INSERT INTO orders(id,event_id,event_name,ticket_type,qty,amount,buyer,email,discord,pay_method,status,created_at,ticket_no) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,[o.id,o.eventId,o.eventName||'',o.ticketType||'',o.qty,o.amount,o.buyer||'',o.email||'',o.discord||'',o.payMethod||'card',o.status||'PAID',o.createdAt||new Date().toISOString(),o.ticketNo||makeId('T')]);
}
async function getData(){
 const es=await pool.query(`SELECT * FROM events ORDER BY created_at DESC`); const ts=await pool.query(`SELECT * FROM tickets ORDER BY created_at ASC`); const os=await pool.query(`SELECT id,event_id AS "eventId",event_name AS "eventName",ticket_type AS "ticketType",qty,amount,buyer,email,discord,pay_method AS "payMethod",status,created_at AS "createdAt",ticket_no AS "ticketNo" FROM orders ORDER BY created_at DESC`);
 return {brand:{name:'GOPASS'},updatedAt:new Date().toISOString(),events:es.rows.map(e=>({...e,id:e.id,artists:e.artists||[],tickets:ts.rows.filter(t=>t.event_id===e.id).map(t=>({id:t.id.split(':').slice(1).join(':')||t.id,name:t.name,detail:t.detail,price:t.price,remaining:t.remaining,sold:t.sold}))})),orders:os.rows};
}
app.get('/health',async(_,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,app:'GOPASS',database:'postgres'})}catch(e){res.status(503).json({ok:false,database:'error'})}});
app.get('/api/events',async(_,res)=>{try{res.json(await getData())}catch(e){console.error(e);res.status(500).json({ok:false,message:'โหลดข้อมูลไม่สำเร็จ'})}});

app.post('/api/orders',async(req,res)=>{
 const {eventId,ticketId,buyer,email,discord,payMethod}=req.body||{}; const qty=Number(req.body?.qty);
 if(!eventId||!ticketId||!buyer||!Number.isInteger(qty)||qty<1||qty>6)return res.status(400).json({ok:false,message:'ข้อมูลคำสั่งซื้อไม่ถูกต้อง'});
 const client=await pool.connect();
 try{await client.query('BEGIN');
  const eid=eventId, tid=`${eid}:${ticketId}`; const q=await client.query(`SELECT e.name AS event_name,t.* FROM tickets t JOIN events e ON e.id=t.event_id WHERE t.id=$1 FOR UPDATE`,[tid]);
  if(!q.rowCount){await client.query('ROLLBACK');return res.status(404).json({ok:false,message:'ไม่พบประเภทบัตรนี้'})}
  const t=q.rows[0]; if(t.remaining<qty){await client.query('ROLLBACK');return res.status(409).json({ok:false,message:'บัตรคงเหลือไม่พอ'})}
  await client.query(`UPDATE tickets SET remaining=remaining-$1,sold=sold+$1,updated_at=NOW() WHERE id=$2`,[qty,tid]);
  const order={id:makeId('GP'),eventId:eid,eventName:t.event_name,ticketType:t.name,qty,amount:t.price*qty,buyer:clean(buyer,120),email:clean(email,160),discord:clean(discord,80),payMethod:clean(payMethod||'card',40),status:'PAID',createdAt:new Date().toISOString(),ticketNo:'GP-'+crypto.randomBytes(5).toString('hex').toUpperCase()};
  await client.query(`INSERT INTO orders(id,event_id,event_name,ticket_id,ticket_type,qty,amount,buyer,email,discord,pay_method,status,created_at,ticket_no) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[order.id,eid,order.eventName,tid,order.ticketType,qty,order.amount,order.buyer,order.email,order.discord,order.payMethod,order.status,order.createdAt,order.ticketNo]);
  await client.query('COMMIT');res.json({ok:true,order});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);res.status(500).json({ok:false,message:'บันทึกคำสั่งซื้อไม่สำเร็จ'})}finally{client.release()}
});

app.post('/api/admin/login',(req,res)=>{const ip=req.ip||'unknown';if(rate(ip).blocked)return res.status(429).json({ok:false,message:'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'});const {username,password}=req.body||{};if(username!==ADMIN_USER||password!==ADMIN_PASSWORD){fail(ip);return res.status(401).json({ok:false,message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'})}loginAttempts.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{username:ADMIN_USER,createdAt:Date.now()});res.setHeader('Set-Cookie',[`gopass_admin=${encodeURIComponent(token)}`,'HttpOnly','SameSite=Lax','Path=/',`Max-Age=${SESSION_TTL_MS/1000}`].join('; '));res.json({ok:true,user:{username:ADMIN_USER},adminPath:ADMIN_PATH})});
app.post('/api/admin/logout',requireAdmin,(req,res)=>{sessions.delete(req.admin.token);res.setHeader('Set-Cookie','gopass_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.json({ok:true})});
app.get('/api/admin/me',(req,res)=>{const s=session(req);if(!s)return res.status(401).json({ok:false});res.json({ok:true,user:{username:s.username}})});

function normalizeTickets(eventId,arr){return (Array.isArray(arr)?arr:[]).map((t,i)=>({id:`${eventId}:${clean(t.id||('ticket-'+(i+1)),80)}`,name:clean(t.name,100),detail:clean(t.detail,300),price:Math.max(0,Math.floor(Number(t.price)||0)),remaining:Math.max(0,Math.floor(Number(t.remaining)||0)),sold:Math.max(0,Math.floor(Number(t.sold)||0))})).filter(t=>t.name)}
async function saveEventTickets(client,eventId,tickets){for(const t of tickets){await client.query(`INSERT INTO tickets(id,event_id,name,detail,price,remaining,sold) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,detail=EXCLUDED.detail,price=EXCLUDED.price,remaining=EXCLUDED.remaining,sold=EXCLUDED.sold,updated_at=NOW()`,[t.id,eventId,t.name,t.detail,t.price,t.remaining,t.sold])}}
app.post('/api/admin/events',requireAdmin,async(req,res)=>{const b=req.body||{},name=clean(b.name);if(!name||!clean(b.date)||!clean(b.time)||!clean(b.venue))return res.status(400).json({ok:false,message:'กรุณากรอกชื่องาน วันที่ เวลา และสถานที่'});let id=clean(b.id,80).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'')||makeId('event-');const client=await pool.connect();try{await client.query('BEGIN');let base=id,n=2;while((await client.query('SELECT 1 FROM events WHERE id=$1',[id])).rowCount)id=`${base}-${n++}`;await client.query(`INSERT INTO events(id,name,short,description,date,time,venue,category,status,hero,artists) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,name,clean(b.short||name),clean(b.description),clean(b.date),clean(b.time),clean(b.venue),clean(b.category||'คอนเสิร์ต'),clean(b.status||'กำลังเปิดขาย'),clean(b.hero||'assets/event-banner.png'),JSON.stringify(Array.isArray(b.artists)?b.artists.map(x=>clean(x,80)).slice(0,20):[])]);let tickets=normalizeTickets(id,b.tickets);if(!tickets.length)tickets=normalizeTickets(id,[{id:'normal',name:'ธรรมดา',detail:'บัตรทั่วไป',price:0,remaining:0,sold:0},{id:'vip',name:'VIP',detail:'สิทธิพิเศษ',price:0,remaining:0,sold:0}]);await saveEventTickets(client,id,tickets);await client.query('COMMIT');const data=await getData();res.json({ok:true,event:data.events.find(e=>e.id===id)})}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);res.status(500).json({ok:false,message:'บันทึกงานไม่สำเร็จ'})}finally{client.release()}});
app.delete('/api/admin/events/:id',requireAdmin,async(req,res)=>{try{const q=await pool.query('DELETE FROM events WHERE id=$1 RETURNING id,name',[req.params.id]);if(!q.rowCount)return res.status(404).json({ok:false,message:'ไม่พบงานนี้'});res.json({ok:true,event:q.rows[0]})}catch(e){console.error(e);res.status(500).json({ok:false,message:'ลบงานไม่สำเร็จ'})}});
app.patch('/api/admin/events/:id',requireAdmin,async(req,res)=>{const b=req.body||{},client=await pool.connect();try{await client.query('BEGIN');const old=await client.query('SELECT * FROM events WHERE id=$1 FOR UPDATE',[req.params.id]);if(!old.rowCount){await client.query('ROLLBACK');return res.status(404).json({ok:false,message:'ไม่พบงานนี้'})}const e=old.rows[0];const vals={name:b.name!==undefined?clean(b.name):e.name,short:b.short!==undefined?clean(b.short):e.short,description:b.description!==undefined?clean(b.description):e.description,date:b.date!==undefined?clean(b.date):e.date,time:b.time!==undefined?clean(b.time):e.time,venue:b.venue!==undefined?clean(b.venue):e.venue,category:b.category!==undefined?clean(b.category):e.category,status:b.status!==undefined?clean(b.status):e.status,hero:b.hero!==undefined?clean(b.hero):e.hero,artists:Array.isArray(b.artists)?b.artists.map(x=>clean(x,80)).slice(0,20):e.artists};await client.query(`UPDATE events SET name=$1,short=$2,description=$3,date=$4,time=$5,venue=$6,category=$7,status=$8,hero=$9,artists=$10,updated_at=NOW() WHERE id=$11`,[vals.name,vals.short,vals.description,vals.date,vals.time,vals.venue,vals.category,vals.status,vals.hero,JSON.stringify(vals.artists),req.params.id]);if(Array.isArray(b.tickets)){const tickets=normalizeTickets(req.params.id,b.tickets);for(const t of tickets)await client.query(`INSERT INTO tickets(id,event_id,name,detail,price,remaining,sold) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,detail=EXCLUDED.detail,price=EXCLUDED.price,remaining=EXCLUDED.remaining,sold=EXCLUDED.sold,updated_at=NOW()`,[t.id,req.params.id,t.name,t.detail,t.price,t.remaining,t.sold]);const keep=tickets.map(t=>t.id);if(keep.length)await client.query(`DELETE FROM tickets WHERE event_id=$1 AND id <> ALL($2::text[])`,[req.params.id,keep]);}await client.query('COMMIT');const data=await getData();res.json({ok:true,event:data.events.find(x=>x.id===req.params.id)})}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);res.status(500).json({ok:false,message:'บันทึกการแก้ไขไม่สำเร็จ'})}finally{client.release()}});
app.get('/api/admin/sales-summary',requireAdmin,async(_,res)=>{try{res.json(await getData())}catch(e){res.status(500).json({ok:false,message:'โหลดข้อมูลไม่สำเร็จ'})}});

initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`GOPASS running on port ${PORT}`))).catch(e=>{console.error('Database initialization failed:',e);process.exit(1)});
