import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { FAISCA_URL } from '@/config/brand';
import { theme } from '@/theme';
import { BrandLogo } from './BrandLogo';
import { PoweredByFaisca } from './PoweredByFaisca';
import { FaiscaCredito } from './FaiscaCredito';

const renderThemed = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('brand placeholders', () => {
  it('opens the customization guide from the placeholder', async () => {
    const user = userEvent.setup();
    renderThemed(<BrandLogo />);

    expect(screen.getByText('Seu app')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Personalize sua marca' }));

    expect(
      await screen.findByRole('dialog', { name: 'Personalize sua marca' }),
    ).toBeInTheDocument();
    expect(screen.getByText('src/brand/logo.svg')).toBeInTheDocument();
    expect(screen.getByText(/VITE_APP_LOGO_URL=/)).toBeInTheDocument();
  });

  it('links the "Powered by Faísca" badge to Bossini Labs', () => {
    renderThemed(<PoweredByFaisca />);
    const link = screen.getByRole('link', { name: 'Powered by Faísca, da Bossini Labs' });
    expect(link).toHaveAttribute('href', FAISCA_URL);
    expect(FAISCA_URL).toBe('https://bossinilabs.com.br');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveTextContent('Powered by Faísca');
  });

  it('shows the Bossini Labs icon in the badge', () => {
    renderThemed(<PoweredByFaisca />);
    const link = screen.getByRole('link', { name: 'Powered by Faísca, da Bossini Labs' });
    expect(link.querySelector('[data-marca="bossini-labs"]')).not.toBeNull();
  });

  it('credits Faísca in the footer as the Bossini Labs icon + "Powered by Faísca", linking to Bossini Labs', () => {
    renderThemed(<FaiscaCredito />);
    const link = screen.getByRole('link', { name: 'Powered by Faísca, da Bossini Labs' });
    expect(link).toHaveAttribute('href', FAISCA_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveTextContent('Powered by Faísca');
    expect(link.querySelector('[data-marca="bossini-labs"]')).not.toBeNull();
  });
});
