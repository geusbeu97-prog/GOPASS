const $ = (selector) => document.querySelector(selector);

const money = (value) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value || 0);

let data = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({
    message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์",
  }));

  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }

  return payload;
}

function toast(message) {
  const element = $("#toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    element.classList.remove("show");
  }, 2200);
}

async function boot() {
  try {
    await api("/api/admin/me");
    await load();
  } catch (error) {
    if (error instanceof TypeError) {
      showLogin("เชื่อมต่อระบบหลังบ้านไม่ได้ กรุณาเปิดผ่าน npm start แล้วเข้า URL ลับของแอดมิน");
      return;
    }

    showLogin();
  }
}

function showLogin(errorMessage = "") {
  document.body.innerHTML = `
    <div class="admin-gate">
      <form class="login-card" id="adminLoginForm">
        <img class="logo" src="assets/gopass-logo.png" alt="GOPASS">
        <div class="login-brand">GOPASS <span>ADMIN</span></div>
        <h1>เข้าสู่ระบบแอดมิน</h1>
        <p>จัดการงานขายบัตร คำสั่งซื้อ และภาพรวมยอดขาย</p>

        <div class="login-error" id="err"></div>

        <div class="field">
          <label for="user">ชื่อผู้ใช้</label>
          <input id="user" autocomplete="username" value="admin">
        </div>

        <div class="field">
          <label for="pass">รหัสผ่าน</label>
          <input
            id="pass"
            type="password"
            autocomplete="current-password"
            placeholder="กรอกรหัสผ่าน"
          >
        </div>

        <button class="btn primary full" type="submit">เข้าสู่ระบบ</button>
        <a class="btn outline full back-home" href="index.html">กลับหน้าเว็บ</a>
      </form>
    </div>
  `;

  const form = $("#adminLoginForm");
  form.addEventListener("submit", login);

  if (errorMessage) showError(errorMessage);
}

function showError(message) {
  const error = $("#err");
  if (!error) return;

  error.textContent = message;
  error.style.display = "block";
}

async function login(event) {
  event.preventDefault();

  const username = $("#user").value.trim();
  const password = $("#pass").value;

  if (!username || !password) {
    showError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    return;
  }

  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    window.location.reload();
  } catch (error) {
    showError(error.message);
  }
}

async function load() {
  try {
    data = await api("/api/admin/sales-summary");
    render("dashboard");
  } catch (error) {
    showLogin(error.message);
  }
}

function totals() {
  const events = data?.events || [];

  return {
    revenue: events.reduce(
      (sum, event) =>
        sum +
        event.tickets.reduce(
          (eventSum, ticket) =>
            eventSum + ticket.price * (ticket.sold || 0),
          0,
        ),
      0,
    ),
    orders: data?.orders?.length || 0,
    sold: events.reduce(
      (sum, event) =>
        sum +
        event.tickets.reduce(
          (eventSum, ticket) => eventSum + (ticket.sold || 0),
          0,
        ),
      0,
    ),
    available: events.reduce(
      (sum, event) =>
        sum +
        event.tickets.reduce(
          (eventSum, ticket) => eventSum + (ticket.remaining || 0),
          0,
        ),
      0,
    ),
  };
}

