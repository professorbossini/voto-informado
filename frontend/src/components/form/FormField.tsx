import { useId } from 'react';
import { FormLabel, Stack, TextField, type TextFieldProps } from '@mui/material';

export type FormFieldProps = Omit<TextFieldProps, 'label'> & { label: string };

/** TextField with the label above the input, as in the design system. */
export function FormField({ label, id, sx, ...props }: FormFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Stack spacing={1} sx={sx}>
      <FormLabel htmlFor={inputId} error={props.error}>
        {label}
      </FormLabel>
      <TextField id={inputId} fullWidth {...props} />
    </Stack>
  );
}
