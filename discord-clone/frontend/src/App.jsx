import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const backendURL = 'https://discord-iifa.onrender.com';
const socket = io(backendURL);

const METIN_KANALLARI = ['genel-sohbet', 'yazilim', 'oyun-odasi', 'muzik'];
const SABIT_SES_KANALLARI = ['Lobi', 'Oyun Ses', 'Sohbet Odası'];

const SES_BAGLANDI = new Audio('https://actions.google.com/sounds/v1/ui/communication_channel_open.ogg');
const SES_AYRILDI = new Audio('https://actions.google.com/sounds/v1/ui/communication_channel_close.ogg');
SES_BAGLANDI.volume = 0.5; SES_AYRILDI.volume = 0.5;

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
  const [avatarRenk, setAvatarRenk] = useState('#00f3ff');
  const [avatarResmi, setAvatarResmi] = useState(''); // YENİ: Profil Fotoğrafı Linki

  const [aktifKanal, setAktifKanal] = useState(METIN_KANALLARI[0]);
  const [mesaj, setMesaj] = useState('');
  const [mesajListesi, setMesajListesi] = useState([]);
  const [kanaldakiKullanicilar, setKanaldakiKullanicilar] = useState([]);
  
  // YENİ: Yazıyor Sensörü
  const [yazanKullanicilar, setYazanKullanicilar] = useState([]);
  const yazmaZamanlayici = useRef(null);

  const [aktifSesKanalı, setAktifSesKanali] = useState(null);
  const [mikrofonAcik, setMikrofonAcik] = useState(false);
  const [uzakSesler, setUzakSesler] = useState([]); 
  const [sestekiKullanicilar, setSestekiKullanicilar] = useState([]); 
  const [konusanlar, setKonusanlar] = useState([]); 
  const [ozelOdalar, setOzelOdalar] = useState([]);
  
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
      
      let isSpeaking = false;
      let animationId;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<bufferLength; i++) sum += dataArray[i];
        if (sum / bufferLength > 15 && !isSpeaking) { isSpeaking = true; setKonusanlar(p => p.includes(userId) ? p : [...p, userId]); } 
        else if (sum / bufferLength <= 15 && isSpeaking) { isSpeaking = false; setKonusanlar(p => p.filter(id => id !== userId)); }
        animationId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
      sesFrekansDurdurucular.current[userId] = () => { cancelAnimationFrame(animationId); source.disconnect(); analyser.disconnect(); if(audioContext.state !== 'closed') audioContext.close(); };
    } catch (err) {}
  };

  useEffect(() => {
    fetch(`${backendURL}/api/odalar`).then(res => res.json()).then(data => setOzelOdalar(data)).catch(err => console.log(err));
  }, []);

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
      if (res.ok) { 
        setKullaniciAdi(data.kullaniciAdi); setAvatarRenk(data.avatarRenk || '#00f3ff'); setAvatarResmi(data.avatarResmi || ''); setGirisYapildi(true); 
      } else setHataMesaji(data.hata);
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
      setMesajListesi([]); setYazanKullanicilar([]); // Kanal değiştiğinde yazanları sıfırla
    }
  }, [aktifKanal, girisYapildi, kullaniciDurumu, avatarRenk, avatarResmi]);

  useEffect(() => {
    socket.on('mesaj_al', (data) => setMesajListesi((eski) => [...eski, data]));
    socket.on('gecmis_mesajlar', (eskiMesajlar) => setMesajListesi(eskiMesajlar));
    socket.on('kullanici_listesi', (liste) => setKanaldakiKullanicilar(liste.filter(k => k.durum !== 'Görünmez')));
    socket.on('sesteki_kullanicilar', (liste) => setSestekiKullanicilar(liste));
    socket.on('odalar_guncellendi', (odalar) => setOzelOdalar(odalar));
    
    // YENİ DİNLEYİCİLER (Yazıyor... ve Silme)
    socket.on('kullanici_yaziyor', (kim) => setYazanKullanicilar(p => p.includes(kim) ? p : [...p, kim]));
    socket.on('kullanici_yazmayi_birakti', (kim) => setYazanKullanicilar(p => p.filter(k => k !== kim)));
    socket.on('mesaj_silindi', (id) => setMesajListesi(p => p.filter(m => m.mesajId !== id)));

    return () => { socket.off('mesaj_al'); socket.off('gecmis_mesajlar'); socket.off('kullanici_listesi'); socket.off('sesteki_kullanicilar'); socket.off('odalar_guncellendi'); socket.off('kullanici_yaziyor'); socket.off('kullanici_yazmayi_birakti'); socket.off('mesaj_silindi'); };
  }, []);

  useEffect(() => {
    if(!aktifSesKanalı) return;
    const peerOlustur = (hedefID, arayanBenMiyim) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      if(medyaAkisiRef.current) medyaAkisiRef.current.getTracks().forEach(t => peer.addTrack(t, medyaAkisiRef.current));
      if(ekranAkisiRef.current) ekranAkisiRef.current.getTracks().forEach(t => peer.addTrack(t, ekranAkisiRef.current));

      peer.ontrack = (event) => {
        setUzakSesler((eski) => { if (!eski.find(s => s.id === event.streams[0].id)) return [...eski, event.streams[0]]; return eski; });
        sesSeviyesiDinle(event.streams[0], hedefID); 
      };
      peer.onicecandidate = (event) => { if (event.candidate) socket.emit('ice_adayi', { hedef: hedefID, aday: event.candidate }); };
      peer.onnegotiationneeded = async () => { try { const teklif = await peer.createOffer(); await peer.setLocalDescription(teklif); socket.emit('ses_teklifi', { hedef: hedefID, sdp: peer.localDescription }); } catch (err) {} };
      return peer;
    };

    socket.on('yeni_kullanici_ses_kanalinda', async (id) => { peerBaglantilari.current[id] = peerOlustur(id, true); });
    socket.on('ses_teklifi', async (data) => {
      let peer = peerBaglantilari.current[data.gonderen];
      if (!peer) { peer = peerOlustur(data.gonderen, false); peerBaglantilari.current[data.gonderen] = peer; }
      try { await peer.setRemoteDescription(new RTCSessionDescription(data.sdp)); const cevap = await peer.createAnswer(); await peer.setLocalDescription(cevap); socket.emit('ses_cevabi', { hedef: data.gonderen, sdp: cevap }); } catch (e) {}
    });
    socket.on('ses_cevabi', async (data) => { try { const peer = peerBaglantilari.current[data.gonderen]; if(peer && peer.signalingState !== 'stable') await peer.setRemoteDescription(new RTCSessionDescription(data.sdp)); } catch(e) {} });
    socket.on('ice_adayi', async (data) => { if (peerBaglantilari.current[data.gonderen]) await peerBaglantilari.current[data.gonderen].addIceCandidate(new RTCIceCandidate(data.aday)); });
    socket.on('kullanici_sesten_ayrildi', (id) => {
      if(peerBaglantilari.current[id]) { peerBaglantilari.current[id].close(); delete peerBaglantilari.current[id]; }
      if(sesFrekansDurdurucular.current[id]) { sesFrekansDurdurucular.current[id](); delete sesFrekansDurdurucular.current[id]; }
      setKonusanlar(prev => prev.filter(kId => kId !== id)); setUzakSesler(eski => eski.filter(s => s.active));
    });

    return () => { socket.off('yeni_kullanici_ses_kanalinda'); socket.off('ses_teklifi'); socket.off('ses_cevabi'); socket.off('ice_adayi'); socket.off('kullanici_sesten_ayrildi'); };
  }, [aktifSesKanalı]);

  useEffect(() => {
    const yenidenBaglaninca = () => {
      if (girisYapildi) {
        socket.emit('kanala_katil', { kanalAdi: aktifKanal, kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk, avatarResmi } });
        if (aktifSesKanalı) socket.emit('sesli_kanala_katil', { kanalAdi: aktifSesKanalı, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk, avatarResmi } });
      }
    };
    socket.on('connect', yenidenBaglaninca);
    return () => socket.off('connect', yenidenBaglaninca);
  }, [girisYapildi, aktifKanal, kullaniciAdi, kullaniciDurumu, avatarRenk, avatarResmi, aktifSesKanalı]);

  useEffect(() => { mesajlarSonuRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajListesi]);

  const sesliKanalaTikla = (kanalIsmi, kanalTipi = 'public') => { if (aktifSesKanalı === kanalIsmi) return; if (kanalTipi === 'private') setGirisSifreModali({ acik: true, odaIsmi: kanalIsmi }); else sesliKanalaBaglanIcraat(kanalIsmi); };
  const sesliKanalaBaglanIcraat = async (kanal) => { try { if (aktifSesKanalı) sesliKanaldanAyril(); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); medyaAkisiRef.current = stream; setAktifSesKanali(kanal); setMikrofonAcik(true); sesSeviyesiDinle(stream, socket.id); socket.emit('sesli_kanala_katil', { kanalAdi: kanal, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk, avatarResmi } }); SES_BAGLANDI.play(); } catch (err) { alert("Mikrofon izni verilmedi!"); } };
  const sesliKanaldanAyril = () => {
    if (medyaAkisiRef.current) { medyaAkisiRef.current.getTracks().forEach(t => t.stop()); medyaAkisiRef.current = null; }
    if (ekranAkisiRef.current) { ekranAkisiRef.current.getTracks().forEach(t => t.stop()); ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false); }
    Object.values(peerBaglantilari.current).forEach(peer => peer.close()); Object.values(sesFrekansDurdurucular.current).forEach(durdur => durdur());
    peerBaglantilari.current = {}; sesFrekansDurdurucular.current = {}; setUzakSesler([]); setKonusanlar([]);
    socket.emit('sesli_kanaldan_ayril', aktifSesKanalı); setAktifSesKanali(null); setMikrofonAcik(false); SES_AYRILDI.play(); 
  };
  const mikrofonuGecisYap = () => { if (medyaAkisiRef.current) { const track = medyaAkisiRef.current.getAudioTracks()[0]; track.enabled = !track.enabled; setMikrofonAcik(track.enabled); } };
  
  const ekranPaylasiminiDegistir = async () => {
    if (ekranPaylasiliyor) {
      if (ekranAkisiRef.current) {
        ekranAkisiRef.current.getTracks().forEach(t => t.stop());
        Object.values(peerBaglantilari.current).forEach(peer => { const senders = peer.getSenders().filter(s => s.track && s.track.kind === 'video'); senders.forEach(s => peer.removeTrack(s)); });
      }
      ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        ekranAkisiRef.current = stream; setYerelEkranAkim(stream); setEkranPaylasiliyor(true);
        stream.getTracks().forEach(track => {
          Object.values(peerBaglantilari.current).forEach(peer => peer.addTrack(track, stream));
          track.onended = () => {
             ekranAkisiRef.current = null; setYerelEkranAkim(null); setEkranPaylasiliyor(false);
             Object.values(peerBaglantilari.current).forEach(peer => { const senders = peer.getSenders().filter(s => s.track && s.track.kind === 'video'); senders.forEach(s => peer.removeTrack(s)); });
          };
        });
      } catch(err) { }
    }
  };

  // YENİ: Yazıyor... Olayını Tetikleme
  const mesajYazimiDegisti = (e) => {
    setMesaj(e.target.value);
    socket.emit('yaziyor', { kanal: aktifKanal, kullaniciAdi });
    clearTimeout(yazmaZamanlayici.current);
    yazmaZamanlayici.current = setTimeout(() => {
      socket.emit('yazmayi_birakti', { kanal: aktifKanal, kullaniciAdi });
    }, 1500);
  };

  const mesajGonder = () => {
    if (mesaj.trim() !== '') {
      socket.emit('mesaj_gonder', { id: socket.id, kullaniciAdi, metin: mesaj, dosyaTipi: 'text', saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kanal: aktifKanal, renk: avatarRenk, avatarResmi });
      setMesaj('');
      socket.emit('yazmayi_birakti', { kanal: aktifKanal, kullaniciAdi }); // Gönderince yazmayı durdur
    }
  };

  const medyaYukle = async (e, isAvatar = false) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("Maksimum 15MB desteklenir."); e.target.value = ''; return; }

    setMedyaYukleniyor(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'no0ddvg5'); 
    formData.append('cloud_name', 'dmdzi2mtx');   

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dmdzi2mtx/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        if (isAvatar) {
          // YENİ: Avatar Yükleme Kaydı
          setAvatarResmi(data.secure_url);
          await fetch(`${backendURL}/api/avatar-guncelle`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, avatarResmi: data.secure_url }) });
        } else {
          socket.emit('mesaj_gonder', { id: socket.id, kullaniciAdi, metin: data.secure_url, dosyaTipi: data.resource_type, saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kanal: aktifKanal, renk: avatarRenk, avatarResmi });
        }
      }
    } catch (err) { alert("Yükleme hatası."); } 
    finally { setMedyaYukleniyor(false); e.target.value = ''; }
  };

  const durumRengiGetir = (durum) => { if(durum === 'Çevrimiçi') return '#00ff88'; if(durum === 'Boşta') return '#ffea00'; if(durum === 'Rahatsız Etmeyin') return '#ff0055'; return '#4a4d57'; };
  const grupluKullanicilar = { 'Çevrimiçi': kanaldakiKullanicilar.filter(k => k.durum === 'Çevrimiçi'), 'Boşta': kanaldakiKullanicilar.filter(k => k.durum === 'Boşta'), 'Rahatsız Etmeyin': kanaldakiKullanicilar.filter(k => k.durum === 'Rahatsız Etmeyin') };

  if (!girisYapildi) {
    return (
      <div className="login-container futuristic-bg">
        <div className="login-box glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <div className="neon-logo">NEXUS</div>
          <h2>{kayitModu ? 'Ajan Kaydı Oluştur' : 'Sisteme Bağlan'}</h2>
          {hataMesaji && <div style={{color: '#ff0055', textShadow: '0 0 5px #ff0055'}}>{hataMesaji}</div>}
          {kayitModu ? (
            <form onSubmit={kayitOlFormSubmit} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <input type="text" placeholder="Kod Adı" value={kullaniciAdiInput} onChange={(e) => setKullaniciAdiInput(e.target.value)} required />
              <input type="email" placeholder="E-Posta Adresi" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Şifre" value={sifre} onChange={(e) => setSifre(e.target.value)} required />
              <button type="submit" className="neon-button">Kayıt Ol</button>
              <p onClick={() => {setKayitModu(false); setHataMesaji(''); setEmail(''); setSifre('');}} style={{color: '#00f3ff', cursor: 'pointer', textDecoration: 'underline'}}>Zaten bir ajan mısın? Giriş Yap</p>
            </form>
          ) : (
            <form onSubmit={girisYapFormSubmit} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <input type="text" placeholder="E-Posta veya Kod Adı" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder="Şifre" value={sifre} onChange={(e) => setSifre(e.target.value)} required />
              <button type="submit" className="neon-button">Giriş Protokolünü Başlat</button>
              <p onClick={() => {setKayitModu(true); setHataMesaji(''); setEmail(''); setSifre('');}} style={{color: '#00f3ff', cursor: 'pointer', textDecoration: 'underline'}}>Yeni misin? Kayıt Ol</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // YENİ: Dinamik Avatar Tarzı
  const avatarStili = (renk, resim) => ({
    backgroundColor: !resim ? renk : 'transparent',
    backgroundImage: resim ? `url(${resim})` : 'none',
    backgroundSize: 'cover', backgroundPosition: 'center',
    boxShadow: `0 0 8px ${renk}`, border: `2px solid ${resim ? renk : 'transparent'}`
  });

  const OdaIciAvatarlar = ({ kanalAdi }) => {
    const oOdakiler = sestekiKullanicilar.filter(k => k.kanal === kanalAdi);
    if (oOdakiler.length === 0) return null;
    return (
      <div className="nested-avatars">
        {oOdakiler.map(k => (
          <div key={k.socketId} className="nested-user">
            <div className={`nested-avatar ${konusanlar.includes(k.socketId) ? 'speaking' : ''}`} style={avatarStili(k.renk, k.avatarResmi)}></div>
            <span>{k.kullaniciAdi}</span>
          </div>
        ))}
      </div>
    );
  };

  const aktifEkranYayinlari = uzakSesler.filter(s => s.active && s.getVideoTracks().length > 0);
  const yayinEkraniAcik = yerelEkranAkim || aktifEkranYayinlari.length > 0;

  return (
    <div className="discord-layout">
      {girisSifreModali.acik && (
        <div className="settings-overlay">
          <div className="settings-modal glass-panel">
            <h2>🔒 {girisSifreModali.odaIsmi} (Şifreli)</h2>
            <form onSubmit={sifreliOdayaGirisIet}>
              <div className="setting-group"><input type="password" placeholder="Oda Şifresi" value={girilenOdaSifresi} onChange={(e) => setGirilenOdaSifresi(e.target.value)} required autoFocus style={{width: '100%'}}/></div>
              <div style={{display:'flex', gap:'10px'}}><button type="submit" className="neon-button">Bağlan</button><button type="button" className="neon-button close-btn" onClick={() => setGirisSifreModali({acik: false, odaIsmi: ''})}>İptal</button></div>
            </form>
          </div>
        </div>
      )}

      {odaKurModaliAcik && (
        <div className="settings-overlay">
          <div className="settings-modal glass-panel">
            <h2>Kendi Odanı Kur</h2>
            <form onSubmit={ozelOdaKur}>
              <div className="setting-group"><label>Oda İsmi:</label><input type="text" value={yeniOdaIsmi} onChange={(e) => setYeniOdaIsmi(e.target.value)} required /></div>
              <div className="setting-group"><label>Güvenlik:</label><select value={yeniOdaTipi} onChange={(e) => setYeniOdaTipi(e.target.value)}><option value="public">🌍 Herkese Açık</option><option value="private">🔒 Şifreli</option></select></div>
              {yeniOdaTipi === 'private' && (<div className="setting-group"><label>Şifre:</label><input type="password" value={yeniOdaSifresi} onChange={(e) => setYeniOdaSifresi(e.target.value)} required /></div>)}
              <div style={{display:'flex', gap:'10px'}}><button type="submit" className="neon-button">Oluştur</button><button type="button" className="neon-button close-btn" onClick={() => setOdaKurModaliAcik(false)}>İptal</button></div>
            </form>
          </div>
        </div>
      )}

      {ayarlarAcik && (
        <div className="settings-overlay">
          <div className="settings-modal glass-panel">
            <h2>Kullanıcı Ayarları</h2>
            <div className="setting-group">
              <label>Durum Modülü:</label>
              <select value={kullaniciDurumu} onChange={(e) => setKullaniciDurumu(e.target.value)}><option value="Çevrimiçi">Çevrimiçi</option><option value="Boşta">Boşta</option><option value="Rahatsız Etmeyin">Rahatsız Etmeyin</option><option value="Görünmez">Görünmez</option></select>
            </div>
            <div className="setting-group">
              <label>Profil Rengi:</label>
              <input type="color" value={avatarRenk} onChange={(e) => setAvatarRenk(e.target.value)} className="color-picker" />
            </div>
            {/* YENİ: Profil Fotoğrafı Yükleme */}
            <div className="setting-group">
              <label>Özel Profil Fotoğrafı (İsteğe Bağlı):</label>
              <input type="file" accept="image/*" onChange={(e) => medyaYukle(e, true)} disabled={medyaYukleniyor} />
              {medyaYukleniyor && <span style={{fontSize:'12px', color:'#00f3ff'}}>Medya Buluta Aktarılıyor...</span>}
            </div>
            <button className="neon-button close-btn" onClick={() => setAyarlarAcik(false)}>Kapat</button>
          </div>
        </div>
      )}

      <div className="server-sidebar"><div className="server-icon active" style={{boxShadow: `0 0 15px ${avatarRenk}`}}>NX</div></div>

      <div className="channel-sidebar">
        <div className="server-header"><h3>NEXUS SUNUCUSU</h3></div>
        <div className="channel-list">
          <p className="category-title">METİN AĞLARI</p>
          {METIN_KANALLARI.map((kanal) => (
            <div key={kanal} className={`channel-item ${aktifKanal === kanal ? 'active' : ''}`} onClick={() => setAktifKanal(kanal)}><span className="hash">#</span> {kanal}</div>
          ))}

          <p className="category-title" style={{marginTop: '20px'}}>SABİT SES BAĞLANTILARI</p>
          {SABIT_SES_KANALLARI.map((kanal) => (
            <div key={kanal}>
              <div className={`channel-item voice-channel ${aktifSesKanalı === kanal ? 'voice-active' : ''}`} onClick={() => sesliKanalaTikla(kanal, 'public')}><span className="hash">🔊</span> {kanal}</div>
              <OdaIciAvatarlar kanalAdi={kanal} />
            </div>
          ))}

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px'}}>
             <p className="category-title" style={{margin:0}}>ÖZEL ODALAR</p><span style={{color: '#00f3ff', cursor: 'pointer', fontSize: '18px', paddingRight: '10px'}} onClick={() => setOdaKurModaliAcik(true)}>+</span>
          </div>
          {ozelOdalar.map((oda) => (
            <div key={oda._id}>
              <div className={`channel-item voice-channel ${aktifSesKanalı === oda.isim ? 'voice-active' : ''}`} onClick={() => sesliKanalaTikla(oda.isim, oda.tip)}><span className="hash">{oda.tip === 'private' ? '🔒' : '🔊'}</span> {oda.isim}</div>
              <OdaIciAvatarlar kanalAdi={oda.isim} />
            </div>
          ))}
        </div>

        {aktifSesKanalı && (
          <div className="voice-control-panel glass-panel">
            <div className="voice-status"><div className={`pulse-dot ${konusanlar.includes(socket.id) ? 'speaking-pulse' : ''}`}></div><span>{aktifSesKanalı} Bağlı</span></div>
            <div className="voice-actions">
              <button className={`mic-btn ${!mikrofonAcik ? 'muted' : ''}`} onClick={mikrofonuGecisYap}>{mikrofonAcik ? '🎙️' : '🔇'}</button>
              <button className={`mic-btn share-btn ${ekranPaylasiliyor ? 'active-share' : ''}`} onClick={ekranPaylasiminiDegistir}>{ekranPaylasiliyor ? '💻 Kapat' : '🖥️ Paylaş'}</button>
              <button className="disconnect-btn" onClick={sesliKanaldanAyril}>❌</button>
            </div>
          </div>
        )}

        <div className="user-profile-bar">
          <div className="avatar-wrapper">
            <div className={`avatar ${konusanlar.includes(socket.id) ? 'speaking' : ''}`} style={avatarStili(avatarRenk, avatarResmi)}></div>
            <div className="status-dot" style={{ backgroundColor: durumRengiGetir(kullaniciDurumu), boxShadow: `0 0 8px ${durumRengiGetir(kullaniciDurumu)}` }}></div>
          </div>
          <div className="user-info"><span className="username">{kullaniciAdi}</span><span className="status">{kullaniciDurumu}</span></div>
          <div className="settings-icon" onClick={() => setAyarlarAcik(true)}>⚙️</div>
        </div>
      </div>

      <div className="chat-area">
        <div className="chat-header"><span className="hash">#</span><h3>{aktifKanal}</h3></div>
        
        {yayinEkraniAcik && (
          <div className="screenshare-grid animate-slide-in">
            {yerelEkranAkim && (
              <div className="video-card"><video autoPlay muted controls ref={el => {if(el) el.srcObject = yerelEkranAkim}} /><span className="video-label" style={{color: avatarRenk}}>● Sen (Canlı)</span></div>
            )}
            {aktifEkranYayinlari.map((s, i) => (
              <div key={i} className="video-card"><video autoPlay controls ref={el => {if(el && el.srcObject !== s) el.srcObject = s}} /><span className="video-label" style={{color: '#ff0055'}}>● Yayın İzleniyor</span></div>
            ))}
          </div>
        )}

        <div className="messages-container" style={{ height: yayinEkraniAcik ? '50%' : '100%' }}>
          {mesajListesi.length === 0 ? (
            <div className="empty-chat animate-fade-in">
              <h3 style={{textShadow: `0 0 10px ${avatarRenk}`}}>#{aktifKanal} ağına bağlandın.</h3><p>İletişim protokolünü başlat...</p>
            </div>
          ) : (
            mesajListesi.map((m, index) => (
              <div key={index} className="message animate-slide-in">
                <div className="message-avatar" style={avatarStili(m.renk, m.avatarResmi)}></div>
                <div className="message-content" style={{ width: '100%' }}>
                  <div className="message-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span className="message-username" style={{ color: m.renk, textShadow: `0 0 5px ${m.renk}88` }}>{m.kullaniciAdi}</span>
                      <span className="message-time" style={{ marginLeft: '10px' }}>{m.saat}</span>
                    </div>
                    {/* YENİ: Kendi mesajını Silme Butonu */}
                    {m.kullaniciAdi === kullaniciAdi && (
                      <span className="delete-msg-btn" onClick={() => socket.emit('mesaj_sil', { kanal: aktifKanal, mesajId: m.mesajId })} title="Mesajı Geri Çek">🗑️</span>
                    )}
                  </div>
                  <div className="message-text">
                    {m.dosyaTipi === 'image' ? (
                      <img src={m.metin} alt="Görsel" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '10px', border: `2px solid ${m.renk}` }} />
                    ) : m.dosyaTipi === 'video' ? (
                      <video src={m.metin} controls style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '10px', border: `2px solid ${m.renk}` }} />
                    ) : ( m.metin )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={mesajlarSonuRef} />
        </div>

        <div className="message-input-area" style={{ position: 'relative' }}>
          {/* YENİ: Yazıyor Bildirimi */}
          {yazanKullanicilar.length > 0 && (
            <div className="typing-indicator">
              <div className="typing-dots"><span></span><span></span><span></span></div>
              {yazanKullanicilar.join(', ')} yazıyor...
            </div>
          )}

          <div className="input-wrapper glass-input" style={{ display: 'flex', alignItems: 'center', padding: '5px 15px', gap: '15px' }}>
            <input type="file" id="medya-secici" style={{ display: 'none' }} accept="image/*,video/*" onChange={(e) => medyaYukle(e, false)} disabled={medyaYukleniyor} />
            <label htmlFor="medya-secici" style={{ cursor: medyaYukleniyor ? 'wait' : 'pointer', fontSize: '26px', color: medyaYukleniyor ? '#8b9bb4' : '#00f3ff' }}>{medyaYukleniyor ? '⏳' : '⊕'}</label>
            <input type="text" value={mesaj} onChange={mesajYazimiDegisti} placeholder={medyaYukleniyor ? "Medya aktarılıyor..." : `#${aktifKanal} ağına veri gönder...`} onKeyDown={(e) => e.key === 'Enter' && mesajGonder()} autoFocus disabled={medyaYukleniyor} style={{ flex: 1, padding: '10px 0' }} />
          </div>
        </div>
      </div>

      <div className="members-sidebar">
        <div className="members-header"><h3>AĞDAKİ ÜYELER</h3></div>
        <div className="members-list-content">
          {['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin'].map((durum) => (
            grupluKullanicilar[durum].length > 0 && (
              <div key={durum} className="member-group">
                <h4 style={{ color: durumRengiGetir(durum), textShadow: `0 0 5px ${durumRengiGetir(durum)}88` }}>{durum.toUpperCase()} — {grupluKullanicilar[durum].length}</h4>
                {grupluKullanicilar[durum].map(k => (
                  <div key={k.id} className="member-item animate-fade-in">
                    <div className="avatar-wrapper">
                      <div className="member-avatar" style={avatarStili(k.renk, k.avatarResmi)}></div>
                      <div className="status-dot" style={{ backgroundColor: durumRengiGetir(k.durum) }}></div>
                    </div>
                    <span className="member-name" style={{ color: k.renk }}>{k.kullaniciAdi}</span>
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
