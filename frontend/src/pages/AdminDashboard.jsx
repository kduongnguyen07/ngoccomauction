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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [settingsData, setSettingsData] = useState({
    momoPhone: '',
    rulePayment: '',
    ruleDisqualify: '',
    ruleUsage: ''
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [inspectingCommissionId, setInspectingCommissionId] = useState(null);
  const [inspectingCommissionTitle, setInspectingCommissionTitle] = useState('');
  const [inspectingBids, setInspectingBids] = useState([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
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
    const currentToken = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${currentToken}`, 'Content-Type': 'application/json' };
    try {
      const [resCom, resLogs, resBidders, resSettings] = await Promise.all([
        fetch(`${API_URL}/api/commissions`, { headers }),
        fetch(`${API_URL}/api/admin/logs`, { headers }),
        fetch(`${API_URL}/api/admin/bidders`, { headers }),
        fetch(`${API_URL}/api/admin/settings`, { headers })
      ]);
      if (resCom.status === 401 || resCom.status === 403) navigate('/admin/login');
      setCommissions(await resCom.json());
      setLogs(await resLogs.json());
      setBidders(await resBidders.json());
      if (resSettings.ok) {
        const settingsJson = await resSettings.json();
        setSettingsData({
          momoPhone: settingsJson.momo_phone || '',
          rulePayment: settingsJson.rule_payment || '',
          ruleDisqualify: settingsJson.rule_disqualify || '',
          ruleUsage: settingsJson.rule_usage || ''
        });
        
        setFormData(prev => ({
          ...prev,
          rulePayment: prev.rulePayment === 'Trong vòng 24h kể từ khi phiên đấu kết thúc' ? (settingsJson.rule_payment || prev.rulePayment) : prev.rulePayment,
          ruleDisqualify: prev.ruleDisqualify === 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc' ? (settingsJson.rule_disqualify || prev.ruleDisqualify) : prev.ruleDisqualify,
          ruleUsage: prev.ruleUsage === 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)' ? (settingsJson.rule_usage || prev.ruleUsage) : prev.ruleUsage
        }));
      }
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

  const handleInspectBids = async (id, title) => {
    setInspectingCommissionId(id);
    setInspectingCommissionTitle(title);
    setInspectingBids([]);
    setIsLoadingBids(true);
    
    const currentToken = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${currentToken}`, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(`${API_URL}/api/admin/commissions/${id}/bids`, { headers });
      if (res.ok) {
        setInspectingBids(await res.json());
      } else {
        toast.error("Không thể lấy lịch sử đấu giá.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi mạng!");
    } finally {
      setIsLoadingBids(false);
    }
  };

  const filteredCommissions = commissions.filter(c => {
    if (statusFilter === 'active' && c.status !== 'active') return false;
    if (statusFilter === 'upcoming' && c.status !== 'upcoming') return false;
    if (statusFilter === 'pending' && !(c.status === 'closed' && !c.is_paid)) return false;
    if (statusFilter === 'paid' && !c.is_paid) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = c.title?.toLowerCase().includes(q);
      const phaseMatch = c.phase?.toLowerCase().includes(q);
      const winnerMatch = c.winner_name?.toLowerCase().includes(q);
      return titleMatch || phaseMatch || winnerMatch;
    }
    return true;
  });

  const renderSettings = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 animate-in fade-in duration-500">
      <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <Settings size={22} className="text-indigo-600"/> Cấu hình hệ thống
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm mb-6">Các quy định mặc định khi tạo mới đợt đấu giá và SĐT nhận tiền.</p>
        
        <form onSubmit={async (e) => {
          e.preventDefault();
          await handleAction('/api/admin/settings', 'PUT', {
            momo_phone: settingsData.momoPhone,
            rule_payment: settingsData.rulePayment,
            rule_disqualify: settingsData.ruleDisqualify,
            rule_usage: settingsData.ruleUsage
          });
        }} className="space-y-4">
          <Input 
            label="Số điện thoại MoMo / Tài khoản ngân hàng" 
            placeholder="VD: 0961234567" 
            value={settingsData.momoPhone} 
            onChange={e => setSettingsData({...settingsData, momoPhone: e.target.value})} 
          />
          <Input 
            label="Luật thanh toán mặc định" 
            placeholder="VD: Trong vòng 24h kể từ khi phiên đấu kết thúc" 
            value={settingsData.rulePayment} 
            onChange={e => setSettingsData({...settingsData, rulePayment: e.target.value})} 
          />
          <Input 
            label="Luật hủy lượt mặc định" 
            placeholder="VD: Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc" 
            value={settingsData.ruleDisqualify} 
            onChange={e => setSettingsData({...settingsData, ruleDisqualify: e.target.value})} 
          />
          <Input 
            label="Quyền sử dụng mặc định" 
            placeholder="VD: Mục đích cá nhân (Thương mại sẽ tính phí riêng)" 
            value={settingsData.ruleUsage} 
            onChange={e => setSettingsData({...settingsData, ruleUsage: e.target.value})} 
          />
          <button className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all mt-2">
            Lưu cấu hình
          </button>
        </form>
      </div>

      <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 h-fit">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <LogOut size={22} className="rotate-180 text-red-500"/> Đổi mật khẩu Admin
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm mb-6">Thay đổi mật khẩu đăng nhập vào bảng quản trị.</p>
        
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error("Xác nhận mật khẩu mới không khớp!");
            return;
          }
          await handleAction('/api/admin/settings/password', 'PUT', {
            oldPassword: passwordData.oldPassword,
            newPassword: passwordData.newPassword
          });
          setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        }} className="space-y-4">
          <Input 
            label="Mật khẩu hiện tại" 
            type="password" 
            placeholder="••••••••" 
            value={passwordData.oldPassword} 
            onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} 
          />
          <Input 
            label="Mật khẩu mới (Tối thiểu 6 ký tự)" 
            type="password" 
            placeholder="••••••••" 
            value={passwordData.newPassword} 
            onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} 
          />
          <Input 
            label="Xác nhận mật khẩu mới" 
            type="password" 
            placeholder="••••••••" 
            value={passwordData.confirmPassword} 
            onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} 
          />
          <button className="w-full bg-red-500 text-white py-3 sm:py-4 rounded-2xl font-bold shadow-lg hover:bg-red-650 hover:bg-red-650 transition-all mt-2">
            Đổi mật khẩu
          </button>
        </form>
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
              <input 
                type="text" 
                placeholder="Tìm kiếm thông tin..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none shadow-sm" 
              />
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
            {currentView === 'settings' && "Cấu hình hệ thống"}
          </h1>
          <p className="text-gray-400 font-medium uppercase text-[10px] tracking-[0.2em]">Hệ thống đấu giá Commission v2.0</p>
        </div>

        {/* SWITCH VIEWS */}
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'commissions' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-wrap gap-2 items-center bg-gray-100/50 p-1.5 rounded-2xl w-fit">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'active', label: 'Đang hoạt động' },
                { key: 'upcoming', label: 'Sắp diễn ra' },
                { key: 'pending', label: 'Chờ thanh toán' },
                { key: 'paid', label: 'Đã thanh toán' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === tab.key
                      ? 'bg-white text-indigo-600 shadow-sm shadow-indigo-100/20'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <CommissionTable 
                  data={filteredCommissions} 
                  handleAction={handleAction} 
                  pending={pending} 
                  handleEditClick={handleEditClick} 
                  handleInspectBids={handleInspectBids}
                />
              </div>
            </div>
          </div>
        )}
        {currentView === 'logs' && renderLogs()}
        {currentView === 'settings' && renderSettings()}
      </main>

      {/* BIDS INSPECTOR MODAL */}
      {inspectingCommissionId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Lịch sử đấu giá chi tiết</h2>
                <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wider">{inspectingCommissionTitle}</p>
              </div>
              <button 
                onClick={() => setInspectingCommissionId(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            
            {isLoadingBids ? (
              <div className="py-20 text-center text-gray-400 font-bold animate-pulse">Đang tải lịch sử...</div>
            ) : inspectingBids.length === 0 ? (
              <div className="py-20 text-center text-gray-400 italic">Chưa có lượt đặt giá nào cho commission này.</div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {inspectingBids.map((bid, index) => {
                  const isTopBid = index === 0;
                  return (
                    <div 
                      key={bid.id} 
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isTopBid 
                          ? 'bg-indigo-50/50 border-indigo-200 shadow-sm shadow-indigo-100/50' 
                          : 'bg-gray-50/50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isTopBid ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'
                        }`}>
                          #{inspectingBids.length - index}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            {bid.full_name}
                            {isTopBid && (
                              <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                Top 1
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                            {bid.contact_info.startsWith('http') ? (
                              <a href={bid.contact_info} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                {bid.contact_info}
                              </a>
                            ) : bid.contact_info}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black tracking-tight ${isTopBid ? 'text-indigo-600 text-base sm:text-lg' : 'text-slate-800 text-sm sm:text-base'}`}>
                          {parseFloat(bid.bid_amount).toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium mt-0.5">
                          {new Date(bid.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex justify-end pt-6 mt-6 border-t border-gray-100">
              <button 
                onClick={() => setInspectingCommissionId(null)} 
                className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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

function CommissionTable({ data, handleAction, pending, handleEditClick, handleInspectBids }) {
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
                  <ActionButton label="Lịch sử" onClick={() => handleInspectBids && handleInspectBids(c.id, c.title)} />
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
                  <ActionButton 
                    label="Xóa" 
                    color="red" 
                    disabled={c.status === 'active'}
                    onClick={() => {
                      if (confirm(`Bạn có chắc chắn muốn xóa "${c.title}" vĩnh viễn? Tất cả lịch sử đấu giá liên quan sẽ bị xóa sạch.`)) {
                        handleAction(`/api/commissions/${c.id}`, 'DELETE');
                      }
                    }} 
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Left unchanged to keep line count consistent

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

function ActionButton({ label, color, onClick, isOverdue, disabled }) {
  const colors = {
    green: 'bg-green-500 hover:bg-green-600',
    black: 'bg-gray-900 hover:bg-black',
    blue: 'bg-blue-600 hover:bg-blue-700',
    red: isOverdue ? 'bg-red-600 animate-pulse' : 'bg-red-400 hover:bg-red-500',
    orange: 'bg-orange-500 hover:bg-orange-600'
  };
  
  const buttonClass = disabled 
    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
    : `${colors[color] || 'bg-indigo-600 hover:bg-indigo-700'} text-white active:scale-95`;
    
  return (
    <button 
      onClick={disabled ? null : onClick} 
      disabled={disabled}
      className={`${buttonClass} px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all uppercase tracking-wider`}
    >
      {label}
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">{label}</label>
      <input {...props} className="w-full bg-[#FBFBFE] border border-gray-100 p-4 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold text-sm transition-all" />
    </div>
  );
}