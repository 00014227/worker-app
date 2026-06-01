import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { RefreshCw, AlertCircle, ArrowRight, MapPin, Truck, Plane, Train, Layers, Package } from 'lucide-react';
import { workerApi, MapOrderRow } from '../lib/api';
import { cn } from '@/lib/utils';

// Leaflet Vite icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const TYPE_CONFIG: Record<string, { bg: string; border: string; Icon: React.FC<{ size: number; color: string }> }> = {
  'Авто':            { bg: '#fff7ed', border: '#ea580c', Icon: (p) => <Truck size={p.size} color={p.color} /> },
  'Авиа':            { bg: '#f0f9ff', border: '#0284c7', Icon: (p) => <Plane size={p.size} color={p.color} /> },
  'Железнодорожная': { bg: '#faf5ff', border: '#7c3aed', Icon: (p) => <Train size={p.size} color={p.color} /> },
  'Мультимодальная': { bg: '#f0fdfa', border: '#0d9488', Icon: (p) => <Layers size={p.size} color={p.color} /> },
};

function statusRing(status: string | null): string {
  if (!status) return '#9ca3af';
  const s = status.toLowerCase();
  if (s.includes('завершен') || s.includes('доставлен')) return '#16a34a';
  if (s.includes('таможн') || s.includes('границ')) return '#ea580c';
  if (s.includes('задержк') || s.includes('отмен')) return '#dc2626';
  return '#3b82f6';
}

function markerColor(status: string | null): string {
  return statusRing(status);
}

function buildDivIcon(transportationType: string | null, status: string | null) {
  const cfg = transportationType ? TYPE_CONFIG[transportationType] : null;
  const ring = statusRing(status);

  if (cfg) {
    const svg = renderToStaticMarkup(<cfg.Icon size={13} color={cfg.border} />);
    return L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${cfg.bg};border:2.5px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">${svg}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -18],
    });
  }

  // Fallback: plain circle
  const svg = renderToStaticMarkup(<Package size={13} color="#6b7280" />);
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#f9fafb;border:2.5px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">${svg}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

interface MapPannerProps {
  target: [number, number] | null;
}
function MapPanner({ target }: MapPannerProps) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 10, { duration: 1 });
  }, [target, map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MapOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workerApi.orders.map();
      setOrders(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const mapped = orders.filter((o) => o.lat !== null && o.lng !== null);
  const unmapped = orders.filter((o) => o.lat === null || o.lng === null);

  const handleSidebarClick = (o: MapOrderRow) => {
    setSelected(o.id);
    if (o.lat !== null && o.lng !== null) {
      setFlyTo([o.lat, o.lng]);
      setTimeout(() => {
        const marker = markerRefs.current[o.id];
        if (marker) marker.openPopup();
      }, 1200);
    }
  };

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r bg-background flex flex-col">
        <div className="px-3 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Карта перевозок</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Загрузка...' : `${mapped.length} на карте · ${unmapped.length} без координат`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="m-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 && !loading && (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <MapPin size={20} className="mx-auto mb-2 opacity-30" />
              Нет перевозок с текущим местоположением
            </div>
          )}

          {/* Mapped orders */}
          {mapped.map((o) => (
            <button
              key={o.id}
              onClick={() => handleSidebarClick(o)}
              className={cn(
                'w-full text-left px-3 py-2.5 border-b hover:bg-muted/40 transition-colors',
                selected === o.id && 'bg-muted/60',
              )}
            >
              <div className="flex items-center gap-1.5">
                {(() => {
                  const cfg = o.transportationType ? TYPE_CONFIG[o.transportationType] : null;
                  return cfg ? (
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: cfg.bg, border: `1.5px solid ${statusRing(o.status)}` }}
                    >
                      <cfg.Icon size={10} color={cfg.border} />
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-muted"
                      style={{ border: `1.5px solid ${statusRing(o.status)}` }}
                    >
                      <Package size={10} color="#6b7280" />
                    </div>
                  );
                })()}
                <span className="font-mono text-xs font-semibold">{o.number}</span>
                {o.status && (
                  <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[90px]">
                    {o.status}
                  </span>
                )}
              </div>
              {o.payer && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate pl-4">{o.payer.name}</p>
              )}
              {(o.departure || o.destination) && (
                <div className="flex items-center gap-1 mt-0.5 pl-4 text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[70px]">{o.departure ?? '—'}</span>
                  <ArrowRight size={8} className="flex-shrink-0" />
                  <span className="truncate max-w-[70px]">{o.destination ?? '—'}</span>
                </div>
              )}
              {o.currentLocation && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 pl-4 truncate italic">
                  {o.currentLocation}
                </p>
              )}
            </button>
          ))}

          {/* Unmapped orders */}
          {unmapped.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/30 uppercase tracking-wide">
                Без координат ({unmapped.length})
              </div>
              {unmapped.map((o) => (
                <div
                  key={o.id}
                  className="px-3 py-2 border-b opacity-60 cursor-default"
                >
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const cfg = o.transportationType ? TYPE_CONFIG[o.transportationType] : null;
                      return cfg ? (
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
                        >
                          <cfg.Icon size={10} color={cfg.border} />
                        </div>
                      ) : (
                        <AlertCircle size={10} className="text-amber-500 flex-shrink-0" />
                      );
                    })()}
                    <span className="font-mono text-xs">{o.number}</span>
                  </div>
                  {o.currentLocation && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-4 truncate italic">
                      {o.currentLocation}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[41, 63]}
          zoom={4}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapPanner target={flyTo} />
          {mapped.map((o) => (
            <Marker
              key={o.id}
              position={[o.lat!, o.lng!]}
              icon={buildDivIcon(o.transportationType, o.status)}
              ref={(ref) => {
                if (ref) markerRefs.current[o.id] = ref;
              }}
            >
              <Popup>
                <div className="text-xs min-w-[160px]">
                  <p className="font-mono font-bold text-sm mb-1">{o.number}</p>
                  {o.status && (
                    <p className="text-muted-foreground mb-1">{o.status}</p>
                  )}
                  {(o.departure || o.destination) && (
                    <div className="flex items-center gap-1 mb-1">
                      <span>{o.departure ?? '—'}</span>
                      <ArrowRight size={10} />
                      <span>{o.destination ?? '—'}</span>
                    </div>
                  )}
                  {o.payer && <p className="text-muted-foreground">{o.payer.name}</p>}
                  {o.currentLocation && (
                    <p className="mt-1 italic text-muted-foreground">{o.currentLocation}</p>
                  )}
                  <button
                    onClick={() => navigate(`/shipments/${o.id}`)}
                    className="mt-2 text-primary hover:underline"
                  >
                    Открыть перевозку →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
