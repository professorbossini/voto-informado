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

  it('links the corner badge to Bossini Labs, as the single image with the text embedded', () => {
    renderThemed(<PoweredByFaisca />);
    const link = screen.getByRole('link', { name: 'Powered by Faísca, da Bossini Labs' });
    expect(link).toHaveAttribute('href', FAISCA_URL);
    expect(FAISCA_URL).toBe('https://bossinilabs.com.br');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    const img = screen.getByRole('img', { name: 'Bossini Labs · Powered by Faísca' });
    expect(link).toContainElement(img);
    expect(img).toHaveAttribute('height', '40');
    expect(img).toHaveAttribute('width', '114');
    expect(link).toHaveTextContent('');
  });

  it('credits Faísca in the footer with only the Bossini Labs image, linking to Bossini Labs', () => {
    renderThemed(<FaiscaCredito />);
    const link = screen.getByRole('link', { name: 'Powered by Faísca, da Bossini Labs' });
    expect(link).toHaveAttribute('href', FAISCA_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    const img = screen.getByRole('img', { name: 'Bossini Labs · Powered by Faísca' });
    expect(link).toContainElement(img);
    expect(img).toHaveAttribute('height', '48');
    expect(img).toHaveAttribute('width', '137');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img.getAttribute('src')).toMatch(/bossini-labs-powered-by-faisca/);
    expect(link).toHaveTextContent('');
  });
});
