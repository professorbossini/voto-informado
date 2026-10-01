import { useState } from 'react';
import { IconButton, InputAdornment, Tooltip } from '@mui/material';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { FormField, type FormFieldProps } from './FormField';

export function PasswordField(props: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Ocultar senha' : 'Mostrar senha';

  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        ...props.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={label}>
                <IconButton
                  aria-label={label}
                  onClick={() => setVisible((v) => !v)}
                  onMouseDown={(e) => e.preventDefault()}
                  edge="end"
                  size="small"
                >
                  {visible ? (
                    <VisibilityOffOutlined fontSize="small" />
                  ) : (
                    <VisibilityOutlined fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
