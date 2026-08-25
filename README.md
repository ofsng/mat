# mat — günlük ders arayüzü

Ömer'in matematik ve İngilizce öğrenme sisteminin web yüzü.
Açarsın, o günkü konu anlatılmaya başlar, cevap yazarsın.
Telefon, tablet, bilgisayar — fark etmez.

Müfredat ve öğretim protokolü ayrı depoda üretilir
(`~/Masaüstü/matematik`); bu depo yalnız arayüzdür.

---

## Kurulum (bir kez, ~5 dakika)

### 1. Vercel'e bağla

[vercel.com](https://vercel.com) → **Add New → Project** → GitHub'dan
`ofsng/mat` deposunu seç → **Deploy**.

Ayar değiştirmen gerekmez; framework yok, derleme yok.

### 2. API anahtarını gir

Dağıtım bitince: **Settings → Environment Variables**

| Alan | Değer |
| --- | --- |
| Name | `OPENROUTER_API_KEY` |
| Value | OpenRouter anahtarın (`sk-or-v1-…`) |
| Environments | Production, Preview, Development — hepsi işaretli |

**Save** → **Deployments** sekmesi → en üstteki dağıtımda **⋯ → Redeploy**.

> Anahtar yalnız sunucuda durur. Tarayıcıya hiç gitmez, koda gömülü
> değildir, depoda yazılı değildir.

### 3. Aç

Vercel'in verdiği adresi (`https://mat-….vercel.app`) telefonda aç,
ana ekrana kısayol olarak ekle.

---

## Kullanım

Açtığında o günkü konu yüklenir ve ders kendiliğinden başlar.
Cevabını yaz, gönder. Sohbet cihazda saklanır — kapatıp sonra
devam edebilirsin.

**⚙ düğmesi:**

| Ayar | Ne işe yarar |
| --- | --- |
| Model | Hangi modelin öğreteceği (fiyatlar aşağıda) |
| Konu | Sıradaki konu yerine başka bir konuya geçme |
| Sohbeti temizle | O konuyu baştan anlattırma |
| Harcamayı sıfırla | Sayacı sıfırlama (OpenRouter bakiyesini değiştirmez) |

Alt satırda o cihazda harcanan token ve dolar görünür.

---

## Maliyet

Fiyatlar dolar / milyon token:

| Model | Girdi | Çıktı | Ders başına (~) |
| --- | ---: | ---: | ---: |
| DeepSeek v3.2 *(varsayılan)* | 0.26 | 0.38 | ~$0.05 |
| Llama 3.3 70B | 0.10 | 0.32 | ~$0.04 |
| GPT-4o mini | 0.15 | 0.60 | ~$0.05 |
| Claude 3.5 Haiku | 0.80 | 4.00 | ~$0.30 |

5 dolarlık bakiye DeepSeek ile kabaca **100 ders** eder.

**Tasarruf nasıl sağlanıyor:**

- Modele tüm müfredat değil, yalnız o günkü konunun verisi gider (~600 token)
- Sohbet geçmişi son 12 mesaja kırpılır
- Yanıt uzunluğu 1400 token ile sınırlı
- Sistem istemi kısa tutulmuş, "uzun duvar yazma" talimatı var

---

## Müfredatı güncelleme

İlerleme kaydedildikçe veya yeni ders yazıldıkça:

```bash
cd ~/Masaüstü/matematik
python3 araclar/disari-aktar        # veri/mufredat.json'u yeniler
cd ~/Masaüstü/mat
git add -A && git commit -m "veri: müfredat güncellendi" && git push
```

Vercel push'u görüp kendiliğinden yeniden dağıtır.

---

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `index.html` | Tek sayfa |
| `stil.css` | Görünüm — açık/koyu tema |
| `app.js` | Sohbet, akış, markdown, harcama sayacı |
| `api/ders.js` | Vercel Edge fonksiyonu — OpenRouter vekili, sistem istemi |
| `veri/mufredat.json` | Müfredat + ilerleme (matematik deposundan üretilir) |

Bağımlılık yok, `npm install` yok, derleme yok.

---

## Sorun giderme

| Belirti | Sebep |
| --- | --- |
| "OPENROUTER_API_KEY tanımlı değil" | Değişken eklenmemiş ya da eklendikten sonra redeploy yapılmamış |
| "anahtar geçersiz veya iptal edilmiş" | Anahtar silinmiş — yenisini oluştur, değişkeni güncelle, redeploy |
| "bakiye bitmiş" | OpenRouter hesabına yükleme gerekiyor |
| "hız sınırı" | Birkaç saniye bekle |
| Ders başlamıyor, ekran boş | Tarayıcı konsolunu aç; `veri/mufredat.json` yüklenememiş olabilir |
