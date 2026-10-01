# Tema, marca e design

O visual é um tema do [MUI](https://mui.com/material-ui/) inspirado no **Material Design 3** e nos materiais de IA do Google: tipografia **Google Sans Flex** com terminais arredondados (eixo `ROND`), paleta lima + violeta e movimento com as curvas oficiais do M3.

## Onde fica cada coisa

| Arquivo                                                                                                                                     | Conteúdo                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`src/theme/tokens.ts`](../src/theme/tokens.ts)                                                                                             | Cores brutas (escalas `lime`, `violet`, `ink`). **Troque a marca aqui.**               |
| [`src/theme/theme.ts`](../src/theme/theme.ts)                                                                                               | Esquemas claro/escuro, tipografia e overrides de todos os componentes                  |
| [`src/theme/motion.ts`](../src/theme/motion.ts)                                                                                             | Tokens de easing e duração do M3, helper `transition()` e opacidades de _state layer_  |
| [`src/theme/augment.d.ts`](../src/theme/augment.d.ts)                                                                                       | Tipos das extensões: cor `lime`, `container`/`onContainer`, variantes `tonal` e `soft` |
| [`src/brand/`](../src/brand/README.md)                                                                                                      | **Seu logo** (`logo.svg`, `.png`...), detectado automaticamente                        |
| [`src/config/brand.ts`](../src/config/brand.ts)                                                                                             | Resolve logo e nome: `VITE_APP_LOGO_URL` → `src/brand/logo.*` → placeholder            |
| [`src/components/brand/FaiscaMark.tsx`](../src/components/brand/FaiscaMark.tsx) + [`public/favicon.svg`](../public/favicon.svg)             | Marca do template Faísca (selo "feito com Faísca" e favicon padrão)                    |
| [`src/components/brand/BossiniMark.tsx`](../src/components/brand/BossiniMark.tsx) + [`public/bossini-mark.svg`](../public/bossini-mark.svg) | Marca Bossini, que acompanha o nome Faísca no selo e no README                         |

A página **/components** do app mostra todos os componentes estilizados: use como referência viva ao montar telas novas.

## Modo claro e escuro

O tema usa **CSS variables** do MUI (`cssVariables: true`), então alternar o modo não re-renderiza a árvore e não há "piscada". O botão no topo alterna entre sistema → claro → escuro e a escolha fica salva no navegador.

No claro o destaque é o **violeta**; no escuro, o **lima**. Botões `color="primary"` se adaptam sozinhos. Para usar lima nos dois modos, use `color="lime"`.

## Extensões do Material 3

```tsx
<Button variant="tonal">Tonal</Button>                     // botão tonal do M3
<Chip variant="soft" color="info" label="Em andamento" />  // chip em cor "container"
<Button color="lime" variant="contained">Pro</Button>      // lima nos dois modos
sx={{ bgcolor: 'primary.container', color: 'primary.onContainer' }}
```

## Feedback visual e movimento

- **State layers**: hover e foco usam a opacidade do M3 (8%/10%) sobre a cor do componente.
- **Pressão**: botões encolhem para 97% com uma mola (`springFast`), como no M3 Expressive.
- **Foco visível**: anel de 2px na cor primária em todos os elementos interativos (acessibilidade por teclado).
- **Switch M3**: o polegar cresce ao ligar e ao pressionar.
- **Transição de página**: _fade through_ com `emphasizedDecelerate` a cada navegação.
- **Splash**: as faíscas do logo cintilam enquanto a sessão é restaurada.
- **`prefers-reduced-motion`**: todas as animações são desligadas para quem pediu isso ao sistema.

Use os tokens nas suas telas:

```ts
import { transition } from '@/theme';
sx={{ transition: transition(['transform', 'opacity'], 'medium2', 'emphasizedDecelerate') }}
```

## Trocando a marca

1. **Logo:** salve em `src/brand/logo.svg` (ou `.png`, `.webp`, `.avif`, `.jpg`), ou aponte `VITE_APP_LOGO_URL` para um link. Ele aparece no cabeçalho, no login, no carregamento, no 404 e como favicon. Enquanto não houver logo, um placeholder tracejado mostra onde ele vai ficar.
2. **Nome:** `VITE_APP_NAME` no `.env` (também vira o título da aba).
3. **Cores:** edite `lime` e `violet` em `tokens.ts` (mantenha a escala 50–900 para que containers e estados continuem harmônicos).
4. **Fonte:** troque o import em `src/main.tsx` e `fontFamily` em `theme.ts`.
5. **Selo "feito com Faísca":** fica no canto inferior, com as marcas do Faísca e do Bossini, e linka para o template. Para esconder, `VITE_SHOW_POWERED_BY=false`; nesse caso, a [licença](../LICENSE) pede o mesmo crédito em outro lugar visível. As marcas não podem ser alteradas.

## Botão do Google

O botão "Entrar com Google" usa o **"G" multicolorido oficial**. As [diretrizes de marca do Google](https://developers.google.com/identity/branding-guidelines) exigem o logo nas cores padrão, e isso é verificado quando o app passa pela verificação OAuth. Estilize o botão à vontade, mas mantenha o "G".
