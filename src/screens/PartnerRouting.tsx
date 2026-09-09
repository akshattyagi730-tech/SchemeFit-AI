import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Sparkles, CheckCircle2, MapPin, AlertTriangle } from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState, EmptyState } from '../components/ui';
import { useApplication, usePartners, useRouting } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useLang } from '../i18n';
import type { PartnerRoute } from '../api/types';

export function PartnerRouting({ navigate }: { navigate: (to: string) => void }) {
  const { active, activeId } = useActiveApplication();
  const { data: application } = useApplication(activeId ?? undefined);
  const schemeCode = application?.schemeCode ?? active?.schemeCode;

  const { data, isLoading, isError, error, refetch } = useRouting(schemeCode);
  const { data: partners } = usePartners(schemeCode);
  const [sort, setSort] = useState<'score' | 'distance'>('score');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { t } = useLang();

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
        <PageTitle title={t('pr.title')}>{t('pr.intro')}</PageTitle>
        <EmptyState title={t('pr.noApp')} hint={t('pr.noAppHint')} />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>{t('pr.goToSchemeMatches')}</Button>
        </div>
      </>
    );
  if (isLoading) return <Loading label={t('pr.loading')} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!routing) return null;

  const mapPoints = (partners ?? []).filter((p) => p.location?.lat);
  const center: [number, number] = mapPoints[0]
    ? [mapPoints[0].location.lat, mapPoints[0].location.lng]
    : [28.6692, 77.4538];

  return (
    <>
      <PageTitle title={t('pr.title')}>{t('pr.introFilters', { scheme: schemeCode })}</PageTitle>

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
          <span className="map-note">{t('pr.mapNote')}</span>
        </article>

        <article className="card route-recommendation">
          {routing.matched && selected ? (
            <>
              <span className="best-label">
                <Sparkles size={14} /> {t('pr.bestMatch')}
              </span>
              <h2>
                {selected.name} <em>{selected.score}/100</em>
              </h2>
              <p>
                {selected.type.replace(/_/g, ' ')} ·{' '}
                {selected.distanceKm != null ? t('pr.kmStraight', { n: selected.distanceKm }) : t('pr.distanceUnavailable')}
                {selected.metricsSimulated ? ` · ${t('pr.simMetrics')}` : ''}
              </p>
              <div className="route-score">
                <ScoreRing score={selected.score} />
                <div>
                  <b>{t('pr.factors')}</b>
                  {selected.factors.map((f) => (
                    <span key={f.key}>
                      <CheckCircle2 /> {f.label}: {f.rawScore}/100 ({t('sm.weight')} {Math.round(f.weight * 100)}%) — {f.detail}
                    </span>
                  ))}
                </div>
              </div>
              <div className="nearest">
                <MapPin /> <b>{t('pr.nearestNotBest')}</b>
                <span>{selected.reason}</span>
              </div>
              <p className="inline-note warn">{t('pr.recDisclaimer')}</p>
            </>
          ) : (
            <>
              <span className="best-label">
                <AlertTriangle size={14} /> {t('pr.noMatchTag')}
              </span>
              <h2>{t('pr.noMatch')}</h2>
              <p>{routing.reason}</p>
              <p className="inline-note">{t('pr.noMatchNote')}</p>
            </>
          )}
        </article>
      </div>

      <article className="card partner-table">
        <div className="card-head">
          <h2>{t('pr.eligiblePartners')}</h2>
          <div className="sort">
            <button className={sort === 'score' ? 'selected' : ''} onClick={() => setSort('score')}>
              {t('pr.bestScore')}
            </button>
            <button className={sort === 'distance' ? 'selected' : ''} onClick={() => setSort('distance')}>
              {t('pr.nearest')}
            </button>
          </div>
        </div>
        {candidates.length === 0 ? (
          <EmptyState title={t('pr.noEligiblePartners')} hint={t('pr.noEligibleHint')} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('pr.col.partner')}</th>
                <th>{t('pr.col.distance')}</th>
                <th>{t('pr.col.workload')}</th>
                <th>{t('pr.col.freeSlots')}</th>
                <th>{t('pr.col.score')}</th>
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
                    <td>{c.factors.find((f) => f.key === 'workload')?.rawScore ?? '—'}/100 {t('pr.free')}</td>
                    <td>{p?.freeSlots ?? '—'}</td>
                    <td>
                      <b className="score-text">{c.score}</b>
                    </td>
                    <td>
                      <button className="select-route" onClick={() => setSelectedId(c.partnerId)}>
                        {selected?.partnerId === c.partnerId ? t('pr.selected') : t('pr.selectBtn')}
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
            <b>{t('pr.filteredOut')}</b>
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
