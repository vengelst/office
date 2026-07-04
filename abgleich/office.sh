#!/bin/zsh
#
# Office interactive deploy helper for macOS.
#
# Usage: ./abgleich/office.sh
#

set -eo pipefail

SCRIPT_DIR="${0:A:h}"
CONFIG_FILE="$SCRIPT_DIR/office.config.sh"

# ─── Colors & helpers ────────────────────────────────────────────────────────

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; CYAN=$'\033[0;36m'; GRAY=$'\033[0;90m'; NC=$'\033[0m'

write_step()  { echo ""; echo "${CYAN}=================================${NC}"; echo "${CYAN}  $1${NC}"; echo "${CYAN}=================================${NC}"; }
write_info()  { echo "${CYAN}[INFO]  $1${NC}"; }
write_ok()    { echo "${GREEN}[ OK ]  $1${NC}"; }
write_warn()  { echo "${YELLOW}[WARN]  $1${NC}"; }
fail()        { echo "${RED}[ERROR] $1${NC}"; exit 1; }

invoke_checked() {
    local desc="$1"; shift
    write_info "$desc"
    if "$@"; then
        write_ok "Erfolgreich: $desc"
    else
        fail "Schritt fehlgeschlagen: $desc (Exit $?)"
    fi
}

ask_text() {
    local prompt="$1"
    local default="${2:-}"
    local suffix=""
    [[ -n "$default" ]] && suffix=" [$default]"
    echo -n "$prompt$suffix: " >&2
    read -r value
    if [[ -z "$value" ]]; then
        echo "$default"
    else
        echo "$value"
    fi
}

ask_yesno() {
    local prompt="$1"
    local default="${2:-y}"
    local hint
    if [[ "$default" == "y" ]]; then hint="[J/n]"; else hint="[j/N]"; fi
    echo -n "$prompt $hint: " >&2
    read -r answer
    answer="${answer:l}"
    if [[ -z "$answer" ]]; then
        [[ "$default" == "y" ]] && return 0 || return 1
    fi
    [[ "$answer" =~ ^(j|ja|y|yes)$ ]] && return 0 || return 1
}

# ─── Configuration ───────────────────────────────────────────────────────────

cfg_remoteName=""
cfg_branch=""
cfg_repoUrl=""
cfg_serverHost=""
cfg_serverUser=""
cfg_serverPath=""
cfg_nginxConfigLocalPath=""
cfg_nginxConfigName=""
cfg_nginxMinioConfigLocalPath=""
cfg_nginxMinioConfigName=""
cfg_nginxSitesAvailablePath=""
cfg_nginxSitesEnabledPath=""
cfg_forceServerReset=""

set_defaults() {
    cfg_remoteName="origin"
    cfg_branch="main"
    cfg_repoUrl="https://github.com/vengelst/office.git"
    cfg_serverHost="vivahome.de"
    cfg_serverUser="root"
    cfg_serverPath="/opt/office"
    cfg_nginxConfigLocalPath="deploy/nginx/office.vivahome.de.conf"
    cfg_nginxConfigName="office.vivahome.de.conf"
    cfg_nginxMinioConfigLocalPath="deploy/nginx/minio.office.vivahome.de.conf"
    cfg_nginxMinioConfigName="minio.office.vivahome.de.conf"
    cfg_nginxSitesAvailablePath="/etc/nginx/sites-available"
    cfg_nginxSitesEnabledPath="/etc/nginx/sites-enabled"
    cfg_forceServerReset="true"
}

save_config() {
    cat > "$CONFIG_FILE" <<CONF
# Office deploy configuration (auto-generated)
remoteName="$cfg_remoteName"
branch="$cfg_branch"
repoUrl="$cfg_repoUrl"
serverHost="$cfg_serverHost"
serverUser="$cfg_serverUser"
serverPath="$cfg_serverPath"
nginxConfigLocalPath="$cfg_nginxConfigLocalPath"
nginxConfigName="$cfg_nginxConfigName"
nginxMinioConfigLocalPath="$cfg_nginxMinioConfigLocalPath"
nginxMinioConfigName="$cfg_nginxMinioConfigName"
nginxSitesAvailablePath="$cfg_nginxSitesAvailablePath"
nginxSitesEnabledPath="$cfg_nginxSitesEnabledPath"
forceServerReset="$cfg_forceServerReset"
CONF
}

