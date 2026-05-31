import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import previewImg from '../assets/preview.jpeg';
import { 
  Gavel, Zap, Clock, Palette, CheckCircle2, 
  XCircle, Info, LogOut, User, Sun, Moon 
} from 'lucide-react';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')) 
  ? rawApiUrl 
  : `https://${rawApiUrl}`;

// SĐT MOMO NHẬN TIỀN
const MOMO_PHONE_NUMBER = import.meta.env.VITE_MOMO_PHONE; 

// CONFIG CÁC TÔNG MÀU NEON CAO CẤP
const THEMES = {
  pink: {
    name: 'Hồng Neon',
    primary: 'from-pink-500 to-rose-600',
    primaryHover: 'from-pink-600 to-rose-700',
    glow1: 'bg-pink-500/5',
    glow2: 'bg-rose-500/5',
    text: 'text-pink-500',
    textLight: 'text-pink-300',
    textLightMode: 'text-pink-600',
    textHover: 'hover:text-pink-500',
    border: 'border-pink-500/30',
    borderLightMode: 'border-pink-200',
    bgBadge: 'bg-pink-950/40',
    bgBadgeLightMode: 'bg-pink-50',
    shadow: 'shadow-pink-500/20',
    textPrice: 'text-pink-400',
    textPriceLightMode: 'text-pink-600',
    focusRing: 'focus:ring-pink-500',
    
    bgPageDark: 'bg-[#0B0F19]',
    bgPageLight: 'bg-[#FFF0F5]',
    bgCardDark: 'bg-slate-900/40 border-white/10',
    bgCardLight: 'bg-white/80 border-pink-100 shadow-pink-100/50',
    textBodyDark: 'text-[#E2E8F0]',
    textBodyLight: 'text-slate-800'
  },
  lgbt: {
    name: 'Cầu Vồng LGBT 🌈',
    primary: 'from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500',
    primaryHover: 'from-red-600 via-yellow-600 via-green-600 via-blue-600 to-purple-600',
    glow1: 'bg-red-500/10',
    glow2: 'bg-purple-500/10',
    text: 'text-purple-400',
    textLight: 'text-pink-300',
    textLightMode: 'text-indigo-650',
    textHover: 'hover:text-purple-400',
    border: 'border-purple-500/30',
    borderLightMode: 'border-purple-200',
    bgBadge: 'bg-purple-950/40',
    bgBadgeLightMode: 'bg-purple-50',
    shadow: 'shadow-purple-500/20',
    textPrice: 'text-purple-400',
    textPriceLightMode: 'text-indigo-650',
    focusRing: 'focus:ring-purple-500',
    
    bgPageDark: 'bg-[#0D0B1A]',
    bgPageLight: 'bg-[#F5F3FF]',
    bgCardDark: 'bg-[#130E26]/80 border-purple-500/10',
    bgCardLight: 'bg-white/90 border-purple-200/60 shadow-purple-50/50',
    textBodyDark: 'text-[#F1EEFE]',
    textBodyLight: 'text-slate-800'
  },
  casino: {
    name: 'Las Vegas Đỏ Đen 🎲',
    primary: 'from-red-600 to-stone-900',
    primaryHover: 'from-red-700 to-black',
    glow1: 'bg-red-500/10',
    glow2: 'bg-stone-900/10',
    text: 'text-red-500',
    textLight: 'text-red-300',
    textLightMode: 'text-red-650',
    textHover: 'hover:text-red-500',
    border: 'border-red-500/30',
    borderLightMode: 'border-red-200',
    bgBadge: 'bg-red-950/40',
    bgBadgeLightMode: 'bg-red-50',
    shadow: 'shadow-red-500/20',
    textPrice: 'text-red-400',
    textPriceLightMode: 'text-red-650',
    focusRing: 'focus:ring-red-500',
    
    bgPageDark: 'bg-[#0B0404]',
    bgPageLight: 'bg-[#FFF5F5]',
    bgCardDark: 'bg-[#170808]/85 border-red-500/15',
    bgCardLight: 'bg-white/90 border-red-200/60 shadow-red-50/50',
    textBodyDark: 'text-[#FCEBEB]',
    textBodyLight: 'text-slate-800'
  },
  fireice: {
    name: 'Lửa & Băng ❄️🔥',
    primary: 'from-cyan-500 to-rose-500',
    primaryHover: 'from-cyan-600 to-rose-600',
    glow1: 'bg-cyan-500/10',
    glow2: 'bg-rose-500/10',
    text: 'text-cyan-400',
    textLight: 'text-rose-300',
    textLightMode: 'text-cyan-650',
    textHover: 'hover:text-cyan-400',
    border: 'border-cyan-500/30',
    borderLightMode: 'border-cyan-200',
    bgBadge: 'bg-cyan-950/40',
    bgBadgeLightMode: 'bg-cyan-50',
    shadow: 'shadow-cyan-500/20',
    textPrice: 'text-cyan-400',
    textPriceLightMode: 'text-cyan-650',
    focusRing: 'focus:ring-cyan-500',
    
    bgPageDark: 'bg-[#070B14]',
    bgPageLight: 'bg-[#F0F8FF]',
    bgCardDark: 'bg-[#0D1525]/85 border-cyan-500/15',
    bgCardLight: 'bg-white/90 border-cyan-150 shadow-cyan-50/50',
    textBodyDark: 'text-[#E6EEFC]',
    textBodyLight: 'text-slate-800'
  },
  sakura: {
    name: 'Sakura Anh Đào',
    primary: 'from-[#FFB7C5] to-[#FFA0B4]',
    primaryHover: 'from-[#FFA0B4] to-[#FF8DA4]',
    glow1: 'bg-[#FFB7C5]/10',
    glow2: 'bg-[#FFA0B4]/10',
    text: 'text-[#FFA0B4]',
    textLight: 'text-[#FFC0CB]',
    textLightMode: 'text-[#D96B7E]',
    textHover: 'hover:text-[#FFA0B4]',
    border: 'border-[#FFB7C5]/30',
    borderLightMode: 'border-[#FFD0D8]',
    bgBadge: 'bg-[#3B1E22]/60',
    bgBadgeLightMode: 'bg-[#FFF0F2]',
    shadow: 'shadow-[#FFB7C5]/20',
    textPrice: 'text-[#FFA0B4]',
    textPriceLightMode: 'text-[#D96B7E]',
    focusRing: 'focus:ring-[#FFA0B4]',
    
    bgPageDark: 'bg-[#1F1215]',
    bgPageLight: 'bg-[#FFF5F6]',
    bgCardDark: 'bg-[#2D1A1E]/80 border-[#FFB7C5]/10',
    bgCardLight: 'bg-white/90 border-[#FFD0D8] shadow-pink-50/50',
    textBodyDark: 'text-[#FCE4E6]',
    textBodyLight: 'text-[#5E3036]'
  },
  watermelon: {
    name: 'Dưa Hấu Mùa Hè',
    primary: 'from-[#FF4B5C] to-[#05DF97]',
    primaryHover: 'from-[#FF3045] to-[#04C988]',
    glow1: 'bg-[#FF4B5C]/10',
    glow2: 'bg-[#05DF97]/10',
    text: 'text-[#FF4B5C]',
    textLight: 'text-[#FF7380]',
    textLightMode: 'text-[#D92A3A]',
    textHover: 'hover:text-[#FF4B5C]',
    border: 'border-[#05DF97]/30',
    borderLightMode: 'border-[#BBF7D0]',
    bgBadge: 'bg-[#1A2E26]/60',
    bgBadgeLightMode: 'bg-[#E6F9F2]',
    shadow: 'shadow-[#FF4B5C]/20',
    textPrice: 'text-[#FF4B5C]',
    textPriceLightMode: 'text-[#D92A3A]',
    focusRing: 'focus:ring-[#FF4B5C]',
    
    bgPageDark: 'bg-[#061811]',
    bgPageLight: 'bg-[#F0FDF4]',
    bgCardDark: 'bg-[#0E281F]/80 border-[#05DF97]/10',
    bgCardLight: 'bg-white/90 border-[#BBF7D0] shadow-emerald-50/50',
    textBodyDark: 'text-[#E6F7F0]',
    textBodyLight: 'text-[#1F3D2F]'
  },
  cyber: {
    name: 'Cyan Cyberpunk',
    primary: 'from-cyan-500 to-blue-600',
    primaryHover: 'from-cyan-600 to-blue-700',
    glow1: 'bg-cyan-500/5',
    glow2: 'bg-blue-500/5',
    text: 'text-cyan-400',
    textLight: 'text-cyan-300',
    textLightMode: 'text-cyan-600',
    textHover: 'hover:text-cyan-400',
    border: 'border-cyan-500/30',
    borderLightMode: 'border-cyan-200',
    bgBadge: 'bg-cyan-950/40',
    bgBadgeLightMode: 'bg-cyan-50',
    shadow: 'shadow-cyan-500/20',
    textPrice: 'text-cyan-400',
    textPriceLightMode: 'text-cyan-600',
    focusRing: 'focus:ring-cyan-500',
    
    bgPageDark: 'bg-[#080E1A]',
    bgPageLight: 'bg-[#F0F9FF]',
    bgCardDark: 'bg-[#0E1726]/80 border-cyan-500/10',
    bgCardLight: 'bg-white/90 border-cyan-150 shadow-cyan-50/50',
    textBodyDark: 'text-[#E2E8F0]',
    textBodyLight: 'text-slate-800'
  },
  matrix: {
    name: 'Lục Matrix',
    primary: 'from-emerald-500 to-teal-600',
    primaryHover: 'from-emerald-600 to-teal-700',
    glow1: 'bg-emerald-500/5',
    glow2: 'bg-teal-500/5',
    text: 'text-emerald-400',
    textLight: 'text-emerald-300',
    textLightMode: 'text-emerald-600',
    textHover: 'hover:text-emerald-400',
    border: 'border-emerald-500/30',
    borderLightMode: 'border-emerald-200',
    bgBadge: 'bg-emerald-950/40',
    bgBadgeLightMode: 'bg-emerald-50',
    shadow: 'shadow-emerald-500/20',
    textPrice: 'text-emerald-400',
    textPriceLightMode: 'text-emerald-600',
    focusRing: 'focus:ring-emerald-500',
    
    bgPageDark: 'bg-[#050D0A]',
    bgPageLight: 'bg-[#F6FDF9]',
    bgCardDark: 'bg-[#0A1A14]/80 border-emerald-500/10',
    bgCardLight: 'bg-white/90 border-emerald-150 shadow-emerald-50/50',
    textBodyDark: 'text-[#E6F4EA]',
    textBodyLight: 'text-slate-800'
  },
  amber: {
    name: 'Vàng Hoàng Kim',
    primary: 'from-amber-500 to-orange-600',
    primaryHover: 'from-amber-600 to-orange-700',
    glow1: 'bg-amber-500/5',
    glow2: 'bg-orange-500/5',
    text: 'text-amber-500',
    textLight: 'text-amber-300',
    textLightMode: 'text-amber-600',
    textHover: 'hover:text-amber-500',
    border: 'border-amber-500/30',
    borderLightMode: 'border-amber-200',
    bgBadge: 'bg-amber-950/40',
    bgBadgeLightMode: 'bg-amber-50',
    shadow: 'shadow-amber-500/20',
    textPrice: 'text-amber-400',
    textPriceLightMode: 'text-amber-600',
    focusRing: 'focus:ring-amber-500',
    
    bgPageDark: 'bg-[#150F07]',
    bgPageLight: 'bg-[#FFFBEB]',
    bgCardDark: 'bg-[#22170B]/80 border-amber-500/10',
    bgCardLight: 'bg-white/90 border-amber-200/60 shadow-amber-50/50',
    textBodyDark: 'text-[#FDF6E2]',
    textBodyLight: 'text-slate-800'
  },
  purple: {
    name: 'Tím Hoàng Hôn',
    primary: 'from-fuchsia-500 to-violet-600',
    primaryHover: 'from-fuchsia-600 to-violet-700',
    glow1: 'bg-fuchsia-500/5',
    glow2: 'bg-violet-500/5',
    text: 'text-fuchsia-500',
    textLight: 'text-fuchsia-300',
    textLightMode: 'text-fuchsia-600',
    textHover: 'hover:text-fuchsia-500',
    border: 'border-fuchsia-500/30',
    borderLightMode: 'border-fuchsia-200',
    bgBadge: 'bg-fuchsia-950/40',
    bgBadgeLightMode: 'bg-fuchsia-50',
    shadow: 'shadow-fuchsia-500/20',
    textPrice: 'text-fuchsia-400',
    textPriceLightMode: 'text-fuchsia-600',
    focusRing: 'focus:ring-fuchsia-500',
    
    bgPageDark: 'bg-[#110D1B]',
    bgPageLight: 'bg-[#FAF5FF]',
    bgCardDark: 'bg-[#1B152A]/80 border-fuchsia-500/10',
    bgCardLight: 'bg-white/90 border-fuchsia-200/60 shadow-purple-50/50',
    textBodyDark: 'text-[#F3E8FF]',
    textBodyLight: 'text-slate-800'
  }
};

