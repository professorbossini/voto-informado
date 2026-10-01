import { useMemo } from 'react';
import { MenuItem, Stack, TextField, useMediaQuery, useTheme } from '@mui/material';
import { UfTileMap } from '@/components/election/UfTileMap';
import { useMeta } from '@/data/MetaContext';

/** Select + tile map for choosing the voter's UF. Alphabetical by state name. */
export function UfPicker({
  value,
  onChange,
  showMap = true,
  label = 'Estado onde você vota',
}: {
  value: string | null;
  onChange: (uf: string) => void;
  showMap?: boolean;
  label?: string;
}) {
  const { meta } = useMeta();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  const ufs = useMemo(
    () => (meta?.ufs ?? []).filter((u) => u.uf !== 'BR').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [meta],
  );
  const names = useMemo(() => Object.fromEntries(ufs.map((u) => [u.uf, u.nome])), [ufs]);

  return (
    <Stack spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <TextField
        select
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        sx={{ minWidth: 260, maxWidth: '100%' }}
        disabled={!ufs.length}
        helperText={!ufs.length ? 'Carregando estados…' : undefined}
      >
        {ufs.map((u) => (
          <MenuItem key={u.uf} value={u.uf}>
            {u.nome} ({u.uf})
          </MenuItem>
        ))}
      </TextField>
      {showMap && <UfTileMap selected={value} onSelect={onChange} names={names} size={narrow ? 38 : 44} />}
    </Stack>
  );
}
