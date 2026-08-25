/* Ömer'in ders arayüzü — istemci mantığı.
   Bağımlılık yok, derleme yok. Durum tarayıcıda (localStorage).

   TASARRUF: Sunucuya yalnız aktif konunun verisi + son 12 mesaj gider.
   Her yanıttan sonra gerçek token kullanımı okunup harcama gösterilir. */

const $ = (s) => document.querySelector(s);

// OpenRouter fiyatları — dolar / milyon token (girdi, çıktı)
const FIYAT = {
  "deepseek/deepseek-v3.2": [0.26, 0.38],
  "openai/gpt-4o-mini": [0.15, 0.6],
  "meta-llama/llama-3.3-70b-instruct": [0.1, 0.32],
  "anthropic/claude-3.5-haiku": [0.8, 4.0],
};

const AY = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
            "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

let VERI = null;
let konuId = null;
let gecmis = [];
let akisSuruyor = false;

/* ---------- yerel saklama ---------- */
const yaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const oku = (k, v) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : v; } catch { return v; } };

/* ---------- güvenli markdown ---------- */
function kacir(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function satiriBicimle(s) {
  return s
    .replace(/`([^`\n]+)`/g, (_, k) => `<code>${k}</code>`)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, "$1<em>$2</em>");
}

function markdown(ham) {
  const metin = kacir(ham);
  const parcalar = metin.split(/```/);
  let cikti = "";

  parcalar.forEach((parca, i) => {
    if (i % 2 === 1) {
      const govde = parca.replace(/^[a-zA-Z0-9-]*\n/, "");
      cikti += `<pre><code>${govde.replace(/\n$/, "")}</code></pre>`;
      return;
    }
    let liste = null;
    for (const satir of parca.split("\n")) {
      const s = satir.trim();
      const madde = s.match(/^[-*•]\s+(.*)$/);
      const sirali = s.match(/^(\d+)[.)]\s+(.*)$/);

      if (madde || sirali) {
        const tur = madde ? "ul" : "ol";
        if (liste !== tur) { if (liste) cikti += `</${liste}>`; cikti += `<${tur}>`; liste = tur; }
        cikti += `<li>${satiriBicimle(madde ? madde[1] : sirali[2])}</li>`;
        continue;
      }
      if (liste) { cikti += `</${liste}>`; liste = null; }

      if (!s) continue;
      const baslik = s.match(/^(#{1,6})\s+(.*)$/);
      if (baslik) { cikti += `<h3>${satiriBicimle(baslik[2])}</h3>`; continue; }
      if (/^(---+|___+|\*\*\*+)$/.test(s)) { cikti += "<hr>"; continue; }
      const alinti = s.match(/^&gt;\s?(.*)$/);
      if (alinti) { cikti += `<blockquote>${satiriBicimle(alinti[1])}</blockquote>`; continue; }
      cikti += `<p>${satiriBicimle(s)}</p>`;
    }
    if (liste) cikti += `</${liste}>`;
  });
  return cikti;
}

/* ---------- arayüz ---------- */
function mesajEkle(rol, metin) {
  const d = document.createElement("div");
  d.className = "mesaj " + rol;
  d.innerHTML = rol === "hoca" ? markdown(metin) : `<p>${kacir(metin)}</p>`;
  $("#akis").append(d);
  asagiKay();
  return d;
}

function asagiKay() {
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
}

function harcamayiGoster() {
  const h = oku("harcama", { girdi: 0, cikti: 0, usd: 0, tur: 0 });
  $("#harcama").textContent = h.tur
    ? `Bu cihazda: ${h.tur} yanıt · ${(h.girdi + h.cikti).toLocaleString("tr")} token · ` +
      `$${h.usd.toFixed(4)} (kalan ≈ $${Math.max(0, 5 - h.usd).toFixed(2)})`
    : "Bu cihazda harcanan: henüz yok";
}

function harcamaEkle(kullanim, model) {
  const [gf, cf] = FIYAT[model] || [0.3, 0.5];
  const g = kullanim?.prompt_tokens || 0;
  const c = kullanim?.completion_tokens || 0;
  const h = oku("harcama", { girdi: 0, cikti: 0, usd: 0, tur: 0 });
  h.girdi += g; h.cikti += c; h.tur += 1;
  h.usd += (g / 1e6) * gf + (c / 1e6) * cf;
  yaz("harcama", h);
  harcamayiGoster();
}

function basligiKur() {
  const detay = VERI.detay[konuId];
  if (!detay) return;
  $("#ders").textContent = detay.ders;
  $("#baslik").textContent = detay.ad;
  $("#baslik").title = detay.ad;
  const b = konuId === VERI.aktif.konu ? VERI.aktif.bolum : 1;
  const g = new Date();
  $("#altbilgi").textContent =
    `${g.getDate()} ${AY[g.getMonth()]} · bölüm ${b}/${detay.bolum_sayisi} · 120 dakika`;
  document.title = detay.ad;
}

function konuListesiniKur() {
  const sec = $("#konu-sec");
  sec.innerHTML = "";
  for (const ders of VERI.dersler) {
    const grup = document.createElement("optgroup");
    grup.label = ders.ad;
    for (const k of ders.konular) {
      const o = document.createElement("option");
      o.value = k.id;
      const sv = VERI.seviyeler[k.id] || 0;
      o.textContent = (sv >= 3 ? "✓ " : "") + k.ad;
      grup.append(o);
    }
    sec.append(grup);
  }
  sec.value = konuId;
}

