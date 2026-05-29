import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const API_URL = (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')) 
        ? rawApiUrl 
        : `https://${rawApiUrl}`;
      const r = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const ans = await r.json();

      if (r.ok && ans.token) {
        localStorage.setItem('adminToken', ans.token);
        navigate('/admin'); // Chuyển cảnh
      } else {
        alert(ans.error || "Sai mật khẩu rồi mày ơi!");
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err);
      alert("Không kết nối được tới Server (Port 5000)!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 font-sans">
      <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm space-y-6 border-4 border-indigo-500">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tighter text-gray-900">ADMIN LOGIN</h1>
          <p className="text-gray-400 text-xs font-bold mt-2 uppercase">Nhập mật khẩu để truy cập quyền lực</p>
        </div>
        <input 
          type="password" 
          placeholder="Nhập mật khẩu admin" 
          className="w-full border-2 p-4 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" 
          onChange={e => setPassword(e.target.value)} 
          required
        />
        <button 
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          {loading ? 'ĐANG KIỂM TRA...' : 'XÁC NHẬN TRUY CẬP'}
        </button>
      </form>
    </div>
  );
}