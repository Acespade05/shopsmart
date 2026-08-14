import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  function load() {
    setLoading(true);
    api
      .get('/admin/inventory')
      .then((res) => setInventory(res.data.inventory))
      .catch((err) => console.error('Failed to load inventory:', err))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveStock(id) {
    try {
      await api.put(`/admin/inventory/${id}`, { stock: parseInt(editValue, 10), reason: 'adjustment' });
      setEditingId(null);
      load();
    } catch (err) {
      console.error('Failed to update stock:', err);
    }
  }

  if (loading) return <p className="text-ink/40 text-sm">Loading...</p>;

  return (
    <div className="border border-line rounded-sm divide-y divide-line">
      {inventory.map((item) => (
        <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm gap-4">
          <span className="flex-1">{item.name}</span>
          {item.low_stock && (
            <span className="text-xs bg-coral/10 text-coral px-2 py-0.5 rounded-sm">Low stock</span>
          )}
          {editingId === item.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="input-field w-20 text-sm"
                autoFocus
              />
              <button onClick={() => saveStock(item.id)} className="text-emerald text-xs">
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="text-ink/40 text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingId(item.id);
                setEditValue(item.stock);
              }}
              className="font-mono text-sm hover:text-emerald w-16 text-right"
            >
              {item.stock}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}