/* ---------- akış ---------- */
async function gonder(metin) {
  if (akisSuruyor) return;
  const detay = VERI.detay[konuId];
  if (!detay) return;

  akisSuruyor = true;
  $("#gonder").disabled = true;

  if (metin) {
    gecmis.push({ rol: "ben", metin });
    mesajEkle("ben", metin);
  }

  const kutu = mesajEkle("hoca", "");
  kutu.classList.add("imlec");

  const bolum = konuId === VERI.aktif.konu ? VERI.aktif.bolum : 1;
  const planKaydi = VERI.planlar[konuId];
  let plan = "";
  if (planKaydi?.dilimler) {
    const d = planKaydi.dilimler.find((x) => (x.dilim ?? x.sira ?? 1) === bolum);
    plan = (d?.hedef || "").trim();
  }
  const model = $("#model").value;
  let toplam = "";

  try {
    const y = await fetch("/api/ders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ konu: detay, plan, bolum, gecmis, model }),
    });

    if (!y.ok) {
      const j = await y.json().catch(() => ({}));
      throw new Error(j.hata || `Sunucu hatası (${y.status})`);
    }

    const okuyucu = y.body.getReader();
    const cozucu = new TextDecoder();
    let tampon = "";

    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      tampon += cozucu.decode(value, { stream: true });
      const satirlar = tampon.split("\n");
      tampon = satirlar.pop() || "";

      for (const satir of satirlar) {
        if (!satir.startsWith("data: ")) continue;
        const veri = satir.slice(6).trim();
        if (veri === "[DONE]") continue;
        let j;
        try { j = JSON.parse(veri); } catch { continue; }
        const p = j.choices?.[0]?.delta?.content;
        if (p) {
          toplam += p;
          kutu.innerHTML = markdown(toplam);
          asagiKay();
        }
        if (j.usage) harcamaEkle(j.usage, model);
      }
    }

    if (!toplam.trim()) throw new Error("Model boş yanıt döndü. Tekrar deneyin.");
    gecmis.push({ rol: "hoca", metin: toplam });
    yaz("sohbet:" + konuId, gecmis);
  } catch (e) {
    kutu.remove();
    mesajEkle("sistem hata", e.message);
  } finally {
    kutu.classList.remove("imlec");
    akisSuruyor = false;
    $("#gonder").disabled = false;
  }
}

/* ---------- kurulum ---------- */
async function baslat() {
  try {
    VERI = await (await fetch("/veri/mufredat.json")).json();
  } catch {
    mesajEkle("sistem hata", "Müfredat dosyası yüklenemedi.");
    return;
  }

  konuId = oku("konu", null) || VERI.aktif.konu;
  if (!VERI.detay[konuId]) konuId = VERI.aktif.konu;

  $("#model").value = oku("model", "deepseek/deepseek-v3.2");
  basligiKur();
  konuListesiniKur();
  harcamayiGoster();

  gecmis = oku("sohbet:" + konuId, []);
  if (gecmis.length) {
    for (const m of gecmis) mesajEkle(m.rol === "ben" ? "ben" : "hoca", m.metin);
  } else {
    mesajEkle("sistem", "Ders başlıyor…");
    gonder("");
  }
}

/* ---------- olaylar ---------- */
$("#menu").addEventListener("click", () => {
  const a = $("#ayarlar");
  a.hidden = !a.hidden;
  $("#menu").setAttribute("aria-expanded", String(!a.hidden));
});

$("#model").addEventListener("change", (e) => yaz("model", e.target.value));

$("#konu-sec").addEventListener("change", (e) => {
  konuId = e.target.value;
  yaz("konu", konuId);
  gecmis = oku("sohbet:" + konuId, []);
  $("#akis").innerHTML = "";
  basligiKur();
  $("#ayarlar").hidden = true;
  $("#menu").setAttribute("aria-expanded", "false");
  if (gecmis.length) {
    for (const m of gecmis) mesajEkle(m.rol === "ben" ? "ben" : "hoca", m.metin);
  } else {
    gonder("");
  }
});

$("#sifirla").addEventListener("click", () => {
  if (!confirm("Bu konunun sohbeti silinsin mi?")) return;
  gecmis = [];
  yaz("sohbet:" + konuId, []);
  $("#akis").innerHTML = "";
  $("#ayarlar").hidden = true;
  gonder("");
});

$("#harcama-sifirla").addEventListener("click", () => {
  yaz("harcama", { girdi: 0, cikti: 0, usd: 0, tur: 0 });
  harcamayiGoster();
});

const metinKutusu = $("#metin");
function boyutAyarla() {
  metinKutusu.style.height = "auto";
  metinKutusu.style.height = Math.min(metinKutusu.scrollHeight, window.innerHeight * 0.4) + "px";
}
metinKutusu.addEventListener("input", boyutAyarla);
metinKutusu.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width:768px)").matches) {
    e.preventDefault();
    $("#giris").requestSubmit();
  }
});

$("#giris").addEventListener("submit", (e) => {
  e.preventDefault();
  const m = metinKutusu.value.trim();
  if (!m || akisSuruyor) return;
  metinKutusu.value = "";
  boyutAyarla();
  gonder(m);
});

baslat();
