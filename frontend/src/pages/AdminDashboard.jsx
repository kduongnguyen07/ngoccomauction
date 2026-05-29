import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, Gavel, History, Settings, LogOut, 
  Plus, Search, Bell, CheckCircle2, XCircle, Clock, ShieldAlert 
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
  
  const [commissions, setCommissions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pending, setPending] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ title: '', phase: '', startPrice: 0, startTime: '', endTime: '' });

  const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    // [FIX] Đọc token trong lúc fetch, không capture từ closure — tránh stale token
    const currentToken = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${currentToken}`, 'Content-Type': 'application/json' };
    try {
      const [resCom, resLogs] = await Promise.all([
        fetch(`${API_URL}/api/commissions`, { headers }),
        fetch(`${API_URL}/api/admin/logs`, { headers })
      ]);
      if (resCom.status === 401 || resCom.status === 403) navigate('/admin/login');
      setCommissions(await resCom.json());
      setLogs(await resLogs.json());
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
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Clock className="text-blue-500"/>} label="Đang đấu giá" value={commissions.filter(c => c.status === 'active').length} />
        <StatCard icon={<CheckCircle2 className="text-green-500"/>} label="Đã hoàn thành" value={commissions.filter(c => c.is_paid).length} />
        <StatCard icon={<ShieldAlert className="text-red-500"/>} label="Chờ thanh toán" value={commissions.filter(c => c.status === 'closed' && !c.is_paid).length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold">Đợt đấu giá gần đây</h2>
            <button onClick={() => setCurrentView('commissions')} className="text-indigo-600 font-bold text-sm hover:underline">Xem tất cả</button>
          </div>
          <CommissionTable data={commissions.slice(0, 5)} handleAction={handleAction} pending={pending} />
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Plus size={20} className="text-indigo-600"/> Tạo đợt mới</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleAction('/api/commissions', 'POST', formData); }} className="space-y-4">
            <Input label="Tên Commission" placeholder="VD: Vẽ Chibi" onChange={e => setFormData({...formData, title: e.target.value})} />
            <Input label="Giai đoạn" placeholder="VD: Batch #1" onChange={e => setFormData({...formData, phase: e.target.value})} />
            <Input label="Giá khởi điểm ($)" type="number" onChange={e => setFormData({...formData, startPrice: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Bắt đầu" type="datetime-local" onChange={e => setFormData({...formData, startTime: e.target.value})} />
              <Input label="Kết thúc" type="datetime-local" onChange={e => setFormData({...formData, endTime: e.target.value})} />
            </div>
            <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all mt-2">Kích hoạt ngay</button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 border-b border-gray-50">
        <h2 className="text-2xl font-bold">Nhật ký hệ thống</h2>
        <p className="text-gray-400 text-sm">Theo dõi mọi hành động trảm người và xác nhận tiền.</p>
      </div>
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${log.action.includes('DISQUALIFY') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                <History size={20}/>
              </div>
              <div>
                <p className="font-bold text-gray-900 uppercase text-xs tracking-widest">{log.action}</p>
                <p className="text-gray-500 text-sm">{JSON.stringify(log.details)}</p>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] font-sans text-[#2D3748]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Gavel size={22}/>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Admin<span className="text-indigo-600">Pro</span></span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<Gavel size={20}/>} label="Commissions" active={currentView === 'commissions'} onClick={() => setCurrentView('commissions')} />
          <NavItem icon={<History size={20}/>} label="Audit Logs" active={currentView === 'logs'} onClick={() => setCurrentView('logs')} />
        </nav>

        <div className="pt-6 border-t border-gray-50 space-y-2">
          <NavItem icon={<Settings size={20}/>} label="Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
          <button onClick={() => {localStorage.removeItem('adminToken'); navigate('/admin/login');}} className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-sm">
            <LogOut size={20}/> <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Tìm kiếm thông tin..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none shadow-sm" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center font-bold text-indigo-600">A</div>
          </div>
        </header>

        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-2">
            {currentView === 'dashboard' && (() => {
              const h = new Date().getHours();
              if (h < 12) return 'Chào buổi sáng, Admin!';
              if (h < 18) return 'Chào buổi chiều, Admin!';
              return 'Chào buổi tối, Admin!';
            })()}
            {currentView === 'commissions' && "Quản lý Commissions"}
            {currentView === 'logs' && "Nhật ký hệ thống"}
          </h1>
          <p className="text-gray-400 font-medium uppercase text-[10px] tracking-[0.2em]">Hệ thống đấu giá Commission v2.0</p>
        </div>

        {/* SWITCH VIEWS */}
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'commissions' && <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden"><CommissionTable data={commissions} handleAction={handleAction} pending={pending} /></div>}
        {currentView === 'logs' && renderLogs()}
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function CommissionTable({ data, handleAction, pending }) {
  return (
    <table className="w-full text-left">
      <thead className="bg-[#FBFBFE] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        <tr>
          <th className="px-8 py-5">Tên Commission</th>
          <th className="px-8 py-5">Người thắng</th>
          <th className="px-8 py-5">Trạng thái</th>
          <th className="px-8 py-5 text-right">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {data.map(c => {
          const isPending = pending.includes(c.id);
          // [FIX #4] Dùng end_time thay vì updated_at — updated_at thay đổi mỗi lần UPDATE bất kỳ
          // isOverdue chỉ có nghĩa khi status = 'closed' và người thắng chưa thanh toán
          const isOverdue = c.status === 'closed' && !c.is_paid && c.end_time
            && (new Date() - new Date(c.end_time)) > 86400000;
          return (
            <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${isPending ? 'bg-purple-50/50' : ''}`}>
              <td className="px-8 py-6">
                <div className="font-bold text-gray-900 text-lg">{c.title}</div>
                <div className="text-indigo-600 font-black text-xl tracking-tighter">${c.current_price}</div>
              </td>
              <td className="px-8 py-6">
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
              <td className="px-8 py-6">
                <StatusPill status={c.is_paid ? 'Paid' : isPending ? 'Pending' : c.status} />
              </td>
              <td className="px-8 py-6 text-right space-x-2">
                {c.status === 'upcoming' && <ActionButton label="Mở Bid" color="green" onClick={() => handleAction(`/api/commissions/${c.id}/status`, 'PUT', {status: 'active'})} />}
                {c.status === 'active' && <ActionButton label="Chốt đơn" color="black" onClick={() => handleAction(`/api/commissions/${c.id}/status`, 'PUT', {status: 'closed'})} />}
                {c.status === 'closed' && !c.is_paid && (
                  <>
                    <ActionButton label="Xác nhận tiền" color="blue" onClick={() => handleAction(`/api/commissions/${c.id}/confirm-payment`)} />
                    <ActionButton label="Trảm" color="red" isOverdue={isOverdue} onClick={() => {if(confirm("Trảm thằng này?")) handleAction(`/api/commissions/${c.id}/disqualify`);}} />
                  </>
                )}
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
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center gap-6">
      <div className="p-5 bg-gray-50 rounded-2xl">{icon}</div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black tracking-tighter">{value}</p>
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
    red: isOverdue ? 'bg-red-600 animate-pulse' : 'bg-red-400 hover:bg-red-500'
  };
  return <button onClick={onClick} className={`${colors[color]} text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all active:scale-95 uppercase tracking-wider`}>{label}</button>;
}

function Input({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">{label}</label>
      <input {...props} className="w-full bg-[#FBFBFE] border border-gray-100 p-4 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold text-sm transition-all" />
    </div>
  );
}