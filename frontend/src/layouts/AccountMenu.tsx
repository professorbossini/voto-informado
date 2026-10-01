import { useState } from 'react';
import {
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ManageAccountsRounded from '@mui/icons-material/ManageAccountsRounded';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth';
import { useNotify } from '@/components/feedback/notificationsContext';
import { UserAvatar } from '@/components/UserAvatar';

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleSignOut = async () => {
    setAnchor(null);
    await signOut();
    notify('Você saiu da sua conta.');
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Abrir menu da conta"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{ borderRadius: '50%', ml: 0.5 }}
      >
        <UserAvatar user={user} sx={{ width: 36, height: 36 }} />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260 } } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ px: 1.5, py: 1.25, alignItems: 'center' }}>
          <UserAvatar user={user} sx={{ width: 40, height: 40 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {user?.name ?? 'Usuário'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {user?.email}
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void navigate('/account');
          }}
        >
          <ListItemIcon>
            <ManageAccountsRounded fontSize="small" />
          </ListItemIcon>
          Minha conta
        </MenuItem>
        <MenuItem onClick={() => void handleSignOut()}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </>
  );
}
