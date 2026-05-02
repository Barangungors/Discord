import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// Bağlantı Adresimiz
const backendURL = 'https://discord-iifa.onrender.com';
const socket = io(backendURL);

const METIN_KANALLARI = ['genel-sohbet', 'yazilim', 'oyun-odasi', 'muzik'];
const SES_KANALLARI = ['Lobi', 'Oyun Ses', 'Sohbet Odası'];

function App() {
  // --- YENİ KAYIT VE GİRİŞ STATE'LERİ ---
  const [kayitModu, setKayitModu] = useState(false); // Formu Kayıt/Giriş arası geçiş yaptırır
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [kullaniciAdiInput, setKullaniciAdiInput] = useState('');
  const [hataMesaji, setHataMesaji] = useState('');

  // --- TEMEL KULLANICI STATE'LERİ ---
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [girisYapildi, setGirisYapildi] = useState(false);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const [kullaniciDurumu, setKullaniciDurumu] = useState('Çevrimiçi');
  const [avatarRenk, setAvatarRenk] = useState('#00f3ff');

  const [aktifKanal, setAktifKanal] = useState(METIN_KANALLARI[0]);
  const [mesaj, setMesaj] = useState('');
  const [mesajListesi, setMesajListesi] = useState([]);
  const [kanaldakiKullanicilar, setKanaldakiKullanicilar] = useState([]);
  
  // --- SESLİ KANAL VE WEBRTC STATE'LERİ ---
  const [aktifSesKanalı, setAktifSesKanali] = useState(null);
  const [mikrofonAcik, setMikrofonAcik] = useState(false);
  const [uzakSesler, setUzakSesler] = useState([]); 
  const medyaAkisiRef = useRef(null);
  const peerBaglantilari = useRef({}); 
  const mesajlarSonuRef = useRef(null);

  // --- YENİ: KAYIT OL FONKSİYONU ---
  const kayitOlFormSubmit = async (e) => {
    e.preventDefault();
    setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/kayit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullaniciAdi: kullaniciAdiInput, email, sifre })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
        setKayitModu(false); // Kayıt olunca giriş formuna at
        setSifre(''); // Şifreyi temizle
      } else {
        setHataMesaji(data.hata);
      }
    } catch (err) {
      setHataMesaji("Sunucuya bağlanılamadı. Lütfen tekrar dene.");
    }
  };

  // --- YENİ: GİRİŞ YAP FONKSİYONU ---
  const girisYapFormSubmit = async (e) => {
    e.preventDefault();
    setHataMesaji('');
    try {
      const res = await fetch(`${backendURL}/api/giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sifre })
      });
      const data = await res.json();

      if (res.ok) {
        setKullaniciAdi(data.kullaniciAdi);
        setAvatarRenk(data.avatarRenk || '#00f3ff');
        setGirisYapildi(true); // Sisteme al
      } else {
        setHataMesaji(data.hata);
      }
    } catch (err) {
      setHataMesaji("Sunucuya bağlanılamadı. Lütfen tekrar dene.");
    }
  };

  // 1. KULLANICI BİLGİSİ VE METİN KANALI SENKRONİZASYONU
  useEffect(() => {
    if (girisYapildi) {
      socket.emit('kanala_katil', {
        kanalAdi: aktifKanal,
        kullaniciBilgisi: { kullaniciAdi, durum: kullaniciDurumu, renk: avatarRenk }
      });
      setMesajListesi([]);
    }
  }, [aktifKanal, girisYapildi, kullaniciDurumu, avatarRenk]);

  // 2. TEMEL SOKET DİNLEYİCİLERİ
  useEffect(() => {
    socket.on('mesaj_al', (data) => setMesajListesi((eski) => [...eski, data]));
    socket.on('gecmis_mesajlar', (eskiMesajlar) => setMesajListesi(eskiMesajlar));
    socket.on('kullanici_listesi', (liste) => setKanaldakiKullanicilar(liste.filter(k => k.durum !== 'Görünmez')));

    return () => {
      socket.off('mesaj_al');
      socket.off('gecmis_mesajlar');
      socket.off('kullanici_listesi');
    };
  }, []);

  // 3. WEBRTC (GERÇEK SES İLETİMİ) DİNLEYİCİLERİ
  useEffect(() => {
    if(!aktifSesKanalı) return;

    const peerOlustur = (hedefID, arayanBenMiyim) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      
      if(medyaAkisiRef.current) {
        medyaAkisiRef.current.getTracks().forEach(track => peer.addTrack(track, medyaAkisiRef.current));
      }

      peer.ontrack = (event) => {
        setUzakSesler((eski) => {
          if (!eski.includes(event.streams[0])) return [...eski, event.streams[0]];
          return eski;
        });
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_adayi', { hedef: hedefID, aday: event.candidate });
        }
      };

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

    socket.on('ses_cevabi', async (data) => {
      if(peerBaglantilari.current[data.gonderen]) {
        await peerBaglantilari.current[data.gonderen].setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    });

    socket.on('ice_adayi', async (data) => {
      if (peerBaglantilari.current[data.gonderen]) {
        await peerBaglantilari.current[data.gonderen].addIceCandidate(new RTCIceCandidate(data.aday));
      }
    });

    return () => {
      socket.off('yeni_kullanici_ses_kanalinda');
      socket.off('ses_teklifi');
      socket.off('ses_cevabi');
      socket.off('ice_adayi');
    };
  }, [aktifSesKanalı]);

  useEffect(() => {
    mesajlarSonuRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesajListesi]);

  // --- SES FONKSİYONLARI ---
  const sesliKanalaBaglan = async (kanal) => {
    try {
      if (medyaAkisiRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      medyaAkisiRef.current = stream;
      setAktifSesKanali(kanal);
      setMikrofonAcik(true);
      socket.emit('sesli_kanala_katil', kanal);
    } catch (err) {
      alert("Mikrofon izni verilmedi veya donanım bulunamadı!");
    }
  };

  const sesliKanaldanAyril = () => {
    if (medyaAkisiRef.current) {
      medyaAkisiRef.current.getTracks().forEach(track => track.stop());
      medyaAkisiRef.current = null;
    }
    Object.values(peerBaglantilari.current).forEach(peer => peer.close());
    peerBaglantilari.current = {};
    setUzakSesler([]);
    
    socket.emit('sesli_kanaldan_ayril', aktifSesKanalı);
    setAktifSesKanali(null);
    setMikrofonAcik(false);
  };

  const mikrofonuGecisYap = () => {
    if (medyaAkisiRef.current) {
      const audioTrack = medyaAkisiRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setMikrofonAcik(audioTrack.enabled);
    }
  };

  const mesajGonder = () => {
    if (mesaj.trim() !== '') {
      socket.emit('mesaj_gonder', {
        id: socket.id,
        kullaniciAdi,
        metin: mesaj,
        saat: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        kanal: aktifKanal,
        renk: avatarRenk
      });
      setMesaj('');
    }
  };

  const durumRengiGetir = (durum) => {
    if(durum === 'Çevrimiçi') return '#00ff88'; 
    if(durum === 'Boşta') return '#ffea00'; 
    if(durum === 'Rahatsız Etmeyin') return '#ff0055'; 
    return '#4a4d57';
  };

  const grupluKullanicilar = {
    'Çevrimiçi': kanaldakiKullanicilar.filter(k => k.durum === 'Çevrimiçi'),
    'Boşta': kanaldakiKullanicilar.filter(k => k.durum === 'Boşta'),
    'Rahatsız Etmeyin': kanaldakiKullanicilar.filter(k => k.durum === 'Rahatsız Etmeyin'),
  };

  // --- YENİ EKRAN: GİRİŞ YAP / KAYIT OL ---
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
              <p onClick={() => {setKayitModu(false); setHataMesaji('');}} style={{color: '#00f3ff', cursor: 'pointer', textDecoration: 'underline'}}>Zaten bir ajan mısın? Giriş Yap</p>
            </form>
          ) : (
            <form onSubmit={girisYapFormSubmit} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <input type="email" placeholder="E-Posta Adresi" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder="Şifre" value={sifre} onChange={(e) => setSifre(e.target.value)} required />
              <button type="submit" className="neon-button">Giriş Protokolünü Başlat</button>
              <p onClick={() => {setKayitModu(true); setHataMesaji('');}} style={{color: '#00f3ff', cursor: 'pointer', textDecoration: 'underline'}}>Yeni misin? Kayıt Ol</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- ANA SOHBET EKRANI (DEĞİŞMEDİ) ---
  return (
    <div className="discord-layout">
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

          <p className="category-title" style={{marginTop: '20px'}}>SESLİ BAĞLANTILAR</p>
          {SES_KANALLARI.map((kanal) => (
            <div key={kanal} className={`channel-item voice-channel ${aktifSesKanalı === kanal ? 'voice-active' : ''}`} onClick={() => sesliKanalaBaglan(kanal)}>
              <span className="hash">🔊</span> {kanal}
            </div>
          ))}
        </div>

        {aktifSesKanalı && (
          <div className="voice-control-panel glass-panel">
            <div className="voice-status">
              <div className="pulse-dot"></div>
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
            <div className="avatar" style={{ backgroundColor: avatarRenk, boxShadow: `0 0 10px ${avatarRenk}` }}></div>
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
          <audio
            key={index}
            autoPlay
            ref={(audioElement) => {
              if (audioElement && audioElement.srcObject !== stream) {
                audioElement.srcObject = stream;
              }
            }}
          />
        ))}
      </div>

    </div>
  );
}

export default App;
