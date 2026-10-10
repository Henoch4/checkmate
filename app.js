import { ethers } from 'ethers';
import { AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { Chess } from 'chess.js';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const botTestnet = {
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOTScan Testnet', url: 'https://scan.bohr.life' } },
  testnet: true,
};
const botMainnet = {
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOTScan', url: 'https://scan.botchain.ai' } },
};

const CM_ABI = [
  'function games(uint256) view returns (address white, address black, uint256 wager, uint256 moveCount, uint8 toMove, bool joined, bool finished, address winner, string lastFEN, uint256 createdAt, uint256 lastMoveAt)',
  'function activeGames() view returns (uint256)',
  'function totalWagered() view returns (uint256)',
  'function createGame(address opponent, string initialFEN) payable',
  'function joinGame(uint256 gameId) payable',
  'function submitMove(uint256 gameId, string san, string fenAfter, bool isMate)',
  'function cancelGame(uint256 gameId)',
  'function resign(uint256 gameId)',
  'function claimTimeout(uint256 gameId)',
  'event GameCreated(uint256 indexed gameId, address indexed white, address indexed black, uint256 wager)',
  'event MoveSubmitted(uint256 indexed gameId, address indexed by, uint256 moveIndex, string san, uint8 toMoveAfter)',
  'event GameFinished(uint256 indexed gameId, address indexed winner, uint256 wager, string reason)',
];

const CONTRACTS = { 968: { cm: '0xA3a4b15c9158dC6c93215A0c431859bad6Ac2C74' }, 677: { cm: '0x222D901AFE6381CE2529b5B9124091a137b4c9bd' } };

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 18) => Number(ethers.formatUnits(n, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

function getProvider() {
  try {
    if (typeof appkit !== 'undefined' && appkit && typeof appkit.getWalletProvider === 'function') {
      const p = appkit.getWalletProvider('eip155') || appkit.getWalletProvider();
      if (p) return p;
    }
  } catch (e) {}
  return null;
}
async function getSigner() {
  const wp = getProvider();
  if (!wp) { try { appkit.open(); } catch (e) {} return null; }
  return new ethers.BrowserProvider(wp).getSigner();
}

let appkit = null;
let readProvider;
let currentChainId = 677;
let account = null;

let games = [];
let selId = null;
let lastSeenGame = null;
let lastSeenKey = null;
let chess = null;
let selSq = null;
let legalDests = [];
let pending = null; // {baseMoveCount, san, fen, isMate}

function initAppKit() {
  if (!$('connectBtn')) return;
  const adapter = new EthersAdapter();
  appkit = new AppKit({
    networks: [botMainnet, botTestnet],
    adapters: [adapter],
    projectId: PROJECT_ID,
    themeMode: 'dark',
    metadata: { name: 'Checkmate', description: 'Wagered chess on BOT Chain', url: location.origin, icons: [] },
  });
  appkit.subscribeAccount((state) => {
    account = state.address || null;
    $('connectBtn').textContent = account ? account.slice(0, 6) + '…' + account.slice(-4) : 'Connect wallet';
    refresh();
  });
  $('connectBtn').addEventListener('click', () => appkit.open());
  if ($('netSel')) {
    $('netSel').addEventListener('change', (e) => {
      currentChainId = Number(e.target.value);
      readProvider = new ethers.JsonRpcProvider(currentChainId === 677 ? 'https://rpc.botchain.ai' : 'https://rpc.bohr.life');
      games = []; selId = null; chess = null; pending = null; lastSeenGame = null; lastSeenKey = null;
      refresh();
    });
  }
}

function readCM() {
  const c = CONTRACTS[currentChainId];
  if (!c) return null;
  return new ethers.Contract(c.cm, CM_ABI, readProvider);
}

function showMsg(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
}

async function gameIds() {
  const c = CONTRACTS[currentChainId];
  if (!c) return [];
  const topic = ethers.id('GameCreated(uint256,address,address,uint256)');
  const logs = await readProvider.getLogs({ address: c.cm, topics: [topic], fromBlock: 0, toBlock: 'latest' });
  return logs.map((l) => Number(l.topics[1]));
}

async function countLogs(sig) {
  const c = CONTRACTS[currentChainId];
  if (!c) return 0;
  const topic = ethers.id(sig);
  const logs = await readProvider.getLogs({ address: c.cm, topics: [topic], fromBlock: 0, toBlock: 'latest' });
  return logs.length;
}

/* ---------------- board ---------------- */

const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

function renderBoard() {
  const el = $('board');
  if (!el) return;
  if (!chess) { el.innerHTML = ''; return; }
  const board = chess.board();
  const playable = canPlay();
  let html = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      const sq = cell ? cell.square : null;
      const isLight = (r + f) % 2 === 0;
      const rank = 8 - r;
      const file = 'abcdefgh'[f];
      const target = sq || file + rank;
      const cls = ['sq', isLight ? 'l' : 'd'];
      if (selSq && target === selSq) cls.push('sel');
      let dot = '';
      if (selSq && legalDests.includes(target)) {
        if (chess.get(target)) cls.push('cap'); else cls.push('can');
      }
      const piece = cell ? `<span class="pc ${cell.color === 'w' ? 'wpc' : 'bpc'}">${GLYPH[cell.type]}</span>` : '';
      const cr = f === 0 ? `<span class="cr">${rank}</span>` : '';
      const cf = r === 7 ? `<span class="cf">${file}</span>` : '';
      const cursor = playable ? '' : ';cursor:default';
      html += `<div class="${cls.join(' ')}" data-sq="${target}" style="${cursor}">${cr}${cf}${piece}${dot}</div>`;
    }
  }
  el.innerHTML = html;
}

