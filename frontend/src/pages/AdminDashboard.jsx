import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, Gavel, History, Settings, LogOut, 
  Plus, Search, Bell, CheckCircle2, XCircle, Clock, ShieldAlert,
  Menu
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')) 
  ? rawApiUrl 
  : `https://${rawApiUrl}`;

export default function AdminDashboard() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(API_URL);
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');
  
  // State điều hướng
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, commissions, logs, settings
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [commissions, setCommissions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [bidders, setBidders] = useState([]);
  const [pending, setPending] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    phase: '',
    startPrice: 0,
    startTime: '',
    endTime: '',
    imageUrl: '',
    minIncrease: 20000,
    maxIncrease: '',
    autoBuyPrice: 1000000,
    rulePayment: 'Trong vòng 24h kể từ khi phiên đấu kết thúc',
    ruleDisqualify: 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc',
    ruleUsage: 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)'
  });

  const [editingCommission, setEditingCommission] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '', phase: '', startPrice: 0, startTime: '', endTime: '', imageUrl: '',
    minIncrease: 20000, maxIncrease: '', autoBuyPrice: 1000000,
    rulePayment: '', ruleDisqualify: '', ruleUsage: ''
  });

  const handleEditClick = (c) => {
    const formatLocalDate = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setEditingCommission(c);
    setEditFormData({
      title: c.title,
      phase: c.phase,
      startPrice: parseFloat(c.start_price),
      startTime: formatLocalDate(c.start_time),
      endTime: formatLocalDate(c.end_time),
      imageUrl: c.image_url || '',
      minIncrease: parseFloat(c.min_increase) || 20000,
      maxIncrease: c.max_increase ? parseFloat(c.max_increase) : '',
      autoBuyPrice: parseFloat(c.auto_buy_price) || 1000000,
      rulePayment: c.rule_payment || 'Trong vòng 24h kể từ khi phiên đấu kết thúc',
      ruleDisqualify: c.rule_disqualify || 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc',
      ruleUsage: c.rule_usage || 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)'
    });
  };

  const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    // [FIX] Đọc token trong lúc fetch, không capture từ closure — tránh stale token
    const currentToken = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${currentToken}`, 'Content-Type': 'application/json' };
    try {
      const [resCom, resLogs, resBidders] = await Promise.all([
        fetch(`${API_URL}/api/commissions`, { headers }),
        fetch(`${API_URL}/api/admin/logs`, { headers }),
        fetch(`${API_URL}/api/admin/bidders`, { headers })
      ]);
      if (resCom.status === 401 || resCom.status === 403) navigate('/admin/login');
      setCommissions(await resCom.json());
      setLogs(await resLogs.json());
      setBidders(await resBidders.json());
    } catch (e) { console.error(e); }
  }, [navigate]);

  useEffect(() => {
    if (!token) navigate('/admin/login');
    fetchData();
    if (socket) {
      socket.on('global-update', fetchData);
      socket.on('admin-notification', (data) => {
        setPending(prev => [...new Set([...prev, parseInt(data.id)])]);
      });
    }
    return () => {
      if (socket) {
        socket.off('global-update', fetchData);
        socket.off('admin-notification');
      }
    };
  }, [token, fetchData, navigate, socket]);

  const handleAction = async (endpoint, method = 'PUT', body = null) => {
    setIsProcessing(true);
    const currentToken = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${currentToken}`, 'Content-Type': 'application/json' };
    try {
      const r = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null });
      if (!r.ok) {
        const err = await r.json();
        toast.error("Lỗi: " + (err.error || "Thao tác thất bại"));
      } else {
        toast.success("Thao tác thành công!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi kết nối mạng!");
    }
    fetchData();
    setIsProcessing(false);
  };

  // --- RENDER CÁC VIEW KHÁC NHAU ---
  
  const renderDashboard = () => (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-500">
      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <StatCard icon={<Clock className="text-blue-500"/>} label="Đang đấu giá" value={commissions.filter(c => c.status === 'active').length} />
        <StatCard icon={<CheckCircle2 className="text-green-500"/>} label="Đã hoàn thành" value={commissions.filter(c => c.is_paid).length} />
        <StatCard icon={<ShieldAlert className="text-red-500"/>} label="Chờ thanh toán" value={commissions.filter(c => c.status === 'closed' && !c.is_paid).length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-bold">Đợt đấu giá gần đây</h2>
            <button onClick={() => setCurrentView('commissions')} className="text-indigo-600 font-bold text-sm hover:underline">Xem tất cả</button>
          </div>
          <div className="overflow-x-auto">
            <CommissionTable data={commissions.slice(0, 5)} handleAction={handleAction} pending={pending} handleEditClick={handleEditClick} />
          </div>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 h-fit max-h-[85vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2"><Plus size={20} className="text-indigo-600"/> Tạo đợt mới</h2>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            let formattedData;
            try {
              formattedData = {
                ...formData,
                startTime: formData.startTime ? new Date(formData.startTime).toISOString() : '',
                endTime: formData.endTime ? new Date(formData.endTime).toISOString() : ''
              };
            } catch (err) {
              toast.error("Vui lòng nhập ngày giờ hợp lệ!");
              return;
            }
            handleAction('/api/commissions', 'POST', formattedData); 
          }} className="space-y-4">
            <Input label="Tên Commission" placeholder="VD: Vẽ Chibi" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <Input label="Giai đoạn" placeholder="VD: Batch #1" value={formData.phase} onChange={e => setFormData({...formData, phase: e.target.value})} />
            <Input label="Giá khởi điểm (VND)" type="number" value={formData.startPrice} onChange={e => setFormData({...formData, startPrice: parseFloat(e.target.value) || 0})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Bắt đầu" type="datetime-local" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
              <Input label="Kết thúc" type="datetime-local" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
            </div>
            <Input label="Link ảnh minh hoạ (Tùy chọn)" placeholder="VD: https://imgur.com/xyz.png" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
            
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h3 className="text-xs font-black text-gray-500 mb-3 uppercase tracking-wider">Luật Đấu Giá Cụ Thể</h3>
              <div className="grid grid-cols-3 gap-2">
                <Input label="MI tối thiểu" type="number" value={formData.minIncrease} onChange={e => setFormData({...formData, minIncrease: parseFloat(e.target.value) || 0})} />
                <Input label="Tăng tối đa" type="number" placeholder="Không" value={formData.maxIncrease} onChange={e => setFormData({...formData, maxIncrease: e.target.value ? parseFloat(e.target.value) : ''})} />
                <Input label="Giá AB" type="number" value={formData.autoBuyPrice} onChange={e => setFormData({...formData, autoBuyPrice: parseFloat(e.target.value) || 0})} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">Quy định hiển thị</h3>
              <Input label="Thanh Toán" value={formData.rulePayment} onChange={e => setFormData({...formData, rulePayment: e.target.value})} />
              <Input label="Hủy Lượt / Trảm" value={formData.ruleDisqualify} onChange={e => setFormData({...formData, ruleDisqualify: e.target.value})} />
              <Input label="Quyền Sử Dụng" value={formData.ruleUsage} onChange={e => setFormData({...formData, ruleUsage: e.target.value})} />
            </div>

            <button className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all mt-2">Kích hoạt ngay</button>
          </form>
        </div>
      </div>
    </div>
  );

  const formatLogMessage = (log) => {
    try {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      if (log.action === 'CONFIRM_PAYMENT') {
        return `✅ Đã nhận tiền cọc cho Commission #${details.commission_id}`;
      }
      if (log.action === 'DISQUALIFY') {
        return `❌ Đã trảm (Hủy lượt): Bidder "${details.winner_name || 'không rõ'}" tại Commission #${details.commission_id}`;
      }
      return `${log.action}: ${JSON.stringify(details)}`;
    } catch (e) {
      return `${log.action}: ${JSON.stringify(log.details)}`;
    }
  };

  const renderLogs = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* CỘT 1: DANH SÁCH BIDDER ĐÃ ĐĂNG KÝ */}
      <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-gray-50">
          <h2 className="text-xl sm:text-2xl font-bold">Người tham gia đấu giá</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Danh sách các tài khoản đã đăng ký trong hệ thống.</p>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FBFBFE] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Tên người dùng</th>
                <th className="px-6 py-4">Thông tin liên hệ</th>
                <th className="px-6 py-4">Ngày đăng ký</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bidders.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{b.full_name}</td>
                  <td className="px-6 py-4 text-indigo-600 font-medium text-sm">
                    {b.contact_info.startsWith('http') ? (
                      <a href={b.contact_info} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Link liên hệ
                      </a>
                    ) : b.contact_info}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {bidders.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-gray-400 italic">Chưa có người đăng ký nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CỘT 2: NHẬT KÝ HỆ THỐNG */}
      <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-gray-50">
          <h2 className="text-xl sm:text-2xl font-bold">Nhật ký giao dịch</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Lịch sử thanh toán cọc và các hình phạt hủy lượt.</p>
        </div>
        <div className="p-4 sm:p-6 space-y-3 max-h-[600px] overflow-y-auto">
          {logs.map(log => {
            const isDisqualify = log.action === 'DISQUALIFY';
            return (
              <div key={log.id} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${isDisqualify ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {isDisqualify ? '❌ Trảm' : '✅ Nhận cọc'}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-700 text-sm font-bold">{formatLogMessage(log)}</p>
              </div>
            );
          })}
          {logs.length === 0 && (
            <p className="text-center text-gray-400 italic py-8">Chưa có nhật ký giao dịch nào.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] font-sans text-[#2D3748] relative overflow-x-hidden">
      
      {/* SIDEBAR DRAWER OVERLAY FOR MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col p-6 transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Gavel size={22}/>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Admin<span className="text-indigo-600">Pro</span></span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem icon={<Gavel size={20}/>} label="Commissions" active={currentView === 'commissions'} onClick={() => { setCurrentView('commissions'); setIsSidebarOpen(false); }} />
          <NavItem icon={<History size={20}/>} label="Bidders & Logs" active={currentView === 'logs'} onClick={() => { setCurrentView('logs'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="pt-6 border-t border-gray-50 space-y-2">
          <NavItem icon={<Settings size={20}/>} label="Settings" active={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} />
          <button onClick={() => {localStorage.removeItem('adminToken'); navigate('/admin/login');}} className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-sm">
            <LogOut size={20}/> <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 sm:p-10 overflow-y-auto w-full max-w-full">
        <header className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 mb-8 sm:mb-12">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="lg:hidden p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-600 hover:text-gray-900 active:scale-95 transition-all shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="relative flex-1 sm:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Tìm kiếm thông tin..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none shadow-sm" />
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            {/* Logo hiển thị trên mobile khi Sidebar đóng */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Gavel size={16}/>
              </div>
              <span className="text-base font-black tracking-tighter uppercase">Admin<span className="text-indigo-600">Pro</span></span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center font-bold text-indigo-600">A</div>
          </div>
        </header>

        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
            {currentView === 'dashboard' && (() => {
              const h = new Date().getHours();
              if (h < 12) return 'Chào buổi sáng, Admin!';
              if (h < 18) return 'Chào buổi chiều, Admin!';
              return 'Chào buổi tối, Admin!';
            })()}
            {currentView === 'commissions' && "Quản lý Commissions"}
            {currentView === 'logs' && "Người tham gia & Nhật ký giao dịch"}
          </h1>
          <p className="text-gray-400 font-medium uppercase text-[10px] tracking-[0.2em]">Hệ thống đấu giá Commission v2.0</p>
        </div>

        {/* SWITCH VIEWS */}
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'commissions' && (
          <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            <CommissionTable data={commissions} handleAction={handleAction} pending={pending} handleEditClick={handleEditClick} />
          </div>
        )}
        {currentView === 'logs' && renderLogs()}
      </main>

      {/* SỬA LUẬT MODAL */}
      {editingCommission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Chỉnh sửa luật & Thông tin</h2>
              <button 
                onClick={() => setEditingCommission(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              let formattedData;
              try {
                formattedData = {
                  ...editFormData,
                  startTime: editFormData.startTime ? new Date(editFormData.startTime).toISOString() : '',
                  endTime: editFormData.endTime ? new Date(editFormData.endTime).toISOString() : ''
                };
              } catch (err) {
                toast.error("Vui lòng nhập ngày giờ hợp lệ!");
                return;
              }
              await handleAction(`/api/commissions/${editingCommission.id}`, 'PUT', formattedData);
              setEditingCommission(null);
            }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Tên Commission" value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} />
                <Input label="Giai đoạn" value={editFormData.phase} onChange={e => setEditFormData({...editFormData, phase: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Giá khởi điểm (VND)" type="number" value={editFormData.startPrice} onChange={e => setEditFormData({...editFormData, startPrice: parseFloat(e.target.value) || 0})} />
                <Input label="Bắt đầu" type="datetime-local" value={editFormData.startTime} onChange={e => setEditFormData({...editFormData, startTime: e.target.value})} />
                <Input label="Kết thúc" type="datetime-local" value={editFormData.endTime} onChange={e => setEditFormData({...editFormData, endTime: e.target.value})} />
              </div>
              <Input label="Link ảnh minh hoạ" value={editFormData.imageUrl} onChange={e => setEditFormData({...editFormData, imageUrl: e.target.value})} />
              
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Luật Đấu Giá Cụ Thể</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Mức tăng tối thiểu (VND)" type="number" value={editFormData.minIncrease} onChange={e => setEditFormData({...editFormData, minIncrease: parseFloat(e.target.value) || 0})} />
                  <Input label="Mức tăng tối đa (Không bắt buộc)" type="number" placeholder="Không giới hạn" value={editFormData.maxIncrease} onChange={e => setEditFormData({...editFormData, maxIncrease: e.target.value ? parseFloat(e.target.value) : ''})} />
                  <Input label="Giá mua đứt AB (VND)" type="number" value={editFormData.autoBuyPrice} onChange={e => setEditFormData({...editFormData, autoBuyPrice: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Quy định hiển thị</h3>
                <Input label="Luật Thanh Toán" value={editFormData.rulePayment} onChange={e => setEditFormData({...editFormData, rulePayment: e.target.value})} />
                <Input label="Luật Hủy Lượt / Trảm" value={editFormData.ruleDisqualify} onChange={e => setEditFormData({...editFormData, ruleDisqualify: e.target.value})} />
                <Input label="Quyền Sử Dụng" value={editFormData.ruleUsage} onChange={e => setEditFormData({...editFormData, ruleUsage: e.target.value})} />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setEditingCommission(null)} className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Hủy</button>
                <button type="submit" className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function CommissionTable({ data, handleAction, pending, handleEditClick }) {
  return (
    <table className="w-full text-left min-w-[700px]">
      <thead className="bg-[#FBFBFE] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        <tr>
          <th className="px-4 sm:px-8 py-4 sm:py-5">Tên Commission</th>
          <th className="px-4 sm:px-8 py-4 sm:py-5">Người thắng</th>
          <th className="px-4 sm:px-8 py-4 sm:py-5">Trạng thái</th>
          <th className="px-4 sm:px-8 py-4 sm:py-5 text-right">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {data.map(c => {
          const isPending = pending.includes(c.id);
          const isOverdue = c.status === 'closed' && !c.is_paid && c.end_time
            && (new Date() - new Date(c.end_time)) > 86400000;
          return (
            <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${isPending ? 'bg-purple-50/50' : ''}`}>
              <td className="px-4 sm:px-8 py-4 sm:py-6">
                <div className="font-bold text-gray-900 text-base sm:text-lg">{c.title}</div>
                <div className="text-indigo-600 font-black text-lg sm:text-xl tracking-tighter">{parseFloat(c.current_price).toLocaleString('vi-VN')} đ</div>
              </td>
              <td className="px-4 sm:px-8 py-4 sm:py-6">
                {c.winner_name ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">{c.winner_name[0]}</div>
                    <div>
                      <div className="font-bold text-sm">{c.winner_name}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{c.winner_contact}</div>
                    </div>
                  </div>
                ) : <span className="text-gray-300 italic text-xs">Chưa có bid</span>}
              </td>
              <td className="px-4 sm:px-8 py-4 sm:py-6">
                <StatusPill status={c.is_paid ? 'Paid' : isPending ? 'Pending' : c.status} />
              </td>
              <td className="px-4 sm:px-8 py-4 sm:py-6 text-right">
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {(c.status === 'upcoming' || c.status === 'active') && handleEditClick && (
                    <ActionButton label="Sửa luật" color="orange" onClick={() => handleEditClick(c)} />
                  )}
                  {c.status === 'upcoming' && <ActionButton label="Mở Bid" color="green" onClick={() => handleAction(`/api/commissions/${c.id}/status`, 'PUT', {status: 'active'})} />}
                  {c.status === 'active' && <ActionButton label="Chốt đơn" color="black" onClick={() => handleAction(`/api/commissions/${c.id}/status`, 'PUT', {status: 'closed'})} />}
                  {c.status === 'closed' && !c.is_paid && (
                    <>
                      <ActionButton label="Xác nhận tiền" color="blue" onClick={() => handleAction(`/api/commissions/${c.id}/confirm-payment`)} />
                      <ActionButton label="Huỷ lượt" color="red" isOverdue={isOverdue} onClick={() => {if(confirm("Bạn có chắc chắn muốn hủy lượt đấu giá của người này không?")) handleAction(`/api/commissions/${c.id}/disqualify`);}} />
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
      {icon} <span>{label}</span>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center gap-4 sm:gap-6">
      <div className="p-4 sm:p-5 bg-gray-50 rounded-xl sm:rounded-2xl">{icon}</div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl sm:text-3xl font-black tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    active: 'bg-blue-50 text-blue-600',
    closed: 'bg-red-50 text-red-600',
    Paid: 'bg-green-50 text-green-600',
    Pending: 'bg-purple-50 text-purple-600 animate-pulse',
    upcoming: 'bg-gray-50 text-gray-500'
  };
  return <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${styles[status] || styles.upcoming}`}>{status}</span>;
}

function ActionButton({ label, color, onClick, isOverdue }) {
  const colors = {
    green: 'bg-green-500 hover:bg-green-600',
    black: 'bg-gray-900 hover:bg-black',
    blue: 'bg-blue-600 hover:bg-blue-700',
    red: isOverdue ? 'bg-red-600 animate-pulse' : 'bg-red-400 hover:bg-red-500',
    orange: 'bg-orange-500 hover:bg-orange-600'
  };
  return <button onClick={onClick} className={`${colors[color] || 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all active:scale-95 uppercase tracking-wider`}>{label}</button>;
}

function Input({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">{label}</label>
      <input {...props} className="w-full bg-[#FBFBFE] border border-gray-100 p-4 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold text-sm transition-all" />
    </div>
  );
}