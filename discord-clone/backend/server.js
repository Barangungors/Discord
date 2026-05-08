const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const mongoURI = "mongodb+srv://barangungors:Selamun14!@sensei.ruwmpft.mongodb.net/discord-clone?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
  .then(() => console.log('📦 MongoDB Veritabanına Başarıyla Bağlanıldı!'))
  .catch((err) => console.log('❌ MongoDB Bağlantı Hatası:', err));

const kullaniciSemasi = new mongoose.Schema({
  kullaniciAdi: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  sifre: { type: String, required: true },
  avatarRenk: { type: String, default: '#5865F2' },
  avatarResmi: { type: String, default: '' } 
});
const Kullanici = mongoose.model('Kullanici', kullaniciSemasi);

const odaSemasi = new mongoose.Schema({
  isim: { type: String, required: true, unique: true },
  tip: { type: String, enum: ['public', 'private'], default: 'public' },
  sifre: { type: String, default: null },
  olusturan: { type: String }
});
const Oda = mongoose.model('Oda', odaSemasi);

app.post('/api/kayit', async (req, res) => {
  try {
    const { kullaniciAdi, email, sifre } = req.body;
    const varMi = await Kullanici.findOne({ $or: [{ email }, { kullaniciAdi }] });
    if (varMi) return res.status(400).json({ hata: "Bu e-posta veya kod adı zaten kullanımda." });

    const sifrelenmisSifre = await bcrypt.hash(sifre, 10);
    const yeniKullanici = new Kullanici({ kullaniciAdi, email, sifre: sifrelenmisSifre });
    await yeniKullanici.save();
    res.status(201).json({ mesaj: "Kayıt işlemi başarılı!" });
  } catch (err) { res.status(500).json({ hata: "Sunucu hatası." }); }
});

app.post('/api/giris', async (req, res) => {
  try {
    const { identifier, sifre } = req.body; 
    const kullanici = await Kullanici.findOne({ $or: [{ email: identifier }, { kullaniciAdi: identifier }] });
    if (!kullanici) return res.status(404).json({ hata: "Ajan bulunamadı." });

    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) return res.status(400).json({ hata: "Şifre hatalı." });

    res.status(200).json({ kullaniciAdi: kullanici.kullaniciAdi, avatarRenk: kullanici.avatarRenk, avatarResmi: kullanici.avatarResmi, email: kullanici.email });
  } catch (err) { res.status(500).json({ hata: "Sunucu hatası." }); }
});

app.post('/api/avatar-guncelle', async (req, res) => {
  try {
    const { email, avatarResmi } = req.body;
    await Kullanici.findOneAndUpdate({ email }, { avatarResmi });
    res.status(200).json({ mesaj: "Profil güncellendi" });
  } catch (err) { res.status(500).json({ hata: "Sunucu hatası." }); }
});

app.get('/api/odalar', async (req, res) => {
  try {
    const odalar = await Oda.find({}, '-sifre');
    res.status(200).json(odalar);
  } catch (err) { res.status(500).json({ hata: "Odalar yüklenemedi." }); }
});

app.post('/api/oda-olustur', async (req, res) => {
  try {
    const { isim, tip, sifre, olusturan } = req.body;
    const varMi = await Oda.findOne({ isim });
    if (varMi) return res.status(400).json({ hata: "Bu isimde bir oda zaten var." });

    let kaydedilecekSifre = null;
    if (tip === 'private' && sifre) kaydedilecekSifre = await bcrypt.hash(sifre, 10);

    const yeniOda = new Oda({ isim, tip, sifre: kaydedilecekSifre, olusturan });
    await yeniOda.save();
    
    const guncelOdalar = await Oda.find({}, '-sifre');
    io.emit('odalar_guncellendi', guncelOdalar);
    res.status(201).json({ mesaj: "Oda oluşturuldu!" });
  } catch (err) { res.status(500).json({ hata: "Oda oluşturulamadı." }); }
});

app.post('/api/oda-giris', async (req, res) => {
  try {
    const { isim, sifre } = req.body;
    const oda = await Oda.findOne({ isim });
    if (!oda || oda.tip !== 'private') return res.status(400).json({ hata: "Geçersiz işlem." });

    const sifreDogruMu = await bcrypt.compare(sifre, oda.sifre);
    if (!sifreDogruMu) return res.status(400).json({ hata: "Oda şifresi hatalı!" });
    res.status(200).json({ mesaj: "Giriş onaylandı." });
  } catch (err) { res.status(500).json({ hata: "Sunucu hatası." }); }
});