function render(view) {
  document.body.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-side">
        <div class="admin-brand">
          <img src="assets/gopass-logo.png" alt="GOPASS">
          <div>
            <strong>GOPASS</strong>
            <span>ADMIN</span>
          </div>
        </div>

        <div class="admin-nav">
          <button class="active" data-v="dashboard">ภาพรวม</button>
          <button data-v="events">จัดการงาน</button>
          <button data-v="orders">คำสั่งซื้อ</button>
          <button data-v="analytics">วิเคราะห์ยอดขาย</button>
          <button data-v="settings">ตั้งค่า</button>
        </div>

        <button class="logout" id="logoutBtn">ออกจากระบบ</button>
      </aside>

      <main class="admin-content">
        <div class="admin-head">
          <div>
            <div class="admin-kicker">GOPASS ADMIN</div>
            <h1 id="admTitle">ภาพรวม</h1>
          </div>

          <div class="admin-tools">
            <button class="btn admin-refresh" id="refreshBtn">รีเฟรช</button>
            <a class="btn primary" href="index.html">ไปหน้าเว็บ</a>
          </div>
        </div>

        <div id="adminView"></div>
      </main>
    </div>

    <div id="toast" class="toast"></div>
  `;

  document.querySelectorAll("[data-v]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-v]")
        .forEach((item) => item.classList.remove("active"));

      button.classList.add("active");
      renderView(button.dataset.v);
    });
  });

  $("#refreshBtn").addEventListener("click", load);
  $("#logoutBtn").addEventListener("click", logout);

  renderView(view);
}

function renderView(view) {
  const title = {
    dashboard: "ภาพรวม",
    events: "จัดการงาน",
    orders: "คำสั่งซื้อ",
    analytics: "วิเคราะห์ยอดขาย",
    settings: "ตั้งค่า",
  };

  $("#admTitle").textContent = title[view] || "ภาพรวม";

  if (view === "dashboard") return renderDashboard();
  if (view === "events") return renderEvents();
  if (view === "orders") return renderOrders();
  if (view === "analytics") return renderAnalytics();
  if (view === "settings") return renderSettings();
}

function renderDashboard() {
  const t = totals();

  const eventRows = (data.events || [])
    .map((event) => {
      const revenue = event.tickets.reduce(
        (sum, ticket) => sum + ticket.price * (ticket.sold || 0),
        0,
      );

      return `
        <div class="admin-event">
          <img class="admin-thumb" src="${event.hero}" alt="">
          <div class="grow">
            <b>${event.name}</b>
            <small>${event.date} · ${event.venue}</small>
          </div>
          <div class="admin-money">${money(revenue)}</div>
        </div>
      `;
    })
    .join("");

  const saleRows = (data.events || [])
    .map((event) => {
      const sold = event.tickets.reduce(
        (sum, ticket) => sum + (ticket.sold || 0),
        0,
      );
      const available = event.tickets.reduce(
        (sum, ticket) => sum + (ticket.remaining || 0),
        0,
      );
      const total = sold + available || 1;
      const percent = Math.round((sold / total) * 100);

      return `
        <div class="admin-event">
          <div class="grow">
            <b>${event.name}</b>
            <small>ขายแล้ว ${sold.toLocaleString()} / ${total.toLocaleString()} ใบ</small>
            <div class="progress">
              <i style="width:${percent}%"></i>
            </div>
          </div>
          <b>${percent}%</b>
        </div>
      `;
    })
    .join("");

  $("#adminView").innerHTML = `
    <div class="admin-stat-grid">
      <div class="admin-card admin-stat">
        <div class="label">ยอดขายรวม</div>
        <div class="value">${money(t.revenue)}</div>
        <div class="sub">จากทุกงาน</div>
      </div>

      <div class="admin-card admin-stat">
        <div class="label">บัตรขายแล้ว</div>
        <div class="value">${t.sold.toLocaleString()}</div>
        <div class="sub">เหลือ ${t.available.toLocaleString()} ใบ</div>
      </div>

      <div class="admin-card admin-stat">
        <div class="label">คำสั่งซื้อ</div>
        <div class="value">${t.orders.toLocaleString()}</div>
        <div class="sub">ข้อมูลตัวอย่างในชุด</div>
      </div>

      <div class="admin-card admin-stat">
        <div class="label">จำนวนงาน</div>
        <div class="value">${data.events.length}</div>
        <div class="sub">คอนเสิร์ตและอีเวนต์</div>
      </div>
    </div>

    <div class="admin-grid">
      <div class="admin-card">
        <div class="section-head">
          <div>
            <h2>ยอดขายแยกตามงาน</h2>
            <p>ภาพรวมแต่ละอีเวนต์</p>
          </div>
        </div>
        ${eventRows}
      </div>

      <div class="admin-card">
        <div class="section-head">
          <div>
            <h2>สถานะการขาย</h2>
            <p>จำนวนคงเหลือโดยประมาณ</p>
          </div>
        </div>
        ${saleRows}
      </div>
    </div>
  `;
}

function renderEvents() {
  const cards = (data.events || []).map((event) => `
    <div class="admin-card">
      <div class="admin-event">
        <img class="admin-thumb" src="${event.hero}" alt="">
        <div class="grow">
          <b>${event.name}</b>
          <small>${event.date} · ${event.time || ""} · ${event.venue}</small>
        </div>
        <button class="btn admin-delete-event" data-id="${event.id}" style="color:#b91c1c">ลบงาน</button>
      </div>
      <div class="ticket-admin-list">
        ${(event.tickets || []).map(ticket => `
          <div class="ticket-admin-row">
            <span><b>${ticket.name}</b> · ${money(ticket.price)}</span>
            <span>ขายแล้ว ${ticket.sold || 0} · เหลือ ${ticket.remaining || 0}</span>
          </div>
        `).join("")}
      </div>
      <div class="admin-event" style="margin-top:12px">
        <div class="grow"><small>สถานะ: ${event.status} · ID: ${event.id}</small></div>
        <button class="btn admin-edit-event" data-id="${event.id}">แก้ไข</button>
      </div>
    </div>
  `).join("");

  $("#adminView").innerHTML = `
    <div class="admin-card" style="margin-bottom:18px">
      <div class="section-head">
        <div><h2>เพิ่มงานใหม่</h2><p>สร้างอีเวนต์และกำหนดบัตร ธรรมดา / VIP ได้จากหน้านี้</p></div>
      </div>
      <form id="eventForm">
        <div class="admin-form-grid">
          <input name="name" placeholder="ชื่องาน *" required>
          <input name="date" placeholder="วันที่ เช่น 31 ธ.ค. 2026 *" required>
          <input name="time" placeholder="เวลา เช่น 18:00 น. *" required>
          <input name="venue" placeholder="สถานที่ *" required>
          <input name="category" placeholder="หมวดหมู่" value="คอนเสิร์ต">
          <select name="status">
            <option>กำลังเปิดขาย</option><option>ใกล้เปิดขาย</option><option>ขายหมด</option>
          </select>
          <input name="hero" placeholder="รูปปก เช่น assets/event-banner.png" value="assets/event-banner.png">
          <input name="short" placeholder="คำโปรยสั้น">
          <textarea name="description" placeholder="รายละเอียดงาน"></textarea>
          <input name="artists" placeholder="ศิลปิน คั่นด้วยเครื่องหมาย ,">
        </div>
        <div class="ticket-editor">
          <h3>บัตร</h3>
          <div class="admin-form-grid">
            <input name="normalPrice" type="number" min="0" placeholder="ราคาธรรมดา" value="0">
            <input name="normalStock" type="number" min="0" placeholder="จำนวนธรรมดา" value="0">
            <input name="vipPrice" type="number" min="0" placeholder="ราคา VIP" value="0">
            <input name="vipStock" type="number" min="0" placeholder="จำนวน VIP" value="0">
          </div>
        </div>
        <button class="btn primary" type="submit">+ เพิ่มงาน</button>
      </form>
    </div>
    <div class="admin-grid">${cards || '<div class="admin-card">ยังไม่มีงาน</div>'}</div>
  `;

  $("#eventForm").addEventListener("submit", createEvent);
  document.querySelectorAll(".admin-delete-event").forEach(btn =>
    btn.addEventListener("click", () => deleteEvent(btn.dataset.id))
  );
  document.querySelectorAll(".admin-edit-event").forEach(btn =>
    btn.addEventListener("click", () => editEvent(btn.dataset.id))
  );
}

async function createEvent(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const payload = {
    name: f.get("name"), short: f.get("short"), description: f.get("description"),
    date: f.get("date"), time: f.get("time"), venue: f.get("venue"),
    category: f.get("category"), status: f.get("status"), hero: f.get("hero"),
    artists: String(f.get("artists") || "").split(",").map(x => x.trim()).filter(Boolean),
    tickets: [
      { id:"normal", name:"ธรรมดา", detail:"บัตรทั่วไป", price:Number(f.get("normalPrice")), remaining:Number(f.get("normalStock")) },
      { id:"vip", name:"VIP", detail:"สิทธิพิเศษ", price:Number(f.get("vipPrice")), remaining:Number(f.get("vipStock")) }
    ]
  };
  try {
    await api("/api/admin/events", {method:"POST", body:JSON.stringify(payload)});
    toast("เพิ่มงานสำเร็จ");
    await load();
    document.querySelector('[data-v="events"]')?.click();
  } catch (err) { toast(err.message); }
}

async function deleteEvent(id) {
  const event = (data.events || []).find(e => e.id === id);
  if (!event) return;
  if (!confirm(`ยืนยันลบงาน "${event.name}" ?\nคำสั่งซื้อเก่าจะยังคงอยู่ในระบบ`)) return;
  try {
    await api(`/api/admin/events/${encodeURIComponent(id)}`, {method:"DELETE"});
    toast("ลบงานแล้ว");
    await load();
    document.querySelector('[data-v="events"]')?.click();
  } catch (err) { toast(err.message); }
}

async function editEvent(id) {
  const event = (data.events || []).find(e => e.id === id);
  if (!event) return;
  const name = prompt("ชื่องาน", event.name);
  if (name === null) return;
  const status = prompt("สถานะ", event.status);
  if (status === null) return;
  try {
    await api(`/api/admin/events/${encodeURIComponent(id)}`, {
      method:"PATCH",
      body:JSON.stringify({name, status})
    });
    toast("แก้ไขงานแล้ว");
    await load();
    document.querySelector('[data-v="events"]')?.click();
  } catch (err) { toast(err.message); }
}


function renderOrders() {
  const rows = (data.orders || [])
    .map(
      (order) => `
        <tr>
          <td>${order.id}</td>
          <td>${order.buyer}</td>
          <td>${order.eventName || order.eventId}</td>
          <td>${order.ticketType}</td>
          <td>${order.qty}</td>
          <td>${money(order.amount)}</td>
          <td>
            <span class="status ${
              order.status === "PAID" ? "paid" : "pending"
            }">${order.status}</span>
          </td>
        </tr>
      `,
    )
    .join("");

  $("#adminView").innerHTML = `
    <div class="admin-card">
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>ผู้ซื้อ</th>
              <th>งาน</th>
              <th>ประเภท</th>
              <th>จำนวน</th>
              <th>ยอด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7">ยังไม่มีรายการ</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAnalytics() {
  const events = data.events || [];
  const revenues = events.map((event) =>
    event.tickets.reduce(
      (sum, ticket) => sum + ticket.price * (ticket.sold || 0),
      0,
    ),
  );
  const maxRevenue = Math.max(...revenues, 1);
  const t = totals();

  const bars = events
    .map((event, index) => {
      const revenue = revenues[index];
      return `
        <div class="bar">
          <em>${Math.round((revenue / maxRevenue) * 100)}%</em>
          <i style="height:${Math.max(
            10,
            (revenue / maxRevenue) * 190,
          )}px"></i>
          <span>${event.name}</span>
        </div>
      `;
    })
    .join("");

  const types = ["VIP", "Normal"]
    .map((type) => {
      const sold = events.reduce(
        (sum, event) =>
          sum + (event.tickets.find((ticket) => ticket.name === type)?.sold || 0),
        0,
      );
      const percent = Math.round((sold / (t.sold || 1)) * 100);

      return `
        <div class="admin-event">
          <div class="grow">
            <b>${type}</b>
            <small>${sold.toLocaleString()} ใบ</small>
          </div>
          <b>${percent}%</b>
        </div>
      `;
    })
    .join("");

  $("#adminView").innerHTML = `
    <div class="admin-grid">
      <div class="admin-card">
        <div class="section-head">
          <div>
            <h2>ยอดขายตามงาน</h2>
            <p>มูลค่ารวมโดยประมาณ</p>
          </div>
        </div>
        <div class="bar-chart">${bars}</div>
      </div>

      <div class="admin-card">
        <div class="section-head">
          <div>
            <h2>Ticket Mix</h2>
            <p>รวมทุกงาน</p>
          </div>
        </div>
        ${types}
      </div>
    </div>
  `;
}