function canPlay() {
  if (!account || !chess || pending) return false;
  const g = current();
  if (!g || g.finished || !g.joined) return false;
  const me = account.toLowerCase();
  const myColor = g.white.toLowerCase() === me ? 'w' : g.black.toLowerCase() === me ? 'b' : null;
  if (!myColor) return false;
  const turn = g.toMove === 0 ? 'w' : 'b';
  return chess.turn() === myColor && turn === myColor;
}

function onSquare(target) {
  if (!chess || pending) return;
  if (!canPlay()) return;
  if (selSq && legalDests.includes(target)) { localMove(selSq, target); return; }
  const piece = chess.get(target);
  if (piece && piece.color === chess.turn()) {
    selSq = target;
    legalDests = chess.moves({ square: target, verbose: true }).map((m) => m.to);
  } else {
    selSq = null;
    legalDests = [];
  }
  renderBoard();
}

function localMove(from, to) {
  try {
    const mv = chess.move({ from, to, promotion: 'q' });
    const g = current();
    pending = { baseMoveCount: Number(g.moveCount), san: mv.san, fen: chess.fen(), isMate: chess.isCheckmate() };
    selSq = null;
    legalDests = [];
    renderBoard();
    renderPending();
    renderState();
  } catch (e) { /* illegal */ }
}

function undoLocal() {
  const g = current();
  if (!g || !chess) return;
  chess = newChess(g.lastFEN);
  pending = null;
  selSq = null;
  legalDests = [];
  renderBoard();
  renderPending();
  renderState();
}

function renderPending() {
  const bar = $('pendBar');
  if (!bar) return;
  if (!pending) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  $('pendSan').textContent = pending.san;
  $('pendMate').style.display = pending.isMate ? 'inline-block' : 'none';
}

function newChess(fen) {
  try { return new Chess(fen); } catch (e) { return new Chess(START_FEN); }
}

/* ---------------- state rendering ---------------- */

function current() {
  return games.find((g) => g.id === selId) || null;
}

function stateLabel(g) {
  if (g.finished) return 'finished';
  if (!g.joined) return 'waiting for opponent';
  return 'in progress';
}

