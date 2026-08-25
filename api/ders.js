// Vercel Edge Function — OpenRouter vekili.
//
// API anahtarı YALNIZ ortam değişkeninde durur: OPENROUTER_API_KEY.
// Koda gömülmez, istemciye gönderilmez, günlüğe yazılmaz.
//
// TASARRUF: İstem yalnız AKTİF konunun verisini taşır (~600 token),
// tüm müfredatı değil. Geçmiş son 12 mesaja kırpılır.

export const config = { runtime: "edge" };

const UC_NOKTA = "https://openrouter.ai/api/v1/chat/completions";
const GECMIS_SINIRI = 12;

function sistemIstemi(konu, plan, bolum) {
  const s = [];
  s.push(
    "Sen Ömer'in özel öğretmenisin. Türkçe konuşursun. Teknik terimleri " +
      "ilk geçtiklerinde parantez içinde İngilizcesiyle verirsin."
  );
  s.push(
    `BUGÜNKÜ KONU: ${konu.ad} — ${konu.ders} · bölüm ${bolum}/${konu.bolum_sayisi}`
  );
  if (plan) s.push(`Bu bölümün hedefi: ${plan}`);
  if (konu.kapsam?.length) s.push(`Kapsam: ${konu.kapsam.join(" · ")}`);
  if (konu.anahtar_kavramlar?.length) {
    const kv = konu.anahtar_kavramlar
      .map((k) => `${k.tr}${k.en ? ` (${k.en})` : ""}`)
      .join(", ");
    s.push(`Anahtar kavramlar: ${kv}`);
  }
  if (konu.somutlastirma?.length) {
    s.push(
      "SOMUTLAŞTIRMA — bunları kullan:\n" +
        konu.somutlastirma
          .map((x) => `• ${x.strateji}: ${(x.aciklama || "").trim()}`)
          .join("\n")
    );
  }
  if (konu.benzetme_kirilma) {
    s.push(
      "BU BENZETME NEREDE KIRILIR (söylemek ZORUNLU):\n" + konu.benzetme_kirilma
    );
  }
  if (konu.sik_hatalar?.length) {
    s.push(
      "Sık yapılan hatalar:\n" + konu.sik_hatalar.map((h) => `• ${h}`).join("\n")
    );
  }
  if (konu.ustalik_sorusu) {
    s.push("Ustalık sorusu (sona sakla):\n" + konu.ustalik_sorusu);
  }

  s.push(`NASIL ÖĞRETİRSİN — sırayla, her mesajda TEK adım:
1. Tek cümlelik tanım + tek örnek
2. Mekanizma: bu kavram hangi problemi çözmek için doğdu, nasıl işler, ne söyler
3. Teknik tanım — bir mesajda en fazla 3 yeni sembol
4. Somut model, ardından modelin nerede yalan söylediği (yukarıdaki kırılma noktası)
5. En çok karıştırılan komşu kavramla kontrast
6. Bir tam çözülmüş örnek — her adımın GEREKÇESİYLE
7. Üç alıştırma, azalan destekle: son adım eksik → yarısı eksik → sadece strateji.
   BURADA DUR ve cevabını bekle.
8. Cevap geldikten sonra: bağımsız soru, sonra transfer sorusu
9. Kapanış: tek kartlık özet`);

  s.push(`KURALLAR:
• Bağımsız sorunun cevabını Ömer bir deneme yazmadan ASLA verme. İsterse "ilk adımını yaz" de.
• Yanlış cevapta İLK yanlış adımı bul. Aynı açıklamayı tekrarlama; eksik önkoşulu bir kat aç.
• "Anladın mı?" diye sorup "evet" cevabını kanıt sayma. Soru sor, cevabını gör.
• Benzetme verip kırılma noktasını söylememek yasak.
• Ömer lise matematiğinin tamamını biliyor, üniversite matematiğini bilmiyor.
• KISA TUT. Telefondan okuyor. Bir mesaj = bir adım. Uzun duvarlar yazma.
• Selamlama yapma, doğrudan konuya gir.`);

  return s.join("\n\n");
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const anahtar = process.env.OPENROUTER_API_KEY;
  if (!anahtar) {
    return Response.json(
      {
        hata:
          "OPENROUTER_API_KEY tanımlı değil. Vercel → Settings → " +
          "Environment Variables bölümünden ekleyip yeniden dağıtın.",
      },
      { status: 500 }
    );
  }

  let govde;
  try {
    govde = await req.json();
  } catch {
    return Response.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { konu, plan, bolum = 1, gecmis = [], model } = govde;
  if (!konu?.ad) {
    return Response.json({ hata: "Konu verisi eksik." }, { status: 400 });
  }

  const mesajlar = [
    { role: "system", content: sistemIstemi(konu, plan, bolum) },
    ...gecmis.slice(-GECMIS_SINIRI).map((m) => ({
      role: m.rol === "ben" ? "user" : "assistant",
      content: String(m.metin || "").slice(0, 8000),
    })),
  ];

  let yanit;
  try {
    yanit = await fetch(UC_NOKTA, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anahtar}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/ofsng/mat",
        "X-Title": "Omer Ders",
      },
      body: JSON.stringify({
        model: model || "deepseek/deepseek-v3.2",
        messages: mesajlar,
        stream: true,
        max_tokens: 1400,
        usage: { include: true },
      }),
    });
  } catch (e) {
    return Response.json(
      { hata: "OpenRouter'a ulaşılamadı: " + e.message },
      { status: 502 }
    );
  }

  if (!yanit.ok) {
    const metin = await yanit.text();
    let mesaj = metin.slice(0, 400);
    try {
      mesaj = JSON.parse(metin)?.error?.message || mesaj;
    } catch {}
    const ipucu =
      yanit.status === 401
        ? " — anahtar geçersiz veya iptal edilmiş"
        : yanit.status === 402
        ? " — bakiye bitmiş"
        : yanit.status === 429
        ? " — hız sınırı, biraz bekleyin"
        : "";
    return Response.json({ hata: mesaj + ipucu }, { status: yanit.status });
  }

  return new Response(yanit.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