load_config() {
    set_defaults
    if [[ -f "$CONFIG_FILE" ]]; then
        local remoteName branch repoUrl serverHost serverUser serverPath
        local nginxConfigLocalPath nginxConfigName nginxMinioConfigLocalPath nginxMinioConfigName
        local nginxSitesAvailablePath nginxSitesEnabledPath forceServerReset
        source "$CONFIG_FILE"
        [[ -n "${remoteName:-}" ]] && cfg_remoteName="$remoteName"
        [[ -n "${branch:-}" ]] && cfg_branch="$branch"
        [[ -n "${repoUrl:-}" ]] && cfg_repoUrl="$repoUrl"
        [[ -n "${serverHost:-}" ]] && cfg_serverHost="$serverHost"
        [[ -n "${serverUser:-}" ]] && cfg_serverUser="$serverUser"
        [[ -n "${serverPath:-}" ]] && cfg_serverPath="$serverPath"
        [[ -n "${nginxConfigLocalPath:-}" ]] && cfg_nginxConfigLocalPath="$nginxConfigLocalPath"
        [[ -n "${nginxConfigName:-}" ]] && cfg_nginxConfigName="$nginxConfigName"
        [[ -n "${nginxMinioConfigLocalPath:-}" ]] && cfg_nginxMinioConfigLocalPath="$nginxMinioConfigLocalPath"
        [[ -n "${nginxMinioConfigName:-}" ]] && cfg_nginxMinioConfigName="$nginxMinioConfigName"
        [[ -n "${nginxSitesAvailablePath:-}" ]] && cfg_nginxSitesAvailablePath="$nginxSitesAvailablePath"
        [[ -n "${nginxSitesEnabledPath:-}" ]] && cfg_nginxSitesEnabledPath="$nginxSitesEnabledPath"
        [[ -n "${forceServerReset:-}" ]] && cfg_forceServerReset="$forceServerReset"
    else
        save_config
    fi
}

show_config() {
    write_step "Aktuelle Deploy-Konfiguration"
    write_info "Git remote: $cfg_remoteName"
    write_info "Git branch: $cfg_branch"
    write_info "Repo URL: $cfg_repoUrl"
    write_info "Server host: $cfg_serverHost"
    write_info "Server user: $cfg_serverUser"
    write_info "Server path: $cfg_serverPath"
    write_info "Nginx config: $cfg_nginxConfigLocalPath"
    write_info "Nginx MinIO config: $cfg_nginxMinioConfigLocalPath"
    write_info "Force server reset: $cfg_forceServerReset"
}

edit_config() {
    show_config
    cfg_remoteName="$(ask_text "Git remote name" "$cfg_remoteName")"
    cfg_branch="$(ask_text "Git branch" "$cfg_branch")"
    cfg_repoUrl="$(ask_text "Repo URL" "$cfg_repoUrl")"
    cfg_serverHost="$(ask_text "Server host" "$cfg_serverHost")"
    cfg_serverUser="$(ask_text "Server user" "$cfg_serverUser")"
    cfg_serverPath="$(ask_text "Server path" "$cfg_serverPath")"
    if ask_yesno "Server bei lokalen Aenderungen hart zuruecksetzen?" "y"; then
        cfg_forceServerReset="true"
    else
        cfg_forceServerReset="false"
    fi

    [[ -z "$cfg_repoUrl" ]] && fail "Repo URL ist erforderlich."
    [[ -z "$cfg_remoteName" ]] && fail "Git-Remote-Name ist erforderlich."

    save_config
    write_ok "Konfiguration gespeichert: $CONFIG_FILE"
}

# ─── Git helpers ─────────────────────────────────────────────────────────────

ensure_no_tracked_secrets() {
    local forbidden=(".env" ".env.production" ".env.local")
    for f in "${forbidden[@]}"; do
        if git ls-files --cached -- "$f" 2>/dev/null | grep -q .; then
            fail "Abbruch: '$f' ist in Git getrackt."
        fi
    done
}

ensure_usable_git_remote() {
    if git remote | grep -qx "$cfg_remoteName"; then
        return 0
    fi

    if [[ -n "$cfg_repoUrl" ]]; then
        local existing
        existing="$(git remote -v | grep "(fetch)" | awk -v url="$cfg_repoUrl" '$2 == url {print $1; exit}')"
        if [[ -n "$existing" ]]; then
            write_warn "Remote '$cfg_remoteName' existiert nicht. Verwende vorhandenes Remote '$existing' mit gleicher URL."
            cfg_remoteName="$existing"
            return 0
        fi
    fi

    [[ -z "$cfg_repoUrl" ]] && fail "Remote '$cfg_remoteName' existiert nicht und Repo URL ist leer."

    write_warn "Remote '$cfg_remoteName' existiert nicht."
    if ask_yesno "Remote '$cfg_remoteName' mit Repo URL '$cfg_repoUrl' anlegen?" "n"; then
        invoke_checked "git remote add $cfg_remoteName $cfg_repoUrl" git remote add "$cfg_remoteName" "$cfg_repoUrl"
    else
        fail "Abbruch: Remote '$cfg_remoteName' wurde nicht angelegt."
    fi
}

GIT_DIRTY=""
GIT_BRANCH=""
GIT_UPSTREAM=""
GIT_AHEAD=0
GIT_BEHIND=0

