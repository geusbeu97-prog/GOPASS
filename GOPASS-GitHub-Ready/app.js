const store={events:[],selectedEvent:null,ticketType:null,qty:1,orders:JSON.parse(localStorage.getItem('gopassOrders')||'[]')};
const $=s=>document.querySelector(s);const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n||0);
async function boot() {
  try {
    const response = await fetch("/api/events", { cache: "no-store" });
    if (!response.ok) throw new Error("โหลดข้อมูลอีเวนต์ไม่สำเร็จ");
    const data = await response.json();
    store.events = data.events || [];
    route();
  } catch (error) {
    console.error(error);
    $("#app").innerHTML = `
      <section class="success">
        <div class="container">
          <div class="success-card">
            <h1>ไม่สามารถโหลด GOPASS ได้</h1>
            <p>กรุณาเปิดเว็บผ่าน <b>npm start</b> ไม่ใช่เปิดไฟล์ HTML โดยตรง</p>
          </div>
        </div>
      </section>
    `;
  }
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function setNav(name){document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===name))}
function card(e){const min=Math.min(...e.tickets.map(t=>t.price));return `<article class="event-card"><div class="cover"><img src="${e.hero}" alt="${e.name}"></div><div class="body"><span class="pill">${e.status}</span><h3>${e.name}</h3><div class="meta">${e.date} · ${e.venue}</div><div class="price-row"><div><div class="small">เริ่มต้น</div><div class="price">${money(min)}</div></div><div class="small">${e.category}</div></div><button class="btn primary full card-btn" onclick="goEvent('${e.id}')">ดูรายละเอียด</button></div></article>`}
function home(){setNav('home');const featured=store.events[0];$('#app').innerHTML=`<section class="hero"><div class="container"><div class="hero-card"><img src="${featured.hero}" alt="${featured.name}"><div class="hero-content"><span class="pill">${featured.status}</span><h1>${featured.short}</h1><p>${featured.description}</p><div class="meta" style="color:#fff">${featured.date} · ${featured.time} · ${featured.venue}</div><div class="hero-actions"><button class="btn primary" onclick="goEvent('${featured.id}')">ซื้อบัตร</button><a class="btn white" href="#events">ดูงานทั้งหมด</a></div></div></div></div></section><section class="section"><div class="container"><div class="section-head"><div><h2>คอนเสิร์ตที่กำลังเปิดขาย</h2><p>เลือกงานที่สนใจ แล้วเลือกประเภทบัตรและจำนวนได้ทันที</p></div><a class="link-red" href="#events">ดูทั้งหมด →</a></div><div class="event-grid">${store.events.slice(0,4).map(card).join('')}</div><div class="banner-strip"><img src="assets/gallery3.png" alt="GOPASS"><div class="banner-text"><h3>ไม่พลาดทุกความมันส์</h3><p>ซื้อบัตรง่าย จ่ายสะดวก และเก็บบัตรไว้ใน GOPASS</p></div></div></div></section>`}
function events(){setNav('events');$('#app').innerHTML=`<section class="section"><div class="container"><div class="section-head"><div><h2>คอนเสิร์ตและอีเวนต์</h2><p>ค้นหางานที่กำลังเปิดขายและงานที่กำลังจะเปิด</p></div></div><div class="tabs"><button class="tab active">ทั้งหมด</button><button class="tab">กำลังเปิดขาย</button><button class="tab">ใกล้เปิดขาย</button><button class="tab">เฟสติวัล</button></div><div class="event-grid">${store.events.map(card).join('')}</div></div></section>`}
function eventDetail(id){setNav('events');const e=store.events.find(x=>x.id===id);store.selectedEvent=e;store.ticketType=e.tickets[0];store.qty=1;$('#app').innerHTML=`<section class="detail-wrap"><div class="container"><a class="back" href="#events">← กลับหน้าคอนเสิร์ต</a><div class="detail-card"><div class="detail-hero"><img src="${e.hero}" alt="${e.name}"><div class="detail-title"><span class="pill">${e.status}</span><h1>${e.name}</h1><p>${e.date} · ${e.time} · ${e.venue}</p></div></div><div class="detail-body"><div class="detail-info"><h2>รายละเอียดงาน</h2><p>${e.description}</p><div class="facts"><div class="fact"><small>วันที่</small><b>${e.date}</b></div><div class="fact"><small>เวลา</small><b>${e.time}</b></div><div class="fact"><small>สถานที่</small><b>${e.venue}</b></div></div><h2 style="margin-top:26px">ศิลปินที่ร่วมแสดง</h2><div class="artist-row">${e.artists.map(a=>`<span class="artist">${a}</span>`).join('')}</div></div><aside class="buy-panel"><h3>เลือกประเภทบัตร</h3>${e.tickets.map((t,i)=>`<div class="ticket-option ${i===0?'active':''}" onclick="selectTicket('${t.id}')" id="ticket-${t.id}"><div class="ticket-line"><div><div class="ticket-name">${t.name}</div><div class="ticket-detail">${t.detail} · เหลือ ${t.remaining.toLocaleString()} ใบ</div></div><div class="ticket-price">${money(t.price)}</div></div></div>`).join('')}<div class="ticket-line" style="margin:15px 0 8px"><strong style="font-size:12px">จำนวน</strong><div class="qty"><button onclick="changeQty(-1)">−</button><span id="qty">1</span><button onclick="changeQty(1)">+</button></div></div><div class="summary"><div class="sum-line"><span id="sumName">${e.tickets[0].name}</span><strong id="sumPrice">${money(e.tickets[0].price)}</strong></div><div class="sum-line"><span>จำนวน</span><span id="sumQty">1 ใบ</span></div><div class="sum-line total"><span>รวมทั้งหมด</span><strong id="sumTotal">${money(e.tickets[0].price)}</strong></div></div><button class="btn primary full" onclick="checkout()">ไปยังหน้าชำระเงิน →</button></aside></div></div></div></section>`}
function selectTicket(id){const e=store.selectedEvent;store.ticketType=e.tickets.find(t=>t.id===id);document.querySelectorAll('.ticket-option').forEach(x=>x.classList.remove('active'));$('#ticket-'+id).classList.add('active');updateSummary()}
function changeQty(delta){if(!store.ticketType)return;store.qty=Math.max(1,Math.min(6,store.qty+delta));$('#qty').textContent=store.qty;updateSummary()}
function updateSummary(){const t=store.ticketType;const total=t.price*store.qty;$('#sumName').textContent=t.name;$('#sumPrice').textContent=money(t.price);$('#sumQty').textContent=`${store.qty} ใบ` ;$('#sumTotal').textContent=money(total)}
function checkout(){const e=store.selectedEvent,t=store.ticketType;location.hash=`checkout/${e.id}/${t.id}/${store.qty}`}
function checkoutPage(id,type,qty){const e=store.events.find(x=>x.id===id);const t=e.tickets.find(x=>x.id===type);store.selectedEvent=e;store.ticketType=t;store.qty=Number(qty)||1;$('#app').innerHTML=`<section class="checkout"><div class="container"><a class="back" href="#event/${e.id}">← กลับเลือกบัตร</a><div class="checkout-grid"><div class="checkout-card"><div class="steps"><div class="step active">1 เลือกบัตร</div><div class="step active">2 ชำระเงิน</div><div class="step">3 เสร็จสิ้น</div></div><h2>ยืนยันการสั่งซื้อ</h2><div class="field"><label>ชื่อผู้ซื้อ</label><input id="buyer" placeholder="กรอกชื่อของคุณ"></div><div class="field"><label>อีเมล</label><input id="email" type="email" placeholder="you@example.com"></div><div class="field"><label>ช่องทางติดต่อ (Discord)</label><input id="discord" placeholder="username"></div><h3 style="font-size:14px;margin-top:22px">วิธีชำระเงิน</h3><div class="pay-method"><label class="pay active"><input type="radio" name="pay" value="card" checked> บัตรเครดิต / เดบิต</label><label class="pay"><input type="radio" name="pay" value="promptpay"> QR PromptPay</label><label class="pay"><input type="radio" name="pay" value="wallet"> Wallet / พร้อมเพย์</label></div></div><aside class="checkout-card"><h2>สรุปรายการ</h2><div class="ticket-preview"><img src="${e.hero}" alt=""><div class="ticket-mini"><strong>${e.name}</strong><span>${t.name}</span></div><div class="ticket-mini"><span>ประเภท</span><span>${t.name}</span></div><div class="ticket-mini"><span>จำนวน</span><span>${store.qty} ใบ</span></div><div class="ticket-mini"><span>ราคาต่อใบ</span><span>${money(t.price)}</span></div><div class="ticket-mini" style="padding-top:10px;border-top:1px solid var(--line);margin-top:10px"><strong>รวมทั้งหมด</strong><strong style="color:var(--red)">${money(t.price*store.qty)}</strong></div></div><button class="btn primary full" onclick="payNow()">ยืนยันการชำระเงิน</button><p class="small" style="text-align:center;margin-top:10px">* หน้านี้เป็นตัวอย่างการชำระเงิน ยังไม่ได้เชื่อม Payment Gateway จริง</p></aside></div></div></section>`}
async function payNow(){
  const buyer=$('#buyer').value.trim();
  if(!buyer)return toast('กรุณากรอกชื่อผู้ซื้อ');
  const e=store.selectedEvent,t=store.ticketType;
  const payMethod=document.querySelector('input[name="pay"]:checked')?.value||'card';
  const btn=document.querySelector('.checkout aside .btn.primary');
  if(btn){btn.disabled=true;btn.textContent='กำลังดำเนินการ...'}
  try{
    const res=await fetch('/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        eventId:e.id,
        ticketId:t.id,
        qty:store.qty,
        buyer,
        email:$('#email').value.trim(),
        discord:$('#discord').value.trim(),
        payMethod
      })
    });
    const payload=await res.json().catch(()=>({ok:false,message:'เกิดข้อผิดพลาด'}));
    if(!res.ok||!payload.ok){
      toast(payload.message||'ไม่สามารถสร้างคำสั่งซื้อได้');
      if(btn){btn.disabled=false;btn.textContent='ยืนยันการชำระเงิน'}
      return;
    }
    const order=payload.order;
    store.orders.unshift(order);
    localStorage.setItem('gopassOrders',JSON.stringify(store.orders));
    // keep local ticket counts roughly in sync until next full reload
    t.remaining=Math.max(0,(t.remaining||0)-store.qty);
    location.hash=`success/${order.id}`;
  }catch(error){
    console.error(error);
    toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    if(btn){btn.disabled=false;btn.textContent='ยืนยันการชำระเงิน'}
  }
}
function success(id){setNav('tickets');const o=store.orders.find(x=>x.id===id);if(!o)return location.hash='home';const e=store.events.find(x=>x.id===o.eventId);$('#app').innerHTML=`<section class="success"><div class="container"><div class="success-card"><div class="success-icon">✓</div><h1>ชำระเงินสำเร็จ!</h1><p>ขอบคุณสำหรับการสั่งซื้อบัตรผ่าน GOPASS</p><div class="order-code">หมายเลขคำสั่งซื้อ · ${o.id}</div><div class="ticket-preview"><img src="${e.hero}" alt=""><div class="ticket-mini"><strong>${e.name}</strong><span>${o.ticketType} × ${o.qty}</span></div><div class="ticket-mini"><span>หมายเลขบัตร</span><span>${o.ticketNo}</span></div><div class="ticket-mini"><span>ยอดชำระ</span><strong style="color:var(--red)">${money(o.amount)}</strong></div></div><div class="ticket-actions"><a href="#tickets" class="btn primary">ดูบัตรของฉัน</a><a href="#home" class="btn outline">กลับหน้าหลัก</a></div></div></div></section>`}
function tickets(){setNav('tickets');const rows=store.orders;if(!rows.length){$('#app').innerHTML=`<section class="mytickets"><div class="container"><div class="section-head"><div><h2>บัตรของฉัน</h2><p>บัตรที่ซื้อจากเครื่องนี้จะถูกเก็บไว้ที่นี่</p></div></div><div class="empty">ยังไม่มีบัตรในบัญชี<br><a class="link-red" href="#events">ไปเลือกคอนเสิร์ต →</a></div></div></section>`;return}$('#app').innerHTML=`<section class="mytickets"><div class="container"><div class="section-head"><div><h2>บัตรของฉัน</h2><p>ใช้หมายเลขบัตรนี้สำหรับการตรวจสอบเข้างาน</p></div></div><div class="ticket-list">${rows.map(o=>{const e=store.events.find(x=>x.id===o.eventId);return `<article class="my-ticket"><img src="${e.hero}" alt=""><div><span class="pill">${o.status==='PAID'?'ใช้งานได้':'รอตรวจสอบ'}</span><h3>${o.eventName}</h3><p>${o.ticketType} · ${o.qty} ใบ<br>Order: ${o.id}<br>Ticket: ${o.ticketNo}</p><div style="margin-top:9px"><a class="link-red" href="#ticket/${o.id}">ดูบัตร →</a></div></div><div class="qr" title="QR Demo"></div></article>`}).join('')}</div></div></section>`}
function ticketDetail(id){const o=store.orders.find(x=>x.id===id);if(!o)return location.hash='tickets';const e=store.events.find(x=>x.id===o.eventId);$('#app').innerHTML=`<section class="success"><div class="container"><div class="success-card" style="text-align:left"><a class="back" href="#tickets">← กลับบัตรของฉัน</a><div class="ticket-preview"><img src="${e.hero}" alt=""><h2 style="margin:14px 0 4px">${e.name}</h2><p class="small">${e.date} · ${e.venue}</p><div class="ticket-mini"><span>ประเภทบัตร</span><strong>${o.ticketType}</strong></div><div class="ticket-mini"><span>หมายเลขบัตร</span><strong>${o.ticketNo}</strong></div><div style="display:grid;place-items:center;padding:18px 0"><div class="qr" style="width:170px;height:170px"></div></div></div><button class="btn primary full" onclick="window.print()">พิมพ์ / บันทึกบัตร</button></div></div></section>`}
function news(){$('#app').innerHTML=`<section class="section"><div class="container"><div class="section-head"><div><h2>ข่าวสาร</h2><p>ข่าวประกาศล่าสุดจาก GOPASS</p></div></div><div class="event-grid"><article class="event-card"><div class="cover"><img src="assets/gallery3.png" alt=""></div><div class="body"><h3>GOPASS เปิดระบบขายบัตรแบบใหม่</h3><div class="meta">ระบบเลือกบัตรและชำระเงินในหน้าเดียว ใช้งานง่ายบนมือถือ</div></div></article><article class="event-card"><div class="cover"><img src="assets/gallery2.png" alt=""></div><div class="body"><h3>เตรียมพบงานใหม่เร็ว ๆ นี้</h3><div class="meta">ติดตามประกาศวันเปิดขายและสิทธิพิเศษผ่าน GOPASS</div></div></article></div></div></section>`}
function goEvent(id){location.hash=`event/${id}`}
function route(){const h=location.hash.slice(1)||'home';if(h==='home')return home();if(h==='events')return events();if(h==='news')return news();if(h==='tickets')return tickets();const p=h.split('/');if(p[0]==='event')return eventDetail(p[1]);if(p[0]==='checkout')return checkoutPage(p[1],p[2],p[3]);if(p[0]==='success')return success(p[1]);if(p[0]==='ticket')return ticketDetail(p[1]);return home()}
$('#searchBtn').addEventListener('click',()=>openSearch());$('#menuBtn').addEventListener('click',()=>toast('เมนูบนมือถือใช้ลิงก์ด้านล่างของหน้าได้'));window.addEventListener('hashchange',route);
function openSearch(){const panel=document.createElement('div');panel.className='search-panel show';panel.id='searchPanel';panel.innerHTML=`<div class="search-card"><div class="section-head"><div><h2>ค้นหางาน</h2><p>ค้นหาชื่อคอนเสิร์ตหรือสถานที่</p></div><button class="btn outline" onclick="closeSearch()">ปิด</button></div><div class="search-row"><input id="searchInput" placeholder="เช่น DELEF FEST"><button class="btn primary" onclick="runSearch()">ค้นหา</button></div><div class="search-results" id="searchResults"></div></div>`;document.body.appendChild(panel);$('#searchInput').focus()}
function closeSearch(){document.getElementById('searchPanel')?.remove()}

function runSearch(){const q=$('#searchInput').value.toLowerCase();const rs=store.events.filter(e=>(e.name+' '+e.venue).toLowerCase().includes(q));$('#searchResults').innerHTML=rs.length?rs.map(e=>`<div class="search-result" onclick="closeSearch();goEvent('${e.id}')"><strong>${e.name}</strong><div class="small">${e.date} · ${e.venue}</div></div>`).join(''):`<div class="empty">ไม่พบงานที่ค้นหา</div>`}
boot();
