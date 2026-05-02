const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const mesajGecmisi = { 'genel-sohbet': [], 'yazilim': [], 'oyun-odasi': [], 'muzik': [] };
const aktifKullanicilar = {}; 

const kullaniciListesiniGuncelle = (kanalAdi) => {
    const kanaldakiler = Object.values(aktifKullanicilar).filter(k => k.kanal === kanalAdi);
    io.to(kanalAdi).emit('kullanici_listesi', kanaldakiler);
};

io.on('connection', (socket) => {
    console.log(`🟢 Bağlantı sağlandı: ${socket.id}`);

    // Geliştirilmiş Kanala Katılma ve Liste Senkronizasyonu
    socket.on('kanala_katil', (veri) => {
        const { kanalAdi, kullaniciBilgisi } = veri;
        const eskiKanal = aktifKullanicilar[socket.id]?.kanal;
        
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(kanalAdi);
        
        // Kullanıcıyı hafızaya kaydet
        aktifKullanicilar[socket.id] = { 
            ...kullaniciBilgisi, 
            id: socket.id, 
            kanal: kanalAdi 
        };

        if (eskiKanal && eskiKanal !== kanalAdi) kullaniciListesiniGuncelle(eskiKanal);
        kullaniciListesiniGuncelle(kanalAdi);

        if (!mesajGecmisi[kanalAdi]) mesajGecmisi[kanalAdi] = [];
        socket.emit('gecmis_mesajlar', mesajGecmisi[kanalAdi]);
    });

    // Birisi sesli kanala girdiğinde odadakilere "Ben geldim, beni arayın" der
    socket.on('sesli_kanala_katil', (kanalAdi) => {
        socket.join(kanalAdi + "_ses"); // Ses kanalları metin kanallarından farklı bir oda (room) olsun
        // Odadaki diğer kişilere yeni gelenin ID'sini gönder ki onu çaldırsınlar
        socket.to(kanalAdi + "_ses").emit('yeni_kullanici_ses_kanalinda', socket.id);
    });

    // Sesli kanaldan çıkış
    socket.on('sesli_kanaldan_ayril', (kanalAdi) => {
        socket.leave(kanalAdi + "_ses");
        socket.to(kanalAdi + "_ses").emit('kullanici_sesten_ayrildi', socket.id);
    });

    // Arama Teklifi (Offer)
    socket.on('ses_teklifi', (data) => {
        io.to(data.hedef).emit('ses_teklifi', { sdp: data.sdp, gonderen: socket.id });
    });

    // Aramaya Cevap (Answer)
    socket.on('ses_cevabi', (data) => {
        io.to(data.hedef).emit('ses_cevabi', { sdp: data.sdp, gonderen: socket.id });
    });

    // Güvenlik Duvarı Aşma (ICE Candidates)
    socket.on('ice_adayi', (data) => {
        io.to(data.hedef).emit('ice_adayi', { aday: data.aday, gonderen: socket.id });
    });

    socket.on('mesaj_gonder', (data) => {
        if (!mesajGecmisi[data.kanal]) mesajGecmisi[data.kanal] = [];
        mesajGecmisi[data.kanal].push(data);
        if (mesajGecmisi[data.kanal].length > 50) mesajGecmisi[data.kanal].shift();
        
        io.to(data.kanal).emit('mesaj_al', data);
    });

    socket.on('disconnect', () => {
        const kanal = aktifKullanicilar[socket.id]?.kanal;
        delete aktifKullanicilar[socket.id]; 
        if (kanal) kullaniciListesiniGuncelle(kanal); 
    });
});

// Port ayarı güncellendi
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Fütüristik Sunucu ${PORT} portunda aktif.`));