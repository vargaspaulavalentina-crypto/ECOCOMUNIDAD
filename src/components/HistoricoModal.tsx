import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Database,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';

interface HistoricoItem {
  id: number;
  uuid: string;
  material_nombre: string;
  categoria: string;
  peso_kg: number;
  puntos_otorgados: number;
  co2_ahorrado_kg: number;
  estado: string;
  distancia_metros: number;
  fecha_entrega: string;
  cadena_custodia_paso: 'depositado' | 'recolectado' | 'en_acopio' | 'transformado';
  recibo_digital_hash: string;
  qr_hash: string;
  punto_nombre: string;
  punto_direccion: string;
  usuario_nombre: string;
}

interface HistoricoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReceipt?: (item: any) => void;
}

export const HistoricoModal: React.FC<HistoricoModalProps> = ({
  isOpen,
  onClose,
  onSelectReceipt,
}) => {
  const [entregas, setEntregas] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedCustodia, setSelectedCustodia] = useState<string>('todos');
  const [activeItem, setActiveItem] = useState<HistoricoItem | null>(null);
  const [isUpdatingCustodia, setIsUpdatingCustodia] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      checkDbStatus();
    }
  }, [isOpen, selectedCategory, selectedCustodia]);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn('DB status check:', e);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory !== 'todas') params.append('categoria', selectedCategory);
      if (selectedCustodia !== 'todos') params.append('custodia', selectedCustodia);

      const res = await fetch(`/api/entregas/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntregas(data.entregas || []);
        if (data.entregas && data.entregas.length > 0 && !activeItem) {
          setActiveItem(data.entregas[0]);
        }
      }
    } catch (err) {
      console.error('Error cargando histórico desde MySQL:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustodia = async (entregaId: number, nuevoPaso: string) => {
    setIsUpdatingCustodia(true);
    try {
      const res = await fetch(`/api/entregas/${entregaId}/custodia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevo_paso: nuevoPaso }),
      });
      if (res.ok) {
        const result = await res.json();
        // Actualizar estado local
        setEntregas((prev) =>
          prev.map((item) =>
            item.id === entregaId
              ? { ...item, cadena_custodia_paso: nuevoPaso as any }
              : item
          )
        );
        if (activeItem && activeItem.id === entregaId) {
          setActiveItem({ ...activeItem, cadena_custodia_paso: nuevoPaso as any });
        }
      }
    } catch (err) {
      console.error('Error actualizando custodia:', err);
    } finally {
      setIsUpdatingCustodia(false);
    }
  };

  if (!isOpen) return null;

  const categorias = [
    'todas',
    'Plástico PET',
    'Cartón y Papel',
    'Vidrio',
    'Aluminio / Latas',
    'Tetra Pak',
  ];

  const pasosCustodia = ['todos', 'depositado', 'recolectado', 'en_acopio', 'transformado'];

  const getCustodiaBadge = (paso: string) => {
    switch (paso) {
      case 'depositado':
        return { label: '1. Depositado', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'recolectado':
        return { label: '2. En Ruta', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'en_acopio':
        return { label: '3. En Acopio', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'transformado':
        return { label: '4. Transformado ESG', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      default:
        return { label: paso, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#ffffff] w-full max-w-5xl rounded-3xl shadow-2xl border border-[#bebeb9]/40 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f0f0eb] flex items-center justify-between bg-[#f8f8f6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#d7eb80] flex items-center justify-center text-[#333333]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#333333]">
                  Histórico de Entregas & Trazabilidad MySQL
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Database className="w-2.5 h-2.5" />
                  XAMPP MySQL Sincronizado
                </span>
              </div>
              <p className="text-xs text-[#6c6c6c]">
                Consulta transaccional en tiempo real con actualización de cadena de custodia y recibos digitales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="p-2 rounded-xl border border-[#bebeb9]/40 text-[#6c6c6c] hover:text-[#333333] hover:bg-[#ffffff] transition-colors"
              title="Refrescar desde base de datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#6c6c6c] hover:text-[#333333] hover:bg-[#ffffff] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Status Strip */}
        {dbStatus && (
          <div className="bg-[#f0f0eb]/60 px-6 py-2 border-b border-[#f0f0eb] flex flex-wrap items-center justify-between text-[11px] text-[#6c6c6c]">
            <div className="flex items-center gap-4">
              <span><strong>Base de Datos:</strong> {dbStatus.base_datos}</span>
              <span><strong>Motor:</strong> {dbStatus.motor}</span>
              <span><strong>Total Entregas en BD:</strong> {dbStatus.conteos?.entregas || 0}</span>
            </div>
            <div className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Estado: Activo y respondiendo
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-6 border-b border-[#f0f0eb] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6c6c6c]" />
            <input
              type="text"
              placeholder="Buscar por material, código hash o UUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#bebeb9]/40 bg-[#f8f8f6] focus:bg-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#d7eb80]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Filter by Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-[#bebeb9]/40 bg-[#f8f8f6] font-medium text-[#333333] focus:outline-none"
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  Categoría: {c}
                </option>
              ))}
            </select>

            {/* Filter by Custody */}
            <select
              value={selectedCustodia}
              onChange={(e) => setSelectedCustodia(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-[#bebeb9]/40 bg-[#f8f8f6] font-medium text-[#333333] focus:outline-none"
            >
              {pasosCustodia.map((p) => (
                <option key={p} value={p}>
                  Custodia: {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content: Master / Detail split view */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Deliveries List (Col 5) */}
          <div className="md:col-span-5 border-r border-[#f0f0eb] overflow-y-auto p-3 space-y-2.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#6c6c6c]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#333333]" />
                Consultando registros en MySQL...
              </div>
            ) : entregas.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6c6c6c]">
                No se encontraron entregas registradas con los filtros aplicados.
              </div>
            ) : (
              entregas.map((item) => {
                const isSelected = activeItem?.id === item.id;
                const badge = getCustodiaBadge(item.cadena_custodia_paso);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveItem(item)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-[#333333] bg-[#f8f8f6] shadow-sm'
                        : 'border-[#f0f0eb] hover:border-[#bebeb9] bg-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#333333] line-clamp-1">
                        {item.material_nombre}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color} shrink-0`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6c6c6c]">
                      <span>{item.peso_kg} kg · {item.puntos_otorgados} Ecocoins</span>
                      <span>{item.fecha_entrega.split('T')[0]}</span>
                    </div>

                    <div className="mt-2 text-[10px] font-mono text-[#6c6c6c] truncate bg-[#f0f0eb]/50 px-2 py-0.5 rounded">
                      Hash: {item.recibo_digital_hash}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Delivery Detail & Interactive Custody Updater (Col 7) */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-6 bg-[#fafafa]">
            {activeItem ? (
              <div className="space-y-6">
                {/* Main Card */}
                <div className="bg-[#ffffff] rounded-2xl p-5 border border-[#f0f0eb] shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6c6c6c]">
                        {activeItem.categoria}
                      </span>
                      <h3 className="text-base font-bold text-[#333333]">
                        {activeItem.material_nombre}
                      </h3>
                      <p className="text-xs text-[#6c6c6c] mt-0.5">
                        Punto de Acopio: <strong>{activeItem.punto_nombre}</strong> ({activeItem.punto_direccion})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#333333]">
                        +{activeItem.puntos_otorgados}
                      </div>
                      <span className="text-[10px] font-semibold text-[#6c6c6c]">Ecocoins</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#f8f8f6] border border-[#f0f0eb] text-center text-xs">
                    <div>
                      <div className="text-[#6c6c6c] text-[10px]">Peso Registrado</div>
                      <div className="font-bold text-[#333333] mt-0.5">{activeItem.peso_kg} kg</div>
                    </div>
                    <div>
                      <div className="text-[#6c6c6c] text-[10px]">CO2 Mitigado</div>
                      <div className="font-bold text-emerald-700 mt-0.5">{activeItem.co2_ahorrado_kg} kg</div>
                    </div>
                    <div>
                      <div className="text-[#6c6c6c] text-[10px]">Distancia Geofence</div>
                      <div className="font-bold text-[#333333] mt-0.5">{activeItem.distancia_metros} m</div>
                    </div>
                  </div>

                  {/* Cryptographic Verification Hash */}
                  <div className="mt-4 pt-4 border-t border-[#f0f0eb]">
                    <div className="text-[10px] font-semibold text-[#6c6c6c] uppercase mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Hash Criptográfico de Trazabilidad (MySQL Inmutable)
                    </div>
                    <div className="font-mono text-xs text-[#333333] bg-[#f0f0eb] p-2 rounded-lg break-all select-all">
                      {activeItem.recibo_digital_hash}
                    </div>
                    <div className="text-[10px] text-[#6c6c6c] mt-1">
                      UUID de Entrega: <span className="font-mono">{activeItem.uuid}</span> · Fecha: {activeItem.fecha_entrega}
                    </div>
                  </div>
                </div>

                {/* Interactive Chain of Custody Updater */}
                <div className="bg-[#ffffff] rounded-2xl p-5 border border-[#f0f0eb] shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-[#333333] uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-[#333333]" />
                      Interactuar con Cadena de Custodia (En Vivo en MySQL)
                    </h4>
                    {isUpdatingCustodia && (
                      <span className="text-[10px] text-amber-600 font-semibold animate-pulse">
                        Actualizando base de datos...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6c6c6c] mb-4">
                    Selecciona un paso para actualizar el ciclo de vida del residuo directamente en la tabla <code className="bg-[#f0f0eb] px-1 py-0.5 rounded text-[10px]">entregas</code> de MySQL:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'depositado', label: '1. Depositado', desc: 'En contenedor' },
                      { id: 'recolectado', label: '2. Recolectado', desc: 'Ruta de operario' },
                      { id: 'en_acopio', label: '3. En Acopio', desc: 'Centro de pesaje' },
                      { id: 'transformado', label: '4. Transformado', desc: 'Reciclaje final' },
                    ].map((step) => {
                      const isCurrent = activeItem.cadena_custodia_paso === step.id;
                      return (
                        <button
                          key={step.id}
                          disabled={isUpdatingCustodia || isCurrent}
                          onClick={() => handleUpdateCustodia(activeItem.id, step.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isCurrent
                              ? 'border-[#333333] bg-[#d7eb80]/20 text-[#333333] font-bold shadow-sm'
                              : 'border-[#f0f0eb] hover:border-[#333333] bg-[#ffffff] text-[#6c6c6c]'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            {step.label}
                            {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-[#333333]" />}
                          </div>
                          <div className="text-[10px] text-[#6c6c6c] mt-0.5">{step.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Open Digital Receipt Button */}
                {onSelectReceipt && (
                  <button
                    onClick={() => {
                      onSelectReceipt(activeItem);
                      onClose();
                    }}
                    className="w-full py-3 rounded-xl bg-[#333333] hover:bg-[#1a1a1a] text-[#ffffff] font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span>Abrir Recibo Digital de Entrega</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#6c6c6c]">
                Selecciona una entrega de la lista para ver su trazabilidad completa.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#f0f0eb] bg-[#f8f8f6] flex items-center justify-between text-xs text-[#6c6c6c]">
          <span>Conectado a XAMPP MySQL · Puerto 3306 · Python Flask Backend</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[#bebeb9]/40 bg-[#ffffff] hover:bg-[#f0f0eb] text-[#333333] font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

