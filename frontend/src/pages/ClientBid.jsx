import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import previewImg from '../assets/preview.jpeg';
import { 
  Gavel, Zap, Clock, Palette, CheckCircle2, 
  XCircle, Info, LogOut, User 
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
    textHover: 'hover:text-pink-500',
    border: 'border-pink-500/30',
    bgBadge: 'bg-pink-950/40',
    shadow: 'shadow-pink-500/20',
    textPrice: 'text-pink-400',
    focusRing: 'focus:ring-pink-500'
  },
  cyber: {
    name: 'Cyan Cyberpunk',
    primary: 'from-cyan-500 to-blue-600',
    primaryHover: 'from-cyan-600 to-blue-700',
    glow1: 'bg-cyan-500/5',
    glow2: 'bg-blue-500/5',
    text: 'text-cyan-400',
    textLight: 'text-cyan-300',
    textHover: 'hover:text-cyan-400',
    border: 'border-cyan-500/30',
    bgBadge: 'bg-cyan-950/40',
    shadow: 'shadow-cyan-500/20',
    textPrice: 'text-cyan-400',
    focusRing: 'focus:ring-cyan-500'
  },
  matrix: {
    name: 'Lục Matrix',
    primary: 'from-emerald-500 to-teal-600',
    primaryHover: 'from-emerald-600 to-teal-700',
    glow1: 'bg-emerald-500/5',
    glow2: 'bg-teal-500/5',
    text: 'text-emerald-400',
    textLight: 'text-emerald-300',
    textHover: 'hover:text-emerald-400',
    border: 'border-emerald-500/30',
    bgBadge: 'bg-emerald-950/40',
    shadow: 'shadow-emerald-500/20',
    textPrice: 'text-emerald-400',
    focusRing: 'focus:ring-emerald-500'
  },
  amber: {
    name: 'Vàng Hoàng Kim',
    primary: 'from-amber-500 to-orange-600',
    primaryHover: 'from-amber-600 to-orange-700',
    glow1: 'bg-amber-500/5',
    glow2: 'bg-orange-500/5',
    text: 'text-amber-500',
    textLight: 'text-amber-300',
    textHover: 'hover:text-amber-500',
    border: 'border-amber-500/30',
    bgBadge: 'bg-amber-950/40',
    shadow: 'shadow-amber-500/20',
    textPrice: 'text-amber-400',
    focusRing: 'focus:ring-amber-500'
  },
  purple: {
    name: 'Tím Hoàng Hôn',
    primary: 'from-fuchsia-500 to-violet-600',
    primaryHover: 'from-fuchsia-600 to-violet-700',
    glow1: 'bg-fuchsia-500/5',
    glow2: 'bg-violet-500/5',
    text: 'text-fuchsia-500',
    textLight: 'text-fuchsia-300',
    textHover: 'hover:text-fuchsia-500',
    border: 'border-fuchsia-500/30',
    bgBadge: 'bg-fuchsia-950/40',
    shadow: 'shadow-fuchsia-500/20',
    textPrice: 'text-fuchsia-400',
    focusRing: 'focus:ring-fuchsia-500'
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

  // Theme state
  const [selectedThemeKey, setSelectedThemeKey] = useState('pink');
  const [showThemePanel, setShowThemePanel] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('clientThemeKey');
    if (savedTheme && THEMES[savedTheme]) {
      setSelectedThemeKey(savedTheme);
    }
  }, []);

  const theme = THEMES[selectedThemeKey] || THEMES.pink;

  // 1. Hàm gọi API bọc trong useCallback để dùng lại mượt mà
  const fetchActiveCom = useCallback(async () => {
    try {
      const raw = await fetch(`${API_URL}/api/commissions/active`);
      if (raw.ok) {
        const ans = await raw.json();
        setCommission(ans);
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

    // Dù có Com hay không vẫn phải hóng thông báo từ Admin
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
        clearInterval(interval);
        return;
      }

      const accurateNow = new Date(new Date().getTime() - serverTimeOffset);
      const targetTime = commission.status === 'upcoming' ? commission.start_time : commission.end_time;
      const difference = new Date(targetTime) - accurateNow;
      
      if (difference <= 0) {
        setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
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
      }
      if (data.status) setCommission(prev => ({ ...prev, status: data.status }));
      
      if (data.refreshHistory) {
        fetch(`${API_URL}/api/commissions/${commission.id}/history`)
          .then(r => r.json())
          .then(ans => setBidHistory(ans));
        fetchActiveCom();
      } else if (data.newBid) {
        setBidHistory(prev => [data.newBid, ...prev].slice(0, 5));
      }
    };

    socket.on(channel, handleLocalUpdate);
    return () => { socket.off(channel, handleLocalUpdate); };
  }, [commission, socket]);

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
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi kết nối mạng!');
    } finally {
      setTimeout(() => setIsBidding(false), 1000);
    }
  };

  // --- LOGIC CHECK TRẠNG THÁI ---
  const accurateNowForCheck = new Date(new Date().getTime() - serverTimeOffset);
  const isTimeOut = commission && (new Date(commission.end_time) - accurateNowForCheck <= 0);
  const isClosed = isTimeOut || commission?.status === 'closed';
  const isUpcoming = commission && commission.status === 'upcoming';
  const topBid = bidHistory[0];
  const isWinner = isClosed && commission && String(commission.winner_bidder_id) === String(bidderId);

  // --- RENDER ---
  if (!commission) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19]">
        <p className="text-xl text-slate-400 font-bold italic animate-pulse">Đang tải phiên đấu giá...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] font-sans relative overflow-hidden">
      
      {/* Background Soft Neon Glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full ${theme.glow1} blur-[120px] pointer-events-none transition-all duration-500`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${theme.glow2} blur-[120px] pointer-events-none transition-all duration-500`} />

      {/* HEADER */}
      <header className="bg-[#0D1424]/80 backdrop-blur-md sticky top-0 z-40 border-b border-white/10 shadow-lg">
        <nav className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between relative">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r ${theme.primary} rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg ${theme.shadow} transition-all duration-500`}>
              <Gavel size={18} className="sm:w-[22px] sm:h-[22px]"/>
            </div>
            <span className="text-lg sm:text-2xl font-black tracking-tighter uppercase text-white transition-colors duration-500">
              Ngọc<span className={`${theme.text} transition-colors duration-500`}>Com</span>Auction
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Tùy chỉnh màu sắc Button */}
            <div className="relative">
              <button 
                onClick={() => setShowThemePanel(!showThemePanel)} 
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-full text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
                title="Thay đổi màu sắc giao diện"
              >
                <Palette size={18}/>
              </button>

              {/* Bảng tùy chỉnh màu sắc */}
              {showThemePanel && (
                <div className="absolute right-0 top-12 z-50 bg-[#0F1626]/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl w-56 animate-in fade-in slide-in-from-top-2 duration-150">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Màu sắc giao diện</h4>
                  <div className="space-y-2">
                    {Object.entries(THEMES).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedThemeKey(key);
                          localStorage.setItem('clientThemeKey', key);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-bold text-xs ${
                          selectedThemeKey === key 
                            ? 'bg-white/10 text-white border border-white/10' 
                            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${t.primary}`} />
                          <span>{t.name}</span>
                        </div>
                        {selectedThemeKey === key && <span className={`${t.text} font-black text-sm`}>●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {bidderName ? (
              <div className="flex items-center gap-1.5 sm:gap-3 bg-slate-800/80 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/10">
                <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-full ${theme.bgBadge} ${theme.textLight} transition-all duration-500 flex items-center justify-center font-bold text-[10px] sm:text-xs`}>
                  {bidderName[0]}
                </div>
                <span className="font-bold text-xs sm:text-sm text-slate-100 max-w-[80px] sm:max-w-none truncate">{bidderName}</span>
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
          
          <div className={`bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-4 sm:p-5 gap-6 sm:gap-8 flex flex-col md:flex-row shadow-pink-500/5 ${theme.shadow} transition-all duration-500`}>
            {/* Hình ảnh */}
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl sm:rounded-[2rem] md:w-2/5 aspect-square flex items-center justify-center overflow-hidden shadow-inner">
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
                  `${theme.bgBadge} ${theme.textLight} border ${theme.border}`
                }`}>
                  {commission.phase} - {isUpcoming ? 'Sắp diễn ra' : isClosed ? 'Đã đóng' : 'Đang mở'}
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 sm:mb-4">{commission.title}</h1>
              </div>

              {/* ĐỒNG HỒ */}
              <div className={`bg-gradient-to-r ${theme.primary} text-white p-4 sm:p-6 rounded-3xl mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-lg ${theme.shadow} transition-all duration-500`}>
                <div className="flex items-center gap-2.5 sm:gap-3 self-center sm:self-auto">
                  <Clock size={20} className="opacity-80 sm:w-7 sm:h-7"/>
                  <span className="font-bold text-xs sm:text-sm uppercase tracking-widest opacity-80">{isUpcoming ? 'Bắt đầu trong:' : 'Kết thúc trong:'}</span>
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 p-4 sm:p-6 bg-slate-900/60 rounded-2xl border border-white/5">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Giá hiện tại</p>
                  <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tighter flex items-baseline">
                    {parseFloat(currentPrice).toLocaleString('vi-VN')}
                    <span className="text-xl sm:text-2xl text-slate-400 ml-1 font-bold">đ</span>
                  </h2>
                </div>
                {topBid && (
                  <div className="flex items-center gap-3 bg-slate-950 border border-white/10 p-3 rounded-xl shadow-md self-start sm:self-auto w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">{topBid.full_name[0]}</div>
                    <div className="text-left">
                      <p className="text-xs text-slate-400 font-medium">Bởi</p>
                      <p className="font-bold text-sm text-slate-200">{topBid.full_name}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ACTION AREA */}
              {isUpcoming ? (
                <div className="w-full text-center p-5 sm:p-6 bg-purple-950/40 text-purple-300 rounded-2xl border border-purple-500/30 font-bold text-base sm:text-lg">
                  ⏰ Phiên đấu giá này chưa diễn ra. Vui lòng chờ đến giờ bắt đầu nhé!
                </div>
              ) : !isClosed ? (
                <div className="w-full space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:flex-1">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">đ</span>
                      <input 
                        type="number" 
                        value={customBid}
                        onChange={(e) => setCustomBid(Number(e.target.value))}
                        className={`w-full pl-10 pr-4 py-4 sm:py-5 bg-slate-950/60 border border-white/10 text-white rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-lg sm:text-xl transition-all`}
                      />
                    </div>
                    <button 
                      onClick={() => executeBid(customBid)} 
                      disabled={isBidding}
                      className={`w-full sm:flex-[1.5] bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white py-4 sm:py-5 px-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg ${theme.shadow} active:scale-95 disabled:opacity-50`} 
                    >
                      {isBidding ? 'Đang xử lý...' : `Đấu giá (+${(parseFloat(commission.min_increase) || 20000).toLocaleString('vi-VN')} đ)`}
                    </button>
                  </div>

                  <div className="relative flex py-1 sm:py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-widest">Hoặc</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <button 
                    onClick={() => executeBid(parseFloat(commission.auto_buy_price) || 1000000, true)} 
                    disabled={isBidding || parseFloat(currentPrice) >= (parseFloat(commission.auto_buy_price) || 1000000)}
                    className="w-full py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-black/30" 
                  >
                    MUA NGAY (AB) {parseFloat(commission.auto_buy_price || 1000000).toLocaleString('vi-VN')} đ
                  </button>
                </div>
              ) : (
                <div className="w-full text-center p-5 sm:p-6 bg-slate-900/60 rounded-2xl border border-white/5">
                  <span className="text-slate-400 font-bold text-base sm:text-lg italic">
                    {commission.status === 'closed' ? 'Phiên đấu giá đã chốt đơn!' : 'Phiên đấu giá đã hết thời gian!'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GIAO DIỆN DÀNH RIÊNG CHO NGƯỜI TRÚNG THẦU */}
          {isWinner && topBid && (
            <div className="bg-emerald-950/40 backdrop-blur-md border-2 border-emerald-500/30 p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] mt-6 text-center shadow-xl shadow-emerald-500/5">
              <h3 className="text-2xl sm:text-5xl font-black text-emerald-400 tracking-tighter mb-4">🎉 CHÚC MỪNG BẠN ĐÃ CHIẾN THẮNG!</h3>
              <p className="text-emerald-300 font-semibold text-sm sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
                Chúc mừng bạn đã trúng đấu giá! Vui lòng quét mã QR chuyển khoản bên dưới để đặt cọc trước 50% số tiền là <span className="font-extrabold text-white text-lg sm:text-2xl">{(parseFloat(topBid.bid_amount) / 2).toLocaleString('vi-VN')} đ</span> (tổng giá trị trúng bid là {parseFloat(topBid.bid_amount).toLocaleString('vi-VN')} đ) trong vòng 24 giờ nhé.
              </p>
              
              {MOMO_PHONE_NUMBER ? (
                <div className="bg-white p-4 sm:p-6 rounded-[2rem] inline-block shadow-lg border border-emerald-500/30 max-w-full">
                  <img
                    src={`https://img.vietqr.io/image/MBBANK-${MOMO_PHONE_NUMBER}-compact2.png?amount=${topBid.bid_amount / 2}&addInfo=Coc 50% Com ${commission.title.replace(/ /g, '%20')}`}
                    alt="VietQR"
                    className="mx-auto w-52 h-52 sm:w-64 sm:h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-yellow-950/40 border-2 border-yellow-500/30 p-4 sm:p-6 rounded-2xl text-yellow-300 font-bold text-sm sm:text-base">
                  ⚠️ Không tìm thấy số tài khoản. Vui lòng liên hệ admin để thanh toán!
                </div>
              )}
            </div>
          )}

          {/* RULES / TOS */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/5 flex items-center gap-2">
              <Zap size={20} className={`${theme.text} animate-pulse transition-colors duration-500`}/> Quy định & Hướng dẫn Đấu giá
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-4 sm:gap-y-5 text-slate-300 font-medium text-xs sm:text-sm">
              {[
                {icon: <Gavel size={16}/>, label: 'SB:', val: `${parseFloat(commission.start_price || 0).toLocaleString('vi-VN')} đ (Giá khởi điểm)`},
                {icon: <Zap size={16}/>, label: 'MI:', val: `${parseFloat(commission.min_increase || 20000).toLocaleString('vi-VN')} đ (Tối thiểu)${commission.max_increase ? ` - ${parseFloat(commission.max_increase).toLocaleString('vi-VN')} đ (Tối đa)` : ''}`},
                {icon: <Palette size={16}/>, label: 'AB:', val: `${parseFloat(commission.auto_buy_price || 1000000).toLocaleString('vi-VN')} đ (Mua đứt)`},
                {icon: <Clock size={16}/>, label: 'Thanh toán:', val: commission.rule_payment || 'Trong vòng 24h kể từ khi phiên đấu kết thúc'},
                {icon: <XCircle size={16}/>, label: 'Huỷ lượt:', val: commission.rule_disqualify || 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc'},
                {icon: <Info size={16}/>, label: 'Sử dụng:', val: commission.rule_usage || 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)'},
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 sm:p-4 bg-slate-950/60 rounded-xl border border-white/5">
                  <div className={`${theme.text} shrink-0 transition-colors duration-500`}>{item.icon}</div>
                  <span className="font-extrabold text-white w-20 shrink-0">{item.label}</span>
                  <span className="text-slate-300">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (Bid History) */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-lg h-fit lg:sticky lg:top-28">
          <h3 className="text-base sm:text-lg font-bold text-white mb-6 sm:mb-8 flex items-center gap-2">
            <Zap size={20} className={`${theme.text} animate-pulse transition-colors duration-500`}/>
            Lịch sử đấu giá trực tiếp
          </h3>
          <div className="space-y-4 sm:space-y-5">
            {bidHistory.map((bid, index) => {
              const isABWinner = (bid.isAutoBuy || (index === 0 && commission?.status === 'closed'));
              return (
                <div key={index} className={`flex items-center justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all ${
                  index === 0 && !isClosed ? `${theme.bgBadge} border ${theme.border} shadow-inner` : 
                  isABWinner ? `bg-gradient-to-r ${theme.primary} border ${theme.border} shadow-lg text-white` : 
                  'bg-slate-950/60 border border-white/5'
                }`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs ${isABWinner ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{bid.full_name[0]}</div>
                    <div>
                      <p className={`font-bold text-sm sm:text-base ${isABWinner ? 'text-white' : 'text-white'}`}>
                        {bid.full_name} 
                      </p>
                      <p className={`text-[10px] sm:text-xs ${isABWinner ? 'text-slate-200' : 'text-slate-400'}`}>
                        {new Date(bid.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(bid.created_at).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg sm:text-2xl font-black tracking-tighter ${isABWinner ? 'text-white' : index === 0 && !isClosed ? theme.textPrice : 'text-slate-200'} transition-colors duration-500`}>
                      {parseFloat(bid.bid_amount).toLocaleString('vi-VN')} đ
                    </div>
                    {isABWinner && <span className={`inline-block text-[9px] font-black uppercase tracking-widest ${selectedThemeKey === 'pink' ? 'bg-white text-pink-600' : 'bg-white text-slate-900'} px-2 py-0.5 rounded-full -mt-1`}>Winner</span>}
                  </div>
                </div>
              );
            })}
            {bidHistory.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-10 italic">Hãy là người đầu tiên đặt bid!</p>
            )}
          </div>
        </div>

      </main>

      {/* FORM ĐĂNG KÝ */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 transition-all animate-in fade-in duration-200">
          <div className="bg-[#0D1424] border border-white/10 p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6 sm:mb-10">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${theme.bgBadge} ${theme.text} border ${theme.border} rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg ${theme.shadow} transition-all duration-500`}>
                <User size={28} className="sm:w-8 sm:h-8"/>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">Chào mừng bạn!</h3>
              <p className="text-slate-400 mt-2 text-xs sm:text-sm max-w-xs mx-auto">Vui lòng điền thông tin để chúng tôi liên hệ khi bạn thắng phiên đấu giá nhé.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5">
              <input 
                type="text" 
                placeholder="Tên của bạn" 
                value={formData.fullName} 
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
                required 
                className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-950/60 border border-white/10 rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-base sm:text-lg text-white placeholder-slate-500`}
              />
              <input 
                type="text" 
                placeholder="Email hoặc Link Facebook (để nhận liên hệ khi thắng)" 
                value={formData.contactInfo} 
                onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })} 
                required 
                className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-950/60 border border-white/10 rounded-2xl focus:ring-2 ${theme.focusRing} focus:outline-none font-bold text-base sm:text-lg text-white placeholder-slate-500`}
              />
              <div className="flex gap-3 sm:gap-4 pt-3 sm:pt-4">
                <button type="submit" className={`flex-1 bg-gradient-to-r ${theme.primary} hover:${theme.primaryHover} text-white py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg ${theme.shadow} active:scale-95`}>
                  Xác nhận
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 sm:py-4 rounded-2xl border border-white/10 font-black text-base sm:text-lg transition-colors active:scale-95">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="max-w-[1600px] mx-auto px-6 py-10 mt-10 border-t border-white/5 text-center text-xs text-slate-500 font-medium">
        <p>&copy; {new Date().getFullYear()} NgocComAuction. All rights reserved.</p>
        <p className="mt-1">Powered by React & Node.js</p>
      </footer>

    </div>
  );
}