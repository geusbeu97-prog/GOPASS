# GOPASS — Concert & Event Ticketing

เว็บขายบัตรคอนเสิร์ต/อีเวนต์โทนขาว-แดง พร้อมหน้า Home, Event List, Event Detail, Ticket Selection, Checkout, Success, My Tickets และ Admin Dashboard

## รันบน Windows

เปิด CMD ในโฟลเดอร์ที่มี `package.json`

```bat
npm install
npm start
```

โดยปกติเว็บจะเปิดที่:

```text
http://localhost:3000
```

ถ้า Port 3000 ถูกใช้ โปรเจกต์จะลองใช้ Port 3001 ให้เองเมื่อรันแบบ local

## ระบบแอดมิน (URL ลับ)

หน้าแอดมิน**ไม่มีลิงก์อยู่ที่ไหนบนเว็บไซต์เลย** และ `/admin` แบบเดิมถูกปิดแล้ว (ตอบ 404)
ต้องรู้ URL ลับเท่านั้นถึงจะเข้าได้ เก็บ URL นี้ไว้เป็นความลับเหมือนรหัสผ่าน

เปิดโดยตรงที่ (ค่าเริ่มต้น):

```text
http://localhost:3000/gopass-hq-9f3k7x
```

บัญชีเริ่มต้น:

```text
Username: admin
Password: GOPASS2026!
```

เปลี่ยน URL ลับและบัญชีได้โดยใช้ Environment Variable โดยไม่ต้องแก้โค้ด:

```bat
set ADMIN_PATH=ชื่อ-path-ลับของคุณ
set ADMIN_USER=ชื่อใหม่
set ADMIN_PASSWORD=รหัสใหม่
npm start
```

แนะนำให้เปลี่ยนทั้งสามค่านี้ก่อนเปิดใช้งานจริง อย่าใช้ค่า default

ระบบ Login ใช้ session cookie ฝั่งเซิร์ฟเวอร์ (HttpOnly) และมีการจำกัดจำนวนครั้งที่กรอกรหัสผิด
(ล็อกชั่วคราวถ้าผิดเกิน 6 ครั้งใน 15 นาทีจาก IP เดียวกัน) เพื่อกันการเดารหัสผ่าน

## สิ่งที่ควรรู้

- ข้อมูล Event เป็นข้อมูล Demo แต่ตอนนี้ **คำสั่งซื้อถูกบันทึกที่ฝั่งเซิร์ฟเวอร์จริง** ลงไฟล์ `data/demo.json`
  (ตัดจำนวนบัตรคงเหลือ, บวกยอดขาย, และแอดมินเห็นออร์เดอร์ทุกอันแบบเรียลไทม์)
- ฝั่งลูกค้ายังเก็บสำเนาออร์เดอร์ไว้ใน localStorage เพิ่มเติม เพื่อให้หน้า "บัตรของฉัน" ใช้งานได้แม้ปิดเบราว์เซอร์
- Checkout ยังไม่เชื่อม Payment Gateway จริง (กดยืนยันแล้วถือว่า PAID ทันทีเพื่อจำลองการซื้อ)
- Admin ใช้ข้อมูลจาก `data/demo.json` เดียวกับหน้าเว็บ อัปเดตอัตโนมัติทุกครั้งที่มีคำสั่งซื้อใหม่
- ก่อนเปิดขายจริงควรต่อฐานข้อมูลจริง (ไฟล์ JSON ไม่เหมาะกับ concurrent write จำนวนมาก) ระบบชำระเงินจริง การสร้าง QR/บัตร และระบบผู้ใช้

## โครงสร้างหลัก

```text
GOPASS-Website-v2/
├─ index.html
├─ admin.html
├─ app.js
├─ admin.js
├─ server.js
├─ app.css
├─ data/
│  └─ demo.json
└─ assets/
   └─ gopass-logo.png
```


## Railway + PostgreSQL
1. สร้าง PostgreSQL service ใน Railway แล้วเชื่อมกับ Web service เพื่อให้มี `DATABASE_URL`
2. ตั้ง Variables: `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_PATH`
3. Deploy ใหม่ ระบบจะสร้างตาราง `events`, `tickets`, `orders` อัตโนมัติ
4. ถ้าฐานข้อมูลว่าง ระบบจะนำข้อมูลเริ่มต้นจาก `data/demo.json` เข้า PostgreSQL ครั้งแรก
5. หลังจากนั้นข้อมูลการเพิ่ม/แก้ไข/ลบงานและจำนวนบัตรจะใช้ PostgreSQL ทั้งหมด
