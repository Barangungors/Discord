const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // Mongoose eklendi

const app = express();
app.use(cors());
app.use(express.json()); // Sunucunun JSON verilerini okuyabilmesi için

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- MONGODB BAĞLANTISI ---
const mongoURI = "mongodb+srv://barangungors:Selamun14!@sensei.ruwmpft.mongodb.net/discord-clone?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
  .then(() => console.log('📦 MongoDB Veritabanına Başarıyla Bağlanıldı!'))
  .catch((err) => console.log('❌ MongoDB Bağlantı Hatası:', err));


// -- Eski Soket Kodlarımız --
const mesajGecmisi = { 'genel-sohbet': [], 'yazilim': [], 'oyun-odasi': [], 'muzik': [] };
const aktifKullanicilar = {}; 

const kullaniciListesiniGuncelle = (kanalAdi) => {
    const kanaldakiler = Object.values(aktifKullanicilar).filter(k => k.kanal === kanalAdi);
    io.to(kanalAdi).emit('kullanici_listesi', kanaldakiler);
};

io.on('connection', (socket) => {
    console.log(`🟢 Bağlantı sağlandı: ${socket.id}`);

    socket.on('kanala_katil', (veri) => {
        const { kanalAdi, kullaniciBilgisi } = veri;
        const eskiKanal = aktifKullanicilar[socket.id]?.kanal;
        
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(kanalAdi);
        
        aktifKullanicilar[socket.id] = { ...kullaniciBilgisi, id: socket.id, kanal: kanalAdi };

        if (eskiKanal && eskiKanal !== kanalAdi) kullaniciListesiniGuncelle(eskiKanal);
        kullaniciListesiniGuncelle(kanalAdi);

        if (!mesajGecmisi[kanalAdi]) mesajGecmisi[kanalAdi] = [];
        socket.emit('gecmis_mesajlar', mesajGecmisi[kanalAdi]);
    });

    socket.on('sesli_kanala_katil', (kanalAdi) => {
        socket.join(kanalAdi + "_ses"); 
        socket.to(kanalAdi + "_ses").emit('yeni_kullanici_ses_kanalinda', socket.id);
    });

    socket.on('sesli_kanaldan_ayril', (kanalAdi) => {
        socket.leave(kanalAdi + "_ses");
        socket.to(kanalAdi + "_ses").emit('kullanici_sesten_ayrildi', socket.id);
    });

    socket.on('ses_teklifi', (data) => io.to(data.hedef).emit('ses_teklifi', { sdp: data.sdp, gonderen: socket.id }));
    socket.on('ses_cevabi', (data) => io.to(data.hedef).emit('ses_cevabi', { sdp: data.sdp, gonderen: socket.id }));
    socket.on('ice_adayi', (data) => io.to(data.hedef).emit('ice_adayi', { aday: data.aday, gonderen: socket.id }));

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Fütüristik Sunucu ${PORT} portunda aktif.`));
