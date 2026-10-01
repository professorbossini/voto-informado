import { useMemo, useState } from 'react';
import { Autocomplete, Box, InputAdornment, TextField, Typography, type SxProps, type Theme } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { data } from '@/data/api';
import { CARGO_LABEL, nomeProprio, normalize } from '@/data/format';
import type { BuscaItem, Cargo } from '@/data/types';

interface Option {
  sq: string;
  nomeUrna: string;
  nome: string;
  numero: string;
  uf: string;
  cargo: Cargo;
  partido: string;
  key: string;
}

/**
 * Search every candidacy on the ballot by name or number. The index (~20k rows)
 * is fetched on first focus only.
 */
export function CandidateSearch({
  onPick,
  placeholder = 'Busque por nome ou número',
  filter,
  size = 'medium',
  sx,
  autoFocus,
}: {
  onPick: (sq: string, item: Option) => void;
  placeholder?: string;
  filter?: (item: Option) => boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
  autoFocus?: boolean;
}) {
  const [items, setItems] = useState<Option[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  const load = () => {
    if (items || loading) return;
    setLoading(true);
    data
      .busca()
      .then((rows: BuscaItem[]) =>
        setItems(
          rows.map(([sq, nomeUrna, nome, numero, uf, cargo, partido]) => ({
            sq, nomeUrna, nome, numero, uf, cargo, partido,
            key: normalize(`${nomeUrna} ${nome} ${numero}`),
          })),
        ),
      )
      .finally(() => setLoading(false));
  };

  const options = useMemo(() => {
    const q = normalize(input);
    if (!items || q.length < 2) return [];
    const terms = q.split(/\s+/);
    const out: Option[] = [];
    for (const it of items) {
      if (filter && !filter(it)) continue;
      if (terms.every((t) => it.key.includes(t))) {
        out.push(it);
        if (out.length >= 30) break;
      }
    }
    return out;
  }, [items, input, filter]);

  return (
    <Autocomplete<Option>
      sx={sx}
      size={size}
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(o) => nomeProprio(o.nomeUrna)}
      isOptionEqualToValue={(a, b) => a.sq === b.sq}
      onOpen={load}
      onFocus={load}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => {
        if (v) {
          onPick(v.sq, v);
          setInput('');
        }
      }}
      value={null}
      blurOnSelect
      noOptionsText={input.length < 2 ? 'Digite ao menos 2 letras ou números' : 'Nenhuma candidatura encontrada na urna'}
      loadingText="Carregando lista oficial de candidaturas…"
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 52 }}>{o.numero}</Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {nomeProprio(o.nomeUrna)} <Typography component="span" variant="caption" color="text.secondary">({o.partido})</Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {CARGO_LABEL[o.cargo]} · {o.uf === 'BR' ? 'Brasil' : o.uf} · {nomeProprio(o.nome)}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          autoFocus={autoFocus}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}
