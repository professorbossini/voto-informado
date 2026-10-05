/** Idiomas do site: português (original) + 20 traduções. Nome de cada um no próprio idioma. */
export interface Idioma {
  id: string;
  nome: string;
  /** Aviso mostrado no rodapé quando o site está traduzido. */
  aviso: string;
}

export const ORIGINAL = 'pt-BR';

export const IDIOMAS: Idioma[] = [
  { id: 'pt-BR', nome: 'Português (Brasil)', aviso: '' },
  { id: 'en', nome: 'English', aviso: 'Translated version. If anything differs, the Portuguese text prevails. Official data (names, statuses) is shown as published.' },
  { id: 'es', nome: 'Español', aviso: 'Versión traducida. Ante cualquier diferencia, prevalece el texto en portugués. Los datos oficiales (nombres, situaciones) se muestran tal como se publicaron.' },
  { id: 'fr', nome: 'Français', aviso: 'Version traduite. En cas de divergence, le texte portugais fait foi. Les données officielles (noms, statuts) sont affichées telles que publiées.' },
  { id: 'ht', nome: 'Kreyòl ayisyen', aviso: 'Vèsyon tradui. Si gen nenpòt diferans, tèks an pòtigè a ki valab. Done ofisyèl yo (non, sitiyasyon) parèt jan yo te pibliye yo.' },
  { id: 'de', nome: 'Deutsch', aviso: 'Übersetzte Fassung. Bei Abweichungen gilt der portugiesische Text. Amtliche Daten (Namen, Status) werden wie veröffentlicht angezeigt.' },
  { id: 'it', nome: 'Italiano', aviso: 'Versione tradotta. In caso di differenze prevale il testo in portoghese. I dati ufficiali (nomi, stati) sono mostrati come pubblicati.' },
  { id: 'nl', nome: 'Nederlands', aviso: 'Vertaalde versie. Bij verschillen geldt de Portugese tekst. Officiële gegevens (namen, statussen) worden getoond zoals gepubliceerd.' },
  { id: 'sv', nome: 'Svenska', aviso: 'Översatt version. Vid skillnader gäller den portugisiska texten. Officiella uppgifter (namn, status) visas som de publicerats.' },
  { id: 'pl', nome: 'Polski', aviso: 'Wersja przetłumaczona. W razie rozbieżności rozstrzyga tekst portugalski. Dane urzędowe (nazwiska, statusy) są pokazane tak, jak je opublikowano.' },
  { id: 'ro', nome: 'Română', aviso: 'Versiune tradusă. În caz de diferențe, prevalează textul în portugheză. Datele oficiale (nume, situații) sunt afișate așa cum au fost publicate.' },
  { id: 'ru', nome: 'Русский', aviso: 'Переведённая версия. При расхождениях действует текст на португальском. Официальные данные (имена, статусы) показаны так, как опубликованы.' },
  { id: 'uk', nome: 'Українська', aviso: 'Перекладена версія. У разі розбіжностей чинним є текст португальською. Офіційні дані (імена, статуси) показано так, як їх опубліковано.' },
  { id: 'el', nome: 'Ελληνικά', aviso: 'Μεταφρασμένη έκδοση. Σε περίπτωση διαφοράς υπερισχύει το πορτογαλικό κείμενο. Τα επίσημα στοιχεία (ονόματα, καταστάσεις) εμφανίζονται όπως δημοσιεύθηκαν.' },
  { id: 'tr', nome: 'Türkçe', aviso: 'Çevrilmiş sürüm. Herhangi bir farklılıkta Portekizce metin geçerlidir. Resmî veriler (isimler, durumlar) yayımlandığı gibi gösterilir.' },
  { id: 'hi', nome: 'हिन्दी', aviso: 'अनूदित संस्करण। किसी भी अंतर की स्थिति में पुर्तगाली पाठ मान्य होगा। आधिकारिक डेटा (नाम, स्थिति) जैसा प्रकाशित हुआ वैसा ही दिखाया गया है।' },
  { id: 'id', nome: 'Bahasa Indonesia', aviso: 'Versi terjemahan. Jika ada perbedaan, teks berbahasa Portugis yang berlaku. Data resmi (nama, status) ditampilkan sebagaimana diterbitkan.' },
  { id: 'vi', nome: 'Tiếng Việt', aviso: 'Bản dịch. Nếu có khác biệt, văn bản tiếng Bồ Đào Nha có giá trị. Dữ liệu chính thức (tên, tình trạng) được hiển thị như đã công bố.' },
  { id: 'zh', nome: '中文（简体）', aviso: '翻译版本。如有任何差异，以葡萄牙语文本为准。官方数据（姓名、状态）按发布原样显示。' },
  { id: 'ja', nome: '日本語', aviso: '翻訳版です。相違がある場合はポルトガル語の原文が優先されます。公式データ（氏名・状況）は公表どおりに表示しています。' },
  { id: 'ko', nome: '한국어', aviso: '번역본입니다. 차이가 있을 경우 포르투갈어 원문이 우선합니다. 공식 자료(이름, 상태)는 공개된 그대로 표시됩니다.' },
];
