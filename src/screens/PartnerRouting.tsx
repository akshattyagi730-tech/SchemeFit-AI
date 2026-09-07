import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Sparkles, CheckCircle2, MapPin, AlertTriangle } from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState, EmptyState } from '../components/ui';
import { useApplication, usePartners, useRouting } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import type { PartnerRoute } from '../api/types';

export function PartnerRouting({ navigate }: { navigate: (to: string) => void }) {
  const { active, activeId } = useActiveApplication();
  const { data: application } = useApplication(activeId ?? undefined);
  const schemeCode = application?.schemeCode ?? active?.schemeCode;

  const { data, isLoading, isError, error, refetch } = useRouting(schemeCode);
  const { data: partners } = usePartners(schemeCode);
  const [sort, setSort] = useState<'score' | 'distance'>('score');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const routing = data?.routing;
  const candidates = useMemo(() => {
    const list = [...(routing?.candidates ?? [])];
    return list.sort((a, b) =>
      sort === 'score' ? b.score - a.score : (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9),
    );
  }, [routing, sort]);

  const selected: PartnerRoute | undefined =
    candidates.find((c) => c.partnerId === selectedId) ?? routing?.recommended ?? candidates[0];

  if (!schemeCode)
    return (
      <>
        <PageTitle title="Partner Routing">Routing matches you with the partner most likely to help — not simply the nearest.</PageTitle>
        <EmptyState title="No application selected" hint="Start an application, then routing runs against that scheme." />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>Go to Scheme Matches</Button>
        </div>
      </>
    );
  if (isLoading) return <Loading label="Running partner routing…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!routing) return null;

  const mapPoints = (partners ?? []).filter((p) => p.location?.lat);
  const center: [number, number] = mapPoints[0]
    ? [mapPoints[0].location.lat, mapPoints[0].location.lng]
    : [28.6692, 77.4538];

  return (
    <>
      <PageTitle title="Partner Routing">
        Mandatory filters (active · authorised · supports {schemeCode} · serves your area · accepting) run first. Survivors
        are then ranked.
      </PageTitle>

      <div className="routing-layout">
        <article className="card route-map">
          <MapContainer center={center} zoom={11} scrollWheelZoom={false}>
            <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapPoints.map((p) => (
              <Marker key={p.id} position={[p.location.lat, p.location.lng]} eventHandlers={{ click: () => setSelectedId(p.id) }}>
                <Popup>
                  {p.name}
                  {routing.candidates.find((c) => c.partnerId === p.id) ? ' — eligible' : ' — filtered out'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <span className="map-note">
            Distances are straight-line (Haversine), not road distance or travel time. Operational load is simulated.
          </span>
        </article>

        <article className="card route-recommendation">
          {routing.matched && selected ? (
            <>
              <span className="best-label">
                <Sparkles size={14} /> BEST MATCH
              </span>
              <h2>
                {selected.name} <em>{selected.score}/100</em>
              </h2>
              <p>
                {selected.type.replace(/_/g, ' ')} ·{' '}
                {selected.distanceKm != null ? `${selected.distanceKm} km straight-line` : 'distance unavailable'}
                {selected.metricsSimulated ? ' · simulated metrics' : ''}
              </p>
              <div className="route-score">
                <ScoreRing score={selected.score} />
                <div>
                  <b>Factor breakdown</b>
                  {selected.factors.map((f) => (
                    <span key={f.key}>
                      <CheckCircle2 /> {f.label}: {f.rawScore}/100 (weight {Math.round(f.weight * 100)}%) — {f.detail}
                    </span>
                  ))}
                </div>
              </div>
              <div className="nearest">
                <MapPin /> <b>Nearest is not always best.</b>
                <span>{selected.reason}</span>
              </div>
              <p className="inline-note warn">
                A routing recommendation does not assign a partner and does not imply acceptance or loan approval. An
                administrator assigns the partner after you submit.
              </p>
            </>
          ) : (
            <>
              <span className="best-label">
                <AlertTriangle size={14} /> NO MATCH
              </span>
              <h2>No partner currently qualifies</h2>
              <p>{routing.reason}</p>
              <p className="inline-note">
                An administrator can review this and assign or reassign a partner manually after you submit.
              </p>
            </>
          )}
        </article>
      </div>

      <article className="card partner-table">
        <div className="card-head">
          <h2>Eligible partners</h2>
          <div className="sort">
            <button className={sort === 'score' ? 'selected' : ''} onClick={() => setSort('score')}>
              Best score
            </button>
            <button className={sort === 'distance' ? 'selected' : ''} onClick={() => setSort('distance')}>
              Nearest
            </button>
          </div>
        </div>
        {candidates.length === 0 ? (
          <EmptyState title="No eligible partners" hint="See the excluded list below for why each partner was filtered out." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Distance (straight-line)</th>
                <th>Workload</th>
                <th>Free slots</th>
                <th>Routing score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const p = partners?.find((x) => x.id === c.partnerId);
                return (
                  <tr key={c.partnerId} className={selected?.partnerId === c.partnerId ? 'selected-row' : ''}>
                    <td>
                      <b>{c.name}</b>
                      <small>{c.type.replace(/_/g, ' ')}</small>
                    </td>
                    <td>{c.distanceKm != null ? `${c.distanceKm} km` : '—'}</td>
                    <td>{c.factors.find((f) => f.key === 'workload')?.rawScore ?? '—'}/100 free</td>
                    <td>{p?.freeSlots ?? '—'}</td>
                    <td>
                      <b className="score-text">{c.score}</b>
                    </td>
                    <td>
                      <button className="select-route" onClick={() => setSelectedId(c.partnerId)}>
                        {selected?.partnerId === c.partnerId ? 'Selected' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {routing.excluded.length > 0 && (
          <div className="inline-note">
            <b>Filtered out:</b>
            <br />
            {routing.excluded.map((e) => (
              <span key={e.partnerId}>
                • {e.name}: {e.reasons.join('; ')}
                <br />
              </span>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
