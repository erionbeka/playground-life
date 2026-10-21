# Proxmox migration checklist — Playground Life

One-time rebuild that turns the current single Ubuntu install into a VM running
on Proxmox VE. Use this to go from "everything survives on one OS" to isolated,
snapshot-able VMs, so a second project can share the same physical box safely.

> **Do not rush this.** The box is currently stable (Ethernet preferred,
> services enabled, tunnel healthy). Rebuild when you have a spare afternoon,
> not before a workday. You WILL lose whatever isn't exported below.

---

## 0. Understand what you get

Proxmox VE = bare-metal hypervisor + web UI. You install it *instead of* Ubuntu,
then run Ubuntu *as a VM* inside it.

- ✅ Yes: isolation per project, snapshots, rollback, whole-VM backups.
- ❌ No: horizontal/auto-scaling. Capacity is still one physical box.

Current production facts (verify before assuming they still hold):

| Thing | Current value |
|---|---|
| Ethernet (preferred) | `enp2s0` — `10.10.10.202/24`, gw `10.10.10.254`, metric 100 |
| Wi-Fi (fallback) | `wlp0s20f3` — `10.10.9.201/24`, gw `10.10.9.254`, metric 600 |
| Tailscale | `100.74.41.40` |
| cloudflared tunnel | `d61a8f72-f9ea-4269-9b0c-01b18a5a5854` |
| Ingress | `playground-life.com` + `www` → `http://localhost:80` |
| Web root | `/var/www/html` (nginx) |
| API | `127.0.0.1:4000` (nginx proxies `/api/`) |
| Postgres | local DB `playground_life` |

---

## 1. BEFORE installing Proxmox — export everything

Nothing below survives the wipe. Do all of it first.

### 1.1 Database (hashed, testable restore)
```bash
pg_dump --format=custom --no-owner --no-acl \
  --file /var/backups/playground-life/pre-proxmox-$(date -u +%F).dump \
  "$DATABASE_URL"
# Copy it OFF the box (another machine / cloud storage), then verify:
pg_restore -l /var/backups/playground-life/pre-proxmox-*.dump | head
```
Confirm one current dump exists **outside** the box. An untested backup is not a
backup.

### 1.2 App + config inventory (small, just copy the files)
- `/etc/cloudflared/config.yml` **and** the tunnel credentials JSON
  (`/home/gudgajs/.cloudflared/<tunnel-id>.json`).
- `/etc/systemd/system/cloudflared.service` (the corrected one).
- `/etc/netplan/00-installer-config.yaml` (also in repo:
  `deploy/netplan-ethernet-preferred.yaml`).
- `/etc/nginx/` full config (repo reference: `deploy/nginx.conf`).
- `.env` / `DATABASE_URL` / `JWT_SECRET` / `POSTGRES_PASSWORD` secrets.
- Any TLS/upload assets stored outside the repo.
- `crontab -l` and `/etc/cron.d/*` (or systemd timers).

### 1.3 Backups offsite
The automated DB backup + restore drill (`deploy/README-backups.md`) must have
run recently and been copied off the box. Confirm with a real restore drill
before wiping.

### 1.4 Repo is pushed
```bash
git status            # clean
git push origin main  # nothing uncommitted
```

---

## 2. Install Proxmox VE

1. Download the current **Proxmox VE 9.x** ISO from the official downloads page
   (proxmox.com/en/downloads — confirm the exact version there; cadence moves).
2. Image it to a USB stick (Rufus / `dd`).
3. Boot the installer, install with the **no-subscription** repo (community,
   free). Select a filesystem — **ZFS (single disk)** is fine; it enables
   snapshots.
4. Set a Proxmox root password + an admin email. It will want a hostname and
   a management IP — give it a static IP on your LAN.
5. After install, log into the web UI at `https://<proxmox-ip>:8006`.

