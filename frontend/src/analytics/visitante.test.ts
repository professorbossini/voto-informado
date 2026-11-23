import { describe, expect, it } from 'vitest';
import { countryName, describeAgent, placeName } from './visitante';

describe('describeAgent', () => {
  it('lê navegador e sistema', () => {
    expect(
      describeAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome 142', os: 'Windows 10' });
    expect(
      describeAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Mobile Safari 18', os: 'iOS 18.1' });
    expect(
      describeAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ).os,
    ).toBe('macOS');
  });

  it('robô vira "Robô" + nome', () => {
    expect(
      describeAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
        .browser,
    ).toBe('Robô Googlebot');
    expect(describeAgent('curl/8.7.1').browser).toBe('Robô curl');
    expect(describeAgent(null)).toEqual({ browser: '–', os: '–' });
  });
});

describe('local', () => {
  it('nome do país em português e partes que faltam somem', () => {
    expect(countryName('BR')).toBe('Brasil');
    expect(placeName({ city: 'Campinas', region: 'São Paulo', country: 'BR' })).toBe(
      'Campinas, São Paulo, Brasil',
    );
    expect(placeName({ country: 'US' })).toBe('Estados Unidos');
    expect(placeName({})).toBe('–');
  });
});