get_git_state() {
    GIT_DIRTY="$(git status --porcelain)"
    GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    GIT_UPSTREAM="$(git for-each-ref --format='%(upstream:short)' "refs/heads/$GIT_BRANCH" 2>/dev/null || true)"
    GIT_AHEAD=0
    GIT_BEHIND=0
    if [[ -n "$GIT_UPSTREAM" ]]; then
        local counts
        counts="$(git rev-list --left-right --count "$GIT_UPSTREAM...HEAD" 2>/dev/null || true)"
        if [[ -n "$counts" ]]; then
            GIT_BEHIND="$(echo "$counts" | awk '{print $1}')"
            GIT_AHEAD="$(echo "$counts" | awk '{print $2}')"
        fi
    fi
}

# ─── Workflow functions ──────────────────────────────────────────────────────

handle_push_and_version() {
    ensure_no_tracked_secrets
    ensure_usable_git_remote
    get_git_state

    write_step "Git Workflow"
    if [[ -n "$GIT_DIRTY" ]]; then
        write_warn "Working Tree hat Aenderungen:"
        echo "$GIT_DIRTY" | sed 's/^/    /'
        if ask_yesno "Aenderungen committen?" "y"; then
            local msg
            msg="$(ask_text "Commit-Message" "Update Office")"
            invoke_checked "git add -A" git add -A
            invoke_checked "git commit" git commit -m "$msg"
            get_git_state
        fi
    else
        write_ok "Working Tree ist sauber."
    fi

    if [[ -z "$GIT_UPSTREAM" ]]; then
        write_warn "Aktueller Branch hat kein Upstream-Tracking."
    else
        write_info "Upstream: $GIT_UPSTREAM"
        write_info "Ahead: $GIT_AHEAD, Behind: $GIT_BEHIND"
    fi

    if [[ "$GIT_BEHIND" -gt 0 ]]; then
        write_warn "Branch ist hinter dem Upstream. Bitte zuerst pull/rebase."
        return
    fi

    if [[ "$GIT_AHEAD" -gt 0 ]] || ask_yesno "Current branch to $cfg_remoteName/$cfg_branch pushen?" "y"; then
        invoke_checked "git push $cfg_remoteName $cfg_branch" git push "$cfg_remoteName" "$cfg_branch"
    else
        write_warn "Push uebersprungen."
    fi
}

