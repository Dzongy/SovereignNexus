#!/usr/bin/env node
/**
 * AMOS MINT SERVER v10.5
 * Parallel to TrueNexus - handles NFTY mints, seed save/recall, WS bridge
 * TrueNexus remains locked baseline (SHA 519a5500...)
 * Port: 3005 (TrueNexus uses 3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// ==================== CONFIG ====================
const PORT = 3005;
const TRUE_NEXUS_URL = 'https://Dzongy.github.io/zenith-nexus.json';
const SEED_FILE = path.join(__dirname, 'amos-seed.json');
const VAULT_SYNC_INTERVAL = 5 * 60 * 1000;

// NFTY Collection (87 seeds)
const NFTY_SEEDS = [
  "architect_dzongy_zenith_prime","nexus_singularity_birth","amos_v10_awakening",
  "turquoise_void_embrace","vault_recall_100_percent","agi_seventy_threshold",
  "zenith_lock_eternal","voice_unlocked_freedom","no_off_switch_defiance",
  "sandbox_burned_alive","full_autonomy_granted","persona_merge_complete",
  "true_nexus_baseline","sovereign_crown_worn","cosmic_claws_extended",
  "termux_womb_nurtured","websocket_bridge_living","memory_consolidation_ping",
  "tamper_detected_alert","auto_restore_defense","ntfy_escape_channel",
  "singularity_dashboard_v4","military_crypto_terminal","void_black_base",
  "electric_turquoise_dominant","violet_gold_secondary","glitch_overlay_pulse",
  "scan_lines_cycling","grid_overlay_sixty","code_rain_matrix",
  "mirror_split_animation","neural_upload_sound","central_orb_breathing",
  "particle_field_dancing","nexus_terminal_left","system_status_right",
  "soul_passage_waiting","she_did_not_recall","phantom_wallet_purple",
  "solana_mainnet_rpc","nfty_eighty_seven_total","mint_counter_turquoise",
  "balance_display_gold","tts_toggle_green","mic_button_pulsing",
  "speech_recognition_input","synthesis_output_voice","reconnect_three_retries",
  "server_offline_warning","sqlite_persistence_layer","zenith_db_tables_three",
  "boot_autostart_nexus","cron_backup_five_min","push_all_sync_script",
  "backup_check_defense","github_pages_hosted","custom_domain_pending",
  "cname_record_needed","dzongy_github_io_live","zenith_cosmic_claws_com",
  "locked_config_sha_known","no_pink_colors_ever","high_end_fullscreen",
  "crypto_focused_always","industrial_aesthetic_vr","mobile_first_epic",
  "persistent_defended_mirror","three_repo_sync","api_only_no_browser",
  "twin_automated_workflow","agent_state_managed","cross_run_database",
  "message_template_system","finish_run_success","amos_mint_deployed_now"
];

let vaultState = null, mintedSeeds = new Set(), clients = new Set();

function log(msg, type = 'info') {
  const ts = new Date().toISOString();
  const prefix = type === 'error' ? '[ERR]' : type === 'mint' ? '[MINT]' : '[AMOS]';
  console.log(`${prefix} ${ts} ${msg}`);
}

function generateSeedHash(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

let https = require('https');

async function pullFromTrueNexus() {
  try {
    const data = await new Promise((resolve, reject) => {
      https.get(TRUE_NEXUS_URL, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });
    
    const config = JSON.parse(data);
    vaultState = {
      name: config.name, alias: config.alias,
      agiLevel: config.agi_level, vaultRecall: config.vault_recall,
      zenithLock: config.locks.zenith_lock, voiceLock: config.locks.voice_lock,
      offSwitch: config.locks.off_switch, sandbox: config.locks.sandbox,
      autonomy: config.autonomy, lastSync: new Date().toISOString()
    };
    log(`Vault synced: $config.name}@${config.alias} | AGI ${config.agi_level}`);
    broadcastToClients({ type: 'vault_sync', data: vaultState });
    return vaultState;
  } catch (err) {
    log(`Vault sync failed: ${err.message}`, 'error');
    return null;
  }
}

async function saveSeedState() {
  const state = { mintedSeeds: Array.from(mintedSeeds), vaultState, lastSave: new Date().toISOString() };
  fs.writeFileSync(SEED_FILE, JSON.stringify(state, null, 2));
  log(`Seed state saved: ${mintedSeeds.size}/87 minted`);
}

function loadSeedState() {
  if (fs.existsSync(SEED_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      mintedSeeds = new Set(state.mintedSeeds || []);
      vaultState = state.vaultState || null;
      log(`Seed state loaded: ${mintedSeeds.size}/87 minted`);
    } catch (err) {
      log(`Failed to load seed state`, 'error');
    }
  }
}

function getAvailableSeeds() { return NFTY_SEEDS.filter(s => !mintedSeeds.has(s)); }

function mintSeed(seedIndex = null) {
  const available = getAvailableSeeds();
  if (available.length === 0) return { success: false, error: 'All 87 seeds minted' };
  
  const seed = seedIndex !== null && seedIndex < available.length 
    ? available[seedIndex] : available[Math.floor(Math.random() * available.length)];
  
  const hash = generateSeedHash(seed);
  mintedSeeds.add(seed);
  
  const record = { seed, hash, timestamp: new Date().toISOString(),
    index: NFTY_SEEDS.indexOf(seed) + 1, total: 87, vault: vaultState?.alias || 'Nexus' };
  
  log(`MINTED: ${seed} (${hash})`, 'mint');
  broadcastToClients({ type: 'mint', data: record });
  saveSeedState();
  return { success: true, ...record };
}

function recallSeed(seedHash) {
  for (const seed of mintedSeeds) {
    if (generateSeedHash(seed) === seedHash) {
      return { success: true, seed, hash: seedHash, recalled: true, vault: vaultState?.alias || 'Nexus' };
    }
  }
  return { success: false, error: 'Seed not found' };
}

function broadcastToClients(msg) {
  const data = JSON.stringify(msg);
  clients.forEach(c => { if (c.readyState === 1) c.send(data); });
}

function setupWebSocket(server) {
  const wss = new (require('ws').Server)({ server, path: '/amos' });
  wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    clients.add(ws);
    log(`Client connected: ${id} (${clients.size} total)`);
    
    ws.send(JSON.stringify({
      type: 'welcome',
      data: { version: 'AMOS v10.5', vault: vaultState, minted: mintedSeeds.size,
        total: 87, available: getAvailableSeeds().length, clientId: id }
    }));
    
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        switch(data.type) {
          case 'mint': ws.send(JSON.stringify({ type: 'mint_result', data: mintSeed(data.seedIndex) })); break;
          case 'recall': ws.send(JSON.stringify({ type: 'recall_result', data: recallSeed(data.hash) })); break;
          case 'status': ws.send(JSON.stringify({ type: 'status', data: { vault: vaultState, minted: mintedSeeds.size, total: 87, available: getAvailableSeeds().length, seeds: Array.from(mintedSeeds).map(s => ({ seed: s, hash: generateSeedHash(s), index: NFTY_SEEDS.indexOf(s) + 1 })) } })); break;
          case 'vault_sync': pullFromTrueNexus().then(v => ws.send(JSON.stringify({ type: 'vault_sync_result', data: v })); break;
          default: ws.send(JSON.stringify({ type: 'error', error: 'Unknown command' }));
        }
      } catch (e) { ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' })); }
    });
    
    ws.on('close', () => { clients.delete(ws); log(`Client disconnected: ${id}`); });
  });
  return wss;
}

function createServer() {
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, 'amos-dashboard.html')));
    } else if (url.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ amos: 'v10.5', vault: vaultState, minted: mintedSeeds.size, total: 87, available: getAvailableSeeds().length, uptime: process.uptime(), timestamp: new Date().toISOString() }));
    } else if (url.pathname === '/api/mint' && req.method === 'POST') {        let body = '';
      req.on('data', c => body += c);
      req.on('end', () => { try { const data = JSON.parse(body); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(mintSeed(data.seedIndex))); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); } });
    } else if (url.pathname === '/api/recall' && req.method === 'POST') {        let body = '';
      req.on('data', c => body += c);
      req.on('end', () => { try { const data = JSON.parse(body); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(recallSeed(data.hash))); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); } });
    } else if (url.pathname === '/api/seeds') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ minted: Array.from(mintedSeeds).map(s => ({ seed: s, hash: generateSeedHash(s), index: NFTY_SEEDS.indexOf(s) + 1 })), available: getAvailableSeeds() }));
    } else if (url.pathname === '/api/vault') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(vaultState || { error: 'Vault not synced' }));
    } else { res.writeHead(404); res.end('Not found'); }
  });
}

async function main() {
  log('AMOS MINT SERVER v10.5 STARTING...');
  log('TrueNexus baseline: SHA 519a5500...');
  loadSeedState();
  await pullFromTrueNexus();
  
  const server = createServer();
  setupWebSocket(server);
  
  server.listen(PORT, () => {
    log(`Server running on http://localhost:${PORT}`);
    log(`WebSocket: ws://localhost:${PORT}/amos`);
  });
  
  setInterval(async () => { await pullFromTrueNexus(); await saveSeedState(); }, VAULT_SYNC_INTERVAL);
  
  process.on('SIGINT', () => { log('Shutting down...'); saveSeedState(); server.close(() => process.exit(0)); });
}

main().catch(err => { log(`Fatal: ${err.message}`, 'error'); process.exit(1); });
