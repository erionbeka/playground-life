#!/usr/bin/env bash
# One-shot connectivity hardening for the Playground Life production box.
#
# Background: the box ran on flaky Wi-Fi. The access point kept dropping
# carrier, which killed cloudflared's long-lived QUIC/UDP flows and produced
# Cloudflare error 1033 ("tunnel down") even though ping/curl still worked.
# The fix is to run on Ethernet as the preferred default route (Wi-Fi kept as
# a higher-metric fallback) and to make every critical service start on boot.
#
# Run once, as root, on the server:  sudo bash deploy/fix-server-connectivity.sh
#
# The Netplan step is NOT applied automatically, because a bad network change
# can lock you out. The script prints the exact file to apply with `netplan try`
# (which auto-reverts if you lose access). Everything else is applied directly.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash $0)." >&2
  exit 1
fi

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# ---------------------------------------------------------------------------
# 1. Enable the critical services so a reboot self-recovers.
# ---------------------------------------------------------------------------
SERVICES=(ssh nginx cloudflared tailscaled)
log "Enabling services: ${SERVICES[*]}"
for svc in "${SERVICES[@]}"; do
  if systemctl list-unit-files "${svc}.service" >/dev/null 2>&1; then
    systemctl enable "$svc" && log "  enabled $svc"
    systemctl restart "$svc" || log "  WARNING: could not (re)start $svc"
  else
    log "  WARNING: unit ${svc}.service not found; skipping"
  fi
done

# ---------------------------------------------------------------------------
# 2. Make cloudflared restart on any exit.
# ---------------------------------------------------------------------------
if systemctl list-unit-files cloudflared.service >/dev/null 2>&1; then
  log "Ensuring cloudflared restarts on any exit."
  mkdir -p /etc/systemd/system/cloudflared.service.d
  cat >/etc/systemd/system/cloudflared.service.d/restart.conf <<'EOF'
[Service]
Restart=always
RestartSec=5s
EOF
  systemctl daemon-reload
  systemctl restart cloudflared
fi

# ---------------------------------------------------------------------------
# 3. Show status.
# ---------------------------------------------------------------------------
log "Service status:"
for svc in "${SERVICES[@]}"; do
  printf '  %-12s active=%s enabled=%s\n' "$svc" \
    "$(systemctl is-active "$svc" 2>/dev/null || true)" \
    "$(systemctl is-enabled "$svc" 2>/dev/null || true)"
done

# ---------------------------------------------------------------------------
# 4. Suggest the Netplan edit (not applied automatically).
# ---------------------------------------------------------------------------
cat <<'EOF'

--------------------------------------------------------------------------
Netplan is NOT changed automatically. To prefer Ethernet over Wi-Fi:

  1. Back up:   sudo cp /etc/netplan/00-installer-config.yaml \
                    /etc/netplan/00-installer-config.yaml.bak
  2. Edit:      sudo nano /etc/netplan/00-installer-config.yaml
  3. Apply:     sudo netplan try       # auto-reverts if you lose access

Use the template in deploy/netplan-ethernet-preferred.yaml, adjusting the
interface names, MAC address, addresses and gateways to match your box.
--------------------------------------------------------------------------
EOF

log "Done."
