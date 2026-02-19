import React, { useEffect, useState, useCallback } from 'react';
import { getModels, addModel, updateModel, deleteModel } from '../../adminApi';
import { Plus, Trash2, Edit2, X, Check, RefreshCw } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  model_multiplier: number;
  output_multiplier: number;
  cache_read_multiplier: number;
  cache_creation_multiplier: number;
  enabled: number;
  created_at: string;
}

const EMPTY_FORM = {
  id: '', name: '', model_multiplier: 1.0, output_multiplier: 5.0,
  cache_read_multiplier: 0.1, cache_creation_multiplier: 2.0,
};

export default function AdminModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try { setModels(await getModels()); } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.id || !form.name) { setError('请填写模型 ID 和名称'); return; }
    setLoading(true);
    try {
      if (editId !== null) {
        await updateModel(editId, { name: form.name, model_multiplier: form.model_multiplier, output_multiplier: form.output_multiplier, cache_read_multiplier: form.cache_read_multiplier, cache_creation_multiplier: form.cache_creation_multiplier });
      } else {
        await addModel(form);
      }
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM);
      await load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模型配置？')) return;
    try { await deleteModel(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const handleToggle = async (m: Model) => {
    try { await updateModel(m.id, { enabled: m.enabled ? 0 : 1 }); await load(); } catch (e: any) { setError(e.message); }
  };

  const startEdit = (m: Model) => {
    setEditId(m.id); setShowForm(true);
    setForm({ id: m.id, name: m.name, model_multiplier: m.model_multiplier, output_multiplier: m.output_multiplier, cache_read_multiplier: m.cache_read_multiplier, cache_creation_multiplier: m.cache_creation_multiplier });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">模型管理</h2>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={14} /> 刷新
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600">
            <Plus size={14} /> 添加模型
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error} <button onClick={() => setError('')} className="ml-2 underline">关闭</button></div>}

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{editId !== null ? '编辑模型' : '添加模型'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">模型 ID *</label>
              <input placeholder="claude-opus-4-6" value={form.id} disabled={editId !== null}
                onChange={e => setForm({...form, id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">显示名称 *</label>
              <input placeholder="Opus 4.6" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">模型倍率</label>
              <input type="number" step="0.1" value={form.model_multiplier} onChange={e => setForm({...form, model_multiplier: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">输出倍率</label>
              <input type="number" step="0.1" value={form.output_multiplier} onChange={e => setForm({...form, output_multiplier: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">缓存读取倍率</label>
              <input type="number" step="0.01" value={form.cache_read_multiplier} onChange={e => setForm({...form, cache_read_multiplier: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">缓存创建倍率</label>
              <input type="number" step="0.1" value={form.cache_creation_multiplier} onChange={e => setForm({...form, cache_creation_multiplier: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50">
              <Check size={14} /> {loading ? '保存中...' : '保存'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              <X size={14} /> 取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">模型 ID</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">名称</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">模型倍率</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">输出倍率</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">缓存读取</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">缓存创建</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">状态</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无模型配置</td></tr>
            )}
            {models.map(m => (
              <tr key={m.id} className={`border-b border-gray-100 ${!m.enabled ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.id}</td>
                <td className="px-4 py-3 text-gray-800">{m.name}</td>
                <td className="px-4 py-3 text-gray-600">{m.model_multiplier}</td>
                <td className="px-4 py-3 text-gray-600">{m.output_multiplier}</td>
                <td className="px-4 py-3 text-gray-600">{m.cache_read_multiplier}</td>
                <td className="px-4 py-3 text-gray-600">{m.cache_creation_multiplier}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${m.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => handleToggle(m)}>
                    {m.enabled ? '启用' : '禁用'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(m)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded" title="编辑"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="删除"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