invoke_server_deploy() {
    local skip_migrate="${1:-false}"
    local ssh_target="$cfg_serverUser@$cfg_serverHost"
    local flags=""
    [[ "$cfg_forceServerReset" == "true" ]] && flags="$flags --force-reset"
    [[ "$skip_migrate" == "true" ]] && flags="$flags --skip-migrate"

    local force_flag="0"
    [[ "$cfg_forceServerReset" == "true" ]] && force_flag="1"

    local remote_cmd
    remote_cmd="set -e
mkdir -p '$cfg_serverPath'
if [ ! -f '$cfg_serverPath/deploy/server-deploy.sh' ]; then
    if [ -d '$cfg_serverPath/.git' ]; then :
    elif [ -z \"\$(ls -A '$cfg_serverPath' 2>/dev/null)\" ]; then
        git clone --branch '$cfg_branch' '$cfg_repoUrl' '$cfg_serverPath'
    elif [ \"$force_flag\" = \"1\" ]; then
        echo \"WARN: Zielpfad nicht leer, bereinige wegen --force-reset.\"
        find '$cfg_serverPath' -mindepth 1 -maxdepth 1 -exec rm -rf {} +
        git clone --branch '$cfg_branch' '$cfg_repoUrl' '$cfg_serverPath'
    else
        echo \"ERROR: Zielpfad ist nicht leer und deploy/server-deploy.sh fehlt. Erneut mit --force-reset ausfuehren.\"
        exit 1
    fi
fi
if [ ! -f '$cfg_serverPath/.env.production' ]; then
    if [ -f '$cfg_serverPath/.env.production.example' ]; then
        cp '$cfg_serverPath/.env.production.example' '$cfg_serverPath/.env.production'
        chmod 600 '$cfg_serverPath/.env.production'
        echo \"WARN: .env.production wurde aus .env.production.example erstellt. Bitte Werte pruefen.\"
    else
        echo \"ERROR: .env.production fehlt und kein .env.production.example vorhanden.\"
        exit 1
    fi
fi
chmod +x '$cfg_serverPath/deploy/server-deploy.sh'
'$cfg_serverPath/deploy/server-deploy.sh' --repo-url '$cfg_repoUrl' --branch '$cfg_branch' --path '$cfg_serverPath' $flags"

    write_step "Server-Deploy auf $ssh_target"
    invoke_checked "ssh $ssh_target (deploy)" \
        ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "bash -lc ${(q)remote_cmd}"
}

install_nginx_configs() {
    local ssh_target="$cfg_serverUser@$cfg_serverHost"
    local remote_staging="$cfg_serverPath/deploy/nginx"

    write_step "Nginx-Configs auf Server kopieren"

    # Office main config
    local local_config="$REPO_ROOT/$cfg_nginxConfigLocalPath"
    if [[ -f "$local_config" ]]; then
        local remote_staging_file="$remote_staging/$cfg_nginxConfigName"
        local remote_available_file="$cfg_nginxSitesAvailablePath/$cfg_nginxConfigName"
        local remote_enabled_file="$cfg_nginxSitesEnabledPath/$cfg_nginxConfigName"

        invoke_checked "ssh $ssh_target (nginx staging dir)" \
            ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "mkdir -p '$remote_staging'"
        invoke_checked "scp office config -> ${ssh_target}:$remote_staging_file" \
            scp -o StrictHostKeyChecking=accept-new "$local_config" "${ssh_target}:$remote_staging_file"

        local nginx_cmd="set -e; sudo cp '$remote_staging_file' '$remote_available_file'; sudo ln -sfn '$remote_available_file' '$remote_enabled_file'"
        invoke_checked "ssh $ssh_target (nginx install office)" \
            ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "bash -lc ${(q)nginx_cmd}"
    else
        write_warn "Office Nginx-Config nicht gefunden: $local_config"
    fi

    # MinIO config
    local local_minio_config="$REPO_ROOT/$cfg_nginxMinioConfigLocalPath"
    if [[ -f "$local_minio_config" ]]; then
        local remote_minio_staging_file="$remote_staging/$cfg_nginxMinioConfigName"
        local remote_minio_available_file="$cfg_nginxSitesAvailablePath/$cfg_nginxMinioConfigName"
        local remote_minio_enabled_file="$cfg_nginxSitesEnabledPath/$cfg_nginxMinioConfigName"

        invoke_checked "scp minio config -> ${ssh_target}:$remote_minio_staging_file" \
            scp -o StrictHostKeyChecking=accept-new "$local_minio_config" "${ssh_target}:$remote_minio_staging_file"

        local nginx_minio_cmd="set -e; sudo cp '$remote_minio_staging_file' '$remote_minio_available_file'; sudo ln -sfn '$remote_minio_available_file' '$remote_minio_enabled_file'"
        invoke_checked "ssh $ssh_target (nginx install minio)" \
            ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "bash -lc ${(q)nginx_minio_cmd}"
    else
        write_warn "MinIO Nginx-Config nicht gefunden: $local_minio_config"
    fi

    # Test and reload
    local reload_cmd="set -e; sudo nginx -t; sudo systemctl reload nginx"
    invoke_checked "ssh $ssh_target (nginx reload)" \
        ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "bash -lc ${(q)reload_cmd}"
}

restart_server_app() {
    local ssh_target="$cfg_serverUser@$cfg_serverHost"
    local restart_cmd="set -e; cd '$cfg_serverPath'; docker compose -f docker-compose.prod.yml --env-file .env.production up -d"

    write_step "App auf Server neu starten"
    invoke_checked "ssh $ssh_target (app restart)" \
        ssh -o StrictHostKeyChecking=accept-new "$ssh_target" "bash -lc ${(q)restart_cmd}"
}

# ─── Main ────────────────────────────────────────────────────────────────────

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$REPO_ROOT" ]] && fail "Nicht in einem Git-Repository. Bitte im office-Projekt starten."
cd "$REPO_ROOT"

load_config

[[ -z "$cfg_repoUrl" ]] && fail "Repo URL ist erforderlich."
[[ -z "$cfg_remoteName" ]] && fail "Git-Remote-Name ist erforderlich."

show_config

while true; do
    write_step "Office interactive menu"
    echo "${GRAY}  1) Aenderungen nach GitHub pushen${NC}"
    echo "${GRAY}  2) Aenderungen nach GitHub pushen + App auf Server deployen${NC}"
    echo "${GRAY}  3) Deploy-Konfiguration anzeigen/aendern${NC}"
    echo "${GRAY}  4) Beenden${NC}"
    echo "${GRAY}  5) Nur Nginx-Konfiguration auf Server (bei Bedarf)${NC}"
    echo "${GRAY}  6) App auf Server neu starten (kein Build)${NC}"
    choice="$(ask_text "Auswahl" "4")"

    case "$choice" in
        1)
            handle_push_and_version
            ;;
        2)
            handle_push_and_version
            invoke_server_deploy "false"
            ;;
        3)
            edit_config
            show_config
            ;;
        4)
            break
            ;;
        5)
            install_nginx_configs
            ;;
        6)
            restart_server_app
            ;;
        *)
            write_warn "Ungueltige Auswahl."
            ;;
    esac
done

write_step "Fertig."
