# Build dos aplicativos Android/iOS (Capacitor): `npm run app:build`.
# O app embute a interface e lê os dados oficiais do site público, que é atualizado
# por `make publicar`. Assim os dados ficam em dia sem precisar lançar versão nova na loja.
# Se o endereço do site mudar, ajuste as URLs abaixo e publique uma versão nova do app
# (ou mantenha o endereço antigo redirecionando para o novo).
VITE_APP_NAME=Voto Informado
VITE_BASE_PATH=/
VITE_DATA_URL=https://professorbossini.dev/voto-informado
VITE_SITE_URL=https://professorbossini.dev/voto-informado
VITE_SHOW_POWERED_BY=false
VITE_ENABLE_LOGIN=false
VITE_ENABLE_PESQUISAS=false
VITE_AUTH_PROVIDER=mock