function renderSettings() {
  $("#adminView").innerHTML = `
    <div class="admin-card">
      <h2 style="margin-top:0">ตั้งค่าระบบ</h2>

      <div class="admin-event">
        <div class="grow">
          <b>แบรนด์</b>
          <small>ชื่อเว็บไซต์ปัจจุบัน</small>
        </div>
        <b>GOPASS</b>
      </div>

      <div class="admin-event">
        <div class="grow">
          <b>เส้นทาง Admin</b>
          <small>URL ลับ ตั้งค่าผ่าน ADMIN_PATH (ดู README-TH.md) — /admin แบบเดิมถูกปิดแล้ว</small>
        </div>
        <b>พร้อมใช้งาน</b>
      </div>

      <div class="admin-event">
        <div class="grow">
          <b>คำสั่งซื้อ</b>
          <small>บันทึกที่ฝั่งเซิร์ฟเวอร์แล้ว (data/demo.json)</small>
        </div>
        <span class="status paid">LIVE</span>
      </div>

      <div class="admin-event">
        <div class="grow">
          <b>การชำระเงินจริง</b>
          <small>ยังเป็นโหมดตัวอย่าง ต้องเชื่อม Payment Gateway ก่อนใช้งานจริง</small>
        </div>
        <span class="status pending">DEMO</span>
      </div>
    </div>
  `;
}

async function logout() {
  await api("/api/admin/logout", { method: "POST" }).catch(() => {});
  window.location.reload();
}

boot();