**Networking note:** Proxmox uses a Linux bridge (`vmbr0`) on one physical NIC.
You have two NICs — decide now whether the VM gets **Ethernet** (recommended;
`enp2s0` bridged to `vmbr0`) or Wi-Fi. Bridging Wi-Fi is unreliable; put the
host + VMs on Ethernet.

---

## 3. Create the Playground Life VM

Recommended settings (adjust to your hardware):

- **Type:** QEMU/KVM VM (not LXC — the app is a full Ubuntu system).
- **OS:** Ubuntu Server 26.04 LTS ISO.
- **Disk:** 40–60 GB, on ZFS.
- **CPU:** 2–4 vCPU. **RAM:** 4–8 GB (leaves headroom for other VMs).
- **Network:** bridge `vmbr0` → your Ethernet NIC.

Inside the VM, recreate:

1. **User + SSH.** Create `gudgajs`, add an SSH key, enable sshd.
2. **Static network.** Ubuntu 26.04 uses netplan + systemd-networkd. Drop in
   `deploy/netplan-ethernet-preferred.yaml` (adjust interface names/MAC for the
   VM's virtual NIC). This is the same config that fixed the flaky Wi-Fi.
3. **Stack.** Node, Postgres, nginx.
4. **App.** Clone the repo, `npm install`, `npm run build`, then
   `sudo rsync -a --delete dist/ /var/www/html/`.
5. **API service.** Recreate the systemd unit that runs the API on :4000.
6. **nginx.** Apply `deploy/nginx.conf` (serves `/var/www/html`, proxies `/api/`
   → `127.0.0.1:4000`).
7. **cloudflared.** Install, copy `config.yml` + credentials JSON + the
   corrected `cloudflared.service`. `systemctl enable --now cloudflared`.
8. **Tailscale.** Install, `tailscale up`. Note the new `100.x` address.
9. **Backups.** Install `deploy/playground-backup.{service,timer}` and the
   restore-drill timer; set `DATABASE_URL`, `RESTORE_TEST_DATABASE_URL`,
   `BACKUP_DIR`.
10. **Restore the DB** from the pre-migration dump.

### Verify inside the VM
```bash
ip route                                   # default via 10.10.10.254 dev enp2s0
systemctl is-active nginx cloudflared ssh tailscaled
curl -sI http://localhost:80 | head -3     # 200 from nginx
curl -sI http://localhost:4000/api/health  # API up
curl -sI https://playground-life.com | head -3   # 200 from the edge
```

---

## 4. Cut over

- The Cloudflare tunnel DNS points at the **tunnel**, not an IP — so once
  cloudflared registers from the new VM, `playground-life.com` serves the VM.
  No DNS change needed.
- Keep the **old box powered off but intact** for a few days as a rollback.
- If anything is wrong, start cloudflared on the old box to revert instantly.

---

## 5. After the migration

- **Snapshots:** take one after a verified cutover ("known-good VM").
  Snapshot before any risky change; roll back in seconds.
- **Backups:** enable Proxmox whole-VM backup to a separate disk/NAS.
- **Second project:** clone the VM or create a fresh VM. Isolate it. It gets its
  own IP/domain/tunnel and cannot starve or break Playground Life.
- **Optional PBS:** add Proxmox Backup Server later for deduplicated VM backups.

---

## Rollback summary

| If… | Then… |
|---|---|
| New VM flaky/unstable | Power off new VM, boot old box, start cloudflared |
| Tunnel won't register | Check `journalctl -u cloudflared`, verify config + credentials |
| DB restore failed | Re-run restore from the pre-migration dump |
| Network wrong in VM | Recheck netplan interface name/MAC; `netplan try` |

---

## Guardrails (the mistakes to avoid)

- ❌ Don't install Proxmox before exporting the DB and configs.
- ❌ Don't bridge the **Wi-Fi** NIC as the main path — use Ethernet.
- ❌ Don't skip the restore test — an untested backup is worthless.
- ❌ Don't delete the old box until the new one has run clean for days.
- ❌ Don't expect Proxmox to fix Wi-Fi, or to auto-scale. It does neither.
