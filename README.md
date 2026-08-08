# NPS Enhanced

A high-performance NAT traversal and reverse proxy server with Web UI.

[![GitHub Stars](https://img.shields.io/github/stars/mcmy/nps2.svg)](https://github.com/mcmy/nps2)
[![GitHub Forks](https://img.shields.io/github/forks/mcmy/nps2.svg)](https://github.com/mcmy/nps2)
[![Release](https://github.com/mcmy/nps2/workflows/Release/badge.svg)](https://github.com/mcmy/nps2/actions)
[![GitHub All Releases](https://img.shields.io/github/downloads/mcmy/nps2/total)](https://github.com/mcmy/nps2/releases)

> ⭐️ Give us a star on [GitHub](https://github.com/mcmy/nps2) if you like it!

- [中文文档](https://github.com/mcmy/nps2/blob/main/README_zh.md)

---

## Introduction

NPS is a lightweight and efficient NAT traversal and reverse proxy system for exposing services behind NAT or firewalls. It supports multiple protocols such as TCP, UDP, HTTP, HTTPS, and SOCKS5, and provides a Web management interface for convenient deployment and monitoring.

This repository is a fork based on [github.com/djylb/nps](https://github.com/djylb/nps), with the active project address moved to [github.com/mcmy/nps2](https://github.com/mcmy/nps2).

Since the original [NPS](https://github.com/ehang-io/nps) project has been inactive for a long time, this repository continues its development as an actively maintained community version with extensive refactoring, improved stability, and enhanced functionality.

- **Before asking questions, please check:** [Documentation](https://d-jy.net/docs/nps/) and [Issues](https://github.com/mcmy/nps2/issues)
- **Contributions welcome:** Submit PRs, provide feedback or suggestions, and help drive the project forward
- **Join the discussion:** Connect with other users in our [Telegram Group](https://t.me/npsdev)
- **Android:** [djylb/npsclient](https://github.com/djylb/npsclient)
- **OpenWrt:** [djylb/nps-openwrt](https://github.com/djylb/nps-openwrt)
- **Mirror:** [djylb/nps-mirror](https://github.com/djylb/nps-mirror)

![NPS Web UI](https://cdn.jsdelivr.net/gh/mcmy/nps2/image/web.png)

---

## Key Features

- **Multi-Protocol Support**  
  Supports TCP/UDP forwarding, HTTP/HTTPS reverse proxy, HTTP/SOCKS5 proxy, P2P mode, Proxy Protocol support, HTTP/3 support, and more for different private-network access scenarios.

- **Cross-Platform Deployment**  
  Compatible with major platforms such as Linux and Windows, and can be easily installed as a system service.

- **Web Management Interface**  
  Provides real-time monitoring of traffic, connection status, and client states with an intuitive and user-friendly interface.

- **Security and Extensibility**  
  Built-in features such as encrypted transmission, traffic limiting, access expiration controls, certificate management, and certificate renewal help improve security and manageability.

- **Multiple Connection Protocols**  
  Supports connecting to the server using TCP, KCP, TLS, QUIC, WS, and WSS protocols.

---

## Installation and Usage

For more detailed configuration options, please refer to the [Documentation](https://d-jy.net/docs/nps/) (some sections may be outdated).

### [Android](https://github.com/djylb/npsclient) | [OpenWrt](https://github.com/djylb/nps-openwrt)

### Docker Deployment

**Docker Hub (default):** [NPS](https://hub.docker.com/r/gitmcmy/nps) | [NPC](https://hub.docker.com/r/gitmcmy/npc)

**GHCR (backup):** [NPS](https://github.com/mcmy/nps2/pkgs/container/nps) | [NPC](https://github.com/mcmy/nps2/pkgs/container/npc)

> If you need to obtain the real client IP, you can use it together with [mmproxy](https://github.com/djylb/mmproxy-docker). For example: SSH.

#### NPS Server

```bash
docker pull gitmcmy/nps
docker run -d --restart=always --name nps --net=host -v $(pwd)/conf:/conf -v /etc/localtime:/etc/localtime:ro gitmcmy/nps
```

GHCR fallback:

```bash
docker pull ghcr.io/mcmy/nps
docker run -d --restart=always --name nps --net=host -v $(pwd)/conf:/conf -v /etc/localtime:/etc/localtime:ro ghcr.io/mcmy/nps
```

> **Tip:** After installing NPS, edit `nps.conf` (for example: listening ports and Web admin credentials) before starting the service.

#### NPC Client

```bash
docker pull gitmcmy/npc
docker run -d --restart=always --name npc --net=host gitmcmy/npc -server=xxx:123,yyy:456 -vkey=key1,key2 -type=tls,tcp -log=off
```

GHCR fallback:

```bash
docker pull ghcr.io/mcmy/npc
docker run -d --restart=always --name npc --net=host ghcr.io/mcmy/npc -server=xxx:123,yyy:456 -vkey=key1,key2 -type=tls,tcp -log=off
```

> **Tip:** Get `-server`, `-vkey`, and `-type` from the client page in the NPS Web UI to avoid manual input mistakes.

### Server Installation

#### Linux

```bash
# Install (default configuration path: /etc/nps/; binary file path: /usr/bin/)
wget -qO- https://raw.githubusercontent.com/mcmy/nps2/refs/heads/main/install.sh | sudo sh -s nps
nps install
nps start|stop|restart|uninstall

# Update
nps update && nps restart
```

> **Tip:** For first-time setup, edit `/etc/nps/nps.conf` and verify it before running `nps start`.

#### Windows

> Windows 7 users should use the version ending with old: [64](https://github.com/mcmy/nps2/releases/latest/download/windows_amd64_server_old.tar.gz) / [32](https://github.com/mcmy/nps2/releases/latest/download/windows_386_server_old.tar.gz)

```powershell
.\nps.exe install
.\nps.exe start|stop|restart|uninstall

# Update
.\nps.exe stop
.\nps-update.exe update
.\nps.exe start
```

### Client Installation

#### Linux

```bash
wget -qO- https://raw.githubusercontent.com/mcmy/nps2/refs/heads/main/install.sh | sudo sh -s npc
/usr/bin/npc install -server=xxx:123,yyy:456 -vkey=xxx,yyy -type=tls -log=off
npc start|stop|restart|uninstall

# Update
npc update && npc restart
```

> **Tip:** For `npc install`, use the command generated on the client page in the NPS Web UI.

#### Windows

> Windows 7 users should use the version ending with old: [64](https://github.com/mcmy/nps2/releases/latest/download/windows_amd64_client_old.tar.gz) / [32](https://github.com/mcmy/nps2/releases/latest/download/windows_386_client_old.tar.gz)

```powershell
.\npc.exe install -server="xxx:123,yyy:456" -vkey="xxx,yyy" -type="tls,tcp" -log="off"
.\npc.exe start|stop|restart|uninstall

# Update
.\npc.exe stop
.\npc-update.exe update
.\npc.exe start
```

> **Tip:** The client supports connecting to multiple servers simultaneously. Example:
> `npc -server=xxx:123,yyy:456,zzz:789 -vkey=key1,key2,key3 -type=tcp,tls`
> Here, `xxx:123` uses TCP, and `yyy:456` and `zzz:789` use TLS.

> If you need to connect to older server versions, add `-proto_version=0` to the startup command.
