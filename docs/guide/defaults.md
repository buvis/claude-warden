# Built-in Defaults

Claude Warden ships with sensible defaults for ~100 common commands. These apply out of the box and can be overridden via `warden.yaml`.

The evaluation order is: **always deny > always allow > conditional rules > default decision (ask)**.

## Always Allowed

These commands run without prompts. They are read-only or safe by nature.

### File operations

`cat` `head` `tail` `less` `more` `wc` `sort` `uniq` `diff` `comm` `cut` `paste` `tr` `fold` `expand` `unexpand` `column` `rev` `tac` `nl` `od` `xxd` `file` `stat`

### Search

`grep` `egrep` `fgrep` `rg` `ag` `ack` `fd` `fzf` `locate` `which` `whereis` `type` `command`

### Directory listing

`ls` `dir` `tree` `exa` `eza` `lsd`

### Path and string utilities

`basename` `dirname` `realpath` `readlink` `echo` `printf` `true` `false` `test` `[`

### Date and time

`date` `cal`

### Environment info

`env` `printenv` `uname` `hostname` `whoami` `id` `pwd`

### Process viewing

`ps` `top` `htop` `uptime` `free` `df` `du` `lsof` `pgrep` `pidof` `jobs`

### Text processing

`jq` `yq` `seq`

### Network diagnostics

`nslookup` `dig` `host` `ping` `traceroute` `mtr` `netstat` `ss` `ifconfig` `ip` `nmap` `arp`

### Pagers and formatters

`bat` `pygmentize` `highlight`

### Version managers

`nvm` `fnm` `rbenv` `pyenv`

### Terminal

`stty` `tput` `reset` `clear`

### System and hardware info

`lscpu` `lsblk` `lsusb` `lspci` `lsmod` `dmesg` `sysctl` `sw_vers` `system_profiler` `hostinfo` `lsb_release` `hostnamectl` `arch` `getconf`

### User and group info

`groups` `getent` `w` `last` `lastlog` `finger` `users`

### Compression and archive

`tar` `gzip` `gunzip` `bzip2` `bunzip2` `xz` `unxz` `zip` `unzip` `7z` `zcat` `bzcat` `xzcat` `zless` `zmore` `zgrep`

### Clipboard

`pbcopy` `pbpaste` `xclip` `xsel` `wl-copy` `wl-paste`

### Binary analysis

`strings` `nm` `objdump` `readelf` `ldd` `otool` `size`

### ImageMagick

`magick` `convert` `identify` `mogrify` `composite` `montage` `compare` `conjure` `stream`

### macOS utilities

`mdfind` `mdls` `mdutil` `plutil` `sips` `xcode-select` `xcrun` `xcodebuild` `networkQuality`

### Shell builtins

`cd` `pushd` `popd` `dirs` `hash` `alias` `set` `unset`

### File management

`mkdir` `touch` `cp` `mv` `ln`

### Build tools

`make` `cmake` `tsc` `turbo` `nx` `lerna`

### Languages and compilers

`rustup` `swift` `swiftc` `zig` `javac` `pip` `pip3` `brew`

### Other

`sleep` `wait` `time` `md5` `md5sum` `sha256sum` `shasum` `cksum` `base64` `watch` `timeout` `nohup` `nice` `iconv` `locale` `localedef` `numfmt` `factor` `bc` `dc` `curl` `wget`

## Always Denied

These commands are always blocked, regardless of arguments or configuration.

| Category | Commands |
|---|---|
| Privilege escalation | `sudo` `su` `doas` |
| Code evaluation | `eval` |
| Disk/filesystem | `mkfs` `fdisk` `dd` `wipefs` `shred` |
| Power management | `shutdown` `reboot` `halt` `poweroff` |
| Firewall | `iptables` `ip6tables` `nft` |
| User management | `useradd` `userdel` `usermod` `groupadd` `groupdel` |
| Scheduled tasks | `crontab` |
| Service management | `systemctl` `service` `launchctl` |

## Conditional Rules

These commands have argument-aware rules. The **default** column shows what happens when no argument pattern matches.

### Version control

| Command | Default | Conditions |
|---|---|---|
| `git` | allow | **ask**: `push --force`/`-f`, `reset --hard`, `clean` |
| `gh` | allow | **ask**: `repo delete`, `repo archive` |

### Node.js ecosystem

| Command | Default | Conditions |
|---|---|---|
| `node` | ask | -- |
| `tsx` | ask | -- |
| `ts-node` | ask | -- |
| `npx` `bunx` `pnpx` | ask | **allow**: ~50 well-known dev tools (jest, vitest, tsc, eslint, prettier, next, vite, playwright, etc.). **ask**: script runners (nodemon) |
| `npm` | ask | **allow**: install, add, remove, run, test, build, init, ci, search, etc. **ask**: publish, unpublish, deprecate, owner, access, token, adduser, login, logout |
| `pnpm` | ask | **allow**: install, add, remove, run, test, build, init, store, fetch, etc. **ask**: registry operations |
| `yarn` | ask | **allow**: install, add, remove, run, test, build, init, up, dlx, workspaces, etc. **ask**: registry operations |
| `bun` | ask | **allow**: standard package commands + well-known dev tools. **ask**: script runners |

### Python

| Command | Default | Conditions |
|---|---|---|
| `python` `python3` | ask | -- |
| `pip` `pip3` | allow | -- |
| `uv` | ask | **allow**: pip, venv, init, add, remove, lock, sync, tree, cache, self, version, help, python, export. **ask**: publish |
| `pipx` | ask | -- |

