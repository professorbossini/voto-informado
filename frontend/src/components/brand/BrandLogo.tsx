import { useState } from 'react';
import { ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { brand } from '@/config/brand';
import { BrandMark } from './BrandMark';
import { NamePlaceholder } from './BrandPlaceholder';
import { BrandSetupDialog } from './BrandSetupDialog';

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large';
}

const sizes = {
  small: { mark: 32, font: '1.125rem' },
  medium: { mark: 40, font: '1.375rem' },
  large: { mark: 48, font: '1.625rem' },
} as const;

/**
 * Your app's logo + name. While either is missing, renders transparent
 * placeholders that open a short "how to customize" guide when clicked.
 */
export function BrandLogo({ size = 'medium' }: BrandLogoProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const s = sizes[size];

  const content = (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <BrandMark size={s.mark} />
      {brand.name ? (
        <Typography
          component="span"
          sx={{
            fontSize: s.font,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontVariationSettings: "'ROND' 100",
          }}
        >
          {brand.name}
        </Typography>
      ) : (
        <NamePlaceholder fontSize={`calc(${s.font} * 0.8)`} />
      )}
    </Stack>
  );

  if (!brand.needsSetup) return content;

  return (
    <>
      <Tooltip title="Personalize sua marca">
        <ButtonBase
          onClick={() => setHelpOpen(true)}
          aria-label="Personalize sua marca"
          sx={(theme) => ({
            borderRadius: 3,
            p: 0.5,
            m: -0.5,
            '&:hover .brand-placeholder, &.Mui-focusVisible .brand-placeholder': {
              borderColor: theme.vars.palette.primary.main,
              color: theme.vars.palette.primary.main,
              bgcolor: theme.alpha(theme.vars.palette.primary.main, 0.06),
            },
          })}
        >
          {content}
        </ButtonBase>
      </Tooltip>
      <BrandSetupDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
