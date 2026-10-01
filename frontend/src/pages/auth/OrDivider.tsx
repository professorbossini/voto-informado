import { Divider, Typography } from '@mui/material';

export function OrDivider() {
  return (
    <Divider sx={{ my: 3, '&::before, &::after': { borderColor: 'divider' } }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
        ou
      </Typography>
    </Divider>
  );
}