### File operations

| Command | Default | Conditions |
|---|---|---|
| `rm` | ask | **allow**: up to 3 args, non-recursive. **ask**: `-r`, `-rf` |
| `chmod` | ask | **deny**: `-R 777` |
| `chown` | ask | -- |

### Text and file tools

| Command | Default | Conditions |
|---|---|---|
| `sed` | allow | **ask**: `-i`, `--in-place` |
| `awk` | allow | **ask**: `system()`, `getline`, `print >` |
| `xargs` | ask | **allow**: bare xargs (no args) |
| `tee` | allow | **ask**: writes to system directories (`/etc`, `/usr`, `/var`, `/sys`, `/proc`, `/boot`, `/root`, `/lib`) |
| `openssl` | allow | **ask**: `enc`, `rsautl`, `pkeyutl`, `smime`, `cms` |
| `find` | allow | **ask**: `-exec`, `-execdir`, `-delete`, `-ok`, `-okdir`. The `-exec` command is recursively evaluated against all rules |

### Network

| Command | Default | Conditions |
|---|---|---|
| `curl` | allow | -- |
| `wget` | allow | -- |
| `ssh` | ask | -- |
| `scp` | ask | -- |
| `rsync` | ask | -- |

### Build tools and languages

| Command | Default | Conditions |
|---|---|---|
| `cargo` | allow | **ask**: publish, login, logout, owner, yank |
| `go` | allow | **ask**: `generate` |
| `dotnet` | allow | **ask**: publish, nuget |
| `swift` | allow | -- |

### Docker and Kubernetes

| Command | Default | Conditions |
|---|---|---|
| `docker` | ask | **allow**: ps, images, logs, inspect, stats, top, version, info. **ask**: build, run, compose, exec, pull, stop, start, restart, create, system prune |
| `docker-compose` | ask | -- |
| `kubectl` | ask | **allow**: get, describe, logs, top, explain, api-resources, api-versions, version, config, cluster-info. **ask**: delete, drain, cordon, taint |

### Infrastructure and cloud

| Command | Default | Conditions |
|---|---|---|
| `terraform` | ask | **allow**: plan, validate, fmt, show, state, output, providers, version, graph, console |
| `fly` `flyctl` | ask | **allow**: status, logs, info, version, platform, doctor, dig, apps list. **ask**: deploy, destroy, scale, secrets |
| `gcloud` | ask | **allow**: info, version, help, config, components, list, describe, get-iam-policy, get |
| `az` | ask | **allow**: list, show, get |
| `aws` | ask | **allow**: describe, list, get, sts |
| `helm` | ask | **allow**: list, search, show, status, get, template, version, env, history |

### Package managers (system)

| Command | Default | Conditions |
|---|---|---|
| `brew` | allow | -- |
| `apt` `apt-get` | ask | -- |
| `yum` `dnf` `pacman` | ask | -- |

### Shell

| Command | Default | Conditions |
|---|---|---|
| `bash` `sh` `zsh` | ask | **allow**: `--version`, `--help` |
| `source` `.` | ask | **allow**: common dotfiles (`.bashrc`, `.zshrc`, `.profile`, `.bash_profile`, `.zprofile`, `.shrc`, `nvm.sh`, `.envrc`, `.env`). **deny**: no-argument invocation |
| `export` | allow | **ask**: `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_*` vars, `PATH` replacement. **allow**: `PATH` extension (preserves `$PATH`) |

### Editors

| Command | Default | Conditions |
|---|---|---|
| `vi` `vim` `nvim` `nano` `emacs` | ask | **allow**: `--version`, `--help` |

### Scripting languages

| Command | Default | Conditions |
|---|---|---|
| `perl` | ask | -- |
| `ruby` `php` | ask | **ask**: `-e`, `--eval`. **allow**: `--version`, `--help` |
| `java` | ask | **allow**: `--version`, `--help` |

### Databases

| Command | Default | Conditions |
|---|---|---|
| `psql` `mysql` `mariadb` `sqlite3` `redis-cli` `mongosh` | ask | **allow**: `--version`, `--help` |

### Process management

| Command | Default | Conditions |
|---|---|---|
| `kill` `killall` `pkill` `renice` | ask | -- |

### Multiplexers

| Command | Default | Conditions |
|---|---|---|
| `screen` `tmux` | ask | **allow**: list-sessions, ls, list |

### Security

| Command | Default | Conditions |
|---|---|---|
| `gpg` | ask | **allow**: `--verify`, `--list-keys`, `--list-secret-keys`, `--fingerprint` |
| `codesign` | ask | **allow**: `--verify`, `--display`, `-vv`, `-d` |

### macOS-specific

| Command | Default | Conditions |
|---|---|---|
| `defaults` | ask | **allow**: read, read-type, find, domains |
| `diskutil` | ask | **allow**: list, info, apfs, cs, appleRAID |
| `networksetup` | ask | **allow**: `-get*`, `-list*`, `-show*` flags |
| `scutil` | ask | **allow**: `--get`, `--dns`, `--proxy`, `--nwi` |
| `osascript` | ask | -- |
| `say` | ask | -- |
| `open` | ask | -- |

### Other

| Command | Default | Conditions |
|---|---|---|
| `claude` | ask | **allow**: `--version`, `--help`, read-only plugin commands (plugin list, help, validate, marketplace list/help) |

## Unlisted commands

Any command not listed above gets the global `defaultDecision`, which is **ask** unless overridden in your `warden.yaml`.
