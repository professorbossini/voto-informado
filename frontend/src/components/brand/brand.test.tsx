import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { FAISCA_REPO_URL } from '@/config/brand';
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

  it('links the "feito com Faísca" badge to the template repository', () => {
    renderThemed(<PoweredByFaisca />);
    const link = screen.getByRole('link', { name: /feito com faísca/i });
    expect(link).toHaveAttribute('href', FAISCA_REPO_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the Bossini mark next to the Faísca name in the badge', () => {
    renderThemed(<PoweredByFaisca />);
    const link = screen.getByRole('link', { name: /feito com faísca/i });
    expect(link.querySelector('[data-marca="bossini"]')).not.toBeNull();
  });

  it('credits Faísca in the footer as "Powered by" + logo + name, linking to the template', () => {
    renderThemed(<FaiscaCredito />);
    const link = screen.getByRole('link', { name: /powered by faísca/i });
    expect(link).toHaveAttribute('href', FAISCA_REPO_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('Powered by');
    expect(link).toHaveTextContent('Faísca');
  });
});