const mesajGecmisi = { 'genel-sohbet': [], 'yazilim': [], 'oyun-odasi': [], 'muzik': [] };
const aktifKullanicilar = {}; 
const sestekiKullanicilar = {}; 

const kullaniciListesiniGuncelle = (kanalAdi) => {
    const kanaldakiler = Object.values(aktifKullanicilar).filter(k => k.kanal === kanalAdi);
    io.to(kanalAdi).emit('kullanici_listesi', kanaldakiler);
};
const sestekileriYayinla = () => io.emit('sesteki_kullanicilar', Object.values(sestekiKullanicilar));

io.on('connection', (socket) => {
    socket.on('kanala_katil', (veri) => {
        const { kanalAdi, kullaniciBilgisi } = veri;
        const eskiKanal = aktifKullanicilar[socket.id]?.kanal;
        Array.from(socket.rooms).forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(kanalAdi);
        aktifKullanicilar[socket.id] = { ...kullaniciBilgisi, id: socket.id, kanal: kanalAdi };
        if (eskiKanal && eskiKanal !== kanalAdi) kullaniciListesiniGuncelle(eskiKanal);
        kullaniciListesiniGuncelle(kanalAdi);
        if (!mesajGecmisi[kanalAdi]) mesajGecmisi[kanalAdi] = [];
        socket.emit('gecmis_mesajlar', mesajGecmisi[kanalAdi]);
    });

    socket.on('sesli_kanala_katil', ({ kanalAdi, kullaniciBilgisi }) => {
        socket.join(kanalAdi + "_ses"); 
        sestekiKullanicilar[socket.id] = { ...kullaniciBilgisi, kanal: kanalAdi, socketId: socket.id };
        sestekileriYayinla();
        socket.to(kanalAdi + "_ses").emit('yeni_kullanici_ses_kanalinda', socket.id);
    });

    socket.on('sesli_kanaldan_ayril', (kanalAdi) => {
        socket.leave(kanalAdi + "_ses");
        delete sestekiKullanicilar[socket.id];
        sestekileriYayinla();
        socket.to(kanalAdi + "_ses").emit('kullanici_sesten_ayrildi', socket.id);
    });

    socket.on('ses_teklifi', (data) => io.to(data.hedef).emit('ses_teklifi', { sdp: data.sdp, gonderen: socket.id }));
    socket.on('ses_cevabi', (data) => io.to(data.hedef).emit('ses_cevabi', { sdp: data.sdp, gonderen: socket.id }));
    socket.on('ice_adayi', (data) => io.to(data.hedef).emit('ice_adayi', { aday: data.aday, gonderen: socket.id }));

    socket.on('yaziyor', ({ kanal, kullaniciAdi }) => socket.to(kanal).emit('kullanici_yaziyor', kullaniciAdi));
    socket.on('yazmayi_birakti', ({ kanal, kullaniciAdi }) => socket.to(kanal).emit('kullanici_yazmayi_birakti', kullaniciAdi));

    socket.on('mesaj_gonder', (data) => {
        data.mesajId = Date.now().toString() + Math.random().toString(36).substr(2, 5); 
        if (!mesajGecmisi[data.kanal]) mesajGecmisi[data.kanal] = [];
        mesajGecmisi[data.kanal].push(data);
        if (mesajGecmisi[data.kanal].length > 100) mesajGecmisi[data.kanal].shift();
        io.to(data.kanal).emit('mesaj_al', data);
    });

    socket.on('mesaj_sil', ({ kanal, mesajId }) => {
        if(mesajGecmisi[kanal]) {
            mesajGecmisi[kanal] = mesajGecmisi[kanal].filter(m => m.mesajId !== mesajId);
            io.to(kanal).emit('mesaj_silindi', mesajId);
        }
    });

    // YENİ: HAYALET SES SİSTEMİ (Sohbete yansımadan sadece anlık ses çaldırır)
    socket.on('ses_cal_gizli', (data) => {
        // Bunu mesaj geçmişine KAYDETMİYORUZ! Sadece anlık olarak odadakilere iletiyoruz.
        io.to(data.kanal).emit('ses_calindi_gizli', data.url);
    });

    socket.on('disconnect', () => {
        const kanal = aktifKullanicilar[socket.id]?.kanal;
        delete aktifKullanicilar[socket.id]; 
        if (kanal) kullaniciListesiniGuncelle(kanal); 
        
        if (sestekiKullanicilar[socket.id]) {
            socket.to(sestekiKullanicilar[socket.id].kanal + "_ses").emit('kullanici_sesten_ayrildi', socket.id);
            delete sestekiKullanicilar[socket.id];
            sestekileriYayinla();
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Fütüristik Sunucu ${PORT} portunda aktif.`));
