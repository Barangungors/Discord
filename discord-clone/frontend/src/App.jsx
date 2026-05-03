import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const backendURL = 'https://discord-iifa.onrender.com';
const socket = io(backendURL);

const METIN_KANALLARI = ['genel-sohbet', 'yazilim', 'oyun-odasi', 'muzik'];
const SABIT_SES_KANALLARI = ['Lobi', 'Oyun Ses', 'Sohbet Odası'];

// Ses Efektleri
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

  const [aktifKanal, setAktifKanal] = useState(METIN_KANALLARI[0]);
  const [mesaj, setMesaj] = useState('');
  const [mesajListesi, setMesajListesi] = useState([]);
  const [kanaldakiKullanicilar, setKanaldakiKullanicilar] = useState([]);
  
  // --- YENİ ODA VE SES STATE'LERİ ---
  const [aktifSesKanalı, setAktifSesKanali] = useState(null);
  const [mikrofonAcik, setMikrofonAcik] = useState(false);
  const [uzakSesler, setUzakSesler] = useState([]); 
  const [sestekiKullanicilar, setSestekiKullanicilar] = useState([]); // Kanalların altında görünenler
  const [konusanlar, setKonusanlar] = useState([]); // Kimin etrafı yeşil yanacak
  const [ozelOdalar, setOzelOdalar] = useState([]);
  
  // Modal State'leri
  const [odaKurModaliAcik, setOdaKurModaliAcik] = useState(false);
  const [yeniOdaIsmi, setYeniOdaIsmi] = useState('');
  const [yeniOdaTipi, setYeniOdaTipi] = useState('public');
  const [yeniOdaSifresi, setYeniOdaSifresi] = useState('');
  const [girisSifreModali, setGirisSifreModali] = useState({ acik: false, odaIsmi: '' });
  const [girilenOdaSifresi, setGirilenOdaSifresi] = useState('');

  const medyaAkisiRef = useRef(null);
  const peerBaglantilari = useRef({}); 
  const sesFrekansDurdurucular = useRef({}); // Konuşma sensörlerini kapatmak için
  const mesajlarSonuRef = useRef(null);

  // --- SES SEVİYESİ ALGILAYICI (GREEN GLOW) ---
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
        let average = sum / bufferLength;

        if (average > 15 && !isSpeaking) {
          isSpeaking = true;
          setKonusanlar(prev => prev.includes(userId) ? prev : [...prev, userId]);
        } else if (average <= 15 && isSpeaking) {
          isSpeaking = false;
          setKonusanlar(prev => prev.filter(id => id !== userId));
        }
        animationId = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      sesFrekansDurdurucular.current[userId] = () => {
        cancelAnimationFrame(animationId);
        source.disconnect();
        analyser.disconnect();
        if(audioContext.state !== 'closed') audioContext.close();
      };
    } catch (err) { console.log("Ses sensörü hatası", err); }
  };

  // --- API İSTEKLERİ ---
  const odalariGetir = async () => {
    try {
      const res = await fetch(`${backendURL}/api/odalar`);
      if(res.ok) setOzelOdalar(await res.json());
    } catch (err) { console.log(err); }
  };

  useEffect(() => { odalariGetir(); }, []);

  const kayitOlFormSubmit = async (e) => {
    e.preventDefault(); setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/kayit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullaniciAdi: kullaniciAdiInput, email, sifre })
      });
      if (res.ok) { alert("Kayıt başarılı! Giriş yapabilirsin."); setKayitModu(false); setSifre(''); } 
      else setHataMesaji((await res.json()).hata);
    } catch (err) { setHataMesaji("Sunucuya bağlanılamadı."); }
  };

  const girisYapFormSubmit = async (e) => {
    e.preventDefault(); setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/giris`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, sifre })
      });
      const data = await res.json();
      if (res.ok) { setKullaniciAdi(data.kullaniciAdi); setAvatarRenk(data.avatarRenk || '#00f3ff'); setGirisYapildi(true); } 
      else setHataMesaji(data.hata);
    } catch (err) { setHataMesaji("Sunucuya bağlanılamadı."); }
  };

  const ozelOdaKur = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendURL}/api/oda-olustur`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isim: yeniOdaIsmi, tip: yeniOdaTipi, sifre: yeniOdaSifresi, olusturan: kullaniciAdi })
      });
      if (res.ok) {
        setOdaKurModaliAcik(false); setYeniOdaIsmi(''); setYeniOdaSifresi('');
      } else alert((await res.json()).hata);
    } catch (err) { alert("Oda kurulamadı."); }
  };

  const sifreliOdayaGirisIet = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendURL}/api/oda-giris`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isim: girisSifreModali.odaIsmi, sifre: girilenOdaSifresi })
      });
      if (res.ok) {
        setGirisSifreModali({ acik: false, odaIsmi: '' }); setGirilenOdaSifresi('');
        sesliKanalaBaglanIcraat(girisSifreModali.odaIsmi); // Şifre doğruysa gir
      } else alert((await res.json()).hata);
    } catch (err) { alert("Hata oluştu."); }
  };

  // --- SOKET DİNLEYİCİLERİ ---
  useEffect(() => {
    if (girisYapildi) {
      socket.emit('kanala_katil', { kanalAdi: aktifKanal, kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk } });
      setMesajListesi([]);
    }
  }, [aktifKanal, girisYapildi, kullaniciDurumu, avatarRenk]);

  useEffect(() => {
    socket.on('mesaj_al', (data) => setMesajListesi((eski) => [...eski, data]));
    socket.on('gecmis_mesajlar', (eskiMesajlar) => setMesajListesi(eskiMesajlar));
    socket.on('kullanici_listesi', (liste) => setKanaldakiKullanicilar(liste.filter(k => k.durum !== 'Görünmez')));
    socket.on('sesteki_kullanicilar', (liste) => setSestekiKullanicilar(liste));
    socket.on('odalar_guncellendi', (odalar) => setOzelOdalar(odalar));

    return () => {
      socket.off('mesaj_al'); socket.off('gecmis_mesajlar'); socket.off('kullanici_listesi'); socket.off('sesteki_kullanicilar'); socket.off('odalar_guncellendi');
    };
  }, []);

  // WEBRTC VE SES
  useEffect(() => {
    if(!aktifSesKanalı) return;
    const peerOlustur = (hedefID, arayanBenMiyim) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      if(medyaAkisiRef.current) medyaAkisiRef.current.getTracks().forEach(track => peer.addTrack(track, medyaAkisiRef.current));

      peer.ontrack = (event) => {
        setUzakSesler((eski) => { if (!eski.includes(event.streams[0])) return [...eski, event.streams[0]]; return eski; });
        sesSeviyesiDinle(event.streams[0], hedefID); // Karşı tarafın konuşma sensörü
      };
      peer.onicecandidate = (event) => { if (event.candidate) socket.emit('ice_adayi', { hedef: hedefID, aday: event.candidate }); };
      return peer;
    };

    socket.on('yeni_kullanici_ses_kanalinda', async (yeniKullaniciID) => {
      const peer = peerOlustur(yeniKullaniciID, true);
      peerBaglantilari.current[yeniKullaniciID] = peer;
      const teklif = await peer.createOffer();
      await peer.setLocalDescription(teklif);
      socket.emit('ses_teklifi', { hedef: yeniKullaniciID, sdp: teklif });
    });

    socket.on('ses_teklifi', async (data) => {
      const peer = peerOlustur(data.gonderen, false);
      peerBaglantilari.current[data.gonderen] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const cevap = await peer.createAnswer();
      await peer.setLocalDescription(cevap);
      socket.emit('ses_cevabi', { hedef: data.gonderen, sdp: cevap });
    });

    socket.on('ses_cevabi', async (data) => { if(peerBaglantilari.current[data.gonderen]) await peerBaglantilari.current[data.gonderen].setRemoteDescription(new RTCSessionDescription(data.sdp)); });
    socket.on('ice_adayi', async (data) => { if (peerBaglantilari.current[data.gonderen]) await peerBaglantilari.current[data.gonderen].addIceCandidate(new RTCIceCandidate(data.aday)); });
    socket.on('kullanici_sesten_ayrildi', (id) => {
      if(peerBaglantilari.current[id]) { peerBaglantilari.current[id].close(); delete peerBaglantilari.current[id]; }
      if(sesFrekansDurdurucular.current[id]) { sesFrekansDurdurucular.current[id](); delete sesFrekansDurdurucular.current[id]; }
      setKonusanlar(prev => prev.filter(kId => kId !== id));
    });

    return () => {
      socket.off('yeni_kullanici_ses_kanalinda'); socket.off('ses_teklifi'); socket.off('ses_cevabi'); socket.off('ice_adayi'); socket.off('kullanici_sesten_ayrildi');
    };
  }, [aktifSesKanalı]);

  useEffect(() => {
    const yenidenBaglaninca = () => {
      if (girisYapildi) {
        socket.emit('kanala_katil', { kanalAdi: aktifKanal, kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk } });
        if (aktifSesKanalı) socket.emit('sesli_kanala_katil', { kanalAdi: aktifSesKanalı, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk } });
      }
    };
    socket.on('connect', yenidenBaglaninca);
    return () => socket.off('connect', yenidenBaglaninca);
  }, [girisYapildi, aktifKanal, kullaniciAdi, kullaniciDurumu, avatarRenk, aktifSesKanalı]);

  useEffect(() => { mesajlarSonuRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mesajListesi]);

  // --- TIKLAMA YÖNETİCİLERİ ---
  const sesliKanalaTikla = (kanalIsmi, kanalTipi = 'public') => {
    if (aktifSesKanalı === kanalIsmi) return; // Zaten o odadaysan işlem yapma
    if (kanalTipi === 'private') {
      setGirisSifreModali({ acik: true, odaIsmi: kanalIsmi }); // Şifre sor
    } else {
      sesliKanalaBaglanIcraat(kanalIsmi); // Direkt gir
    }
  };

  const sesliKanalaBaglanIcraat = async (kanal) => {
    try {
      if (aktifSesKanalı) sesliKanaldanAyril(); // Başka odadaysa önce çıkış yap
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      medyaAkisiRef.current = stream;
      setAktifSesKanali(kanal);
      setMikrofonAcik(true);
      
      // Kendi mikrofonumuza sensör bağlıyoruz (Yeşil ışık yansın diye)
      sesSeviyesiDinle(stream, socket.id);

      socket.emit('sesli_kanala_katil', { kanalAdi: kanal, kullaniciBilgisi: { kullaniciAdi, renk: avatarRenk } });
      SES_BAGLANDI.play(); // BAĞLANMA SESİ ÇAL
    } catch (err) { alert("Mikrofon izni verilmedi!"); }
  };

  const sesliKanaldanAyril = () => {
    if (medyaAkisiRef.current) { medyaAkisiRef.current.getTracks().forEach(track => track.stop()); medyaAkisiRef.current = null; }
    Object.values(peerBaglantilari.current).forEach(peer => peer.close());
    Object.values(sesFrekansDurdurucular.current).forEach(durdur => durdur());
    
    peerBaglantilari.current = {}; sesFrekansDurdurucular.current = {};
    setUzakSesler([]); setKonusanlar([]);
    socket.emit('sesli_kanaldan_ayril', aktifSesKanalı);
    setAktifSesKanali(null); setMikrofonAcik(false);
    SES_AYRILDI.play(); // AYRILMA SESİ ÇAL
  };

  const mikrofonuGecisYap = () => {
    if (medyaAkisiRef.current) {
      const track = medyaAkisiRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setMikrofonAcik(track.enabled);
    }
  };

  const mesajGonder = () => {
    if (mesaj.trim() !== '') {
      socket.emit('mesaj_gonder', { id: socket.id, kullaniciAdi, metin: mesaj, saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kanal: aktifKanal, renk: avatarRenk });
      setMesaj('');
    }
  };

  const durumRengiGetir = (durum) => {
    if(durum === 'Çevrimiçi') return '#00ff88'; if(durum === 'Boşta') return '#ffea00'; if(durum === 'Rahatsız Etmeyin') return '#ff0055'; return '#4a4d57';
  };

  const grupluKullanicilar = {
    'Çevrimiçi': kanaldakiKullanicilar.filter(k => k.durum === 'Çevrimiçi'), 'Boşta': kanaldakiKullanicilar.filter(k => k.durum === 'Boşta'), 'Rahatsız Etmeyin': kanaldakiKullanicilar.filter(k => k.durum === 'Rahatsız Etmeyin'),
  };

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

  // Odaların altına o odadaki kişilerin avatarlarını çizen bileşen
  const OdaIciAvatarlar = ({ kanalAdi }) => {
    const oOdakiler = sestekiKullanicilar.filter(k => k.kanal === kanalAdi);
    if (oOdakiler.length === 0) return null;
    return (
      <div className="nested-avatars">
        {oOdakiler.map(k => (
          <div key={k.socketId} className="nested-user">
            <div className={`nested-avatar ${konusanlar.includes(k.socketId) ? 'speaking' : ''}`} style={{ backgroundColor: k.renk }}></div>
            <span>{k.kullaniciAdi}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="discord-layout">
      {/* Şifreli Odaya Giriş Modali */}
      {girisSifreModali.acik && (
        <div className="settings-overlay">
          <div className="settings-modal glass-panel">
            <h2>🔒 {girisSifreModali.odaIsmi} (Şifreli)</h2>
            <form onSubmit={sifreliOdayaGirisIet}>
              <div className="setting-group">
                <input type="password" placeholder="Oda Şifresini Girin" value={girilenOdaSifresi} onChange={(e) => setGirilenOdaSifresi(e.target.value)} required autoFocus style={{width: '100%'}}/>
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <button type="submit" className="neon-button">Bağlan</button>
                <button type="button" className="neon-button close-btn" onClick={() => setGirisSifreModali({acik: false, odaIsmi: ''})}>İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Oda Oluştur Modali */}
      {odaKurModaliAcik && (
        <div className="settings-overlay">
          <div className="settings-modal glass-panel">
            <h2>Kendi Odanı Kur</h2>
            <form onSubmit={ozelOdaKur}>
              <div className="setting-group">
                <label>Oda İsmi:</label>
                <input type="text" value={yeniOdaIsmi} onChange={(e) => setYeniOdaIsmi(e.target.value)} required />
              </div>
              <div className="setting-group">
                <label>Güvenlik Seviyesi:</label>
                <select value={yeniOdaTipi} onChange={(e) => setYeniOdaTipi(e.target.value)}>
                  <option value="public">🌍 Herkese Açık</option>
                  <option value="private">🔒 Şifreli (Gizli)</option>
                </select>
              </div>
              {yeniOdaTipi === 'private' && (
                <div className="setting-group">
                  <label>Oda Şifresi:</label>
                  <input type="password" value={yeniOdaSifresi} onChange={(e) => setYeniOdaSifresi(e.target.value)} required />
                </div>
              )}
              <div style={{display:'flex', gap:'10px'}}>
                <button type="submit" className="neon-button">Oluştur</button>
                <button type="button" className="neon-button close-btn" onClick={() => setOdaKurModaliAcik(false)}>İptal</button>
              </div>
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
              <select value={kullaniciDurumu} onChange={(e) => setKullaniciDurumu(e.target.value)}>
                <option value="Çevrimiçi">Çevrimiçi</option>
                <option value="Boşta">Boşta</option>
                <option value="Rahatsız Etmeyin">Rahatsız Etmeyin</option>
                <option value="Görünmez">Görünmez</option>
              </select>
            </div>
            <div className="setting-group">
              <label>Hologram Rengi (Avatar):</label>
              <input type="color" value={avatarRenk} onChange={(e) => setAvatarRenk(e.target.value)} className="color-picker" />
            </div>
            <button className="neon-button close-btn" onClick={() => setAyarlarAcik(false)}>Senkronize Et ve Çık</button>
          </div>
        </div>
      )}

      <div className="server-sidebar">
        <div className="server-icon active" style={{boxShadow: `0 0 15px ${avatarRenk}`}}>NX</div>
      </div>

      <div className="channel-sidebar">
        <div className="server-header"><h3>NEXUS SUNUCUSU</h3></div>
        <div className="channel-list">
          <p className="category-title">METİN AĞLARI</p>
          {METIN_KANALLARI.map((kanal) => (
            <div key={kanal} className={`channel-item ${aktifKanal === kanal ? 'active' : ''}`} onClick={() => setAktifKanal(kanal)}>
              <span className="hash">#</span> {kanal}
            </div>
          ))}

          <p className="category-title" style={{marginTop: '20px'}}>SABİT SES BAĞLANTILARI</p>
          {SABIT_SES_KANALLARI.map((kanal) => (
            <div key={kanal}>
              <div className={`channel-item voice-channel ${aktifSesKanalı === kanal ? 'voice-active' : ''}`} onClick={() => sesliKanalaTikla(kanal, 'public')}>
                <span className="hash">🔊</span> {kanal}
              </div>
              <OdaIciAvatarlar kanalAdi={kanal} />
            </div>
          ))}

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px'}}>
             <p className="category-title" style={{margin:0}}>ÖZEL ODALAR</p>
             <span style={{color: '#00f3ff', cursor: 'pointer', fontSize: '18px', paddingRight: '10px'}} onClick={() => setOdaKurModaliAcik(true)}>+</span>
          </div>
          
          {ozelOdalar.map((oda) => (
            <div key={oda._id}>
              <div className={`channel-item voice-channel ${aktifSesKanalı === oda.isim ? 'voice-active' : ''}`} onClick={() => sesliKanalaTikla(oda.isim, oda.tip)}>
                <span className="hash">{oda.tip === 'private' ? '🔒' : '🔊'}</span> {oda.isim}
              </div>
              <OdaIciAvatarlar kanalAdi={oda.isim} />
            </div>
          ))}

        </div>

        {aktifSesKanalı && (
          <div className="voice-control-panel glass-panel">
            <div className="voice-status">
              <div className={`pulse-dot ${konusanlar.includes(socket.id) ? 'speaking-pulse' : ''}`}></div>
              <span>{aktifSesKanalı} Bağlı</span>
            </div>
            <div className="voice-actions">
              <button className={`mic-btn ${!mikrofonAcik ? 'muted' : ''}`} onClick={mikrofonuGecisYap}>
                {mikrofonAcik ? '🎙️ Açık' : '🔇 Kapalı'}
              </button>
              <button className="disconnect-btn" onClick={sesliKanaldanAyril}>❌ Çık</button>
            </div>
          </div>
        )}

        <div className="user-profile-bar">
          <div className="avatar-wrapper">
            <div className={`avatar ${konusanlar.includes(socket.id) ? 'speaking' : ''}`} style={{ backgroundColor: avatarRenk, boxShadow: konusanlar.includes(socket.id) ? '' : `0 0 10px ${avatarRenk}` }}></div>
            <div className="status-dot" style={{ backgroundColor: durumRengiGetir(kullaniciDurumu), boxShadow: `0 0 8px ${durumRengiGetir(kullaniciDurumu)}` }}></div>
          </div>
          <div className="user-info">
            <span className="username">{kullaniciAdi}</span>
            <span className="status">{kullaniciDurumu}</span>
          </div>
          <div className="settings-icon" onClick={() => setAyarlarAcik(true)}>⚙️</div>
        </div>
      </div>

      <div className="chat-area">
        <div className="chat-header">
          <span className="hash">#</span><h3>{aktifKanal}</h3>
        </div>
        <div className="messages-container">
          {mesajListesi.length === 0 ? (
            <div className="empty-chat animate-fade-in">
              <h3 style={{textShadow: `0 0 10px ${avatarRenk}`}}>#{aktifKanal} ağına bağlandın.</h3>
              <p>İletişim protokolünü başlat...</p>
            </div>
          ) : (
            mesajListesi.map((m, index) => (
              <div key={index} className="message animate-slide-in">
                <div className="message-avatar" style={{ backgroundColor: m.renk, boxShadow: `0 0 8px ${m.renk}` }}></div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-username" style={{ color: m.renk, textShadow: `0 0 5px ${m.renk}88` }}>{m.kullaniciAdi}</span>
                    <span className="message-time">{m.saat}</span>
                  </div>
                  <div className="message-text">{m.metin}</div>
                </div>
              </div>
            ))
          )}
          <div ref={mesajlarSonuRef} />
        </div>
        <div className="message-input-area">
          <div className="input-wrapper glass-input">
            <input type="text" value={mesaj} onChange={(e) => setMesaj(e.target.value)} placeholder={`#${aktifKanal} ağına veri gönder...`} onKeyDown={(e) => e.key === 'Enter' && mesajGonder()} autoFocus />
          </div>
        </div>
      </div>

      <div className="members-sidebar">
        <div className="members-header"><h3>AĞDAKİ ÜYELER</h3></div>
        <div className="members-list-content">
          {['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin'].map((durum) => (
            grupluKullanicilar[durum].length > 0 && (
              <div key={durum} className="member-group">
                <h4 style={{ color: durumRengiGetir(durum), textShadow: `0 0 5px ${durumRengiGetir(durum)}88` }}>
                  {durum.toUpperCase()} — {grupluKullanicilar[durum].length}
                </h4>
                {grupluKullanicilar[durum].map(k => (
                  <div key={k.id} className="member-item animate-fade-in">
                    <div className="avatar-wrapper">
                      <div className="member-avatar" style={{ backgroundColor: k.renk, boxShadow: `0 0 8px ${k.renk}` }}></div>
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

      <div style={{ display: 'none' }}>
        {uzakSesler.map((stream, index) => (
          <audio key={index} autoPlay ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} />
        ))}
      </div>
    </div>
  );
}

export default App;
