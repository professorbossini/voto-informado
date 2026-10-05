import { getApps } from 'firebase/app';
import { aoEscrever, aplicarRemoto, lerBruto } from '@/data/localStore';
import { cifrar, decifrar, derivarChave, esquecerChave, guardarChave, lerChave, novoSal } from './cripto';

/**
 * Perfil sincronizado (login opcional): as escolhas guardadas no aparelho vão para o
 * Firestore CRIPTOGRAFADAS (data/sync/cripto). Documento perfis/<uid> com só
 * { cifra, iv, sal, versao, atualizado_em, consentimento_em }; as regras do banco
 * só deixam cada conta ler e gravar o próprio documento.
 */

/** Escolhas sincronizadas: acompanhados, cola, comparação, estado, tema e idioma. */
export const CHAVES = ['vi:acompanhar', 'vi:cola', 'vi:comparar', 'vi:uf', 'vi:tema', 'vi:idioma'] as const;

export interface DocPerfil {
  cifra: string;
  iv: string;
  sal: string;
  versao: number;
  atualizado_em: string;
  consentimento_em: string;
}

type Instantaneo = { valores: Record<string, string>; em: string };

async function fs() {
  const { getFirestore, doc, getDoc, setDoc, deleteDoc } = await import('firebase/firestore');
  const app = getApps()[0];
  if (!app) throw new Error('Firebase não inicializado');
  return { db: getFirestore(app), doc, getDoc, setDoc, deleteDoc };
}

export async function lerDoc(uid: string): Promise<DocPerfil | null> {
  const { db, doc, getDoc } = await fs();
  const s = await getDoc(doc(db, 'perfis', uid));
  return s.exists() ? (s.data() as DocPerfil) : null;
}

function instantaneo(): Instantaneo {
  const valores: Record<string, string> = {};
  for (const k of CHAVES) {
    const v = lerBruto(k);
    if (v != null) valores[k] = v;
  }
  return { valores, em: new Date().toISOString() };
}

async function enviar(uid: string, chave: CryptoKey, sal: string, consentimento: string) {
  const { db, doc, setDoc } = await fs();
  const { cifra, iv } = await cifrar(chave, instantaneo());
  const d: DocPerfil = { cifra, iv, sal, versao: 1, atualizado_em: new Date().toISOString(), consentimento_em: consentimento };
  await setDoc(doc(db, 'perfis', uid), d);
}

export type EstadoSync =
  | { fase: 'desligado' }
  | { fase: 'carregando' }
  /** Primeiro acesso: criar a frase de sincronização (depois do consentimento). */
  | { fase: 'criar-frase' }
  /** Já há perfil, mas este aparelho ainda não tem a chave: digitar a frase. */
  | { fase: 'pedir-frase'; doc: DocPerfil }
  | { fase: 'ativo'; atualizadoEm: string }
  | { fase: 'erro'; mensagem: string };

/** Sessão de sincronização de uma conta: aplica o perfil e envia cada mudança (com pausa de 1,5 s). */
export class Sincronizador {
  private parar: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chave: CryptoKey | null = null;
  private doc: DocPerfil | null = null;
  constructor(
    private uid: string,
    private aoMudar: (e: EstadoSync) => void,
  ) {}

  async iniciar(): Promise<void> {
    this.aoMudar({ fase: 'carregando' });
    try {
      this.doc = await lerDoc(this.uid);
      if (!this.doc) return this.aoMudar({ fase: 'criar-frase' });
      const chave = await lerChave(this.uid);
      if (!chave || !(await this.tentar(chave))) return this.aoMudar({ fase: 'pedir-frase', doc: this.doc });
    } catch (e) {
      this.aoMudar({ fase: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Cria o perfil (primeiro acesso) com a frase escolhida e o consentimento dado. */
  async criar(frase: string, consentimentoEm: string): Promise<void> {
    const sal = novoSal();
    const chave = await derivarChave(frase, sal);
    await guardarChave(this.uid, chave);
    this.chave = chave;
    await enviar(this.uid, chave, sal, consentimentoEm);
    this.doc = await lerDoc(this.uid);
    this.ligar();
  }

  /** Desbloqueia neste aparelho com a frase. Devolve false se a frase não confere. */
  async desbloquear(frase: string): Promise<boolean> {
    if (!this.doc) return false;
    const chave = await derivarChave(frase, this.doc.sal);
    if (!(await this.tentar(chave))) return false;
    await guardarChave(this.uid, chave);
    return true;
  }

  private async tentar(chave: CryptoKey): Promise<boolean> {
    if (!this.doc) return false;
    try {
      const remoto = await decifrar<Instantaneo>(chave, this.doc.cifra, this.doc.iv);
      // Mescla: o que veio do perfil prevalece; o que só existe neste aparelho é enviado depois.
      const local = instantaneo().valores;
      aplicarRemoto(remoto.valores);
      this.chave = chave;
      this.ligar();
      if (Object.keys(local).some((k) => !(k in remoto.valores))) this.agendar();
      return true;
    } catch {
      return false;
    }
  }

  private ligar() {
    this.parar?.();
    this.parar = aoEscrever((k) => (CHAVES as readonly string[]).includes(k) && this.agendar());
    this.aoMudar({ fase: 'ativo', atualizadoEm: this.doc?.atualizado_em ?? new Date().toISOString() });
  }

  private agendar() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.chave || !this.doc) return;
      void enviar(this.uid, this.chave, this.doc.sal, this.doc.consentimento_em).then(
        () => this.aoMudar({ fase: 'ativo', atualizadoEm: new Date().toISOString() }),
        (e: unknown) => this.aoMudar({ fase: 'erro', mensagem: e instanceof Error ? e.message : String(e) }),
      );
    }, 1500);
  }

  /** Apaga o perfil do servidor e a chave deste aparelho. */
  async apagarTudo(): Promise<void> {
    this.encerrar();
    const { db, doc, deleteDoc } = await fs();
    await deleteDoc(doc(db, 'perfis', this.uid));
    await esquecerChave(this.uid);
  }

  /** Sai: para de sincronizar e esquece a chave neste aparelho (os dados no aparelho ficam). */
  async sair(): Promise<void> {
    this.encerrar();
    await esquecerChave(this.uid);
  }

  encerrar() {
    this.parar?.();
    this.parar = null;
    if (this.timer) clearTimeout(this.timer);
  }
}
