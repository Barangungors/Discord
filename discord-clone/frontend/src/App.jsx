import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const backendURL = 'https://discord-iifa.onrender.com';
const socket = io(backendURL);

const METIN_KANALLARI = ['genel-sohbet', 'yazilim', 'oyun-odasi', 'muzik'];
const SABIT_SES_KANALLARI = ['Lobi', 'Oyun Ses', 'Sohbet Odası'];

const SES_BAGLANDI = new Audio('https://actions.google.com/sounds/v1/ui/communication_channel_open.ogg');
const SES_AYRILDI = new Audio('https://actions.google.com/sounds/v1/ui/communication_channel_close.ogg');
const SES_PING = new Audio('https://actions.google.com/sounds/v1/alarms/pop_up.ogg');
SES_BAGLANDI.volume = 0.5; SES_AYRILDI.volume = 0.5; SES_PING.volume = 0.7;

const POPULER_EMOJILER = ['😀','😂','😍','😎','😭','😡','👍','🔥','❤️','🎉','✨','💀','👀','🤔','💯','🙌','👏','🤦‍♂️','😘','😁'];

const SOUNDBOARD_SESLERI = [
  { id: 'airhorn', isim: 'Airhorn', ikon: '📢', url: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3' },
  { id: 'vineboom', isim: 'Vine Boom', ikon: '💥', url: 'https://www.myinstants.com/media/sounds/vine-boom.mp3' },
  { id: 'cricket', isim: 'Cırcır Böceği', ikon: '🦗', url: 'https://www.myinstants.com/media/sounds/crickets.mp3' },
  { id: 'sadtrombone', isim: 'Sad Trombone', ikon: '🎺', url: 'https://www.myinstants.com/media/sounds/sadtrombone.mp3' },
  { id: 'anime-wow', isim: 'Anime Wow', ikon: '😲', url: 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3' },
  { id: 'dun-dun', isim: 'Ba Dum Tss', ikon: '🥁', url: 'https://www.myinstants.com/media/sounds/ba-dum-tsss.mp3' },
  { id: 'bruh', isim: 'Bruh', ikon: '🤦', url: 'https://www.myinstants.com/media/sounds/movie_1.mp3' },
  { id: 'fart', isim: 'Reverb Fart', ikon: '💨', url: 'https://www.myinstants.com/media/sounds/reverb-fart.mp3' }
];

const KOMUTLAR = [
  { komut: '/zar', aciklama: '1 ile 6 arasında rastgele zar atar.' },
  { komut: '/yazitura', aciklama: 'Yazı mı tura mı atar.' }
];

function App() {
  const [kayitModu, setKayitModu] = useState(false); 
  const [email, setEmail] = useState(''); 
  const [sifre, setSifre] = useState('');
  const [kullaniciAdiInput, setKullaniciAdiInput] = useState('');
  const [hataMesaji, setHataMesaji] = useState('');

  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [girisYapildi, setGirisYapildi] = useState(false);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const [kullaniciDurumu, setKullaniciDurumu] = useState('Çevrimiçi');
  const [avatarRenk, setAvatarRenk] = useState('#5865F2'); 
  const [avatarResmi, setAvatarResmi] = useState('');

  const [aktifKanal, setAktifKanal] = useState(METIN_KANALLARI[0]);
  const [mesaj, setMesaj] = useState('');
  const [mesajListesi, setMesajListesi] = useState([]);
  const [kanaldakiKullanicilar, setKanaldakiKullanicilar] = useState([]);
  
  const [yanitlananMesaj, setYanitlananMesaj] = useState(null);
  const [yazanKullanicilar, setYazanKullanicilar] = useState([]);
  const yazmaZamanlayici = useRef(null);

  const [aktifSesKanalı, setAktifSesKanali] = useState(null);
  const [mikrofonAcik, setMikrofonAcik] = useState(false);
  const [uzakSesler, setUzakSesler] = useState([]); 
  const [sestekiKullanicilar, setSestekiKullanicilar] = useState([]); 
  const [konusanlar, setKonusanlar] = useState([]); 
  const [ozelOdalar, setOzelOdalar] = useState([]);
  
  const [emojiMenuAcik, setEmojiMenuAcik] = useState(false);
  const [sesPaneliAcik, setSesPaneliAcik] = useState(false);
  const [seciliProfil, setSeciliProfil] = useState(null);
  const [komutOnerisi, setKomutOnerisi] = useState(false);

  // YENİ: DİNAMİK GIF MOTORU STATE'LERİ
  const [gifMenuAcik, setGifMenuAcik] = useState(false);
  const [arananGif, setArananGif] = useState('');
  const [canliGifler, setCanliGifler] = useState([]);
  const [gifYukleniyor, setGifYukleniyor] = useState(false);

  const [medyaYukleniyor, setMedyaYukleniyor] = useState(false);
  const [ekranPaylasiliyor, setEkranPaylasiliyor] = useState(false);
  const [yerelEkranAkim, setYerelEkranAkim] = useState(null);
  
  const [odaKurModaliAcik, setOdaKurModaliAcik] = useState(false);
  const [yeniOdaIsmi, setYeniOdaIsmi] = useState('');
  const [yeniOdaTipi, setYeniOdaTipi] = useState('public');
  const [yeniOdaSifresi, setYeniOdaSifresi] = useState('');
  const [girisSifreModali, setGirisSifreModali] = useState({ acik: false, odaIsmi: '' });
  const [girilenOdaSifresi, setGirilenOdaSifresi] = useState('');

  const ekranAkisiRef = useRef(null);
  const medyaAkisiRef = useRef(null);
  const peerBaglantilari = useRef({}); 
  const sesFrekansDurdurucular = useRef({}); 
  const mesajlarSonuRef = useRef(null);

  const sesSeviyesiDinle = (stream, userId) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isSpeaking = false; let animationId;
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray); let sum = 0; for(let i=0; i<bufferLength; i++) sum += dataArray[i];
        if (sum / bufferLength > 15 && !isSpeaking) { isSpeaking = true; setKonusanlar(p => p.includes(userId) ? p : [...p, userId]); } 
        else if (sum / bufferLength <= 15 && isSpeaking) { isSpeaking = false; setKonusanlar(p => p.filter(id => id !== userId)); }
        animationId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
      sesFrekansDurdurucular.current[userId] = () => { cancelAnimationFrame(animationId); source.disconnect(); analyser.disconnect(); if(audioContext.state !== 'closed') audioContext.close(); };
    } catch (err) {}
  };

  useEffect(() => { fetch(`${backendURL}/api/odalar`).then(res => res.json()).then(data => setOzelOdalar(data)).catch(err => console.log(err)); }, []);

  const kayitOlFormSubmit = async (e) => {
    e.preventDefault(); setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/kayit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kullaniciAdi: kullaniciAdiInput, email, sifre }) });
      if (res.ok) { alert("Kayıt başarılı! Giriş yapabilirsin."); setKayitModu(false); setSifre(''); } else setHataMesaji((await res.json()).hata);
    } catch (err) { setHataMesaji("Bağlantı hatası."); }
  };

  const girisYapFormSubmit = async (e) => {
    e.preventDefault(); setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/giris`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email, sifre }) });
      const data = await res.json();
      if (res.ok) { setKullaniciAdi(data.kullaniciAdi); setAvatarRenk(data.avatarRenk || '#5865F2'); setAvatarResmi(data.avatarResmi || ''); setGirisYapildi(true); } 
      else setHataMesaji(data.hata);
    } catch (err) { setHataMesaji("Bağlantı hatası."); }
  };

  const ozelOdaKur = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendURL}/api/oda-olustur`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isim: yeniOdaIsmi, tip: yeniOdaTipi, sifre: yeniOdaSifresi, olusturan: kullaniciAdi }) });
      if (res.ok) { setOdaKurModaliAcik(false); setYeniOdaIsmi(''); setYeniOdaSifresi(''); } else alert((await res.json()).hata);
    } catch (err) { alert("Hata oluştu."); }
  };

  const sifreliOdayaGirisIet = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendURL}/api/oda-giris`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isim: girisSifreModali.odaIsmi, sifre: girilenOdaSifresi }) });
      if (res.ok) { setGirisSifreModali({ acik: false, odaIsmi: '' }); setGirilenOdaSifresi(''); sesliKanalaBaglanIcraat(girisSifreModali.odaIsmi); } else alert((await res.json()).hata);
    } catch (err) { alert("Hata oluştu."); }
  };

  useEffect(() => {
    if (girisYapildi) {
      socket.emit('kanala_katil', { kanalAdi: aktifKanal, kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk, avatarResmi } });
      setMesajListesi([]); setYazanKullanicilar([]); setYanitlananMesaj(null); setEmojiMenuAcik(false); setGifMenuAcik(false); setSesPaneliAcik(false); setSeciliProfil(null); setKomutOnerisi(false);
    }
  }, [aktifKanal, girisYapildi, kullaniciDurumu, avatarRenk, avatarResmi]);

  useEffect(() => {
    socket.on('mesaj_al', (data) => {
      setMesajListesi((eski) => [...eski, data]);
      if (data.dosyaTipi === 'text' && data.metin.includes(`@${kullaniciAdi}`) && data.kullaniciAdi !== kullaniciAdi) {
        SES_PING.play().catch(e => console.log(e));
      }
    });

    // YENİ: Hayalet Sesi Dinle ve Anında Çal (Sohbete kaydolmaz)
    socket.on('ses_calindi_gizli', (url) => {
      const calinacakSes = new Audio(url);
      calinacakSes.volume = 0.8;
      calinacakSes.play().catch(e => console.log("Ses oynatılamadı:", e));
    });

    socket.on('gecmis_mesajlar', (eskiMesajlar) => setMesajListesi(eskiMesajlar));
    socket.on('kullanici_listesi', (liste) => setKanaldakiKullanicilar(liste.filter(k => k.durum !== 'Görünmez')));
    socket.on('sesteki_kullanicilar', (liste) => setSestekiKullanicilar(liste));
    socket.on('odalar_guncellendi', (odalar) => setOzelOdalar(odalar));
    socket.on('kullanici_yaziyor', (kim) => setYazanKullanicilar(p => p.includes(kim) ? p : [...p, kim]));
    socket.on('kullanici_yazmayi_birakti', (kim) => setYazanKullanicilar(p => p.filter(k => k !== kim)));
    socket.on('mesaj_silindi', (id) => setMesajListesi(p => p.filter(m => m.mesajId !== id)));

    return () => { socket.off('mesaj_al'); socket.off('ses_calindi_gizli'); socket.off('gecmis_mesajlar'); socket.off('kullanici_listesi'); socket.off('sesteki_kullanicilar'); socket.off('odalar_guncellendi'); socket.off('kullanici_yaziyor'); socket.off('kullanici_yazmayi_birakti'); socket.off('mesaj_silindi'); };
  }, [kullaniciAdi]);

  useEffect(() => {
    if(!aktifSesKanalı) return;
    const peerOlustur = (hedefID, arayanBenMiyim) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      if(medyaAkisiRef.current) medyaAkisiRef.current.getTracks().forEach(t => peer.addTrack(t, medyaAkisiRef.current));
      if(ekranAkisiRef.current) ekranAkisiRef.current.getTracks().forEach(t => peer.addTrack(t, ekranAkisiRef.current));
      peer.ontrack = (event) => { setUzakSesler((eski) => { if (!eski.find(s => s.id === event.streams[0].id)) return [...eski, event.streams[0]]; return eski; }); sesSeviyesiDinle(event.streams[0], hedefID); };
      peer.onicecandidate = (event) => { if (event.candidate) socket.emit('ice_adayi', { hedef: hedefID, aday: event.candidate }); };
      peer.onnegotiationneeded = async () => { try { const teklif = await peer.createOffer(); await peer.setLocalDescription(teklif); socket.emit('ses_teklifi', { hedef: hedefID, sdp: peer.localDescription }); } catch (err) {} };
      return peer;
    };
    socket.on('yeni_kullanici_ses_kanalinda', async (id) => { peerBaglantilari.current[id] = peerOlustur(id, true); });
    socket.on('ses_teklifi', async (data) => { let peer = peerBaglantilari.current[data.gonderen]; if (!peer) { peer = peerOlustur(data.gonderen, false); peerBaglantilari.current[data.gonderen] = peer; } try { await peer.setRemoteDescription(new RTCSessionDescription(data.sdp)); const cevap = await peer.createAnswer(); await peer.setLocalDescription(cevap); socket.emit('ses_cevabi', { hedef: data.gonderen, sdp: cevap }); } catch (e) {} });
    socket.on('ses_cevabi', async (data) => { try { const peer = peerBaglantilari.current[data.gonderen]; if(peer && peer.signalingState !== 'stable') await peer.setRemoteDescription(new RTCSessionDescription(data.sdp)); } catch(e) {} });
    socket.on('ice_adayi', async (data) => { if (peerBaglantilari.current[data.gonderen]) await peerBaglantilari.current[data.gonderen].addIceCandidate(new RTCIceCandidate(data.aday)); });
    socket.on('kullanici_sesten_ayrildi', (id) => { if(peerBaglantilari.current[id]) { peerBaglantilari.current[id].close(); delete peerBaglantilari.current[id]; } if(sesFrekansDurdurucular.current[id]) { sesFrekansDurdurucular.current[id](); delete sesFrekansDurdurucular.current[id]; } setKonusanlar(prev => prev.filter(kId => kId !== id)); setUzakSesler(eski => eski.filter(s => s.active)); });
    return () => { socket.off('yeni_kullanici_ses_kanalinda'); socket.off('ses_teklifi'); socket.off('ses_cevabi'); socket.off('ice_adayi'); socket.off('kullanici_sesten_ayrildi'); };
  }, [aktifSesKanalı]);

  useEffect(() => { const yenidenBaglaninca = () => { if (girisYapildi) { socket.emit('kanala_katil', { kanalAdi: aktifKanal, kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk, avatarResmi } }); if (aktifSesKanalı) socket.emit('sesli_kanala_katil', { kanalAdi: aktifSesKanalı, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk, avatarResmi } }); } }; socket.on('connect', yenidenBaglaninca); return () => socket.off('connect', yenidenBaglaninca); }, [girisYapildi, aktifKanal, kullaniciAdi, kullaniciDurumu, avatarRenk, avatarResmi, aktifSesKanalı]);

  useEffect(() => { mesajlarSonuRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajListesi]);

  const sesliKanalaTikla = (kanalIsmi, kanalTipi = 'public') => { if (aktifSesKanalı === kanalIsmi) return; if (kanalTipi === 'private') setGirisSifreModali({ acik: true, odaIsmi: kanalIsmi }); else sesliKanalaBaglanIcraat(kanalIsmi); };
  const sesliKanalaBaglanIcraat = async (kanal) => { try { if (aktifSesKanalı) sesliKanaldanAyril(); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); medyaAkisiRef.current = stream; setAktifSesKanali(kanal); setMikrofonAcik(true); sesSeviyesiDinle(stream, socket.id); socket.emit('sesli_kanala_katil', { kanalAdi: kanal, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk, avatarResmi } }); SES_BAGLANDI.play(); } catch (err) { alert("Mikrofon izni verilmedi!"); } };
  const sesliKanaldanAyril = () => { if (medyaAkisiRef.current) { medyaAkisiRef.current.getTracks().forEach(t => t.stop()); medyaAkisiRef.current = null; } if (ekranAkisiRef.current) { ekranAkisiRef.current.getTracks().forEach(t => t.stop()); ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false); } Object.values(peerBaglantilari.current).forEach(peer => peer.close()); Object.values(sesFrekansDurdurucular.current).forEach(durdur => durdur()); peerBaglantilari.current = {}; sesFrekansDurdurucular.current = {}; setUzakSesler([]); setKonusanlar([]); socket.emit('sesli_kanaldan_ayril', aktifSesKanalı); setAktifSesKanali(null); setMikrofonAcik(false); SES_AYRILDI.play(); };
  const mikrofonuGecisYap = () => { if (medyaAkisiRef.current) { const track = medyaAkisiRef.current.getAudioTracks()[0]; track.enabled = !track.enabled; setMikrofonAcik(track.enabled); } };
  const ekranPaylasiminiDegistir = async () => { if (ekranPaylasiliyor) { if (ekranAkisiRef.current) { ekranAkisiRef.current.getTracks().forEach(t => t.stop()); Object.values(peerBaglantilari.current).forEach(peer => { const senders = peer.getSenders().filter(s => s.track && s.track.kind === 'video'); senders.forEach(s => peer.removeTrack(s)); }); } ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false); } else { try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); ekranAkisiRef.current = stream; setYerelEkranAkim(stream); setEkranPaylasiliyor(true); stream.getTracks().forEach(track => { Object.values(peerBaglantilari.current).forEach(peer => peer.addTrack(track, stream)); track.onended = () => { ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false); Object.values(peerBaglantilari.current).forEach(peer => { const senders = peer.getSenders().filter(s => s.track && s.track.kind === 'video'); senders.forEach(s => peer.removeTrack(s)); }); }; }); } catch(err) { } } };

  // YENİ: DİNAMİK GIF ARAMA MOTORU (TENOR API)
  const gifleriGetir = async (aramaKelimesi = '') => {
    setGifYukleniyor(true);
    // Herkese açık Tenor test API anahtarı (Discord'un resmi GIF sağlayıcısı)
    const url = aramaKelimesi === '' 
      ? `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=30`
      : `https://g.tenor.com/v1/search?q=${aramaKelimesi}&key=LIVDSRZULELA&limit=30`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const gifLinkleri = data.results.map(g => g.media[0].gif.url);
      setCanliGifler(gifLinkleri);
    } catch(err) { console.log("GIF Çekilemedi"); }
    finally { setGifYukleniyor(false); }
  };

  // GIF Menüsü açıldığında otomatik trend GIF'leri yükle
  useEffect(() => {
    if (gifMenuAcik) gifleriGetir();
  }, [gifMenuAcik]);

  const gifGonder = (gifUrl) => {
    socket.emit('mesaj_gonder', { id: socket.id, kullaniciAdi, metin: gifUrl, dosyaTipi: 'image', saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kanal: aktifKanal, renk: avatarRenk, avatarResmi, yanitlanan: yanitlananMesaj });
    setGifMenuAcik(false); setYanitlananMesaj(null);
  };

  const sesCal = (sesObj) => {
    // YENİ: Sesi mesaj olarak değil, "Hayalet Veri" olarak gönder!
    socket.emit('ses_cal_gizli', { kanal: aktifKanal, url: sesObj.url });
    setSesPaneliAcik(false);
  };

  const mesajYazimiDegisti = (e) => {
    const val = e.target.value; setMesaj(val);
    if (val.startsWith('/')) { setKomutOnerisi(true); } else { setKomutOnerisi(false); }
    socket.emit('yaziyor', { kanal: aktifKanal, kullaniciAdi });
    clearTimeout(yazmaZamanlayici.current);
    yazmaZamanlayici.current = setTimeout(() => { socket.emit('yazmayi_birakti', { kanal: aktifKanal, kullaniciAdi }); }, 1500);
  };

  const emojiEkle = (emoji) => { setMesaj(prev => prev + emoji); setEmojiMenuAcik(false); };

  const mesajGonder = () => {
    if (mesaj.trim() === '') return;

    let gonderilecekMetin = mesaj;
    let sistemMesaji = false;

    if (mesaj === '/zar') {
      const zar = Math.floor(Math.random() * 6) + 1;
      gonderilecekMetin = `🎲 **${kullaniciAdi}** bir zar attı ve **${zar}** geldi!`;
      sistemMesaji = true;
    } else if (mesaj === '/yazitura') {
      const sonuc = Math.random() > 0.5 ? 'YAZI' : 'TURA';
      gonderilecekMetin = `🪙 **${kullaniciAdi}** madeni para fırlattı: **${sonuc}!**`;
      sistemMesaji = true;
    }

    socket.emit('mesaj_gonder', { 
      id: socket.id, kullaniciAdi: sistemMesaji ? 'NEXUS SİSTEMİ' : kullaniciAdi, 
      metin: gonderilecekMetin, dosyaTipi: 'text', 
      saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      kanal: aktifKanal, renk: sistemMesaji ? '#ffea00' : avatarRenk, 
      avatarResmi: sistemMesaji ? 'https://cdn-icons-png.flaticon.com/512/2621/2621111.png' : avatarResmi, 
      yanitlanan: yanitlananMesaj 
    });
    
    setMesaj(''); setYanitlananMesaj(null); setEmojiMenuAcik(false); setKomutOnerisi(false);
    socket.emit('yazmayi_birakti', { kanal: aktifKanal, kullaniciAdi }); 
  };

  const medyaYukle = async (e, isAvatar = false) => {
    const file = e.target.files[0]; if (!file) return; if (file.size > 15 * 1024 * 1024) { alert("Maksimum 15MB desteklenir."); e.target.value = ''; return; }
    setMedyaYukleniyor(true); const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', 'no0ddvg5'); formData.append('cloud_name', 'dmdzi2mtx');   
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dmdzi2mtx/auto/upload', { method: 'POST', body: formData }); const data = await res.json();
      if (data.secure_url) {
        if (isAvatar) { setAvatarResmi(data.secure_url); await fetch(`${backendURL}/api/avatar-guncelle`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, avatarResmi: data.secure_url }) }); } 
        else { socket.emit('mesaj_gonder', { id: socket.id, kullaniciAdi, metin: data.secure_url, dosyaTipi: data.resource_type, saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kanal: aktifKanal, renk: avatarRenk, avatarResmi, yanitlanan: yanitlananMesaj }); setYanitlananMesaj(null); }
      }
    } catch (err) { alert("Yükleme hatası."); } finally { setMedyaYukleniyor(false); e.target.value = ''; }
  };

  const formatliMetin = (metin) => {
    if (!metin) return null;
    let islenmis = metin.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    islenmis = islenmis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
    islenmis = islenmis.replace(/\*(.*?)\*/g, '<em>$1</em>'); 
    islenmis = islenmis.replace(/__(.*?)__/g, '<u>$1</u>'); 
    islenmis = islenmis.replace(/`(.*?)`/g, '<span class="inline-code">$1</span>'); 
    islenmis = islenmis.replace(/@(\S+)/g, '<span class="mention">@$1</span>'); 
    return <span dangerouslySetInnerHTML={{ __html: islenmis }} />;
  };

  const durumRengiGetir = (durum) => { if(durum === 'Çevrimiçi') return '#23a559'; if(durum === 'Boşta') return '#f0b232'; if(durum === 'Rahatsız Etmeyin') return '#f23f43'; return '#80848e'; };
  const grupluKullanicilar = { 'Çevrimiçi': kanaldakiKullanicilar.filter(k => k.durum === 'Çevrimiçi'), 'Boşta': kanaldakiKullanicilar.filter(k => k.durum === 'Boşta'), 'Rahatsız Etmeyin': kanaldakiKullanicilar.filter(k => k.durum === 'Rahatsız Etmeyin') };

  const arkaPlanaTiklandi = () => { setEmojiMenuAcik(false); setGifMenuAcik(false); setSesPaneliAcik(false); setSeciliProfil(null); setKomutOnerisi(false); };

  if (!girisYapildi) {
    return (
      <div className="login-container discord-bg">
        <div className="login-box discord-panel">
          <div className="discord-logo">DISCORD CLONE</div>
          <h2 style={{color: '#f2f3f5', marginBottom: '8px', fontSize: '24px'}}>{kayitModu ? 'Hesap Oluştur' : 'Tekrar Hoş Geldin!'}</h2>
          <p style={{color: '#b5bac1', fontSize: '14px', marginBottom: '20px'}}>{kayitModu ? 'Aramıza katıl.' : 'Seni gördüğümüze çok sevindik!'}</p>
          {hataMesaji && <div style={{color: '#f23f43', fontSize: '13px', marginBottom: '10px'}}>{hataMesaji}</div>}
          {kayitModu ? (
            <form onSubmit={kayitOlFormSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <div className="input-group"><label>KULLANICI ADI</label><input type="text" value={kullaniciAdiInput} onChange={(e) => setKullaniciAdiInput(e.target.value)} required /></div>
              <div className="input-group"><label>E-POSTA</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="input-group"><label>ŞİFRE</label><input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} required /></div>
              <button type="submit" className="discord-button blurple-btn">Devam Et</button>
              <p onClick={() => {setKayitModu(false); setHataMesaji(''); setEmail(''); setSifre('');}} className="link-text">Zaten bir hesabın var mı?</p>
            </form>
          ) : (
            <form onSubmit={girisYapFormSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <div className="input-group"><label>E-POSTA VEYA KULLANICI ADI</label><input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
              <div className="input-group"><label>ŞİFRE</label><input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} required /></div>
              <button type="submit" className="discord-button blurple-btn">Giriş Yap</button>
              <p onClick={() => {setKayitModu(true); setHataMesaji(''); setEmail(''); setSifre('');}} className="link-text">Hesaba mı ihtiyacın var? Kaydol</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  const avatarStili = (renk, resim) => ({ backgroundColor: !resim ? renk : 'transparent', backgroundImage: resim ? `url(${resim})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', });

  const OdaIciAvatarlar = ({ kanalAdi }) => {
    const oOdakiler = sestekiKullanicilar.filter(k => k.kanal === kanalAdi);
    if (oOdakiler.length === 0) return null;
    return (
      <div className="nested-avatars">
        {oOdakiler.map(k => (
          <div key={k.socketId} className="nested-user" onClick={(e) => { e.stopPropagation(); setSeciliProfil(k); }}>
            <div className={`nested-avatar ${konusanlar.includes(k.socketId) ? 'speaking-discord' : ''}`} style={avatarStili(k.renk, k.avatarResmi)}></div>
            <span>{k.kullaniciAdi}</span>
          </div>
        ))}
      </div>
    );
  };

  const aktifEkranYayinlari = uzakSesler.filter(s => s.active && s.getVideoTracks().length > 0);
  const yayinEkraniAcik = yerelEkranAkim || aktifEkranYayinlari.length > 0;

  return (
    <div className="discord-layout main-theme" onClick={arkaPlanaTiklandi}>
      
      {seciliProfil && (
        <div className="profile-popout-discord animate-fade-in" onClick={(e) => e.stopPropagation()}>
           <div className="profile-popout-banner" style={{backgroundColor: seciliProfil.renk || '#5865F2'}}></div>
           <div className="profile-popout-avatar-wrapper">
             <div className="profile-popout-avatar" style={avatarStili(seciliProfil.renk, seciliProfil.avatarResmi)}></div>
             <div className="profile-popout-status" style={{ backgroundColor: durumRengiGetir(seciliProfil.durum) }}></div>
           </div>
           <div className="profile-popout-info">
              <h3>{seciliProfil.kullaniciAdi}</h3>
              <p>{seciliProfil.durum}</p>
              <div className="profile-popout-divider"></div>
              <h4>ROLLER</h4>
              <span className="profile-popout-role">NEXUS Ajanı</span>
           </div>
        </div>
      )}

      {girisSifreModali.acik && (
        <div className="discord-modal-overlay">
          <div className="discord-modal">
            <h2>🔒 {girisSifreModali.odaIsmi} Şifresi</h2>
            <form onSubmit={sifreliOdayaGirisIet}>
              <div className="input-group" style={{marginTop:'15px'}}><input type="password" value={girilenOdaSifresi} onChange={(e) => setGirilenOdaSifresi(e.target.value)} required autoFocus /></div>
              <div className="modal-actions"><button type="button" className="link-text" onClick={() => setGirisSifreModali({acik: false, odaIsmi: ''})}>İptal</button><button type="submit" className="discord-button blurple-btn" style={{width:'auto'}}>Bağlan</button></div>
            </form>
          </div>
        </div>
      )}

      {odaKurModaliAcik && (
        <div className="discord-modal-overlay">
          <div className="discord-modal">
            <h2>Kanal Oluştur</h2>
            <p style={{color:'#b5bac1', fontSize:'14px', marginBottom:'20px'}}>Sohbet etmek için yeni bir alan oluştur.</p>
            <form onSubmit={ozelOdaKur}>
              <div className="input-group"><label>KANAL ADI</label><input type="text" value={yeniOdaIsmi} onChange={(e) => setYeniOdaIsmi(e.target.value)} required placeholder="yeni-kanal"/></div>
              <div className="input-group"><label>GİZLİLİK SEVİYESİ</label><select value={yeniOdaTipi} onChange={(e) => setYeniOdaTipi(e.target.value)} className="discord-select"><option value="public">🌍 Herkese Açık</option><option value="private">🔒 Özel (Şifreli)</option></select></div>
              {yeniOdaTipi === 'private' && (<div className="input-group"><label>ŞİFRE</label><input type="password" value={yeniOdaSifresi} onChange={(e) => setYeniOdaSifresi(e.target.value)} required /></div>)}
              <div className="modal-actions"><button type="button" className="link-text" onClick={() => setOdaKurModaliAcik(false)}>İptal</button><button type="submit" className="discord-button blurple-btn" style={{width:'auto'}}>Kanalı Oluştur</button></div>
            </form>
          </div>
        </div>
      )}

      {ayarlarAcik && (
        <div className="discord-modal-overlay">
          <div className="discord-modal settings">
            <h2>Kullanıcı Ayarları</h2>
            <div className="input-group"><label>DURUM</label><select value={kullaniciDurumu} onChange={(e) => setKullaniciDurumu(e.target.value)} className="discord-select"><option value="Çevrimiçi">Çevrimiçi</option><option value="Boşta">Boşta</option><option value="Rahatsız Etmeyin">Rahatsız Etmeyin</option><option value="Görünmez">Görünmez</option></select></div>
            <div className="input-group"><label>PROFİL RENGİ</label><input type="color" value={avatarRenk} onChange={(e) => setAvatarRenk(e.target.value)} className="color-picker-discord" /></div>
            <div className="input-group"><label>PROFİL FOTOĞRAFI DEĞİŞTİR</label><input type="file" accept="image/*" onChange={(e) => medyaYukle(e, true)} disabled={medyaYukleniyor} className="file-input-discord" />{medyaYukleniyor && <span style={{fontSize:'12px', color:'#5865F2'}}>Yükleniyor...</span>}</div>
            <div className="modal-actions" style={{justifyContent:'flex-end'}}><button className="discord-button blurple-btn" style={{width:'auto'}} onClick={() => setAyarlarAcik(false)}>Tamamlandı</button></div>
          </div>
        </div>
      )}

      <div className="server-sidebar-discord">
        <div className="server-icon-discord active"><img src="https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/636e0a6ca814282eca7172c6_icon_clyde_white_RGB.svg" alt="Discord" style={{width:'28px'}}/></div>
        <div className="server-separator"></div>
        <div className="server-icon-discord server-custom" style={{backgroundColor: avatarRenk}}>NX</div>
        <div className="server-icon-discord add-server">+</div>
      </div>

      <div className="channel-sidebar-discord">
        <div className="server-header-discord"><h3>Nexus Sunucusu</h3></div>
        <div className="channel-list-discord">
          <div className="category-title-discord">METİN KANALLARI</div>
          {METIN_KANALLARI.map((kanal) => (
            <div key={kanal} className={`channel-item-discord ${aktifKanal === kanal ? 'active' : ''}`} onClick={() => setAktifKanal(kanal)}><span className="hash-discord">#</span> {kanal}</div>
          ))}
          <div className="category-title-discord" style={{marginTop: '20px'}}>SES KANALLARI</div>
          {SABIT_SES_KANALLARI.map((kanal) => (
            <div key={kanal}>
              <div className={`channel-item-discord voice ${aktifSesKanalı === kanal ? 'active-voice' : ''}`} onClick={() => sesliKanalaTikla(kanal, 'public')}><span className="hash-discord">🔊</span> {kanal}</div>
              <OdaIciAvatarlar kanalAdi={kanal} />
            </div>
          ))}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingRight: '10px'}}>
             <div className="category-title-discord" style={{margin:0}}>ÖZEL ODALAR</div><span className="add-channel-icon" onClick={() => setOdaKurModaliAcik(true)}>+</span>
          </div>
          {ozelOdalar.map((oda) => (
            <div key={oda._id}>
              <div className={`channel-item-discord voice ${aktifSesKanalı === oda.isim ? 'active-voice' : ''}`} onClick={() => sesliKanalaTikla(oda.isim, oda.tip)}><span className="hash-discord">{oda.tip === 'private' ? '🔒' : '🔊'}</span> {oda.isim}</div>
              <OdaIciAvatarlar kanalAdi={oda.isim} />
            </div>
          ))}
        </div>

        {aktifSesKanalı && (
          <div className="voice-control-panel-discord">
            <div className="voice-status-discord">
              <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                 <div className={`pulse-dot-discord ${konusanlar.includes(socket.id) ? 'speaking-pulse' : ''}`}></div><span style={{color:'#23a559', fontWeight:'600', fontSize: '13px'}}>Ses Bağlantısı</span>
              </div>
              <span style={{fontSize:'12px', color:'#b5bac1', marginLeft: '14px'}}>{aktifSesKanalı}</span>
            </div>
            <div className="voice-actions-discord">
              <button className={`action-icon-discord ${!mikrofonAcik ? 'muted' : ''}`} onClick={mikrofonuGecisYap} title={mikrofonAcik ? "Sesi Kapat" : "Sesi Aç"}>{mikrofonAcik ? '🎙️' : '🔇'}</button>
              <button className={`action-icon-discord ${ekranPaylasiliyor ? 'active' : ''}`} onClick={ekranPaylasiminiDegistir} title={ekranPaylasiliyor ? "Ekranı Kapat" : "Ekran Paylaş"}>🖥️</button>
              <button className="action-icon-discord disconnect" onClick={sesliKanaldanAyril} title="Bağlantıyı Kes">📞</button>
            </div>
          </div>
        )}

        <div className="user-profile-bar-discord">
          <div className="avatar-wrapper-discord">
            <div className="avatar-discord" style={avatarStili(avatarRenk, avatarResmi)}></div>
            <div className="status-dot-discord" style={{ backgroundColor: durumRengiGetir(kullaniciDurumu) }}></div>
          </div>
          <div className="user-info-discord"><div className="username-discord">{kullaniciAdi}</div><div className="status-text-discord">{kullaniciDurumu}</div></div>
          <div className="settings-icon-discord" onClick={() => setAyarlarAcik(true)}>⚙️</div>
        </div>
      </div>

      <div className="chat-area-discord">
        <div className="chat-header-discord"><span className="hash-discord" style={{fontSize:'24px', marginRight:'10px'}}>#</span><h3>{aktifKanal}</h3></div>
        
        {yayinEkraniAcik && (
          <div className="screenshare-grid-discord">
            {yerelEkranAkim && (<div className="video-card-discord"><video autoPlay muted controls ref={el => {if(el) el.srcObject = yerelEkranAkim}} /><span className="video-label-discord">Canlı (Sen)</span></div>)}
            {aktifEkranYayinlari.map((s, i) => (<div key={i} className="video-card-discord"><video autoPlay controls ref={el => {if(el && el.srcObject !== s) el.srcObject = s}} /><span className="video-label-discord live-badge">CANLI YAYIN</span></div>))}
          </div>
        )}

        <div className="messages-container-discord" style={{ height: yayinEkraniAcik ? '50%' : '100%' }}>
          {mesajListesi.length === 0 ? (
            <div className="empty-chat-discord"><div className="welcome-icon">#</div><h2>{aktifKanal} kanalına hoş geldin!</h2><p>Bu, #{aktifKanal} kanalının başlangıcıdır.</p></div>
          ) : (
            mesajListesi.map((m, index) => {
              const oncekiMesaj = index > 0 ? mesajListesi[index - 1] : null;
              const ayniKisi = oncekiMesaj && oncekiMesaj.kullaniciAdi === m.kullaniciAdi && !m.yanitlanan;
              const bahsedildim = m.dosyaTipi === 'text' && m.metin.includes(`@${kullaniciAdi}`);

              return (
                <div key={index} className={`message-discord ${ayniKisi ? 'grouped' : ''} ${yanitlananMesaj?.mesajId === m.mesajId ? 'highlight-reply' : ''} ${bahsedildim ? 'mentioned-message' : ''}`}>
                  {m.yanitlanan && (
                    <div className="replied-message-wrapper" onClick={(e) => {e.stopPropagation(); setSeciliProfil(m.yanitlanan);}}>
                      <div className="reply-spine"></div><div className="replied-avatar" style={avatarStili(m.yanitlanan.renk, m.yanitlanan.avatarResmi)}></div><span className="replied-username" style={{color: m.yanitlanan.renk}}>@{m.yanitlanan.kullaniciAdi}</span><span className="replied-text">{m.yanitlanan.dosyaTipi === 'text' ? m.yanitlanan.metin : 'Medya gönderdi'}</span>
                    </div>
                  )}

                  {!ayniKisi && <div className="message-avatar-discord clickable" style={avatarStili(m.renk, m.avatarResmi)} onClick={(e) => {e.stopPropagation(); setSeciliProfil(m);}}></div>}
                  
                  <div className="message-content-discord">
                    {!ayniKisi && (
                      <div className="message-header-discord"><span className="message-username-discord clickable" style={{color: m.renk}} onClick={(e) => {e.stopPropagation(); setSeciliProfil(m);}}>{m.kullaniciAdi}</span><span className="message-time-discord">{m.saat}</span></div>
                    )}
                    {ayniKisi && <div className="message-time-hover">{m.saat}</div>}
                    <div className="message-text-discord">
                      {m.dosyaTipi === 'image' ? ( <img src={m.metin} alt="Görsel" className="chat-image" /> ) : m.dosyaTipi === 'video' ? ( <video src={m.metin} controls className="chat-video" /> ) : ( formatliMetin(m.metin) )}
                    </div>
                  </div>
                  
                  <div className="message-actions-discord">
                     <span className="action-btn" onClick={() => setYanitlananMesaj(m)} title="Yanıtla">↩️</span>
                     {m.kullaniciAdi === kullaniciAdi && ( <span className="action-btn" onClick={() => socket.emit('mesaj_sil', { kanal: aktifKanal, mesajId: m.mesajId })} title="Sil">🗑️</span> )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={mesajlarSonuRef} />
        </div>

        <div className="message-input-area-discord">
          {yazanKullanicilar.length > 0 && (<div className="typing-indicator-discord"><span className="dots-discord"><span>.</span><span>.</span><span>.</span></span><strong>{yazanKullanicilar.join(', ')}</strong> yazıyor...</div>)}

          {yanitlananMesaj && (<div className="reply-banner"><span>Şu kişiye yanıt veriliyor: <strong>@{yanitlananMesaj.kullaniciAdi}</strong></span><span className="cancel-reply" onClick={() => setYanitlananMesaj(null)}>❌</span></div>)}

          {emojiMenuAcik && (
            <div className="emoji-picker-discord animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="emoji-picker-header">Emojiler</div>
              <div className="emoji-grid">
                {POPULER_EMOJILER.map(emj => (<span key={emj} className="emoji-item" onClick={() => emojiEkle(emj)}>{emj}</span>))}
              </div>
            </div>
          )}

          {/* YENİ: DİNAMİK ARAMA KUTULU GIF PANELİ */}
          {gifMenuAcik && (
            <div className="emoji-picker-discord animate-fade-in" style={{width: '380px', height: '400px', display: 'flex', flexDirection: 'column'}} onClick={(e) => e.stopPropagation()}>
              <div className="emoji-picker-header" style={{paddingBottom: '8px'}}>
                 <input type="text" value={arananGif} onChange={(e) => { setArananGif(e.target.value); gifleriGetir(e.target.value); }} placeholder="Tenor ile GIF Ara..." className="gif-search-input" autoFocus/>
              </div>
              <div className="gif-grid" style={{flex: 1, maxHeight: 'none'}}>
                {gifYukleniyor ? ( <div style={{padding: '20px', color: '#b5bac1', textAlign: 'center', width: '100%'}}>Yükleniyor...</div> ) : canliGifler.map((g, i) => (
                  <img key={i} src={g} alt="GIF" className="gif-item-dynamic" onClick={() => gifGonder(g)} />
                ))}
              </div>
            </div>
          )}

          {sesPaneliAcik && (
            <div className="emoji-picker-discord animate-fade-in" style={{width: '380px'}} onClick={(e) => e.stopPropagation()}>
              <div className="emoji-picker-header">🎧 Ses Paneli (Gizli Yayın)</div>
              <div className="soundboard-grid">
                {SOUNDBOARD_SESLERI.map(ses => (
                  <div key={ses.id} className="soundboard-btn" onClick={() => sesCal(ses)}>
                     <span className="sb-icon">{ses.ikon}</span><span className="sb-text">{ses.isim}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {komutOnerisi && (
            <div className="command-popup animate-fade-in">
              <div className="command-header">Komutlar</div>
              {KOMUTLAR.map(k => (
                <div key={k.komut} className="command-item" onClick={() => {setMesaj(k.komut); setKomutOnerisi(false);}}>
                   <strong>{k.komut}</strong> <span>{k.aciklama}</span>
                </div>
              ))}
            </div>
          )}

          <div className={`input-wrapper-discord ${yanitlananMesaj ? 'reply-active' : ''}`}>
            <input type="file" id="medya-secici" style={{ display: 'none' }} accept="image/*,video/*" onChange={(e) => medyaYukle(e, false)} disabled={medyaYukleniyor} />
            <label htmlFor="medya-secici" className="add-media-btn">{medyaYukleniyor ? '⏳' : '+'}</label>
            <input type="text" value={mesaj} onChange={mesajYazimiDegisti} placeholder={medyaYukleniyor ? "Medya aktarılıyor..." : `#${aktifKanal} kanalına mesaj gönder`} onKeyDown={(e) => e.key === 'Enter' && mesajGonder()} autoFocus disabled={medyaYukleniyor} className="chat-input-discord" />
            
            <div className="input-right-icons">
               <span title="GIF Seç" className="icon-btn text-icon" onClick={(e) => { e.stopPropagation(); setGifMenuAcik(!gifMenuAcik); setEmojiMenuAcik(false); setSesPaneliAcik(false); }}>GIF</span>
               <span title="Ses Paneli" className="icon-btn text-icon" onClick={(e) => { e.stopPropagation(); setSesPaneliAcik(!sesPaneliAcik); setEmojiMenuAcik(false); setGifMenuAcik(false); }}>🔊</span>
               <span title="Emoji Seç" className="icon-btn" onClick={(e) => { e.stopPropagation(); setEmojiMenuAcik(!emojiMenuAcik); setGifMenuAcik(false); setSesPaneliAcik(false); }}>😊</span>
            </div>
          </div>
        </div>
      </div>

      <div className="members-sidebar-discord">
        <div className="members-list-content-discord">
          {['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin'].map((durum) => (
            grupluKullanicilar[durum].length > 0 && (
              <div key={durum} className="member-group-discord">
                <h4 className="role-title-discord">{durum.toUpperCase()} — {grupluKullanicilar[durum].length}</h4>
                {grupluKullanicilar[durum].map(k => (
                  <div key={k.id} className="member-item-discord" onClick={(e) => {e.stopPropagation(); setSeciliProfil(k);}}>
                    <div className="avatar-wrapper-discord small">
                      <div className="avatar-discord small" style={avatarStili(k.renk, k.avatarResmi)}></div>
                      <div className="status-dot-discord small" style={{ backgroundColor: durumRengiGetir(k.durum) }}></div>
                    </div>
                    <span className="member-name-discord" style={{ color: k.renk }}>{k.kullaniciAdi}</span>
                  </div>
                ))}
              </div>
            )
          ))}
        </div>
      </div>
      <div style={{ display: 'none' }}>{uzakSesler.filter(s => s.getVideoTracks().length === 0).map((stream, index) => (<audio key={index} autoPlay ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} />))}</div>
    </div>
  );
}

export default App;
