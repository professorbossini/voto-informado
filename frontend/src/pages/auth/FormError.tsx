import { Alert, Collapse } from '@mui/material';

export function FormError({ message }: { message: string | null }) {
  return (
    <Collapse in={Boolean(message)} unmountOnExit>
      <Alert severity="error" sx={{ mb: 2.5 }} role="alert">
        {message}
      </Alert>
    </Collapse>
  );
}