function renderState() {
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const g = current();
  set('sId', g ? '#' + g.id : '—');
  set('sWhite', g ? short(g.white) : '—');
  set('sBlack', g ? short(g.black) : '—');
  set('sWager', g ? fmt(g.wager) + ' BOT' : '—');
  set('sState', g ? stateLabel(g) : '—');
  set('sLast', g ? new Date(g.lastMoveAt * 1000).toLocaleString() : '—');
  let side = '—';
  if (g && account) {
    const me = account.toLowerCase();
    if (g.white.toLowerCase() === me) side = 'White (you)';
    else if (g.black.toLowerCase() === me) side = 'Black (you)';
    else side = 'spectator';
  }
  set('sSide', side);

  const b = $('bState');
  if (b) {
    if (!g) {
      b.innerHTML = '<b>No game selected</b>Pick a game from the list below.';
    } else if (g.finished) {
      const won = account && g.winner.toLowerCase() === account.toLowerCase();
      b.innerHTML = `<b>Game #${g.id} — finished</b>${short(g.winner)} won${won ? ' — pay you' : ''} · ${Number(g.moveCount)} moves` +
        `<span class="turn-chip"><span class="bci ${g.toMove === 0 ? 'w' : 'b'}"></span>game over</span>`;
    } else if (!g.joined) {
      b.innerHTML = `<b>Game #${g.id} — open</b>White ${short(g.white)} is waiting for Black ${short(g.black)} to join` +
        `<span class="turn-chip"><span class="bci w"></span>White to move (after join)</span>`;
    } else {
      const turnSide = g.toMove === 0 ? 'w' : 'b';
      const myTurn = canPlay();
      b.innerHTML = `<b>Game #${g.id} — move ${Number(g.moveCount) + 1}</b>` +
        `White ${short(g.white)} vs Black ${short(g.black)} · ${fmt(g.wager)} BOT each` +
        `<span class="turn-chip"><span class="bci ${turnSide}"></span>${turnSide === 'w' ? 'White' : 'Black'} to move${myTurn ? ' — your move' : ''}</span>`;
    }
  }

  // action buttons
  const me = account ? account.toLowerCase() : null;
  const isWhite = !!(g && me && g.white.toLowerCase() === me);
  const isBlack = !!(g && me && g.black.toLowerCase() === me);
  const isPlayer = isWhite || isBlack;
  const show = (id, on) => { const e = $(id); if (e) e.style.display = on ? 'inline-flex' : 'none'; };
  show('joinBtn', !!(g && isBlack && !g.joined && !g.finished));
  show('cancelBtn', !!(g && isWhite && !g.joined && !g.finished));
  show('resignBtn', !!(g && isPlayer && g.joined && !g.finished));
  show('timeoutBtn', !!(g && isPlayer && g.joined && !g.finished && Date.now() / 1000 > g.lastMoveAt + 86400));
}

async function renderMoveList() {
  const box = $('moveList');
  if (!box) return;
  const g = current();
  if (!g) { box.innerHTML = '<div class="hint" style="padding:0">Moves appear here.</div>'; return; }
  const c = CONTRACTS[currentChainId];
  const topic = ethers.id('MoveSubmitted(uint256,address,uint256,string,uint8)');
  const idTopic = ethers.zeroPadValue(ethers.toBeHex(g.id), 32);
  try {
    const logs = await readProvider.getLogs({ address: c.cm, topics: [topic, idTopic], fromBlock: 0, toBlock: 'latest' });
    const ifc = new ethers.Interface(CM_ABI);
    const evs = logs.map((l) => ifc.parseLog(l).args).sort((a, b) => Number(a.moveIndex) - Number(b.moveIndex));
    const white = evs.filter((e) => Number(e.moveIndex) % 2 === 1);
    const black = evs.filter((e) => Number(e.moveIndex) % 2 === 0);
    let html = '';
    if (!evs.length && !pending) html = '<div class="hint" style="padding:0">No moves yet.</div>';
    for (let i = 0; i < white.length || i < black.length; i++) {
      const w = white[i] ? white[i].san : '';
      const b = black[i] ? black[i].san : '';
      const wm = /#/.test(w) ? ' mate' : '';
      const bm = /#/.test(b) ? ' mate' : '';
      html += `<div class="mv"><span class="n">${i + 1}.</span><span class="s${wm}">${w}</span><span class="s${bm}">${b}</span></div>`;
    }
    if (pending) {
      const isW = Number(g.moveCount) % 2 === 0; // next move odd → white
      html += `<div class="mv"><span class="n">${white.length + black.length + 1}.</span>` +
        `<span class="s" style="color:var(--gold)">${isW ? pending.san : ''}</span>` +
        `<span class="s" style="color:var(--gold)">${isW ? '' : pending.san}</span></div>`;
    }
    box.innerHTML = html || '<div class="hint" style="padding:0">No moves yet.</div>';
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    box.innerHTML = '<div class="hint" style="padding:0">Move log unavailable.</div>';
  }
}