export default function ClientBid() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(API_URL);
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const [commission, setCommission] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ d: '00', h: '00', m: '00', s: '00' });
  const [bidHistory, setBidHistory] = useState([]);
  const [bidderId, setBidderId] = useState(null);
  const [bidderToken, setBidderToken] = useState(null);
  const [bidderName, setBidderName] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isBidding, setIsBidding] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [customBid, setCustomBid] = useState('');
  const [formData, setFormData] = useState({ fullName: '', contactInfo: '' });

  const activeMomoPhone = commission?.momo_phone || MOMO_PHONE_NUMBER;

  const [usdVndRate, setUsdVndRate] = useState(25000); // default fallback

  const formatUSD = (vndAmount) => {
    if (!vndAmount || isNaN(vndAmount) || !usdVndRate) return '';
    const usd = vndAmount / usdVndRate;
    return `(~$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD)`;
  };

  // Theme & Mode states
  const [selectedThemeKey, setSelectedThemeKey] = useState('pink');
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Gamification states
  const [pricePulse, setPricePulse] = useState(false);
  const [particles, setParticles] = useState([]);
  const [themeParticles, setThemeParticles] = useState([]);
  const [isLast30Seconds, setIsLast30Seconds] = useState(false);
  const [payTimeLeft, setPayTimeLeft] = useState('');
  const [showRulesPopup, setShowRulesPopup] = useState(false);

  // --- LOGIC CHECK TRẠNG THÁI ---
  const accurateNowForCheck = new Date(new Date().getTime() - serverTimeOffset);
  const isTimeOut = commission && (new Date(commission.end_time) - accurateNowForCheck <= 0);
  const isClosed = isTimeOut || commission?.status === 'closed';
  const isUpcoming = commission && commission.status === 'upcoming';
  const topBid = bidHistory[0];
  const isWinner = isClosed && commission && String(commission.winner_bidder_id) === String(bidderId);

  useEffect(() => {
    document.title = "OnigiriComAuction";
    const savedTheme = localStorage.getItem('clientThemeKey');
    if (savedTheme && THEMES[savedTheme]) {
      setSelectedThemeKey(savedTheme);
    }
    const savedMode = localStorage.getItem('clientThemeMode');
    if (savedMode === 'light') {
      setIsDarkMode(false);
    }
  }, []);

  const theme = THEMES[selectedThemeKey] || THEMES.pink;

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('clientThemeMode', newMode ? 'dark' : 'light');
  };

  // SOUND SYNTHESIS FEEDBACK USING WEB AUDIO API
  const playChime = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      if (type === 'success') {
        const playTone = (freq, time, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.08, time);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(time);
          osc.stop(time + duration);
        };
        playTone(523.25, audioCtx.currentTime, 0.35); // C5
        playTone(783.99, audioCtx.currentTime + 0.08, 0.45); // G5
      } else if (type === 'warning') {
        const playTone = (freq, time, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.08, time);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(time);
          osc.stop(time + duration);
        };
        playTone(329.63, audioCtx.currentTime, 0.25); // E4
        playTone(261.63, audioCtx.currentTime + 0.08, 0.35); // C4
      }
    } catch (e) {
      console.warn('AudioContext blocked or not supported:', e);
    }
  };

  // REACT CONFETTI BURST ANIMATION
  const triggerConfetti = () => {
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      id: Math.random() + i,
      x: Math.random() * 100, // percentage left
      size: Math.random() * 8 + 6,
      color: ['#FFC0CB', '#FF69B4', '#FF1493', '#00FFFF', '#39FF14', '#FFD700', '#FF4500'][Math.floor(Math.random() * 7)],
      delay: Math.random() * 1.5,
      duration: Math.random() * 2 + 1.8,
      rotation: Math.random() * 360
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 4000);
  };

  // TICK SOUND GENERATOR
  const playTickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Autoplay blocked
    }
  };

  // COPY HELPER
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  // GENERATE THEME PARTICLES
  useEffect(() => {
    let count = 0;
    if (selectedThemeKey === 'sakura') count = 25;
    else if (selectedThemeKey === 'lgbt') count = 30;
    else if (selectedThemeKey === 'casino') count = 25;
    else if (selectedThemeKey === 'fireice') count = 25;
    else if (selectedThemeKey === 'watermelon') count = 20;
    else if (selectedThemeKey === 'matrix') count = 20;
    else if (selectedThemeKey === 'cyber') count = 15;
    else if (['pink', 'amber', 'purple'].includes(selectedThemeKey)) count = 25;
    
    if (count === 0) {
      setThemeParticles([]);
      return;
    }
    
    const items = Array.from({ length: count }).map((_, i) => {
      const size = selectedThemeKey === 'matrix' ? Math.random() * 8 + 10 : Math.random() * 12 + 8;
      const speed = selectedThemeKey === 'matrix' ? Math.random() * 3 + 2 : Math.random() * 8 + 4;
      const opacity = Math.random() * 0.35 + 0.15;
      
      let content = '✨';
      if (selectedThemeKey === 'sakura') {
        content = ['🌸', '💮', '💖'][Math.floor(Math.random() * 3)];
      } else if (selectedThemeKey === 'lgbt') {
        content = ['❤️', '🧡', '💛', '💚', '💙', '💜'][Math.floor(Math.random() * 6)];
      } else if (selectedThemeKey === 'casino') {
        content = ['♠️', '♥️', '♦️', '♣️', '🎲', '🪙'][Math.floor(Math.random() * 6)];
      } else if (selectedThemeKey === 'fireice') {
        content = ['❄️', '🔥', '💧', '✨'][Math.floor(Math.random() * 4)];
      } else if (selectedThemeKey === 'watermelon') {
        content = ['🍉', '💧', '🟢'][Math.floor(Math.random() * 3)];
      } else if (selectedThemeKey === 'matrix') {
        content = String.fromCharCode(33 + Math.floor(Math.random() * 93));
      } else if (selectedThemeKey === 'cyber') {
        content = ['⚡', '🤖', '✨'][Math.floor(Math.random() * 3)];
      }
      
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        speed,
        delay: Math.random() * -20,
        opacity,
        content
      };
    });
    setThemeParticles(items);
  }, [selectedThemeKey]);

  // COUNTDOWN FOR WINNER PAYMENT (24H DEADLINE)
  useEffect(() => {
    if (!isWinner || !commission?.end_time) return;

    const interval = setInterval(() => {
      const accurateNow = new Date(new Date().getTime() - serverTimeOffset);
      const endTime = new Date(commission.end_time);
      const deadline = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
      const diff = deadline - accurateNow;

      if (diff <= 0) {
        setPayTimeLeft('Đã hết hạn thanh toán!');
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setPayTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isWinner, commission, serverTimeOffset]);

  // HIỂN THỊ POPUP NỘI QUY KHI KHÁCH TRUY CẬP LẦN ĐẦU (MỖI ĐỢT COMMISSION)
  useEffect(() => {
    if (commission) {
      const seen = localStorage.getItem('seenRules-' + commission.id);
      if (!seen) {
        setShowRulesPopup(true);
      }
    }
  }, [commission]);

  const closeRulesPopup = () => {
    if (commission) {
      localStorage.setItem('seenRules-' + commission.id, 'true');
    }
    setShowRulesPopup(false);
  };

  // 1. Hàm gọi API bọc trong useCallback để dùng lại mượt mà
  const fetchActiveCom = useCallback(async () => {
    try {
      const raw = await fetch(`${API_URL}/api/commissions/active`);
      if (raw.ok) {
        const ans = await raw.json();
        setCommission(ans);
        if (ans.usd_vnd_rate) setUsdVndRate(ans.usd_vnd_rate);
        setCurrentPrice(ans.current_price);
        const minIncrease = parseFloat(ans.min_increase) || 20000;
        setCustomBid(parseFloat(ans.current_price) + minIncrease);
        
        const offset = new Date() - new Date(ans.server_now);
        setServerTimeOffset(offset);
        
        const historyRaw = await fetch(`${API_URL}/api/commissions/${ans.id}/history`);
        if (historyRaw.ok) setBidHistory(await historyRaw.json());
      } else {
        setCommission(null);
      }
    } catch (error) { 
      console.error(error); 
      setCommission(null); 
    }
  }, []);

  // 2. Load Data ban đầu và cắm ăng-ten lắng nghe toàn cầu
  useEffect(() => {
    fetchActiveCom();
    
    const savedToken = localStorage.getItem('bidderToken');
    const savedId = localStorage.getItem('bidderId');
    const savedName = localStorage.getItem('bidderName');
    if (savedToken && savedId) { setBidderToken(savedToken); setBidderId(savedId); setBidderName(savedName); }

    if (socket) {
      socket.on('global-update', fetchActiveCom);
    }
    return () => {
      if (socket) {
        socket.off('global-update', fetchActiveCom);
      }
    };
  }, [fetchActiveCom, socket]);

  // 3. Logic Đồng hồ đếm ngược
  useEffect(() => {
    if (!commission || (!commission.end_time && !commission.start_time)) return;

    const interval = setInterval(() => {
      if (commission.status === 'closed') {
        setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
        setIsLast30Seconds(false);
        clearInterval(interval);
        return;
      }

      const accurateNow = new Date(new Date().getTime() - serverTimeOffset);
      const targetTime = commission.status === 'upcoming' ? commission.start_time : commission.end_time;
      const difference = new Date(targetTime) - accurateNow;
      
      if (difference <= 0) {
        setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
        setIsLast30Seconds(false);
        clearInterval(interval);
        fetchActiveCom();
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60);
        const s = Math.floor((difference / 1000) % 60);
        setTimeLeft({
          d: d.toString().padStart(2, '0'),
          h: h.toString().padStart(2, '0'),
          m: m.toString().padStart(2, '0'),
          s: s.toString().padStart(2, '0')
        });

        // Tick sound and flash red UI for final 30 seconds of an active commission
        if (commission.status === 'active' && d === 0 && h === 0 && m === 0 && s < 30) {
          setIsLast30Seconds(true);
          playTickSound();
        } else {
          setIsLast30Seconds(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [commission, serverTimeOffset, fetchActiveCom]);

  // 4. Lắng nghe Socket Realtime cho phiên đấu giá HIỆN TẠI
  useEffect(() => {
    if (!commission || !socket) return;
    
    const channel = `commission-${commission.id}-update`;
    const handleLocalUpdate = (data) => {
      if (data.currentPrice !== undefined) {
        setCurrentPrice(data.currentPrice);
        const minIncrease = parseFloat(commission.min_increase) || 20000;
        setCustomBid(parseFloat(data.currentPrice) + minIncrease);
        
        // Trigger visual sparkle update
        setPricePulse(true);
        setTimeout(() => setPricePulse(false), 800);
      }
      if (data.status) setCommission(prev => ({ ...prev, status: data.status }));
      
      if (data.refreshHistory) {
        fetch(`${API_URL}/api/commissions/${commission.id}/history`)
          .then(r => r.json())
          .then(ans => {
            // Check outbid trigger
            const currentBidderId = localStorage.getItem('bidderId');
            if (ans.length > 0 && currentBidderId && String(ans[0].bidder_id) !== String(currentBidderId)) {
              if (bidHistory.length > 0 && String(bidHistory[0].bidder_id) === String(currentBidderId)) {
                playChime('warning');
                toast('⚠️ Bạn đã bị vượt mặt!', { icon: '🔔' });
              }
            }
            setBidHistory(ans);
          });
        fetchActiveCom();
      } else if (data.newBid) {
        // Play outbid warning sound if applicable
        const currentBidderId = localStorage.getItem('bidderId');
        if (currentBidderId && String(data.newBid.bidder_id) !== String(currentBidderId)) {
          if (bidHistory.length > 0 && String(bidHistory[0].bidder_id) === String(currentBidderId)) {
            playChime('warning');
            toast('⚠️ Bạn đã bị vượt mặt!', { icon: '🔔' });
          }
        }
        setBidHistory(prev => [data.newBid, ...prev].slice(0, 5));
      }
    };

    socket.on(channel, handleLocalUpdate);
    return () => { socket.off(channel, handleLocalUpdate); };
  }, [commission, socket, bidHistory]);

  // 5. Xử lý Đăng ký
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const raw = await fetch(`${API_URL}/api/bidders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const ans = await raw.json();
      if (!raw.ok) {
        toast.error(ans.error || 'Đăng ký thất bại, thử lại!');
        return;
      }
      if (ans.id) {
        localStorage.setItem('bidderToken', ans.bidderToken);
        localStorage.setItem('bidderId', ans.id);
        localStorage.setItem('bidderName', ans.full_name);
        setBidderToken(ans.bidderToken);
        setBidderId(ans.id);
        setBidderName(ans.full_name);
        setShowForm(false);
        toast.success('Đăng ký thành công!');
        playChime('success');
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi kết nối, thử lại!');
    }
  };

  // 6. Xử lý Bấm Bid / AutoBuy
  const executeBid = async (amount, isAutoBuy = false) => {
    if (!bidderToken) { setShowForm(true); return; }
    if (!commission) return;
    if (isBidding) return;

    const minIncrease = parseFloat(commission.min_increase) || 20000;
    const maxIncrease = commission.max_increase ? parseFloat(commission.max_increase) : null;
    const autoBuyPrice = parseFloat(commission.auto_buy_price) || 1000000;

    // Validate phía client trước khi gửi lên server
    const parsed = parseFloat(amount);
    if (!isAutoBuy) {
      if (isNaN(parsed) || parsed <= 0) {
        toast.error('Giá trị đặt đấu giá không hợp lệ!');
        return;
      }
      const minBid = parseFloat(currentPrice) + minIncrease;
      if (parsed < minBid) {
        toast.error(`Mức đấu giá tối thiểu là ${minBid.toLocaleString('vi-VN')} đ!`);
        return;
      }
      if (maxIncrease && parsed > parseFloat(currentPrice) + maxIncrease) {
        toast.error(`Mức đấu giá tối đa là ${(parseFloat(currentPrice) + maxIncrease).toLocaleString('vi-VN')} đ!`);
        return;
      }
    }

    setIsBidding(true);
    try {
      const raw = await fetch(`${API_URL}/api/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bidder-token': bidderToken,
        },
        body: JSON.stringify({ commissionId: commission.id, bidAmount: parsed, isAutoBuy }),
      });
      const ans = await raw.json();
      if (!ans.success) {
        toast.error(ans.error || 'Thao tác thất bại');
      } else {
        toast.success(isAutoBuy ? 'Mua đứt thành công! 🎉' : 'Đặt bid thành công! 🔥');
        triggerConfetti();
        playChime('success');
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi kết nối mạng!');
    } finally {
      setTimeout(() => setIsBidding(false), 1000);
    }
  };



  // PHẦN TRĂM TIẾN TRÌNH ĐẾN AB (MUA ĐỨT) & BƯỚC GIÁ NHANH
  const startPrice = commission ? parseFloat(commission.start_price) || 0 : 0;
  const autoBuyPrice = commission ? parseFloat(commission.auto_buy_price) || 1000000 : 1000000;
  const curPrice = parseFloat(currentPrice) || startPrice;
  const progressPercent = Math.min(100, Math.max(0, ((curPrice - startPrice) / (autoBuyPrice - startPrice)) * 100));

  const minIncrease = commission ? parseFloat(commission.min_increase) || 20000 : 20000;
  const quickIncrements = [
    minIncrease,
    minIncrease * 2.5,
    minIncrease * 5,
    minIncrease * 10
  ];

  if (!commission) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${isDarkMode ? theme.bgPageDark : theme.bgPageLight} transition-colors duration-500`}>
        <div className="relative mb-6 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full border-4 ${isDarkMode ? 'border-white/5' : 'border-slate-200'} border-t-current ${theme.text} animate-spin`} />
          <Gavel className={`absolute m-auto ${theme.text} animate-pulse`} size={24} />
        </div>
        <p className={`text-xs font-black tracking-widest uppercase animate-pulse ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Đang kết nối phòng đấu giá...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? theme.bgPageDark : theme.bgPageLight} ${isDarkMode ? theme.textBodyDark : theme.textBodyLight} font-sans relative overflow-hidden transition-all duration-500`}>
      
      {/* CONFETTI & PREMIUM THEME ANIMATION STYLES */}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes floatOrb1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.15); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatOrb2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-50px, 50px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes sakuraFall {
          0% { transform: translateY(-10vh) translateX(0) rotate(0deg); }
          50% { transform: translateY(50vh) translateX(60px) rotate(180deg); }
          100% { transform: translateY(110vh) translateX(-30px) rotate(360deg); }
        }
        @keyframes watermelonFloat {
          0% { transform: translateY(110vh) scale(0.8); opacity: 0; }
          10% { opacity: 0.65; }
          90% { opacity: 0.65; }
          100% { transform: translateY(-10vh) scale(1.2); opacity: 0; }
        }
        @keyframes matrixRain {
          0% { transform: translateY(-20vh); opacity: 1; }
          100% { transform: translateY(120vh); opacity: 0; }
        }
        @keyframes gridScan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes sparkleFloat {
          0% { transform: translateY(105vh) translateX(0) scale(0.5); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-5vh) translateX(30px) scale(1.1); opacity: 0; }
        }
        @keyframes pulseLive {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>

      {/* Confetti Rendering */}
      {particles.map(p => (
        <div 
          key={p.id}
          className="fixed z-[999] pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.id % 3 === 0 ? '50%' : p.id % 3 === 1 ? '4px' : '0px',
            animation: `fall ${p.duration}s linear ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`
          }}
        />
      ))}

      {/* Theme Particles / Falling Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
        {themeParticles.map(p => (
          <div
            key={p.id}
            className="absolute select-none font-bold"
            style={{
              left: `${p.x}%`,
              top: 0,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animation: selectedThemeKey === 'sakura' ? `sakuraFall ${p.speed}s linear ${p.delay}s infinite`
                         : selectedThemeKey === 'watermelon' ? `watermelonFloat ${p.speed}s linear ${p.delay}s infinite`
                         : selectedThemeKey === 'matrix' ? `matrixRain ${p.speed}s linear ${p.delay}s infinite`
                         : `sparkleFloat ${p.speed}s linear ${p.delay}s infinite`,
              color: selectedThemeKey === 'matrix' ? '#10B981' : undefined
            }}
          >
            {p.content}
          </div>
        ))}
        {selectedThemeKey === 'cyber' && (
          <div 
            className="absolute inset-x-0 h-[2px] bg-cyan-500/20 pointer-events-none"
            style={{ animation: 'gridScan 6s linear infinite' }}
          />
        )}
      </div>

      {/* Background Soft Neon Glows */}
      <div 
        className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full ${theme.glow1} blur-[120px] pointer-events-none transition-all duration-500`} 
        style={{ animation: 'floatOrb1 15s ease-in-out infinite' }}
      />
      <div 
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${theme.glow2} blur-[120px] pointer-events-none transition-all duration-500`} 
        style={{ animation: 'floatOrb2 20s ease-in-out infinite' }}
      />

      {/* HEADER */}
      <header className={`${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white/40 border-black/5 shadow-sm'} backdrop-blur-md sticky top-0 z-40 border-b transition-colors duration-500`}>
        <nav className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between relative">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r ${theme.primary} rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg ${theme.shadow} transition-all duration-500`}>
              <Gavel size={18} className="sm:w-[22px] sm:h-[22px]"/>
            </div>
            <span className={`text-lg sm:text-2xl font-black tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'} transition-colors duration-500`}>
              ONIGIRI<span className={`${theme.text} transition-colors duration-500`}>Com</span>Auction
            </span>
          </div>
          
          {usdVndRate && (
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-slate-900/60 border-white/5 text-slate-400' 
                : 'bg-slate-100/80 border-slate-200/80 text-slate-500'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Tỷ giá: 1 USD = {usdVndRate.toLocaleString('vi-VN')} đ (Yahoo Finance)
            </div>
          )}
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Light/Dark Mode */}
            <button 
              onClick={toggleDarkMode} 
              className={`p-2 border rounded-full transition-all active:scale-95 flex items-center justify-center ${
                isDarkMode 
                  ? 'bg-slate-800/80 hover:bg-slate-700 border-white/10 text-slate-300 hover:text-white' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={isDarkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            >
              {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
            </button>

            {/* Tùy chỉnh màu sắc Button */}
            <div className="relative">
              <button 
                onClick={() => setShowThemePanel(!showThemePanel)} 
                className={`p-2 border rounded-full transition-all active:scale-95 flex items-center justify-center ${
                  isDarkMode 
                    ? 'bg-slate-800/80 hover:bg-slate-700 border-white/10 text-slate-300 hover:text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Thay đổi màu sắc giao diện"
              >
                <Palette size={18}/>
              </button>

              {/* Bảng tùy chỉnh màu sắc */}
              {showThemePanel && (
                <div className={`absolute right-0 top-12 z-50 backdrop-blur-md border p-4 rounded-2xl shadow-2xl w-56 animate-in fade-in slide-in-from-top-2 duration-150 ${
                  isDarkMode 
                    ? 'bg-[#0F1626]/95 border-white/10 text-white' 
                    : 'bg-white/95 border-slate-200/80 text-slate-800'
                }`}>
                  <h4 className={`text-xs font-black uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Màu sắc giao diện</h4>
                  <div className="space-y-2">
                    {Object.entries(THEMES).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedThemeKey(key);
                          localStorage.setItem('clientThemeKey', key);
                          setShowThemePanel(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-xs ${
                          selectedThemeKey === key 
                            ? isDarkMode ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-900 border border-slate-200'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${t.primary}`} />
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{t.name}</span>
                        </div>
                        {selectedThemeKey === key && <span className={`${t.text} font-black text-sm`}>●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {bidderName ? (
              <div className={`flex items-center gap-1.5 sm:gap-3 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border transition-colors duration-500 ${
                isDarkMode ? 'bg-slate-800/80 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-full transition-all duration-500 flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                  isDarkMode ? `${theme.bgBadge} ${theme.textLight}` : `${theme.bgBadgeLightMode} ${theme.textLightMode}`
                }`}>
                  {bidderName[0]}
                </div>
                <span className={`font-bold text-xs sm:text-sm max-w-[80px] sm:max-w-none truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>{bidderName}</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className={`text-slate-400 ${theme.textHover} p-0.5 transition-colors`}><LogOut size={14} className="sm:w-4 sm:h-4"/></button>
              </div>
            ) : (
              <button 
                onClick={() => setShowForm(true)} 
                className={`flex items-center gap-1.5 bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white px-3.5 py-2 sm:px-6 sm:py-3 rounded-full font-bold text-xs sm:text-sm transition-all duration-500 shadow-md active:scale-95`}
              >
                <User size={14} className="sm:w-[18px] sm:h-[18px]"/> Đăng nhập<span className="hidden sm:inline"> để Bid</span>
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 relative z-10">
        
        {/* CỘT TRÁI (Main Auction Card) */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
          
          <div className={`backdrop-blur-md rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-4 sm:p-5 gap-6 sm:gap-8 flex flex-col md:flex-row ${
            isDarkMode ? theme.bgCardDark : theme.bgCardLight
          } ${theme.shadow} border transition-all duration-500`}>
            {/* Hình ảnh */}
            <div className={`border rounded-2xl sm:rounded-[2rem] md:w-2/5 aspect-square flex items-center justify-center overflow-hidden shadow-inner transition-colors duration-500 ${
              isDarkMode ? 'bg-slate-950/60 border-white/10' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <img 
                src={commission.image_url || previewImg} 
                alt={commission.title} 
                className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
              />
            </div>
            
            {/* Thông tin & Bid Section */}
            <div className="flex-1 flex flex-col justify-center py-2 sm:py-4">
              <div className="mb-4 sm:mb-6">
                <span className={`inline-block px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2.5 sm:mb-3 transition-all duration-500 ${
                  isUpcoming ? 'bg-purple-950/40 text-purple-300 border border-purple-500/30 animate-pulse' : 
                  isClosed ? 'bg-slate-800 text-slate-400 border border-white/5' : 
                  isDarkMode 
                    ? `${theme.bgBadge} ${theme.textLight} border ${theme.border}`
                    : `${theme.bgBadgeLightMode} ${theme.textLightMode} border ${theme.borderLightMode}`
                }`}>
                  {commission.phase} - {isUpcoming ? 'Sắp diễn ra' : isClosed ? 'Đã đóng' : 'Đang mở'}
                </span>
                <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight mb-2 sm:mb-4 transition-colors duration-500 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>{commission.title}</h1>
              </div>

              {/* ĐỒNG HỒ */}
              <div className={`bg-gradient-to-r ${
                isLast30Seconds 
                  ? 'from-red-650 to-rose-600 animate-pulse border border-red-500 shadow-red-500/40 shadow-xl' 
                  : theme.primary
              } text-white p-4 sm:p-6 rounded-3xl mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-lg ${
                isLast30Seconds ? 'shadow-red-500/30' : theme.shadow
              } transition-all duration-500`}>
                <div className="flex items-center gap-2.5 sm:gap-3 self-center sm:self-auto">
                  <Clock size={20} className={`${isLast30Seconds ? 'animate-bounce' : 'opacity-80'} sm:w-7 sm:h-7`}/>
                  <span className="font-bold text-xs sm:text-sm uppercase tracking-widest opacity-80">
                    {isUpcoming ? 'Bắt đầu trong:' : isLast30Seconds ? '⏱️ SẮP HẾT GIỜ:' : 'Kết thúc trong:'}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                  {[
                    { val: timeLeft.d, label: 'Ngày' }, { val: timeLeft.h, label: 'Giờ' }, 
                    { val: timeLeft.m, label: 'Phút' }, { val: timeLeft.s, label: 'Giây' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-1 sm:gap-1.5">
                      <div className="text-center">
                        <div className="text-2xl sm:text-4xl font-black tracking-tighter w-11 sm:w-14 py-0.5 sm:py-1 bg-black/20 rounded-lg sm:rounded-xl text-white">{item.val}</div>
                        <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest opacity-70 mt-1">{item.label}</div>
                      </div>
                      {index < 3 && <div className="text-xl sm:text-3xl font-bold opacity-50 -mt-4 sm:-mt-5">:</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* GIÁ HIỆN TẠI */}
              <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl border transition-colors duration-500 ${
                isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white/40 border-black/5'
              }`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Giá hiện tại</p>
                  <h2 className={`text-4xl sm:text-6xl font-black tracking-tighter flex items-baseline transition-all duration-300 ${
                    pricePulse 
                      ? 'scale-105 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.95)]' 
                      : isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {parseFloat(currentPrice).toLocaleString('vi-VN')}
                    <span className={`text-xl sm:text-2xl ml-1 font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>đ</span>
                    {usdVndRate && (
                      <span className={`text-sm sm:text-lg font-bold ml-3 block sm:inline-block opacity-75 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {formatUSD(currentPrice)}
                      </span>
                    )}
                  </h2>
                </div>
                {topBid && (
                  <div className={`flex items-center gap-3 p-3 rounded-xl border self-start sm:self-auto w-full sm:w-auto transition-colors duration-500 ${
                    isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white border-black/5 shadow-sm'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                    }`}>{topBid.full_name[0]}</div>
                    <div className="text-left">
                      <p className="text-xs text-slate-400 font-medium">Bởi</p>
                      <p className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-855'}`}>{topBid.full_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* AB PROGRESS BAR (MUA ĐỨT) */}
              {!isClosed && !isUpcoming && (
                <div className={`mb-6 p-4 rounded-2xl border transition-all duration-500 ${
                  isDarkMode ? 'bg-black/10 border-white/5' : 'bg-white/30 border-black/5'
                }`}>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider mb-2">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Tiến trình tới AB (Mua đứt)</span>
                    <span className={isDarkMode ? theme.text : theme.textLightMode}>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className={`w-full h-3 rounded-full overflow-hidden p-[2px] transition-all border ${
                    isDarkMode ? 'bg-black/40 border-white/10' : 'bg-slate-200/50 border-slate-300/40'
                  }`}>
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${theme.primary} transition-all duration-500 relative`}
                      style={{ width: `${progressPercent}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2">
                    <span>SB: {startPrice.toLocaleString('vi-VN')} đ {usdVndRate && <span className="opacity-60 font-medium">/ {formatUSD(startPrice)}</span>}</span>
                    {progressPercent >= 75 ? (
                      <span className="text-rose-500 font-extrabold animate-pulse">🔥 Sắp chạm mốc Mua Đứt!</span>
                    ) : (
                      <span>AB: {autoBuyPrice.toLocaleString('vi-VN')} đ {usdVndRate && <span className="opacity-60 font-medium">/ {formatUSD(autoBuyPrice)}</span>}</span>
                    )}
                  </div>
                </div>
              )}

              {/* TRẠNG THÁI DẪN ĐẦU / BỊ VƯỢT GIÁ CÁ NHÂN HÓA */}
              {!isClosed && !isUpcoming && bidderId && (
                <div className="mb-6 transition-all duration-300">
                  {topBid && String(topBid.bidder_id) === String(bidderId) ? (
                    <div className={`py-2 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider animate-pulse ${
                      isDarkMode 
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      👑 Bạn đang là người dẫn đầu! Cố lên nhé!
                    </div>
                  ) : bidHistory.some(b => String(b.bidder_id) === String(bidderId)) ? (
                    <div className={`py-2 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider animate-bounce ${
                      isDarkMode 
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-400' 
                        : 'bg-rose-50 border-rose-250 text-rose-700'
                    }`}>
                      ⚠️ Bạn đã bị vượt giá! Đặt bid thêm để giành lại vị trí!
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* ACTION AREA */}
              {isUpcoming ? (
                <div className="w-full text-center p-5 sm:p-6 bg-purple-950/40 text-purple-300 rounded-2xl border border-purple-500/30 font-bold text-base sm:text-lg">
                  ⏰ Phiên đấu giá này chưa diễn ra. Vui lòng chờ đến giờ bắt đầu nhé!
                </div>
              ) : !isClosed ? (
                <div className="w-full space-y-4">
                  {/* Quick-Bid Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {quickIncrements.map((inc) => {
                      const bidValue = parseFloat(currentPrice) + inc;
                      return (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setCustomBid(bidValue)}
                          className={`py-2.5 px-1 text-center font-black rounded-xl text-[10px] sm:text-xs border transition-all active:scale-95 ${
                            parseFloat(customBid) === bidValue
                              ? isDarkMode 
                                ? `bg-white/10 text-white border-white/30 shadow-inner` 
                                : `bg-slate-100 text-slate-950 border-slate-300 shadow-sm`
                              : isDarkMode 
                                ? 'bg-black/25 text-slate-400 hover:text-white border-white/5 hover:bg-white/5' 
                                : 'bg-white/40 text-slate-600 hover:text-slate-900 border-black/5 hover:bg-slate-50'
                          }`}
                        >
                          +{inc >= 1000 ? `${(inc / 1000).toLocaleString('vi-VN')}k` : inc}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:flex-1">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">đ</span>
                      <input 
                        type="number" 
                        value={customBid}
                        onChange={(e) => setCustomBid(Number(e.target.value))}
                        className={`w-full pl-10 pr-4 py-4 sm:py-5 rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-lg sm:text-xl transition-all ${
                          isDarkMode 
                            ? 'bg-black/30 border-white/10 text-white' 
                            : 'bg-white/40 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                    <button 
                      onClick={() => executeBid(customBid)} 
                      disabled={isBidding}
                      className={`w-full sm:flex-[1.5] bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white py-4 sm:py-5 px-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg ${theme.shadow} active:scale-95 disabled:opacity-50`} 
                    >
                      {isBidding ? 'Đang xử lý...' : (
                        <span>
                          Đặt Đấu Giá: {Number(customBid || 0).toLocaleString('vi-VN')} đ
                          {usdVndRate && <span className="text-xs font-semibold ml-1.5 opacity-80 block sm:inline"> {formatUSD(Number(customBid || 0))}</span>}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="relative flex py-1 sm:py-2 items-center">
                    <div className={`flex-grow border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'} transition-colors duration-500`}></div>
                    <span className={`flex-shrink-0 mx-4 text-xs sm:text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Hoặc</span>
                    <div className={`flex-grow border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'} transition-colors duration-500`}></div>
                  </div>

                  <button 
                    onClick={() => executeBid(parseFloat(commission.auto_buy_price) || 1000000, true)} 
                    disabled={isBidding || parseFloat(currentPrice) >= (parseFloat(commission.auto_buy_price) || 1000000)}
                    className={`w-full py-4 sm:py-5 border rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95 disabled:opacity-50 shadow-md ${
                      isDarkMode 
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border-white/10 shadow-black/30' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 shadow-slate-200/50'
                    }`}
                  >
                    MUA NGAY (AB) {parseFloat(commission.auto_buy_price || 1000000).toLocaleString('vi-VN')} đ {usdVndRate && <span className="text-xs font-bold opacity-80">/ {formatUSD(parseFloat(commission.auto_buy_price || 1000000))}</span>}
                  </button>
                </div>
              ) : (
                <div className={`w-full text-center p-5 sm:p-6 border rounded-2xl transition-colors duration-500 ${
                  isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white/40 border-slate-200'
                }`}>
                  <span className={`font-bold text-base sm:text-lg italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {commission.status === 'closed' ? 'Phiên đấu giá đã chốt đơn!' : 'Phiên đấu giá đã hết thời gian!'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GIAO DIỆN DÀNH RIÊNG CHO NGƯỜI TRÚNG THẦU */}
          {isWinner && topBid && (
            <div className={`p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] mt-6 text-center shadow-xl border-2 transition-all duration-500 ${
              isDarkMode 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-emerald-500/5' 
                : 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-emerald-100/50'
            }`}>
              <h3 className={`text-2xl sm:text-5xl font-black tracking-tighter mb-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>🎉 CHÚC MỪNG BẠN ĐÃ CHIẾN THẮNG!</h3>
              <p className={`font-semibold text-sm sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto ${isDarkMode ? 'text-emerald-300' : 'text-slate-700'}`}>
                Chúc mừng bạn đã trúng đấu giá! Vui lòng quét mã QR chuyển khoản bên dưới hoặc sử dụng thông tin chuyển khoản để đặt cọc trước 50% số tiền đặt cọc trong vòng 24 giờ nhé.
              </p>
              
              <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-center mb-6">
                {activeMomoPhone ? (
                  <div className="p-4 rounded-[2rem] shadow-lg border shrink-0 bg-white border-emerald-100 shadow-slate-100">
                    <img
                      src={`https://img.vietqr.io/image/MBBANK-${activeMomoPhone}-compact2.png?amount=${topBid.bid_amount / 2}&addInfo=Coc%2050%25%20Com%20${commission.title.replace(/ /g, '%20')}`}
                      alt="VietQR"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className={`border-2 p-4 rounded-2xl ${
                    isDarkMode ? 'bg-yellow-950/40 border-yellow-500/30 text-yellow-300' : 'bg-yellow-50 border-yellow-450 text-yellow-800'
                  }`}>
                    ⚠️ Không tìm thấy SĐT MoMo/STK mặc định. Vui lòng liên hệ Admin.
                  </div>
                )}

                <div className="flex-1 w-full text-left space-y-3">
                  <div className={`p-4 rounded-2xl border transition-colors duration-500 ${
                    isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <span className="text-xs text-slate-400 font-bold block mb-1">Thời gian thanh toán còn lại:</span>
                    <span className="text-xl sm:text-2xl font-black tracking-wider text-rose-500 animate-pulse">{payTimeLeft}</span>
                  </div>

                  <div className={`p-4 rounded-2xl border space-y-3.5 transition-colors duration-500 ${
                    isDarkMode ? 'bg-black/25 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Số tài khoản / MoMo:</span>
                        <span className={`font-black text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeMomoPhone || 'Chưa cấu hình'}</span>
                      </div>
                      {activeMomoPhone && (
                        <button 
                          onClick={() => handleCopy(activeMomoPhone, 'Số tài khoản')}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all active:scale-95 ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Copy
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-dashed border-slate-800/10 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Số tiền cần đặt cọc (50%):</span>
                        <span className="font-black text-sm sm:text-base text-rose-500">
                          {(parseFloat(topBid.bid_amount) / 2).toLocaleString('vi-VN')} đ
                          {usdVndRate && <span className="text-xs font-bold opacity-80 ml-1.5">/ {formatUSD(parseFloat(topBid.bid_amount) / 2)}</span>}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleCopy((parseFloat(topBid.bid_amount) / 2).toString(), 'Số tiền cọc')}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all active:scale-95 ${
                          isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Copy
                      </button>
                    </div>

                    <div className="flex justify-between items-center border-t border-dashed border-slate-800/10 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Nội dung chuyển khoản:</span>
                        <span className={`font-black text-xs sm:text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-805'}`}>Coc 50% Com {commission.title}</span>
                      </div>
                      <button 
                        onClick={() => handleCopy(`Coc 50% Com ${commission.title}`, 'Nội dung')}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all active:scale-95 ${
                          isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RULES / TOS */}
          <div className={`p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border transition-all duration-500 ${
            isDarkMode ? theme.bgCardDark : theme.bgCardLight
          }`}>
            <h3 className={`text-lg sm:text-xl font-bold mb-4 sm:mb-6 pb-3 sm:pb-4 border-b flex items-center gap-2 transition-colors duration-500 ${
              isDarkMode ? 'text-white border-white/5' : 'text-slate-950 border-slate-100'
            }`}>
              <Zap size={20} className={`${theme.text} animate-pulse transition-colors duration-500`}/> Quy định & Hướng dẫn Đấu giá
            </h3>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-4 sm:gap-y-5 font-medium text-xs sm:text-sm ${
              isDarkMode ? theme.textBodyDark : theme.textBodyLight
            }`}>
              {[
                {icon: <Gavel size={16}/>, label: 'SB:', val: `${parseFloat(commission.start_price || 0).toLocaleString('vi-VN')} đ (Giá khởi điểm)`},
                {icon: <Zap size={16}/>, label: 'MI:', val: `${parseFloat(commission.min_increase || 20000).toLocaleString('vi-VN')} đ (Tối thiểu)${commission.max_increase ? ` - ${parseFloat(commission.max_increase).toLocaleString('vi-VN')} đ (Tối đa)` : ''}`},
                {icon: <Palette size={16}/>, label: 'AB:', val: `${parseFloat(commission.auto_buy_price || 1000000).toLocaleString('vi-VN')} đ (Mua đứt)`},
                {icon: <Clock size={16}/>, label: 'Thanh toán:', val: commission.rule_payment || 'Trong vòng 24h kể từ khi phiên đấu kết thúc'},
                {icon: <XCircle size={16}/>, label: 'Huỷ lượt:', val: commission.rule_disqualify || 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc'},
                {icon: <Info size={16}/>, label: 'Sử dụng:', val: commission.rule_usage || 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)'},
              ].map(item => (
                <div key={item.label} className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all duration-500 ${
                  isDarkMode ? 'bg-black/30 border-white/5' : 'bg-white/40 border-black/5'
                }`}>
                  <div className={`${theme.text} shrink-0 transition-colors duration-500`}>{item.icon}</div>
                  <span className={`font-extrabold w-20 shrink-0 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.label}</span>
                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (Bid History) */}
        <div className={`p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-lg h-fit lg:sticky lg:top-28 border transition-all duration-500 ${
          isDarkMode ? theme.bgCardDark : theme.bgCardLight
        }`}>
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-slate-950'
            }`}>
              <Zap size={20} className={`${theme.text} animate-pulse transition-colors duration-500`}/>
              Lịch sử đấu giá
            </h3>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
              isDarkMode 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-450' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
            }`}>
              <span 
                className="w-2 h-2 rounded-full bg-emerald-500" 
                style={{ animation: 'pulseLive 2s infinite' }}
              />
              Live
            </div>
          </div>
          <div className="space-y-4 sm:space-y-5">
            {bidHistory.map((bid, index) => {
              const isABWinner = (bid.isAutoBuy || (index === 0 && commission?.status === 'closed'));
              return (
                <div key={index} className={`flex items-center justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all border ${
                  index === 0 && !isClosed 
                    ? isDarkMode ? `${theme.bgBadge} ${theme.border} shadow-inner` : `${theme.bgBadgeLightMode} ${theme.borderLightMode} shadow-sm`
                    : isABWinner 
                      ? `bg-gradient-to-r ${theme.primary} ${isDarkMode ? theme.border : theme.borderLightMode} shadow-lg text-white` 
                      : isDarkMode ? 'bg-black/30 border border-white/5' : 'bg-white/40 border border-black/5'
                }`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs ${isABWinner ? 'bg-white text-slate-900' : 'bg-slate-850 text-slate-400'}`}>{bid.full_name[0]}</div>
                    <div>
                      <p className={`font-bold text-sm sm:text-base ${isABWinner ? 'text-white' : isDarkMode ? 'text-white' : 'text-slate-850'}`}>
                        {bid.full_name} 
                      </p>
                      <p className={`text-[10px] sm:text-xs ${isABWinner ? 'text-slate-200' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(bid.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(bid.created_at).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg sm:text-2xl font-black tracking-tighter transition-colors duration-500 ${
                      isABWinner 
                        ? 'text-white' 
                        : index === 0 && !isClosed 
                          ? isDarkMode ? theme.textPrice : theme.textPriceLightMode 
                          : isDarkMode ? 'text-slate-200' : 'text-slate-850'
                    }`}>
                      {parseFloat(bid.bid_amount).toLocaleString('vi-VN')} đ
                    </div>
                    {usdVndRate && (
                      <div className={`text-[10px] sm:text-xs font-bold opacity-70 ${isABWinner ? 'text-white' : 'text-slate-400'}`}>
                        {formatUSD(parseFloat(bid.bid_amount))}
                      </div>
                    )}
                    {isABWinner && <span className={`inline-block text-[9px] font-black uppercase tracking-widest ${selectedThemeKey === 'pink' ? 'bg-white text-pink-600' : 'bg-white text-slate-900'} px-2 py-0.5 rounded-full -mt-1`}>Winner</span>}
                  </div>
                </div>
              );
            })}
            {bidHistory.length === 0 && (
              <div className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed transition-all duration-500 ${
                isDarkMode 
                  ? 'bg-black/10 border-white/10 text-slate-400' 
                  : 'bg-slate-50/50 border-slate-200 text-slate-500 shadow-inner'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors duration-500 ${
                  isDarkMode ? 'bg-slate-800/80 border border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  <Gavel size={20} className="animate-pulse" />
                </div>
                <h4 className={`font-black text-sm uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Chưa có lượt đấu giá</h4>
                <p className="text-xs text-slate-500 font-medium max-w-[200px] leading-relaxed">
                  Hãy là người tiên phong đặt bid đầu tiên để dẫn đầu phòng đấu giá!
                </p>
                <div className="flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Sẵn sàng nhận Bid
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* FORM ĐĂNG KÝ */}
      {showForm && (
        <div className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/60'} backdrop-blur-sm flex justify-center items-center p-4 z-50 transition-all animate-in fade-in duration-200`}>
          <div className={`border p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-[#0D1424] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="text-center mb-6 sm:mb-10">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${theme.bgBadge} ${theme.text} border ${theme.border} rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg ${theme.shadow} transition-all duration-500`}>
                <User size={28} className="sm:w-8 sm:h-8"/>
              </div>
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Chào mừng bạn!</h3>
              <p className={`mt-2 text-xs sm:text-sm max-w-xs mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vui lòng điền thông tin để chúng tôi liên hệ khi bạn thắng phiên đấu giá nhé.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5">
              <input 
                type="text" 
                placeholder="Tên của bạn" 
                value={formData.fullName} 
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
                required 
                className={`w-full px-4 sm:px-5 py-3 sm:py-4 border rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-base sm:text-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-slate-950/60 border-white/10 text-white placeholder-slate-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <input 
                type="text" 
                placeholder="Email hoặc Link Facebook (để nhận liên hệ khi thắng)" 
                value={formData.contactInfo} 
                onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })} 
                required 
                className={`w-full px-4 sm:px-5 py-3 sm:py-4 border rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-base sm:text-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-slate-950/60 border-white/10 text-white placeholder-slate-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <div className="flex gap-3 sm:gap-4 pt-3 sm:pt-4">
                <button type="submit" className={`flex-1 bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg ${theme.shadow} active:scale-95`}>
                  Xác nhận
                </button>
                <button type="button" onClick={() => setShowForm(false)} className={`flex-1 border py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-colors active:scale-95 ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-300' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                }`}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className={`max-w-[1600px] mx-auto px-6 py-10 mt-10 border-t text-center text-xs font-medium transition-colors duration-500 ${
        isDarkMode ? 'border-white/10 text-slate-400' : 'border-black/5 text-slate-500'
      }`}>
        <p>&copy; {new Date().getFullYear()} OnigiriComAuction. All rights reserved.</p>
        <p className="mt-1">Powered by React & Node.js</p>
      </footer>

      {/* POPUP RULES / NỘI QUY KHI TRUY CẬP */}
      {showRulesPopup && (
        <div className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/60'} backdrop-blur-sm flex justify-center items-center p-4 z-[60] transition-all animate-in fade-in duration-200`}>
          <div className={`border p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-[#0D1424] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="text-center mb-6 sm:mb-8">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${theme.bgBadge} ${theme.text} border ${theme.border} rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg ${theme.shadow} transition-all duration-500`}>
                <Gavel size={28} className="sm:w-8 sm:h-8"/>
              </div>
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quy Định Đấu Giá</h3>
              <p className={`mt-2 text-xs sm:text-sm max-w-xs mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vui lòng đọc kỹ nội quy của phiên đấu giá trước khi tham gia nhé!</p>
            </div>
            
            <div className="space-y-4 mb-6 sm:mb-8">
              {[
                { label: 'Giá khởi điểm (SB):', val: `${parseFloat(commission.start_price || 0).toLocaleString('vi-VN')} đ` },
                { label: 'Bước giá tối thiểu (MI):', val: `${parseFloat(commission.min_increase || 20000).toLocaleString('vi-VN')} đ${commission.max_increase ? ` - Tối đa: ${parseFloat(commission.max_increase).toLocaleString('vi-VN')} đ` : ''}` },
                { label: 'Giá mua ngay (AB):', val: `${parseFloat(commission.auto_buy_price || 1000000).toLocaleString('vi-VN')} đ` },
                { label: 'Quy định thanh toán:', val: commission.rule_payment },
                { label: 'Quy định hủy lượt:', val: commission.rule_disqualify },
                { label: 'Mục đích sử dụng:', val: commission.rule_usage },
              ].map((rule, idx) => (
                <div key={idx} className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
                  isDarkMode ? 'bg-black/35 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`block text-[10px] sm:text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
                    {rule.label}
                  </span>
                  <span className={`text-xs sm:text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {rule.val}
                  </span>
                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={closeRulesPopup} 
              className={`w-full bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg ${theme.shadow} active:scale-95`}
            >
              Tôi đã hiểu và đồng ý
            </button>
          </div>
        </div>
      )}

    </div>
  );
}