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

const MIN_INCREASE = import.meta.env.VITE_MIN_INCREASE ? parseInt(import.meta.env.VITE_MIN_INCREASE) : 20000;
const AUTO_BUY_PRICE = import.meta.env.VITE_AUTO_BUY_PRICE ? parseInt(import.meta.env.VITE_AUTO_BUY_PRICE) : 1000000;

// SĐT MOMO NHẬN TIỀN
const MOMO_PHONE_NUMBER = import.meta.env.VITE_MOMO_PHONE; 

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

  // 1. Hàm gọi API bọc trong useCallback để dùng lại mượt mà
  const fetchActiveCom = useCallback(async () => {
    try {
      const raw = await fetch(`${API_URL}/api/commissions/active`);
      if (raw.ok) {
        const ans = await raw.json();
        setCommission(ans);
        setCurrentPrice(ans.current_price);
        setCustomBid(parseFloat(ans.current_price) + MIN_INCREASE);
        
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
      // [FIX #7] Dùng !== undefined thay vì if(data.currentPrice) — tránh bỏ qua giá = 0
      if (data.currentPrice !== undefined) {
        setCurrentPrice(data.currentPrice);
        setCustomBid(parseFloat(data.currentPrice) + MIN_INCREASE);
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
        // Hiện lỗi từ server (tên quá dài, thiếu field, v.v.)
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

    // Validate phía client trước khi gửi lên server
    const parsed = parseFloat(amount);
    if (!isAutoBuy) {
      if (isNaN(parsed) || parsed <= 0) {
        toast.error('Giá trị đặt đấu giá không hợp lệ!');
        return;
      }
      const minBid = parseFloat(currentPrice) + MIN_INCREASE;
      if (parsed < minBid) {
        toast.error(`Mức đấu giá tối thiểu là ${minBid.toLocaleString('vi-VN')} đ!`);
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
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FB]">
        <p className="text-xl text-gray-400 font-bold italic animate-pulse">Đang tải phiên đấu giá...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-[#2D3748]">
      
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
        <nav className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100">
              <Gavel size={18} className="sm:w-[22px] sm:h-[22px]"/>
            </div>
            <span className="text-lg sm:text-2xl font-black tracking-tighter uppercase">Ngọc<span className="text-red-600">Com</span>Auction</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {bidderName ? (
              <div className="flex items-center gap-1.5 sm:gap-3 bg-gray-50 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-gray-100">
                <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[10px] sm:text-xs">{bidderName[0]}</div>
                <span className="font-bold text-xs sm:text-sm max-w-[80px] sm:max-w-none truncate">{bidderName}</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-gray-400 hover:text-red-500 p-0.5"><LogOut size={14} className="sm:w-4 sm:h-4"/></button>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-gray-900 text-white px-3.5 py-2 sm:px-6 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:bg-black transition-all shadow-md active:scale-95">
                <User size={14} className="sm:w-[18px] sm:h-[18px]"/> Đăng nhập<span className="hidden sm:inline"> để Bid</span>
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        
        {/* CỘT TRÁI (Main Auction Card) */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
          
          <div className="bg-white rounded-3xl sm:rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row p-4 sm:p-5 gap-6 sm:gap-8">
            {/* Hình ảnh */}
            <div className="bg-gray-100 rounded-2xl sm:rounded-[2rem] md:w-2/5 aspect-square flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner">
              <img 
                src={previewImg} 
                alt={commission.title} 
                className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
              />
            </div>
            
            {/* Thông tin & Bid Section */}
            <div className="flex-1 flex flex-col justify-center py-2 sm:py-4">
              <div className="mb-4 sm:mb-6">
                <span className={`inline-block px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2.5 sm:mb-3 ${isUpcoming ? 'bg-purple-100 text-purple-700 animate-pulse' : isClosed ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-700'}`}>
                  {commission.phase} - {isUpcoming ? 'Sắp diễn ra' : isClosed ? 'Đã đóng' : 'Đang mở'}
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-950 mb-2 sm:mb-4">{commission.title}</h1>
              </div>

              {/* ĐỒNG HỒ */}
              <div className="bg-[#E53E3E] text-white p-4 sm:p-6 rounded-3xl mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-xl shadow-red-200">
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
                        <div className="text-2xl sm:text-4xl font-black tracking-tighter w-11 sm:w-14 py-0.5 sm:py-1 bg-black/10 rounded-lg sm:rounded-xl">{item.val}</div>
                        <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest opacity-70 mt-1">{item.label}</div>
                      </div>
                      {index < 3 && <div className="text-xl sm:text-3xl font-bold opacity-50 -mt-4 sm:-mt-5">:</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* GIÁ HIỆN TẠI */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Giá hiện tại</p>
                  <h2 className="text-4xl sm:text-6xl font-black text-gray-950 tracking-tighter flex items-baseline">
                    {parseFloat(currentPrice).toLocaleString('vi-VN')}
                    <span className="text-xl sm:text-2xl text-gray-400 ml-1 font-bold">đ</span>
                  </h2>
                </div>
                {topBid && (
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100 self-start sm:self-auto w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">{topBid.full_name[0]}</div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400 font-medium">Bởi</p>
                      <p className="font-bold text-sm text-gray-800">{topBid.full_name}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ACTION AREA */}
              {isUpcoming ? (
                <div className="w-full text-center p-5 sm:p-6 bg-purple-50 text-purple-700 rounded-2xl border border-purple-100 font-bold text-base sm:text-lg">
                  ⏰ Phiên đấu giá này chưa diễn ra. Vui lòng chờ đến giờ bắt đầu nhé!
                </div>
              ) : !isClosed ? (
                <div className="w-full space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:flex-1">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">đ</span>
                      <input 
                        type="number" 
                        value={customBid}
                        onChange={(e) => setCustomBid(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-4 sm:py-5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-lg sm:text-xl transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => executeBid(customBid)} 
                      disabled={isBidding}
                      className="w-full sm:flex-[1.5] bg-red-600 hover:bg-red-700 text-white py-4 sm:py-5 px-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50" 
                    >
                      {isBidding ? 'Đang xử lý...' : `Đấu giá (+${MIN_INCREASE.toLocaleString('vi-VN')} đ)`}
                    </button>
                  </div>

                  <div className="relative flex py-1 sm:py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-widest">Hoặc</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  <button 
                    onClick={() => executeBid(AUTO_BUY_PRICE, true)} 
                    disabled={isBidding || currentPrice >= AUTO_BUY_PRICE}
                    className="w-full py-4 sm:py-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95 disabled:opacity-50" 
                  >
                    MUA NGAY (AB) {AUTO_BUY_PRICE.toLocaleString('vi-VN')} đ
                  </button>
                </div>
              ) : (
                <div className="w-full text-center p-5 sm:p-6 bg-gray-100 rounded-2xl border border-gray-200">
                  <span className="text-gray-500 font-bold text-base sm:text-lg italic">
                    {commission.status === 'closed' ? 'Phiên đấu giá đã chốt đơn!' : 'Phiên đấu giá đã hết thời gian!'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GIAO DIỆN DÀNH RIÊNG CHO NGƯỜI TRÚNG THẦU */}
          {isWinner && topBid && (
            <div className="bg-green-50 border-2 border-green-500 p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] mt-6 text-center shadow-xl shadow-green-100">
              <h3 className="text-2xl sm:text-5xl font-black text-green-700 tracking-tighter mb-4">🎉 CHÚC MỪNG BẠN ĐÃ CHIẾN THẮNG!</h3>
              <p className="text-green-700 font-semibold text-sm sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
                Chúc mừng bạn đã trúng đấu giá! Vui lòng quét mã QR chuyển khoản bên dưới để đặt cọc trước 50% số tiền là <span className="font-extrabold text-lg sm:text-2xl">{(parseFloat(topBid.bid_amount) / 2).toLocaleString('vi-VN')} đ</span> (tổng giá trị trúng bid là {parseFloat(topBid.bid_amount).toLocaleString('vi-VN')} đ) trong vòng 24 giờ nhé.
              </p>
              
              {/* [FIX #6] Fallback khi VITE_MOMO_PHONE chưa được cấu hình */}
              {MOMO_PHONE_NUMBER ? (
                <div className="bg-white p-4 sm:p-6 rounded-[2rem] inline-block shadow-lg border border-green-100 max-w-full">
                  <img
                    src={`https://img.vietqr.io/image/MBBANK-${MOMO_PHONE_NUMBER}-compact2.png?amount=${topBid.bid_amount / 2}&addInfo=Coc 50% Com ${commission.title.replace(/ /g, '%20')}`}
                    alt="VietQR"
                    className="mx-auto w-52 h-52 sm:w-64 sm:h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-400 p-4 sm:p-6 rounded-2xl text-yellow-800 font-bold text-sm sm:text-base">
                  ⚠️ Không tìm thấy số tài khoản. Vui lòng liên hệ admin để thanh toán!
                </div>
              )}
            </div>
          )}

          {/* RULES / TOS */}
          <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-lg sm:text-xl font-bold text-gray-950 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-50 flex items-center gap-2"><Zap size={20} className="text-red-500"/> Quy định & Hướng dẫn Đấu giá</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-4 sm:gap-y-5 text-gray-700 font-medium text-xs sm:text-sm">
              {[
                {icon: <Gavel size={16}/>, label: 'SB:', val: 'Theo cài đặt (Giá khởi điểm)'},
                {icon: <Zap size={16}/>, label: 'MI:', val: `${MIN_INCREASE.toLocaleString('vi-VN')} đ (Bước giá tối thiểu)`},
                {icon: <Palette size={16}/>, label: 'AB:', val: `${AUTO_BUY_PRICE.toLocaleString('vi-VN')} đ (Giá mua đứt - Thắng ngay)`},
                {icon: <Clock size={16}/>, label: 'Thanh toán:', val: 'Trong vòng 24h kể từ khi phiên đấu kết thúc'},
                {icon: <XCircle size={16}/>, label: 'Huỷ lượt:', val: 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc'},
                {icon: <Info size={16}/>, label: 'Sử dụng:', val: 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)'},
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-red-500 shrink-0">{item.icon}</div>
                  <span className="font-extrabold text-gray-900 w-16 sm:w-20 shrink-0">{item.label}</span>
                  <span className="text-gray-600">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (Bid History) */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-lg border border-gray-100 h-fit lg:sticky lg:top-28">
          <h3 className="text-base sm:text-lg font-bold text-gray-950 mb-6 sm:mb-8 flex items-center gap-2">
            <Zap size={20} className="text-red-500 animate-pulse"/>
            Lịch sử đấu giá trực tiếp
          </h3>
          <div className="space-y-4 sm:space-y-5">
            {bidHistory.map((bid, index) => {
              const isABWinner = (bid.isAutoBuy || (index === 0 && commission?.status === 'closed'));
              return (
                <div key={index} className={`flex items-center justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all ${index === 0 && !isClosed ? 'bg-red-50 border border-red-100 shadow-inner' : isABWinner ? 'bg-gray-950 border border-black shadow-lg' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs ${isABWinner ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{bid.full_name[0]}</div>
                    <div>
                      <p className={`font-bold text-sm sm:text-base ${isABWinner ? 'text-white' : 'text-gray-950'}`}>
                        {bid.full_name} 
                      </p>
                      <p className={`text-[10px] sm:text-xs ${isABWinner ? 'text-gray-300' : 'text-gray-500'}`}>
                        {new Date(bid.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(bid.created_at).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg sm:text-2xl font-black tracking-tighter ${isABWinner ? 'text-red-500' : index === 0 && !isClosed ? 'text-red-600' : 'text-gray-950'}`}>
                      {parseFloat(bid.bid_amount).toLocaleString('vi-VN')} đ
                    </div>
                    {isABWinner && <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-full -mt-1">Winner</span>}
                  </div>
                </div>
              );
            })}
            {bidHistory.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10 italic">Hãy là người đầu tiên đặt bid!</p>
            )}
          </div>
        </div>

      </main>

      {/* FORM ĐĂNG KÝ */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 transition-all">
          <div className="bg-white p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all">
            <div className="text-center mb-6 sm:mb-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-red-100">
                <User size={28} className="sm:w-8 sm:h-8"/>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tighter text-gray-950">Chào mừng bạn!</h3>
              <p className="text-gray-500 mt-2 text-xs sm:text-sm max-w-xs mx-auto">Vui lòng điền thông tin để chúng tôi liên hệ khi bạn thắng phiên đấu giá nhé.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5">
              <input 
                type="text" 
                placeholder="Tên của bạn" 
                value={formData.fullName} 
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
                required 
                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-base sm:text-lg"
              />
              <input 
                type="text" 
                placeholder="Email hoặc Link Facebook (để nhận liên hệ khi thắng)" 
                value={formData.contactInfo} 
                onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })} 
                required 
                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-base sm:text-lg"
              />
              <div className="flex gap-3 sm:gap-4 pt-3 sm:pt-4">
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-colors shadow-lg shadow-red-100 active:scale-95">
                  Xác nhận
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg transition-colors active:scale-95">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="max-w-[1600px] mx-auto px-6 py-10 mt-10 border-t border-gray-100 text-center text-xs text-gray-400 font-medium">
        <p>&copy; {new Date().getFullYear()} NgocComAuction. All rights reserved.</p>
        <p className="mt-1">Powered by React & Node.js</p>
      </footer>

    </div>
  );
}