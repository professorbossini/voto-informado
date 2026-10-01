import { Avatar, type AvatarProps } from '@mui/material';
import type { AuthUser } from '@/auth';
import { initials } from '@/utils/initials';

export function UserAvatar({ user, ...props }: { user: AuthUser | null } & AvatarProps) {
  return (
    <Avatar
      src={user?.photoUrl ?? undefined}
      alt={user?.name ?? user?.email ?? 'Usuário'}
      slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
      {...props}
      sx={[
        { bgcolor: 'primary.main', color: 'primary.contrastText' },
        ...(Array.isArray(props.sx) ? props.sx : [props.sx]),
      ]}
    >
      {initials(user?.name ?? user?.email)}
    </Avatar>
  );
}
