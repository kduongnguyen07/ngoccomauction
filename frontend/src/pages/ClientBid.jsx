import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { 
  Gavel, Zap, Clock, Palette, CheckCircle2, 
  XCircle, Info, LogOut, User 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const USD_VND_RATE = import.meta.env.VITE_USD_VND_RATE ? parseInt(import.meta.env.VITE_USD_VND_RATE) : 25000;

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
        setCustomBid(parseFloat(ans.current_price) + 2);
        
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
    if (!commission || !commission.end_time) return;

    const interval = setInterval(() => {
      if (commission.status === 'closed') {
        setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
        clearInterval(interval);
        return;
      }

      const accurateNow = new Date(new Date().getTime() - serverTimeOffset);
      const difference = new Date(commission.end_time) - accurateNow;
      
      if (difference <= 0) {
        setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
        clearInterval(interval);
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
  }, [commission, serverTimeOffset]);

  // 4. Lắng nghe Socket Realtime cho phiên đấu giá HIỆN TẠI
  useEffect(() => {
    if (!commission || !socket) return;
    
    const channel = `commission-${commission.id}-update`;
    const handleLocalUpdate = (data) => {
      // [FIX #7] Dùng !== undefined thay vì if(data.currentPrice) — tránh bỏ qua giá = 0
      if (data.currentPrice !== undefined) {
        setCurrentPrice(data.currentPrice);
        setCustomBid(parseFloat(data.currentPrice) + 2);
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
        toast.error('Giá bid không hợp lệ!');
        return;
      }
      const minBid = parseFloat(currentPrice) + 2;
      if (parsed < minBid) {
        toast.error(`Bid tối thiểu phải là $${minBid.toFixed(0)}!`);
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
        <nav className="max-w-[1600px] mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100">
              <Gavel size={22}/>
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">Ngọc<span className="text-red-600">Com</span>Auction</span>
          </div>
          
          {/* [FIX #5] Xóa các nav link href="#" giả — không có nội dung */}

          <div className="flex items-center gap-4">
            {bidderName ? (
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">{bidderName[0]}</div>
                <span className="font-bold text-sm">{bidderName}</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-gray-400 hover:text-red-500"><LogOut size={16}/></button>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-black transition-all shadow-md active:scale-95">
                <User size={18}/> Đăng nhập để Bid
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1600px] mx-auto p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* CỘT TRÁI (Main Auction Card) */}
        <div className="lg:col-span-2 space-y-8 animate-in fade-in duration-500">
          
          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row p-5 gap-8">
            {/* Hình ảnh */}
            <div className="bg-gray-100 rounded-[2rem] md:w-2/5 aspect-square flex items-center justify-center text-gray-300 font-bold italic p-10 border border-gray-100 shadow-inner">
              <Palette size={64} strokeWidth={1} />
            </div>
            
            {/* Thông tin & Bid Section */}
            <div className="flex-1 flex flex-col justify-center py-4">
              <div className="mb-6">
                <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3 ${isClosed ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-700'}`}>
                  {commission.phase} - {isClosed ? 'Closed' : 'Open'}
                </span>
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 mb-6">{commission.title}</h1>
              </div>

              {/* ĐỒNG HỒ */}
              <div className="bg-[#E53E3E] text-white p-6 rounded-3xl mb-8 flex items-center justify-between shadow-xl shadow-red-200">
                <div className="flex items-center gap-3">
                  <Clock size={28} className="opacity-80"/>
                  <span className="font-bold text-sm uppercase tracking-widest opacity-80">Kết thúc trong:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { val: timeLeft.d, label: 'Ngày' }, { val: timeLeft.h, label: 'Giờ' }, 
                    { val: timeLeft.m, label: 'Phút' }, { val: timeLeft.s, label: 'Giây' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="text-center">
                        <div className="text-4xl font-black tracking-tighter w-14 py-1 bg-black/10 rounded-xl">{item.val}</div>
                        <div className="text-[10px] font-medium uppercase tracking-widest opacity-70 mt-1">{item.label}</div>
                      </div>
                      {index < 3 && <div className="text-3xl font-bold opacity-50 -mt-5">:</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* GIÁ HIỆN TẠI */}
              <div className="flex items-center justify-between mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Current Bid</p>
                  <h2 className="text-6xl font-black text-gray-950 tracking-tighter flex items-start">
                    <span className="text-3xl text-gray-400 mt-2 mr-1">$</span>
                    {currentPrice}
                  </h2>
                </div>
                {topBid && (
                  <div className="text-right flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">{topBid.full_name[0]}</div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Bởi</p>
                      <p className="font-bold text-sm text-gray-800">{topBid.full_name}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ACTION AREA */}
              {!isClosed ? (
                <div className="w-full space-y-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
                      <input 
                        type="number" 
                        value={customBid}
                        onChange={(e) => setCustomBid(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-xl transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => executeBid(customBid)} 
                      disabled={isBidding}
                      className="flex-[1.5] bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50" 
                    >
                      {isBidding ? 'Processing...' : `Place a Bid (MI: $2)`}
                    </button>
                  </div>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-bold uppercase tracking-widest">Or</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  <button 
                    onClick={() => executeBid(40, true)} 
                    disabled={isBidding || currentPrice >= 40}
                    className="w-full py-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-xl transition-all active:scale-95 disabled:opacity-50" 
                  >
                    AUTO BUY $40
                  </button>
                </div>
              ) : (
                <div className="w-full text-center p-6 bg-gray-100 rounded-2xl border border-gray-200">
                  <span className="text-gray-500 font-bold text-lg italic">
                    {commission.status === 'closed' ? 'Phiên đấu giá đã chốt đơn!' : 'Phiên đấu giá đã hết thời gian!'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GIAO DIỆN DÀNH RIÊNG CHO THẰNG TRÚNG THẦU */}
          {isWinner && topBid && (
            <div className="bg-green-50 border-2 border-green-500 p-10 rounded-[2.5rem] mt-6 text-center shadow-xl shadow-green-100">
              <h3 className="text-5xl font-black text-green-700 tracking-tighter mb-4">🎉 YOU WON THE AUCTION!</h3>
              <p className="text-green-700 font-semibold text-lg mb-8 max-w-xl mx-auto">
                Chúc mừng mày đã trúng Com! Vui lòng quét mã MOMO bên dưới để thanh toán số tiền <span className="font-extrabold text-2xl">${topBid.bid_amount}</span> trong vòng 24h nhé.
              </p>
              
              {/* [FIX #6] Fallback khi VITE_MOMO_PHONE chưa được cấu hình */}
              {MOMO_PHONE_NUMBER ? (
                <div className="bg-white p-6 rounded-3xl inline-block shadow-lg border border-green-100">
                  <img
                    src={`https://img.vietqr.io/image/MBBANK-${MOMO_PHONE_NUMBER}-compact2.png?amount=${topBid.bid_amount * USD_VND_RATE}&addInfo=Thanh toan Com ${commission.title.replace(/ /g, '%20')}`}
                    alt="Momo QR"
                    className="mx-auto w-64 h-64"
                  />
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-2xl text-yellow-800 font-bold">
                  ⚠️ Không tìm thấy số tài khoản. Vui lòng liên hệ admin để thanh toán!
                </div>
              )}
              <p className="text-sm text-gray-500 mt-6 italic flex items-center justify-center gap-2">
                <Info size={16}/> Tỷ giá tạm tính: {USD_VND_RATE.toLocaleString('vi-VN')} VNĐ / 1 USD
              </p>
            </div>
          )}

          {/* RULES / TOS */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-950 mb-6 pb-4 border-b border-gray-50 flex items-center gap-2"><Zap size={20} className="text-red-500"/> Auction Rules & Terms of Service</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 text-gray-700 font-medium text-sm">
              {[
                {icon: <Gavel size={16}/>, label: 'SB:', val: '$0 (Starting Bid)'},
                {icon: <Zap size={16}/>, label: 'MI:', val: '$2 (Minimum Increase)'},
                {icon: <Palette size={16}/>, label: 'AB:', val: '$40 (Auto Buy - Instant Win)'},
                {icon: <Clock size={16}/>, label: 'Payment:', val: 'Within 24h after winning'},
                {icon: <XCircle size={16}/>, label: 'Cancel:', val: 'No refund / cancel bid'},
                {icon: <Info size={16}/>, label: 'Usage:', val: 'Personal use only (Commercial fee extra)'},
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-red-500">{item.icon}</div>
                  <span className="font-extrabold text-gray-900 w-20">{item.label}</span>
                  <span className="text-gray-600">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (Bid History) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-gray-100 h-fit sticky top-28">
          <h3 className="text-lg font-bold text-gray-950 mb-8 flex items-center gap-2">
            <Zap size={20} className="text-red-500 animate-pulse"/>
            Live Bid History
          </h3>
          <div className="space-y-5">
            {bidHistory.map((bid, index) => {
              const isABWinner = (bid.isAutoBuy || (index === 0 && commission?.status === 'closed'));
              return (
                <div key={index} className={`flex items-center justify-between p-5 rounded-2xl transition-all ${index === 0 && !isClosed ? 'bg-red-50 border border-red-100 shadow-inner' : isABWinner ? 'bg-gray-950 border border-black shadow-lg' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${isABWinner ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{bid.full_name[0]}</div>
                    <div>
                      <p className={`font-bold ${isABWinner ? 'text-white' : 'text-gray-950'}`}>
                        {bid.full_name} 
                      </p>
                      <p className={`text-xs ${isABWinner ? 'text-gray-300' : 'text-gray-500'}`}>
                        {new Date(bid.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(bid.created_at).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black tracking-tighter ${isABWinner ? 'text-red-500' : index === 0 && !isClosed ? 'text-red-600' : 'text-gray-950'}`}>
                      ${bid.bid_amount}
                    </div>
                    {isABWinner && <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-full -mt-1">Winner</span>}
                  </div>
                </div>
              );
            })}
            {bidHistory.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10 italic">Be the first to bid!</p>
            )}
          </div>
        </div>

      </main>

      {/* FORM ĐĂNG KÝ */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 transition-all">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md transform transition-all">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
                <User size={32}/>
              </div>
              <h3 className="text-3xl font-black tracking-tighter text-gray-950">Wait, Who are you?</h3>
              <p className="text-gray-500 mt-2 text-sm max-w-xs mx-auto">Nhập lẹ cái info để tụi tao biết mày là ai trước khi ném tiền vào mặt nhé.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-5">
              <input 
                type="text" 
                placeholder="Tên mày là gì?" 
                value={formData.fullName} 
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
                required 
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-lg"
              />
              <input 
                type="text" 
                placeholder="Email hoặc Facebook (để liên hệ khi thắng, link facebook thì nhớ để chế độ công khai nhé)" 
                value={formData.contactInfo} 
                onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })} 
                required 
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-lg"
              />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-red-100 active:scale-95">
                  Xác nhận
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-black text-lg transition-colors active:scale-95">
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