import React, { useState } from 'react';
import { GameState, Team, Player, PlayerPosition } from '../types';
import { xorNumber } from '../utils/cryptoLedger';
import { evaluateKiPlayerCCQ } from '../utils/substrateEngine';

interface TransfersProps {
  gameState: GameState;
  userTeam: Team;
  freeAgents: Player[];
  onTransfer: (dealType: 'buy' | 'sell', player: Player, price: number, opponentTeamId?: string) => void;
  onNavigate: (screen: string) => void;
}

export default function Transfers({
  gameState,
  userTeam,
  freeAgents,
  onTransfer,
  onNavigate
}: TransfersProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [posFilter, setPosFilter] = useState<PlayerPosition | 'ALL'>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [bidPrice, setBidPrice] = useState<number>(0);
  const [negotiationStep, setNegotiationStep] = useState<'none' | 'negotiating' | 'accepted' | 'rejected'>('none');

  // Find all players in other teams
  const otherTeamsPlayers: { player: Player; teamId: string; teamName: string; flag: string }[] = [];
  gameState.teams.forEach(t => {
    if (t.id === userTeam.id) return;
    t.players.forEach(p => {
      otherTeamsPlayers.push({
        player: p,
        teamId: t.id,
        teamName: t.name,
        flag: t.flag
      });
    });
  });

  // Combine other teams and free agents
  const marketPlayers = [
    ...otherTeamsPlayers,
    ...freeAgents.map(p => ({
      player: p,
      teamId: '',
      teamName: 'Vereinslos',
      flag: '⚪'
    }))
  ];

  // Filter market list
  const filteredMarket = marketPlayers.filter(item => {
    if (posFilter !== 'ALL' && item.player.position !== posFilter) return false;
    return true;
  }).sort((a, b) => b.player.overall - a.player.overall);

  // Filter own players for selling
  const sellablePlayers = userTeam.players.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    return true;
  }).sort((a, b) => b.overall - a.overall);

  const startNegotiations = (player: Player) => {
    setSelectedPlayer(player);
    setBidPrice(player.value); // default bid is market value
    setNegotiationStep('negotiating');
  };

  const submitBid = () => {
    if (!selectedPlayer) return;

    if (bidPrice > xorNumber(userTeam.budget_xor)) {
      alert('Ihr Budget reicht für dieses Gebot nicht aus!');
      return;
    }

    const ratio = bidPrice / selectedPlayer.value;

    if (ratio < 0.85) {
      setNegotiationStep('rejected');
      return;
    }

    // Find AI owner team if the player belongs to one
    const opponentTeamItem = marketPlayers.find(m => m.player.id === selectedPlayer.id);
    const opponentTeamId = opponentTeamItem?.teamId || undefined;
    const opponentTeam = opponentTeamId ? gameState.teams.find(t => t.id === opponentTeamId) : undefined;

    if (opponentTeam) {
      // CCQ strategic matrix evaluation
      const kiScore = evaluateKiPlayerCCQ(opponentTeam, selectedPlayer);
      // kiScore generally centers around 0.5 to 1.5. Higher score = team values player more.
      // We calculate a required bid ratio threshold.
      const threshold = 0.8 + (kiScore * 0.2);
      if (ratio >= threshold) {
        setNegotiationStep('accepted');
      } else {
        setNegotiationStep('rejected');
      }
    } else {
      // Free agent - accepts easily
      if (ratio >= 0.90) {
        setNegotiationStep('accepted');
      } else {
        setNegotiationStep('rejected');
      }
    }
  };

  const confirmPurchase = () => {
    if (!selectedPlayer) return;

    // Find if the player belongs to an AI team
    const opponentTeamItem = marketPlayers.find(m => m.player.id === selectedPlayer.id);
    const opponentTeamId = opponentTeamItem?.teamId || undefined;

    onTransfer('buy', selectedPlayer, bidPrice, opponentTeamId);
    setSelectedPlayer(null);
    setNegotiationStep('none');
  };

  const sellPlayerInstantly = (player: Player) => {
    if (userTeam.players.length <= 11) {
      alert('Sie können keinen Spieler verkaufen! Ihr Kader muss mindestens 11 Spieler umfassen.');
      return;
    }
    if (userTeam.lineup.includes(player.id)) {
      alert('Dieser Spieler steht in der Startaufstellung. Bitte wechseln Sie ihn zuerst aus.');
      return;
    }

    const price = Math.round(player.value * 0.9); // 10% discount for instant sell
    if (window.confirm(`Möchten Sie ${player.name} wirklich sofort für ${(price/1000000).toFixed(2)} Mio. € verkaufen?`)) {
      onTransfer('sell', player, price);
    }
  };

  return (
    <div className="screen-content">
      {/* Header Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex-row-between">
          <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>🤝 Transfermarkt</h1>
          <span className="badge-gold">Budget: {(xorNumber(userTeam.budget_xor)/1000000).toFixed(1)}M €</span>
        </div>

        {/* Tab navigation: Buy / Sell */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setActiveTab('buy'); setPosFilter('ALL'); }}
            className={`tab-pill ${activeTab === 'buy' ? 'active' : ''}`}
            style={{ flex: 1 }}
          >
            Spieler kaufen 🛒
          </button>
          <button
            onClick={() => { setActiveTab('sell'); setPosFilter('ALL'); }}
            className={`tab-pill ${activeTab === 'sell' ? 'active' : ''}`}
            style={{ flex: 1 }}
          >
            Eigener Kader (Verkauf) 💰
          </button>
        </div>

        {/* Position filters */}
        <div className="tabs-container">
          {['ALL', 'TW', 'ABW', 'MF', 'ANG'].map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos as any)}
              className={`tab-pill ${posFilter === pos ? 'active' : ''}`}
              style={{ flex: 1, padding: '4px 6px', fontSize: '0.7rem' }}
            >
              {pos === 'ALL' ? 'Alle' : pos}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'buy' ? (
        /* MARKET BUY SCREEN LIST */
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {filteredMarket.slice(0, 40).map(item => (
              <div 
                key={item.player.id} 
                className="list-item clickable"
                onClick={() => startNegotiations(item.player)}
                style={{ cursor: 'pointer', padding: '10px 14px' }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className="player-position-tag">{item.player.position}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.player.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {item.flag} {item.teamName} • Alter: {item.player.age}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                      {(item.player.value / 1000000).toFixed(1)}M €
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Wert</div>
                  </div>
                  <div className={`player-ovr-badge ${item.player.overall >= 80 ? 'high' : 'med'}`}>
                    {item.player.overall}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* OWN CADRE SELL SCREEN LIST */
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {sellablePlayers.map(p => {
              const isLineup = userTeam.lineup.includes(p.id);

              return (
                <div 
                  key={p.id} 
                  className="list-item"
                  style={{ 
                    padding: '10px 14px',
                    opacity: isLineup ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span className="player-position-tag">{p.position}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        OVR: {p.overall} • Alter: {p.age} {isLineup && '• (In Startelf)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right', marginRight: '6px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                        {(p.value / 1000000).toFixed(1)}M €
                      </div>
                    </div>
                    
                    <button
                      onClick={() => sellPlayerInstantly(p)}
                      disabled={isLineup}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isLineup ? 'var(--bg-panel)' : 'var(--accent-red)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isLineup ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Verkaufen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Negotiation Modal Overlay */}
      {selectedPlayer && negotiationStep !== 'none' && (
        <div className="modal-overlay" onClick={() => { setSelectedPlayer(null); setNegotiationStep('none'); }}>
          <div className="modal-drawer" onClick={e => e.stopPropagation()}>
            
            <div className="flex-row-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <div>
                <h3>Transferverhandlung</h3>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  {selectedPlayer.name} ({selectedPlayer.position})
                </h2>
              </div>
              <div className="player-ovr-badge high">{selectedPlayer.overall}</div>
            </div>

            {negotiationStep === 'negotiating' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <div className="flex-row-between" style={{ marginBottom: '4px' }}>
                    <span>Marktwert:</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{(selectedPlayer.value/1000000).toFixed(2)} Mio. €</span>
                  </div>
                  <div className="flex-row-between">
                    <span>Gehaltsforderung:</span>
                    <span>{(selectedPlayer.salary).toLocaleString()} € / Woche</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Dein Ablöseangebot:
                  </label>
                  <div className="flex-row-between" style={{ gap: '10px' }}>
                    <input
                      type="range"
                      min={Math.round(selectedPlayer.value * 0.7)}
                      max={Math.round(selectedPlayer.value * 1.5)}
                      step={Math.round(selectedPlayer.value * 0.05)}
                      value={bidPrice}
                      onChange={(e) => setBidPrice(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent-green)' }}
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', width: '90px', textAlign: 'right' }}>
                      {(bidPrice/1000000).toFixed(2)}M €
                    </span>
                  </div>
                  <div className="flex-row-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Min: 70%</span>
                    <span>Max: 150%</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={submitBid}
                    style={{ flex: 1 }}
                  >
                    Gebot abgeben 📑
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => { setSelectedPlayer(null); setNegotiationStep('none'); }}
                    style={{ flex: 1 }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {negotiationStep === 'accepted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>✅</div>
                <h3 style={{ color: 'var(--accent-green)' }}>GEBOT ANGENOMMEN!</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Der abgebende Verband und der Spieler haben dem Angebot über <b>{(bidPrice/1000000).toFixed(2)} Mio. €</b> zugestimmt.
                </p>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={confirmPurchase}
                    style={{ flex: 1 }}
                  >
                    Vertrag unterschreiben ✍️
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => { setSelectedPlayer(null); setNegotiationStep('none'); }}
                    style={{ flex: 1 }}
                  >
                    Deal abblasen
                  </button>
                </div>
              </div>
            )}

            {negotiationStep === 'rejected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>❌</div>
                <h3 style={{ color: 'var(--accent-red)' }}>ANGEBOT ABGELEHNT</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Das Angebot ist dem Verband oder dem Spieler zu gering. Die Verhandlungen wurden abgebrochen.
                </p>
                <button 
                  className="btn-secondary" 
                  onClick={() => { setSelectedPlayer(null); setNegotiationStep('none'); }}
                  style={{ width: '100%', marginTop: '10px' }}
                >
                  Zurück zum Markt
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