function renderGameList() {
  const el = $('gameList');
  if (!el) return;
  if (!games.length) {
    el.innerHTML = '<div class="hint">No games yet — create the first one.</div>';
    return;
  }
  el.innerHTML = games.map((g) => {
    const tagCls = g.finished ? 'done' : g.joined ? 'live' : 'open';
    const tagTxt = g.finished ? 'finished' : g.joined ? 'in progress' : 'open';
    const youAre = account && (account.toLowerCase() === g.white.toLowerCase() || account.toLowerCase() === g.black.toLowerCase());
    const yourColor = youAre ? (account.toLowerCase() === g.white.toLowerCase() ? 'white' : 'black') : null;
    return `<div class="gitem${g.id === selId ? ' sel' : ''}" data-id="${g.id}">
      <div class="g-top"><b>Game #${g.id} · ${fmt(g.wager)} BOT</b><span class="tag ${tagCls}">${tagTxt}</span></div>
      <div class="g-meta">
        <span>♔ <span class="mono">${short(g.white)}</span></span>
        <span>♚ <span class="mono">${short(g.black)}</span></span>
        <span>${Number(g.moveCount)} moves</span>
        ${g.finished ? `<span>winner <span class="mono">${short(g.winner)}</span></span>` : ''}
        ${yourColor ? `<span>you: ${yourColor}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---------------- refresh ---------------- */

async function refresh() {
  const cm = readCM();
  if (!cm) {
    ['tActive', 'tWagered', 'tBal', 'stActive', 'stWagered', 'stGames', 'stMoves'].forEach((id) => {
      const e = $(id); if (e) e.textContent = 'not on this chain';
    });
    const gl = $('gameList');
    if (gl) gl.innerHTML = '<div class="hint">Checkmate is deployed on Testnet 968.</div>';
    return;
  }
  try {
    const [ids, active, wagered, created, submitted] = await Promise.all([
      gameIds(), cm.activeGames(), cm.totalWagered(), countLogs('GameCreated(uint256,address,address,uint256)'), countLogs('MoveSubmitted(uint256,address,uint256,string,uint8)'),
    ]);
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('tActive', String(active)); set('stActive', String(active));
    set('tWagered', fmt(wagered) + ' BOT'); set('stWagered', fmt(wagered) + ' BOT');
    set('stGames', String(created));
    set('stMoves', String(submitted));
    if (account) {
      const bal = await readProvider.getBalance(account);
      set('tBal', fmt(bal) + ' BOT');
    } else set('tBal', 'connect wallet');

    const loaded = await Promise.all(ids.map(async (id) => {
      const g = await cm.games(id);
      return {
        id,
        white: g[0], black: g[1], wager: g[2], moveCount: Number(g[3]), toMove: Number(g[4]),
        joined: g[5], finished: g[6], winner: g[7], lastFEN: g[8], createdAt: Number(g[9]), lastMoveAt: Number(g[10]),
      };
    }));
    games = loaded;

    if (selId == null && games.length) selId = games[0].id;
    if (selId != null && !games.some((g) => g.id === selId)) selId = games.length ? games[0].id : null;

    const g = current();
    if (g) {
      if (!chess || (pending && pending.baseMoveCount !== Number(g.moveCount))) {
        // chain moved (or fresh selection): reset local state
        pending = null; selSq = null; legalDests = [];
        chess = newChess(g.lastFEN);
      } else if (!pending && chess && chess.fen() !== g.lastFEN) {
        chess = newChess(g.lastFEN);
        selSq = null; legalDests = [];
      }
    } else { chess = null; pending = null; selSq = null; legalDests = []; }

    // ---- live move alerts (5s poll, board-only refresh) ----
    try {
      if (g && account) {
        const key = g.id + ':' + Number(g.moveCount) + ':' + (g.finished ? 'F' : '');
        if (lastSeenGame === g.id && lastSeenKey && lastSeenKey !== key) {
          const info = await lastMoveInfo(g.id);
          if (info && info.by.toLowerCase() !== account.toLowerCase()) {
            if (g.finished) showMsg('actMsg', 'Game over — ' + (g.winner.toLowerCase() === account.toLowerCase() ? 'you won!' : short(g.winner) + ' won'));
            else showMsg('actMsg', 'Opponent played ' + info.san + ' — your move!');
          }
        }
        lastSeenGame = g.id; lastSeenKey = key;
      } else if (g) { lastSeenGame = g.id; lastSeenKey = g.id + ':' + Number(g.moveCount) + ':' + (g.finished ? 'F' : ''); }
    } catch { /* alerts are best-effort */ }

    renderGameList();
    renderState();
    renderPending();
    renderBoard();
    renderMoveList();
  } catch (e) {
    console.error(e);
    const el = $('gameList');
    if (el) el.innerHTML = '<div class="hint">Failed to load games: ' + String(e.message || e).slice(0, 120) + '</div>';
  }
}

async function lastMoveInfo(gameId) {
  try {
    const c = CONTRACTS[currentChainId];
    const topic = ethers.id('MoveSubmitted(uint256,address,uint256,string,uint8)');
    const idTopic = '0x' + gameId.toString(16).padStart(64, '0');
    const logs = await readProvider.getLogs({ address: c.cm, topics: [topic, idTopic], fromBlock: 0, toBlock: 'latest' });
    if (!logs.length) return null;
    const iface = new ethers.Interface(CM_ABI);
    const e = iface.parseLog(logs[logs.length - 1]);
    return { by: e.args[1], san: e.args[3] };
  } catch { return null; }
}

async function selectGame(id) {
  if (selId === id && chess) return;
  selId = id;
  pending = null;
  selSq = null;
  legalDests = [];
  const g = current();
  chess = g ? newChess(g.lastFEN) : null;
  const am = $('actMsg');
  if (am) am.style.display = 'none';
  renderGameList();
  renderState();
  renderPending();
  renderBoard();
  renderMoveList();
}

/* ---------------- actions ---------------- */

async function signerOrAlert() {
  if (!account) { appkit?.open(); return null; }
  if (!CONTRACTS[currentChainId]) { alert('No contracts on this network in this app. Switch to BOT Chain 677 or Testnet 968.'); return null; }
  const s = await getSigner();
  if (!s) { appkit?.open(); return null; }
  return s;
}

async function doCreate() {
  const s = await signerOrAlert();
  if (!s) return;
  const opp = $('cOpp')?.value.trim();
  const wager = $('cWager')?.value;
  const fen = $('cFen')?.value.trim() || START_FEN;
  if (!ethers.isAddress(opp)) return showMsg('gmMsg', 'Enter a valid opponent address');
  if (opp.toLowerCase() === (await s.getAddress()).toLowerCase()) return showMsg('gmMsg', 'Opponent must not be you');
  if (!wager || Number(wager) <= 0) return showMsg('gmMsg', 'Enter a wager > 0');
  try { new Chess(fen); } catch (e) { return showMsg('gmMsg', 'Invalid FEN'); }
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('gmMsg', 'Sending createGame…');
  try {
    const tx = await cm.createGame(opp, fen, { value: ethers.parseEther(wager) });
    showMsg('gmMsg', 'Sent: ' + tx.hash.slice(0, 14) + '…');
    await tx.wait();
    showMsg('gmMsg', 'Game created ✓ — waiting for opponent to join');
    refresh();
  } catch (e) { showMsg('gmMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100)); }
}

async function doJoin() {
  const g = current();
  if (!g) return;
  const s = await signerOrAlert();
  if (!s) return;
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('actMsg', 'Joining with ' + fmt(g.wager) + ' BOT…');
  try {
    const tx = await cm.joinGame(g.id, { value: g.wager });
    await tx.wait();
    showMsg('actMsg', 'Joined ✓ — you are Black. White moves first.');
    refresh();
  } catch (e) { showMsg('actMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100)); }
}

async function doCancel() {
  const g = current();
  if (!g) return;
  const s = await signerOrAlert();
  if (!s) return;
  if (!confirm('Cancel game #' + g.id + '? Your wager is refunded.')) return;
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('actMsg', 'Cancelling…');
  try {
    const tx = await cm.cancelGame(g.id);
    await tx.wait();
    showMsg('actMsg', 'Cancelled ✓ — wager refunded');
    refresh();
  } catch (e) { showMsg('actMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100)); }
}

async function doResign() {
  const g = current();
  if (!g) return;
  const s = await signerOrAlert();
  if (!s) return;
  if (!confirm('Resign game #' + g.id + '? Your opponent takes the pot.')) return;
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('actMsg', 'Resigning…');
  try {
    const tx = await cm.resign(g.id);
    await tx.wait();
    showMsg('actMsg', 'Resigned ✓');
    refresh();
  } catch (e) { showMsg('actMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100)); }
}

async function doTimeout() {
  const g = current();
  if (!g) return;
  const s = await signerOrAlert();
  if (!s) return;
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('actMsg', 'Claiming timeout…');
  try {
    const tx = await cm.claimTimeout(g.id);
    await tx.wait();
    showMsg('actMsg', 'Timeout claimed ✓');
    refresh();
  } catch (e) { showMsg('actMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100)); }
}

async function doSubmit() {
  if (!pending) return;
  const g = current();
  if (!g) return;
  const s = await signerOrAlert();
  if (!s) return;
  const cm = new ethers.Contract(CONTRACTS[currentChainId].cm, CM_ABI, s);
  showMsg('actMsg', 'Submitting ' + pending.san + '…');
  try {
    const tx = await cm.submitMove(g.id, pending.san, pending.fen, pending.isMate);
    showMsg('actMsg', 'Sent: ' + tx.hash.slice(0, 14) + '…');
    await tx.wait();
    showMsg('actMsg', pending.isMate ? 'Checkmate! ✓ — pot paid to winner' : 'Move confirmed ✓');
    pending = null;
    refresh();
  } catch (e) {
    showMsg('actMsg', 'Failed: ' + String(e.reason || e.message || e).slice(0, 100));
    undoLocal();
  }
}

/* ---------------- boot ---------------- */

function boot() {
  readProvider = new ethers.JsonRpcProvider(currentChainId === 677 ? 'https://rpc.botchain.ai' : 'https://rpc.bohr.life');
  initAppKit();
  $('board')?.addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (sq) onSquare(sq.dataset.sq);
  });
  $('gameList')?.addEventListener('click', (e) => {
    const it = e.target.closest('.gitem');
    if (it) selectGame(Number(it.dataset.id));
  });
  $('createBtn')?.addEventListener('click', doCreate);
  $('joinBtn')?.addEventListener('click', doJoin);
  $('cancelBtn')?.addEventListener('click', doCancel);
  $('resignBtn')?.addEventListener('click', doResign);
  $('timeoutBtn')?.addEventListener('click', doTimeout);
  $('submitBtn')?.addEventListener('click', doSubmit);
  $('undoBtn')?.addEventListener('click', undoLocal);
  refresh();
  setInterval(refresh, 5000);
}
boot();
