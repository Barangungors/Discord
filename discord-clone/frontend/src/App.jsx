import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// DİKKAT: Ngrok adımında buradaki 'http://localhost:3001' adresini değiştireceğiz!
// Önceki hali: const socket = io('https://...ngrok.dev');
const socket = io('https://discord-iifa.onrender.com');

const METIN_KANALLARI = ['genel-sohbet', 'yazilim', 'oyun-odasi', 'muzik'];
const SES_KANALLARI = ['Lobi', 'Oyun Ses', 'Sohbet Odası'];

function App() {
  const [kullaniciAdiInput, setKullaniciAdiInput] = useState('');
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
  const [uzakSesler, setUzakSesler] = useState([]); // Karşıdan gelen ses objeleri (Stream'ler)
  const medyaAkisiRef = useRef(null);
  const peerBaglantilari = useRef({}); // Kiminle tünelimiz var
  const mesajlarSonuRef = useRef(null);

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

  // 2. TEMEL SOKET DİNLEYİCİLERİ (Mesaj ve Liste)
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
      // Google'ın ücretsiz STUN sunucuları (IP adreslerini bulmak için)
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      
      // Kendi mikrofon sesimi tünele aktarıyorum
      if(medyaAkisiRef.current) {
        medyaAkisiRef.current.getTracks().forEach(track => peer.addTrack(track, medyaAkisiRef.current));
      }

      // Karşıdan ses paketi geldiğinde (GÜNCELLENDİ)
      peer.ontrack = (event) => {
        setUzakSesler((eski) => {
          // Aynı stream'in tekrar eklenmesini önle
          if (!eski.includes(event.streams[0])) {
            return [...eski, event.streams[0]];
          }
          return eski;
        });
      };

      // Bağlantı yolu bulunduğunda (ICE) karşıya ilet
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_adayi', { hedef: hedefID, aday: event.candidate });
        }
      };

      return peer;
    };

    // Biri sese girince (Aramayı başlatan taraf benim)
    socket.on('yeni_kullanici_ses_kanalinda', async (yeniKullaniciID) => {
      const peer = peerOlustur(yeniKullaniciID, true);
      peerBaglantilari.current[yeniKullaniciID] = peer;
      const teklif = await peer.createOffer();
      await peer.setLocalDescription(teklif);
      socket.emit('ses_teklifi', { hedef: yeniKullaniciID, sdp: teklif });
    });

    // Biri beni aradığında (Cevap veren tarafım)
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

  // Otomatik kaydırma
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
    // Tüm P2P bağlantılarını kapat
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

  const sohbeteKatil = () => { if (kullaniciAdiInput.trim() !== '') { setKullaniciAdi(kullaniciAdiInput); setGirisYapildi(true); } };
  
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

  if (!girisYapildi) {
    return (
      <div className="login-container futuristic-bg">
        <div className="login-box glass-panel">
          <div className="neon-logo">NEXUS</div>
          <h2>Sisteme Bağlan</h2>
          <input type="text" placeholder="Kod adınızı girin..." value={kullaniciAdiInput} onChange={(e) => setKullaniciAdiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sohbeteKatil()} autoFocus />
          <button className="neon-button" onClick={sohbeteKatil}>Giriş Protokolünü Başlat</button>
        </div>
      </div>
    );
  }

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

      {/* SOL MENÜ */}
      <div className="server-sidebar">
        <div className="server-icon active" style={{boxShadow: `0 0 15px ${avatarRenk}`}}>NX</div>
      </div>

      {/* İÇ MENÜ - KANALLAR */}
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

        {/* SES KONTROL PANELİ */}
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

      {/* SOHBET ALANI */}
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

      {/* SAĞ MENÜ (LİSTE) */}
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

      {/* UZAK SESLERİ OYNATMA ALANI (Görünmez) - EKLENDİ */}
      <div style={{ display: 'none' }}>
        {uzakSesler.map((stream, index) => (
          <audio
            key={index}
            autoPlay
            ref={(audioElement) => {
              // DOM'a eklendiğinde sesi bağla
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
