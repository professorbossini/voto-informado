import { Alert, AlertTitle, Stack, type SxProps, type Theme } from '@mui/material';
import type { AvisoGastos } from '@/data/types';
import { avisosRelevantes, isLacuna, type CasaFiltro } from './gastos';

/** Drops the "Lacuna na fonte oficial:" prefix (it becomes the alert title) and re-capitalizes. */
function semPrefixo(texto: string): string {
  const t = texto.replace(/^Lacuna na fonte oficial:\s*/i, '');
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

/**
 * Notices published with the spending data, filtered by house and years.
 * Source gaps are warnings; methodology notes are info. When the gap is neutralized
 * (travel tickets excluded from totals), the gap notice is shown as info with that remark.
 */
export function AvisosAlerts({
  avisos,
  casa,
  anos,
  lacunaNeutralizada = false,
  sx,
}: {
  avisos: AvisoGastos[] | undefined;
  casa: CasaFiltro;
  anos: number[];
  lacunaNeutralizada?: boolean;
  sx?: SxProps<Theme>;
}) {
  const lista = avisosRelevantes(avisos, casa, anos);
  if (!lista.length) return null;
  const ordenada = [...lista.filter(isLacuna), ...lista.filter((a) => !isLacuna(a))];
  return (
    <Stack spacing={1} sx={sx}>
      {ordenada.map((a) => {
        const lacuna = isLacuna(a);
        const warning = lacuna && !lacunaNeutralizada;
        return (
          <Alert key={a.texto} severity={warning ? 'warning' : 'info'} variant="standard">
            {lacuna && <AlertTitle>{warning ? 'Lacuna na fonte oficial' : 'Lacuna na fonte oficial (neutralizada nesta visão)'}</AlertTitle>}
            {semPrefixo(a.texto)}
            {lacuna && lacunaNeutralizada && ' As categorias de passagens estão excluídas dos totais exibidos, então esta lacuna não afeta os valores abaixo.'}
          </Alert>
        );
      })}
    </Stack>
  );
}
