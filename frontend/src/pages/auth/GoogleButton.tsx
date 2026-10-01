import { Button, CircularProgress } from '@mui/material';
import { GoogleIcon } from '@/components/GoogleIcon';

interface GoogleButtonProps {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function GoogleButton({
  label = 'Entrar com Google',
  loading,
  disabled,
  onClick,
}: GoogleButtonProps) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      size="large"
      fullWidth
      onClick={onClick}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GoogleIcon />}
      sx={(theme) => ({
        borderColor: theme.vars.palette.divider,
        color: theme.vars.palette.text.primary,
        fontWeight: 500,
        bgcolor: 'background.paper',
        '&:hover': {
          borderColor: theme.vars.palette.text.disabled,
          bgcolor: theme.alpha(theme.vars.palette.primary.main, 0.04),
        },
        ...theme.applyStyles('dark', { bgcolor: 'background.subtle' }),
      })}
    >
      {label}
    </Button>
  );
}
