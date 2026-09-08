#!/usr/bin/env bash
# First run on a bare Ubuntu server. Idempotent: running it twice changes
# nothing the second time, so it is also the way to bring a server back in line
# after somebody has poked at it by hand.
#
#   ssh root@185.214.135.167
#   apt-get update && apt-get install -y git
#   git clone https://github.com/felipelana/pokerstudioreplayer.git /opt/pokerstudio/repo
#   bash /opt/pokerstudio/repo/infra/scripts/provision-vps.sh deploy
#
# The argument is the name of the unattended user the deploy pipeline will log
# in as. It is created without a password: only the key you install can use it.
#
# What it does NOT do, on purpose: it never writes a secret. The .env files are
# created empty from the examples and filled in by a person, so no credential
# ever passes through a script, a shell history or a terminal scrollback.
set -euo pipefail

DEPLOY_USER="${1:-deploy}"
ROOT=/opt/pokerstudio
REPO="$ROOT/repo"

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

say "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban unattended-upgrades apt-listchanges

say "Unattended security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

say "Firewall"
# Do not lock yourself out: SSH is allowed before the firewall is switched on.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

say "SSH hardening"
# Keys only, no root login, no empty passwords. Written as a drop-in so an
# Ubuntu upgrade replacing sshd_config does not silently undo it.
cat > /etc/ssh/sshd_config.d/10-pokerstudio.conf <<'CONF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
X11Forwarding no
CONF
sshd -t && systemctl reload ssh

say "fail2ban"
cat > /etc/fail2ban/jail.d/pokerstudio.conf <<'CONF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban

say "Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker --version
docker compose version

say "Container log rotation"
# Without this one busy container fills the disk and takes the host with it.
cat > /etc/docker/daemon.json <<'CONF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
CONF
systemctl restart docker

say "Deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

say "Directories"
mkdir -p "$ROOT"/{staging,prod,edge}
for env in staging prod; do
  mkdir -p "$ROOT/$env/backups" "$ROOT/$env/caddy"
  cp -n "$REPO/infra/docker/docker-compose.yml" "$ROOT/$env/"
  cp -n "$REPO/infra/docker/docker-compose.$env.yml" "$ROOT/$env/" 2>/dev/null || true
  if [ ! -f "$ROOT/$env/.env" ]; then
    cp "$REPO/infra/docker/.env.$env.example" "$ROOT/$env/.env" 2>/dev/null \
      || cp "$REPO/infra/docker/.env.prod.example" "$ROOT/$env/.env"
  fi
  chmod 600 "$ROOT/$env/.env"
done
cp -n "$REPO/infra/docker/caddy/docker-compose.edge.yml" "$ROOT/edge/"
cp -n "$REPO/infra/docker/caddy/Caddyfile" "$ROOT/edge/"
[ -f "$ROOT/edge/.env" ] || printf 'ACME_EMAIL=\nSTAGING_USER=\nSTAGING_PASSWORD_HASH=\n' > "$ROOT/edge/.env"
chmod 600 "$ROOT/edge/.env"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"

say "Shared edge network"
docker network inspect pokerstudio-edge >/dev/null 2>&1 || docker network create pokerstudio-edge

say "Nightly backup of production"
cat > /etc/cron.d/pokerstudio-backup <<CONF
0 3 * * * $DEPLOY_USER $REPO/infra/scripts/backup.sh prod >> /var/log/pokerstudio-backup.log 2>&1
CONF

cat <<NEXT

Done. What is left is the part a script must not do for you:

  1. Put your public key in /home/$DEPLOY_USER/.ssh/authorized_keys
  2. Fill in the secrets, by hand, then keep them at chmod 600:
       $ROOT/staging/.env
       $ROOT/prod/.env
       $ROOT/edge/.env        (ACME_EMAIL, STAGING_USER, STAGING_PASSWORD_HASH)
     Generate them with:
       openssl rand -hex 24     # POSTGRES_PASSWORD
       openssl rand -hex 32     # SESSION_SECRET, ENCRYPTION_KEY
       docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your password'
     In .env, a bcrypt hash must have every \$ doubled to \$\$, or compose eats it.
  3. Point the four names at this server, then start the edge:
       cd $ROOT/edge && docker compose -p pokerstudio-edge -f docker-compose.edge.yml up -d
  4. Push to develop and let the pipeline put staging up.

NEXT
