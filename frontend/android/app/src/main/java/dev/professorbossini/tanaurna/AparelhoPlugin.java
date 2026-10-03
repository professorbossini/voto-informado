package dev.professorbossini.tanaurna;

import android.content.Context;
import android.graphics.Color;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Recursos do aparelho que o WebView não oferece sozinho. Chamado por src/native/platform.ts.
 */
@CapacitorPlugin(name = "Aparelho")
public class AparelhoPlugin extends Plugin {

    /**
     * window.print() não faz nada no WebView do Android. Abre o diálogo de impressão do sistema
     * (que também oferece "Salvar como PDF") com a página atual, respeitando o CSS @media print.
     */
    @PluginMethod
    public void imprimir(PluginCall call) {
        String titulo = call.getString("titulo", "Tá na Urna");
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintAttributes atributos = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .build();
                printManager.print(titulo, webView.createPrintDocumentAdapter(titulo), atributos);
                call.resolve();
            } catch (Exception e) {
                call.reject("Não foi possível abrir a impressão", e);
            }
        });
    }

    /**
     * Cor atrás das barras do sistema (status e navegação). Em WebViews anteriores ao Chromium 140
     * o Capacitor afasta a página das barras, e o que aparece ali é o fundo da janela: ele precisa
     * acompanhar o tema claro/escuro escolhido no app, não o do sistema.
     */
    @PluginMethod
    public void corDasBarras(PluginCall call) {
        String cor = call.getString("cor");
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().getWindow().getDecorView().setBackgroundColor(Color.parseColor(cor));
                call.resolve();
            } catch (Exception e) {
                call.reject("Cor inválida: " + cor, e);
            }
        });
    }
}
