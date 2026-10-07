"""Avisos de novidade para quem segue um parlamentar, partido ou ministro (botão "Seguir" do site).

As automações (notícias, votações) chamam `enviar(itens)` com o que mudou; o Worker
tanaurna-avisos (infra/cloudflare/avisos) entrega a notificação só para quem segue cada alvo, uma
única vez por `chave`. Autenticação: token OIDC do GitHub Actions (audience "tanaurna-avisos"),
sem senha guardada. Fora do GitHub Actions, não faz nada.

Item: {"alvo": "parlamentar:camara-123", "chave": "...", "titulo": "...", "corpo": "...", "url": "..."}
"""

from __future__ import annotations

import os

import requests

AVISOS = os.environ.get("AVISOS_URL", "https://tanaurna-avisos.insta-publisher.workers.dev").rstrip("/")


def _token() -> str | None:
    url, tok = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not tok:
        return None
    r = requests.get(url, params={"audience": "tanaurna-avisos"}, headers={"Authorization": f"bearer {tok}"}, timeout=30)
    r.raise_for_status()
    return r.json()["value"]


def enviar(itens: list[dict]) -> None:
    if not itens:
        return
    try:
        token = _token()
    except requests.RequestException as exc:
        print(f"novidades: sem token OIDC ({exc}); avisos não enviados")
        return
    if not token:
        print(f"novidades: {len(itens)} itens (fora do GitHub Actions: não enviados)")
        return
    entregues = 0
    for i in range(0, len(itens), 500):
        try:
            r = requests.post(f"{AVISOS}/novidades", json={"itens": itens[i : i + 500]}, headers={"Authorization": f"Bearer {token}"}, timeout=(10, 120))
            r.raise_for_status()
            entregues += sum(x.get("entregues", 0) for x in r.json().get("enviados", []))
        except requests.RequestException as exc:
            print(f"novidades: falha ao enviar ({exc})")
    print(f"novidades: {len(itens)} itens; {entregues} notificações entregues")
